import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).resolve().parent / "data"
RAW_DIR = DATA_DIR / "SisFall_raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Windowing parameters
WINDOW_SIZE = 128   # 128 timesteps (~2.56 sec at 50 Hz downsampled)
STEP_SIZE = 64      # 50% overlap
SAMPLING_DOWNSAMPLE_RATIO = 4  # From 200 Hz to 50 Hz

# Conversion constants for SisFall sensors
ADXL345_CONV = (2.0 * 16.0 / 8192.0) * 9.81   # bits to m/s^2 (±16g, 13 bits)
ITG3200_CONV = (2.0 * 2000.0 / 65536.0)       # bits to deg/s (±2000 deg/s, 16 bits)

CLASS_NAMES = [
    "actividad_normal",       # 0: ADL / Rutina minera
    "posible_caida",          # 1: Impacto / Caída crítica
    "inmovilidad_prolongada",  # 2: Inmovilidad / Atrapamiento
    "movimiento_inusual"      # 3: Sacudida / Resbalón leve
]

def parse_sisfall_file(filepath: Path):
    """
    Lee un archivo de SisFall y extrae [ax, ay, az, gx, gy, gz] en unidades físicas (m/s^2 y deg/s).
    """
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    readings = []
    for line in lines:
        cleaned = line.strip().rstrip(';').rstrip(',')
        if not cleaned:
            continue
        parts = [p.strip() for p in cleaned.split(',') if p.strip()]
        if len(parts) >= 6:
            try:
                # ADXL345: parts[0..2], ITG3200: parts[3..5]
                ax = float(parts[0]) * ADXL345_CONV
                ay = float(parts[1]) * ADXL345_CONV
                az = float(parts[2]) * ADXL345_CONV
                gx = float(parts[3]) * ITG3200_CONV
                gy = float(parts[4]) * ITG3200_CONV
                gz = float(parts[5]) * ITG3200_CONV
                
                # Signal Vector Magnitude (SVM) and Gyro Norm
                svm = np.sqrt(ax**2 + ay**2 + az**2)
                gyro_norm = np.sqrt(gx**2 + gy**2 + gz**2)
                
                readings.append([ax, ay, az, gx, gy, gz, svm, gyro_norm])
            except ValueError:
                continue

    if len(readings) == 0:
        return None

    data = np.array(readings, dtype=np.float32)
    # Downsample from 200 Hz to 50 Hz
    data_downsampled = data[::SAMPLING_DOWNSAMPLE_RATIO]
    return data_downsampled

def determine_window_label(window: np.ndarray, file_code: str) -> int:
    """
    Etiqueta la ventana temporal en base al tipo de actividad y a las características cinemáticas en esa ventana.
    """
    svms = window[:, 6]
    max_svm = np.max(svms)
    min_svm = np.min(svms)
    gyro_norms = window[:, 7]
    max_gyro = np.max(gyro_norms)
    var_svm = np.var(svms)

    is_fall_file = file_code.startswith('F')
    
    # 1. Fall impact detected in window
    if (max_svm > 24.0 or (max_svm > 20.0 and max_gyro > 220.0)) and is_fall_file:
        return 1  # posible_caida
    
    # 2. Prolonged immobility (low variance, static gravity)
    if var_svm < 0.04 and 8.0 < np.mean(svms) < 11.5 and max_gyro < 15.0:
        if file_code in ['D08', 'D09', 'D13'] or is_fall_file:
            return 2  # inmovilidad_prolongada
            
    # 3. Unusual movement (high vibrations without full free fall)
    if max_svm > 17.0 or max_gyro > 180.0 or var_svm > 6.0:
        return 3  # movimiento_inusual
        
    # 4. Normal Activity
    return 0  # actividad_normal

def process_all_files():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    txt_files = list(RAW_DIR.glob("**/*.txt"))
    print(f"[Preprocesamiento] Procesando {len(txt_files)} archivos de SisFall...")
    
    windows_list = []
    labels_list = []
    
    for idx, fpath in enumerate(txt_files):
        activity_code = fpath.stem.split('_')[0].upper()
        data = parse_sisfall_file(fpath)
        if data is None or len(data) < WINDOW_SIZE:
            continue
            
        n_samples = len(data)
        for start_idx in range(0, n_samples - WINDOW_SIZE + 1, STEP_SIZE):
            window = data[start_idx : start_idx + WINDOW_SIZE] # shape: (128, 8)
            label = determine_window_label(window, activity_code)
            
            windows_list.append(window)
            labels_list.append(label)
            
    X = np.array(windows_list, dtype=np.float32)
    y = np.array(labels_list, dtype=np.int32)
    
    print(f"\n[Preprocesamiento] Total de ventanas generadas: {X.shape[0]}")
    print(f"[Preprocesamiento] Forma de entrada (X): {X.shape} -> (Muestras, Timesteps={WINDOW_SIZE}, Canales={X.shape[2]})")
    
    # Distribution of classes
    unique, counts = np.unique(y, return_counts=True)
    dist = dict(zip([CLASS_NAMES[u] for u in unique], counts.tolist()))
    print(f"[Preprocesamiento] Distribución de Clases:")
    for k, v in dist.items():
        print(f"  - {k}: {v} ventanas ({v/len(y)*100:.1f}%)")

    # Stratified Train (70%), Val (15%), Test (15%) Split
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    # Save numpy datasets
    np.save(PROCESSED_DIR / "X_train.npy", X_train)
    np.save(PROCESSED_DIR / "y_train.npy", y_train)
    np.save(PROCESSED_DIR / "X_val.npy", X_val)
    np.save(PROCESSED_DIR / "y_val.npy", y_val)
    np.save(PROCESSED_DIR / "X_test.npy", X_test)
    np.save(PROCESSED_DIR / "y_test.npy", y_test)

    metadata = {
        "dataset_name": "SisFall Benchmark Preprocessed",
        "sampling_rate_hz": 50,
        "window_size": WINDOW_SIZE,
        "step_size": STEP_SIZE,
        "channels": [
            "accel_x", "accel_y", "accel_z",
            "gyro_x", "gyro_y", "gyro_z",
            "svm", "gyro_norm"
        ],
        "class_mapping": {i: name for i, name in enumerate(CLASS_NAMES)},
        "splits": {
            "train": int(X_train.shape[0]),
            "val": int(X_val.shape[0]),
            "test": int(X_test.shape[0]),
            "total": int(X.shape[0]),
        },
        "class_distribution": dist,
    }

    with open(PROCESSED_DIR / "dataset_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\n[Preprocesamiento] [OK] Conjuntos de datos guardados exitosamente en: {PROCESSED_DIR}")
    print(f"  - X_train: {X_train.shape}, y_train: {y_train.shape}")
    print(f"  - X_val:   {X_val.shape}, y_val:   {y_val.shape}")
    print(f"  - X_test:  {X_test.shape}, y_test:  {y_test.shape}")
    print(f"  - Metadatos: {PROCESSED_DIR / 'dataset_metadata.json'}")

if __name__ == "__main__":
    process_all_files()
