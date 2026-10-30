# -*- coding: utf-8 -*-
"""
M-10 · Paso 1-2: Lectura del dataset REAL de SisFall, conversión de unidades,
submuestreo con antialiasing a 50 Hz, ventaneo (128 pasos, 50% solapamiento)
y etiquetado por CÓDIGO DE ACTIVIDAD (sin umbrales de señal).

Decisiones fijas (aprobadas por el usuario):
  - Clase 0 "Normal": todos los ADLs excepto D12, D13, D14 (incluye D11, D18 y D19
    como hard-negatives, y D07-D10 cuyas pausas sentadas son breves).
  - Clase 1 "Posible Caída": SOLO la ventana que contiene el pico de SVM del
    registro (impacto). Las demás ventanas de los registros F## se EXCLUYEN.
  - Clase 2 "Baja actividad (reposo)": SOLO D12, D13, D14. D17 va a Normal.
  - Sin clase 3. Salida del modelo futuro: 3 unidades.
  - Sin normalización global (la normalización se hará solo con el train de cada fold).

Dataset: SisFall (Sucerquia et al., 2017, UDEA) en ml_training/data/SisFall_dataset/
  38 sujetos (SA01-SA23 adultos 19-30 años; SE01-SE15 mayores 60-75 años), 200 Hz,
  columnas: ADXL345 xyz (±16 g, 13 bits) | ITG3200 xyz (±2000 °/s, 16 bits) | MMA8451Q xyz (no usada).

Conversiones (Readme oficial del dataset):
  ADXL345  [g]   = bits * (2*16)   / 2^13
  ITG3200  [°/s] = bits * (2*2000) / 2^16

Si el dataset real no está presente, el pipeline FALLA con un error claro
(sin descarga y sin generación sintética).
"""
import io
import json
import random
import re
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.signal import decimate

# --------------------------------------------------------------- semillas
SEED = 42
np.random.seed(SEED)
random.seed(SEED)

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
DATASET_ROOT = DATA_DIR / "SisFall_dataset"
PROCESSED_DIR = DATA_DIR / "processed"
REPORTS_DIR = ML_DIR / "reports"

# --------------------------------------------------------------- parámetros
FS_RAW = 200          # Hz según Readme oficial
FS_TARGET = 50        # Hz tras decimación (factor 4)
Q_DECIMATE = 4
WINDOW_SIZE = 128     # 2.56 s a 50 Hz
STEP_SIZE = 64        # 50 % de solapamiento

ADXL345_SCALE = (2.0 * 16.0) / (2 ** 13)      # g por count
ITG3200_SCALE = (2.0 * 2000.0) / (2 ** 16)    # °/s por count

REST_ADL_CODES = ("D12", "D13", "D14")   # única fuente de "Baja actividad"
CLASS_NAMES = ["Normal", "Posible_Caida", "Baja_actividad"]

FALL_RE = re.compile(r"^(F\d{2})_(S[AE]\d{2})_R\d{2}\.txt$", re.IGNORECASE)
ADL_RE = re.compile(r"^(D\d{2})_(S[AE]\d{2})_R\d{2}\.txt$", re.IGNORECASE)


def fail_clear_error(msg: str):
    print("\n" + "=" * 70)
    print("[ERROR] " + msg)
    print("=" * 70)
    raise SystemExit(1)


# --------------------------------------------------------------- lectura
def load_record(path: Path) -> np.ndarray:
    """Lee un registro .txt del SisFall real -> (N, 6) float64 [ADXL bits / ITG bits]."""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        txt = f.read()
    txt = txt.replace(";", "\n")            # cada línea termina en ';'
    df = pd.read_csv(io.StringIO(txt), header=None, sep=",",
                     skipinitialspace=True, engine="c", dtype=np.float64)
    df = df.dropna()
    if df.shape[0] == 0 or df.shape[1] < 6:
        raise ValueError(f"Registro sin datos válidos: {path.name}")
    return df.to_numpy(dtype=np.float64)[:, :6]   # ADXL345 xyz + ITG3200 xyz


def convert_units(arr_bits: np.ndarray) -> np.ndarray:
    """bits -> unidades físicas (ADXL345 [g], ITG3200 [°/s])."""
    out = arr_bits.copy()
    out[:, :3] *= ADXL345_SCALE
    out[:, 3:] *= ITG3200_SCALE
    return out


def decimate_to_50hz(arr: np.ndarray) -> np.ndarray:
    """Submuestreo 200 -> 50 Hz con filtro antialiasing FIR"""
    return decimate(arr, Q_DECIMATE, axis=0, ftype="fir", zero_phase=True)


def grid_starts(n50: int):
    if n50 < WINDOW_SIZE:
        return []
    return list(range(0, n50 - WINDOW_SIZE + 1, STEP_SIZE))


# --------------------------------------------------------------- pipeline
def main():
    if not DATASET_ROOT.is_dir():
        fail_clear_error(
            "No se encontró el dataset REAL de SisFall en:\n"
            f"    {DATASET_ROOT}\n"
            "Descarga la versión oficial (v1.0, UDEA/SISTEMIC) con la estructura\n"
            "SA01..SA23 / SE01..SE15 y colócala en esa ruta. Este pipeline NO genera\n"
            "datos sintéticos y NO tiene fallback automático."
        )
    subject_dirs = sorted([d for d in DATASET_ROOT.iterdir()
                           if d.is_dir() and re.match(r"^(SA|SE)\d{2}$", d.name)])
    sa = [d.name for d in subject_dirs if d.name.startswith("SA")]
    se = [d.name for d in subject_dirs if d.name.startswith("SE")]
    if len(subject_dirs) != 38 or len(sa) != 23 or len(se) != 15:
        fail_clear_error(
            f"Se esperaban 38 carpetas de sujetos (23 SA + 15 SE) y hay {len(subject_dirs)}. "
            "Revisa la estructura del dataset real."
        )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    txt_files = sorted(DATASET_ROOT.glob("**/*.txt"))
    txt_files = [f for f in txt_files if FALL_RE.match(f.name) or ADL_RE.match(f.name)]
    print(f"[Paso 1] Dataset real detectado: {len(subject_dirs)} sujetos, "
          f"{len(txt_files)} registros .txt de trabajo.")

    X_list, y_list = [], []
    groups_list, record_list, activity_list = [], [], []
    window_idx_list, peak_pos_list = [], []
    excluded_from_fall = 0
    fall_windows_per_record = {}
    fall_grid_windows = {}
    extra_fall_anchored_windows = 0
    renamed_records = []
    class_counts = {0: 0, 1: 0, 2: 0}
    n_records = 0

    t0 = time.time()
    for k, fpath in enumerate(txt_files, 1):
        fname = fpath.name
        m_f = FALL_RE.match(fname)
        m_a = ADL_RE.match(fname)
        activity = (m_f or m_a).group(1).upper()
        subject = (m_f or m_a).group(2)
        record_id = fname[:-4]

        # Quirk del zip oficial: SA15/ contiene D17_SE15_R##.txt (falso nombre);
        # el sujeto verdadero es el de la CARPETA (así cada sujeto conserva 5 trials
        # por código; SE15 ya tiene 5 D17 en SE15/ con contenido distinto).
        # En ese caso el record_id se rebautiza con el sujeto de la carpeta.
        folder_subject = fpath.parent.name
        if subject != folder_subject:
            trial = record_id.split("_")[2]
            record_id = f"{activity}_{folder_subject}_{trial}"
            subject = folder_subject
            renamed_records.append(fname)

        arr_bits = load_record(fpath)
        arr = convert_units(arr_bits)
        arr50 = decimate_to_50hz(arr)
        svm50 = np.sqrt((arr50[:, :3] ** 2).sum(axis=1))
        gyro_norm50 = np.sqrt((arr50[:, 3:] ** 2).sum(axis=1))
        arr8 = np.hstack([arr50, svm50[:, None], gyro_norm50[:, None]])   # 8 canales
        peak_pos = int(np.argmax(svm50))       # posición del pico de SVM (50 Hz)
        n50 = arr50.shape[0]

        starts = grid_starts(n50)
        n_records += 1
        if m_f:
            fall_windows_per_record[record_id] = 0
            fall_grid_windows[record_id] = len(starts)

        for s in starts:
            # --- etiquetado POR CÓDIGO DE ACTIVIDAD ------------------------
            if m_f:
                # Posible Caída SOLO si la ventana de la rejilla contiene el pico
                if not (s <= peak_pos < s + WINDOW_SIZE):
                    excluded_from_fall += 1
                    continue                      # se EXCLUYE
                label = 1
            else:
                label = 2 if activity in REST_ADL_CODES else 0

            X_list.append(arr8[s:s + WINDOW_SIZE].astype(np.float32))
            y_list.append(label)
            groups_list.append(subject)
            record_list.append(record_id)
            activity_list.append(activity)
            window_idx_list.append(s)
            peak_pos_list.append(peak_pos)
            class_counts[label] += 1
            if m_f:
                fall_windows_per_record[record_id] += 1

        # si el pico quedó en la cola no ventaneada de un registro F##,
        # se añade UNA ventana anclada al pico (múltiplo de 64, dentro del registro)
        if m_f and fall_windows_per_record[record_id] == 0:
            s = max(0, ((peak_pos - WINDOW_SIZE // 2) // STEP_SIZE) * STEP_SIZE)
            s = min(s, n50 - WINDOW_SIZE)
            X_list.append(arr8[s:s + WINDOW_SIZE].astype(np.float32))
            y_list.append(1)
            groups_list.append(subject)
            record_list.append(record_id)
            activity_list.append(activity)
            window_idx_list.append(s)
            peak_pos_list.append(peak_pos)
            class_counts[1] += 1
            fall_windows_per_record[record_id] = 1
            extra_fall_anchored_windows += 1

        if k % 500 == 0 or k == len(txt_files):
            print(f"  {k}/{len(txt_files)} registros · {len(X_list)} ventanas · "
                  f"{time.time() - t0:.1f} s", flush=True)

    print("\n[Paso 1] Concatenando y guardando...")
    X = np.stack(X_list, axis=0).astype(np.float32, copy=False)
    y = np.asarray(y_list, dtype=np.int8)
    groups = np.asarray(groups_list)
    records = np.asarray(record_list)
    activity = np.asarray(activity_list)
    window_idx = np.asarray(window_idx_list, dtype=np.int32)
    peak_pos = np.asarray(peak_pos_list, dtype=np.int32)
    del X_list, y_list, groups_list, record_list, activity_list

    # --- sanity checks ------------------------------------------------------
    assert X.shape[0] == y.shape[0] == groups.shape[0]
    assert set(np.unique(y).tolist()).issubset({0, 1, 2})
    assert not np.isnan(X).any(), "NaN dentro de X"
    print(f"[debug] class_counts={class_counts} · registros F##={len(fall_windows_per_record)} "
          f"· suma ventanas F##={sum(fall_windows_per_record.values())}")
    assert class_counts[1] == sum(fall_windows_per_record.values()), (
        "las ventanas de caída deben coincidir con la suma de ventanas con pico")
    assert all(n in (1, 2) for n in fall_windows_per_record.values()), (
        "con ventana=128 y paso=64, el pico cae en 1 o 2 ventanas (50 % de solapamiento)")
    print(f"[debug] class_counts={class_counts} · registros F##={len(fall_windows_per_record)} "
          f"· suma ventanas F##={sum(fall_windows_per_record.values())}")
    print(f"[debug] registros únicos en X: {len(np.unique(records))} · txt_files: {len(txt_files)} · "
          f"renombreados (quirk SA15/SE15): {renamed_records}")
    assert len(np.unique(records)) == len(txt_files), "no debe perderse ningún registro"

    np.save(PROCESSED_DIR / "X.npy", X)
    np.save(PROCESSED_DIR / "y.npy", y)
    np.save(PROCESSED_DIR / "groups.npy", groups)
    age_group = np.where(np.char.startswith(groups, "SA"), "SA", "SE")
    np.save(PROCESSED_DIR / "age_group.npy", age_group)
    np.save(PROCESSED_DIR / "record_ids.npy", records)
    np.save(PROCESSED_DIR / "activity.npy", activity)
    np.save(PROCESSED_DIR / "window_idx.npy", window_idx)
    np.save(PROCESSED_DIR / "peak_pos.npy", peak_pos)

    metadata = {
        "dataset": "SisFall real v1.0 (UDEA/SISTEMIC, Sucerquia et al. 2017)",
        "path": str(DATASET_ROOT),
        "fs_in_hz": FS_RAW,
        "fs_hz": FS_TARGET,
        "decimation": {"type": "scipy.signal.decimate", "q": Q_DECIMATE,
                       "ftype": "fir", "zero_phase": True},
        "window_size": WINDOW_SIZE,
        "step_size": STEP_SIZE,
        "channels": ["accel_x_g", "accel_y_g", "accel_z_g",
                     "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
                     "svm_g", "gyro_norm_dps"],
        "unit_conversions": {
            "adxl345_g_per_bit": ADXL345_SCALE,
            "itg3200_dps_per_bit": ITG3200_SCALE,
        },
        "classes": CLASS_NAMES,
        "labeling_by_activity_code": True,
        "rest_codes_for_class2": list(REST_ADL_CODES),
        "fall_window_rule": ("solo las ventana(s) que contienen el pico de SVM del registro "
                             "(1 o 2 con solapamiento 50 %); resto EXCLUIDO"),
        "quirk_sa15_se15": ("el zip oficial contiene D17_SE15_R01..R05 dentro de SA15/ con "
                            "contenido distinto a los de SE15/; el sujeto se toma de la carpeta "
                            "y el record_id se renombra (D17_SA15_R##) para preservar 5 trials "
                            "por código y sujeto"),
        "renamed_records": renamed_records,
        "normalization": "ninguna en este punto (por fold en entrenamiento)",
        "seed": SEED,
        "counts": {
            "records_total": n_records,
            "windows_total": int(X.shape[0]),
            "class0_normal": class_counts[0],
            "class1_fall": class_counts[1],
            "class2_rest": class_counts[2],
            "windows_excluded_from_fall_records": excluded_from_fall,
            "windows_fall_anchored_tail": extra_fall_anchored_windows,
            "subject_counts": {"SA": len(sa), "SE": len(se)},
        },
    }
    with open(PROCESSED_DIR / "dataset_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    # ---------------------------------------------------------- conteos
    print("\n" + "=" * 70)
    print("CONTEOS POR CLASE")
    print("=" * 70)
    for c, name in enumerate(CLASS_NAMES):
        pct = class_counts[c] / X.shape[0] * 100
        print(f"  clase {c} {name:<16}: {class_counts[c]:>6} ventanas ({pct:.1f} %)")
    print(f"  ventanas excluidas de registros F##: {excluded_from_fall}")
    print(f"  ventanas de caída ancladas en cola:  {extra_fall_anchored_windows}")

    print("\nCONTEOS POR GRUPO ETARIO Y CLASE (ventanas)")
    is_sa_mask = np.char.startswith(groups, "SA")
    for g_label, g_mask in (("SA (jóvenes 19-30)", is_sa_mask), ("SE (mayores 60-75)", ~is_sa_mask)):
        cells = [f"{int(((y == c) & g_mask).sum()):>7}" for c in range(3)]
        print(f"  {g_label:<20}:" + "".join(cells))

    print("\nPOR SUJETO (ventanas por clase: Normal | Posible_Caida | Baja_actividad)")
    for subj in sorted(set(groups.tolist())):
        mask = groups == subj
        cells = [f"{int(((y == c) & mask).sum()):>7}" for c in range(3)]
        print(f"  {subj:<7}: " + " ".join(cells))

    is_sa_mask = np.char.startswith(groups, "SA")
    grp = {g: int(((y == 1) & (is_sa_mask if g == "SA" else ~is_sa_mask)).sum()) for g in ("SA", "SE")}
    subjects_of = {rid: rid.split("_")[1] for rid in fall_windows_per_record}
    n_fall_records_sa = sum(1 for s in subjects_of.values() if s.startswith("SA"))
    n_fall_records_se = sum(1 for s in subjects_of.values() if s.startswith("SE"))
    print(f"\nRegistros F## con ventana de caída: {n_fall_records_sa} de sujetos SA, "
          f"{n_fall_records_se} de sujetos SE (solo SE06 simula caídas en SisFall).")
    print(f"Ventanas clase 1 por grupo etario: SA={grp['SA']}, SE={grp['SE']}")

    fvals = np.array(list(fall_windows_per_record.values()))
    gvals = np.array(list(fall_grid_windows.values()))
    print("\nVENTANAS POR REGISTRO DE CAÍDA (F##):")
    print(f"  registros: {len(gvals)} · ventanas totales por registro: "
          f"min={gvals.min()} · mediana={int(np.median(gvals))} · max={gvals.max()}")
    unique, cnt = np.unique(gvals, return_counts=True)
    for u, c in zip(unique, cnt):
        print(f"    {u} ventanas totales (rejilla): {c} registros")
    print(f"  ventanas etiquetadas como caída (con el pico de SVM) por registro: "
          f"min={fvals.min()} · mediana={int(np.median(fvals))} · max={fvals.max()}")
    unique, cnt = np.unique(fvals, return_counts=True)
    for u, c in zip(unique, cnt):
        print(f"    {u} ventanas de caída: {c} registros")

    # ---------------------------------------------------------- labeling_rules.md
    FALL_TXT = {
        "F01": "Fall forward while walking caused by a slip",
        "F02": "Fall backward while walking caused by a slip",
        "F03": "Lateral fall while walking caused by a slip",
        "F04": "Fall forward while walking caused by a trip",
        "F05": "Fall forward while jogging caused by a trip",
        "F06": "Vertical fall while walking caused by fainting",
        "F07": "Fall while walking, hands on table to dampen fall, fainting",
        "F08": "Fall forward when trying to get up",
        "F09": "Lateral fall when trying to get up",
        "F10": "Fall forward when trying to sit down",
        "F11": "Fall backward when trying to sit down",
        "F12": "Lateral fall when trying to sit down",
        "F13": "Fall forward while sitting (fainting/asleep)",
        "F14": "Fall backward while sitting (fainting/asleep)",
        "F15": "Lateral fall while sitting (fainting/asleep)",
    }
    L = []
    L.append("# Reglas de etiquetado — dataset REAL de SisFall (v1.0, UDEA/SISTEMIC)\n\n")
    L.append("Revisión anti-fuga (aprobada por el usuario antes de entrenar).\n\n")
    L.append("| Código | Fuente | Clase | Descripción (Readme oficial de SisFall) |\n")
    L.append("|---|---|---|---|\n")
    ADL_DESC = {
        "D01": "Walking slowly", "D02": "Walking quickly", "D03": "Jogging slowly",
        "D04": "Jogging quickly", "D05": "Walking up/down stairs slowly",
        "D06": "Walking up/down stairs quickly",
        "D07": "Slowly sit in half-height chair, wait, up slowly",
        "D08": "Quickly sit in half-height chair, wait, up quickly",
        "D09": "Slowly sit in low-height chair, wait, up slowly",
        "D10": "Quickly sit in low-height chair, wait, up quickly",
        "D11": "Sitting, trying to get up, collapse into chair (hard-negative)",
        "D12": "Sitting, lying slowly, wait, sit again (REPOSO)",
        "D13": "Sitting, lying quickly, wait, sit again (REPOSO)",
        "D14": "On back, change to lateral, wait, change back (REPOSO)",
        "D15": "Standing, bending at knees, getting up",
        "D16": "Standing, bending without knees, getting up",
        "D17": "Standing, into car, seated, out (a Normal por decisión del usuario)",
        "D18": "Stumble while walking (hard-negative)",
        "D19": "Gently jump without falling",
    }
    for code, desc in ADL_DESC.items():
        cls = 2 if code in REST_ADL_CODES else 0
        L.append(f"| {code} | ADL | {cls} | {desc} |\n")
    for code, desc in FALL_TXT.items():
        L.append(f"| {code} | CAÍDA | 1 (solo ventana del pico) | {desc} |\n")
    L.append("\nNotas:\n\n")
    L.append("- **Clase 0 \"Normal\"**: todos los ADLs excepto D12/D13/D14. Incluye D07–D10\n"
             "  (los ciclos sentarse-levantar van a Normal, decisión del usuario) y D11, D18, D19\n"
             "  como *hard-negatives* (casi-caídas y salto).\n")
    L.append("- **Clase 2 \"Baja actividad (reposo)\"**: SOLO ventanas de {D12, D13, D14}.\n"
             "  D17 (sentado en coche) va a Normal por decisión explícita del usuario.\n")
    L.append("- **Clase 1 \"Posible Caída\"**: SOLO las ventanas (128 pasos, 50 % solape, 50 Hz)\n"
             "  que contienen el pico de SVM del registro (argmax(SVM) sobre la señal a 50 Hz).\n"
             "  Con ventana=128 y paso=64 el pico cae normalmente en 1 o 2 ventanas\n"
             "  consecutivas; ambas se etiquetan como clase 1 (todas cumplen \"contener el\n"
             "  pico\"). Las demás ventanas de los registros F## se **excluyen** del dataset\n"
             "  (no pertenecen a ninguna clase) para no contaminar las clases con el reposo\n"
             "  post-caída ni el contexto pre-caída.\n"
             "  Si el pico cae en la cola no ventaneada del registro, se añade UNA ventana\n"
             "  anclada al pico (múltiplo de 64 pasos, dentro de los límites del registro).\n")
    L.append("- El etiquetado es **por código de actividad**; NO se usan umbrales de max_svm,\n"
             "  var_svm ni max_gyro. Se eliminó la heurística anterior y la clase 3.\n")
    L.append("- **No hay normalización global**: en el Paso 3 el escalado se ajusta solo con\n"
             "  el train de cada fold.\n")
    L.append(f"- Unidades: ADXL345 bits→g con factor {ADXL345_SCALE:.6g} (2·16/2^13); ITG3200\n"
             f"  bits→°/s con factor {ITG3200_SCALE:.6g} (2·2000/2^16). Sensores usados:\n"
             "  ADXL345 + ITG3200 (el canal MMA8451Q no participa).\n")
    L.append("- Submuestreo 200 → 50 Hz con `scipy.signal.decimate(q=4, ftype='fir', zero_phase=True)`.\n")
    L.append(f"- Ventaneo: 128 pasos a 50 Hz ({WINDOW_SIZE / FS_TARGET:.2f} s), paso {STEP_SIZE}\n"
             "  (50 % de solapamiento). Las ventanas incompletas (<128 pasos) no se usan.\n")
    L.append(f"- Semilla de reproducibilidad: {SEED} (numpy/random; TF se fijará en el entrenamiento).\n")
    L.append("- **Quirk del zip oficial (documentado):** los archivos D17_SE15_R01..R05.txt\n"
             "  existen en DOS carpetas (SA15/ y SE15/) con contenido distinto. El sujeto se\n"
             "  atribuye por CARPETA y el record_id se renombra (D17_SA15_R##), de modo que\n"
             "  SA15 recupera su D17 y SE15 conserva 5 trials por código; ninguno se pierde\n"
             "  ni se duplica. (Es el único desajuste nombre/carpeta de todo el dataset.)\n")
    L.append("\nFuente: Sucerquia et al., *SisFall: A Fall and Movement Dataset*, Sensors\n"
             "2017, 17(1), 198; README oficial incluido en la carpeta de datos.\n")
    with open(REPORTS_DIR / "labeling_rules.md", "w", encoding="utf-8") as f:
        f.write("".join(L))

    print(f"\n[OK] labeling_rules.md guardado en {REPORTS_DIR / 'labeling_rules.md'}")
    print(f"[OK] X.npy {X.shape} · {X.nbytes / 1e6:.1f} MB · tiempo total {time.time() - t0:.1f} s")
    print(f"     y.npy {y.shape} · {len(set(groups.tolist()))} sujetos · "
          f"{int(X.shape[0])} ventanas totales")


if __name__ == "__main__":
    main()
