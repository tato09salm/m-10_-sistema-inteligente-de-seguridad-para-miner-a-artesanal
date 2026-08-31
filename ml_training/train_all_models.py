import os
import sys
import json
import time
from pathlib import Path
import numpy as np

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Suppress TensorFlow verbose info logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, optimizers
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_score, recall_score, f1_score

DATA_DIR = Path(__file__).resolve().parent / "data" / "processed"
MODELS_DIR = Path(__file__).resolve().parent / "saved_models"
REPORTS_DIR = Path(__file__).resolve().parent / "reports"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Training Hyperparameters
EPOCHS = 20
BATCH_SIZE = 128
LEARNING_RATE = 1e-3

def load_preprocessed_data():
    print("[Pipeline] Cargando dataset preprocesado de SisFall...")
    X_train = np.load(DATA_DIR / "X_train.npy")
    y_train = np.load(DATA_DIR / "y_train.npy")
    X_val = np.load(DATA_DIR / "X_val.npy")
    y_val = np.load(DATA_DIR / "y_val.npy")
    X_test = np.load(DATA_DIR / "X_test.npy")
    y_test = np.load(DATA_DIR / "y_test.npy")

    with open(DATA_DIR / "dataset_metadata.json", "r", encoding="utf-8") as f:
        metadata = json.load(f)

    print(f"  - Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
    return X_train, y_train, X_val, y_val, X_test, y_test, metadata

# --- MODEL DEFINITIONS ---

# 1. Puro: 1D-CNN
def build_1d_cnn(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Conv1D(64, kernel_size=5, padding="same", activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    x = layers.Dropout(0.3)(x)

    x = layers.Conv1D(128, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling1D()(x)
    
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    
    return models.Model(inputs=inp, outputs=out, name="Puro_1D_CNN")

# 2. Puro: Bi-LSTM
def build_bilstm(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Bidirectional(layers.LSTM(32))(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Puro_Bi_LSTM")

# 3. Puro: GRU
def build_gru(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.GRU(64, return_sequences=True)(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.GRU(64)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Puro_GRU")

# 4. Híbrido: CNN-LSTM
def build_cnn_lstm(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Conv1D(64, kernel_size=5, padding="same", activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    
    x = layers.Conv1D(128, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    x = layers.Dropout(0.3)(x)
    
    x = layers.LSTM(64)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Hibrido_CNN_LSTM")

# 5. Híbrido: Conv1D + Spatial Attention + Residual GRU
class TemporalAttention(layers.Layer):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    def build(self, input_shape):
        self.W = self.add_weight(name="att_weight", shape=(input_shape[-1], 1), initializer="normal")
        self.b = self.add_weight(name="att_bias", shape=(input_shape[1], 1), initializer="zeros")
        super().build(input_shape)
    def call(self, x):
        e = tf.keras.backend.tanh(tf.keras.backend.dot(x, self.W) + self.b)
        a = tf.keras.backend.softmax(e, axis=1)
        output = x * a
        return tf.keras.backend.sum(output, axis=1)

def build_attention_res_gru(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    c1 = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(inp)
    c1 = layers.BatchNormalization()(c1)
    
    gru_out = layers.GRU(64, return_sequences=True)(c1)
    res = layers.Add()([c1, gru_out])
    
    att = TemporalAttention()(res)
    
    x = layers.Dense(64, activation="relu")(att)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Hibrido_Attention_ResGRU")

def evaluate_model_performance(model, X_test, y_test, class_names):
    start_t = time.time()
    y_pred_probs = model.predict(X_test, batch_size=256, verbose=0)
    total_time = (time.time() - start_t) * 1000.0
    latency_ms_per_sample = total_time / len(X_test)

    y_pred = np.argmax(y_pred_probs, axis=1)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    rec = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    report = classification_report(
        y_test, y_pred,
        target_names=[class_names[str(i)] for i in range(len(np.unique(y_test)))],
        output_dict=True,
        zero_division=0
    )

    return {
        "accuracy": round(acc * 100.0, 2),
        "precision": round(prec * 100.0, 2),
        "recall": round(rec * 100.0, 2),
        "f1_score": round(f1 * 100.0, 2),
        "latency_ms": round(latency_ms_per_sample, 3),
        "confusion_matrix": cm,
        "classification_report": report,
    }

def train_and_benchmark_all():
    X_train, y_train, X_val, y_val, X_test, y_test, metadata = load_preprocessed_data()
    
    input_shape = (X_train.shape[1], X_train.shape[2])
    num_classes = len(np.unique(y_train))
    class_names = metadata["class_mapping"]

    model_factories = [
        ("Puro_1D_CNN", build_1d_cnn, "1. Puro: 1D-CNN (Red Convolucional 1D)"),
        ("Puro_Bi_LSTM", build_bilstm, "2. Puro: Bi-LSTM (Bidirectional LSTM)"),
        ("Puro_GRU", build_gru, "3. Puro: GRU (Gated Recurrent Unit)"),
        ("Hibrido_CNN_LSTM", build_cnn_lstm, "4. Hibrido: CNN-LSTM (Convolucional + Recurrente)"),
        ("Hibrido_Attention_ResGRU", build_attention_res_gru, "5. Hibrido: Conv1D + Attention + Residual GRU"),
    ]

    results = []

    print("\n=======================================================")
    print("[M-10 ML] INICIANDO ENTRENAMIENTO DE LOS 5 MODELOS DEEP LEARNING")
    print("=======================================================\n")

    for model_id, factory_fn, desc in model_factories:
        print(f"\n-------------------------------------------------------")
        print(f"[Entrenando] {desc}")
        print(f"-------------------------------------------------------")
        
        model = factory_fn(input_shape, num_classes)
        model.compile(
            optimizer=optimizers.Adam(learning_rate=LEARNING_RATE),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"]
        )

        h5_path = MODELS_DIR / f"{model_id}.h5"
        
        cbs = [
            callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True, verbose=1),
            callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-5, verbose=1),
            callbacks.ModelCheckpoint(filepath=str(h5_path), monitor="val_accuracy", save_best_only=True, verbose=0)
        ]

        t0 = time.time()
        history = model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            callbacks=cbs,
            verbose=1
        )
        training_time_sec = time.time() - t0

        model.save(str(h5_path))
        file_size_kb = round(h5_path.stat().st_size / 1024.0, 1)

        eval_metrics = evaluate_model_performance(model, X_test, y_test, class_names)
        
        model_result = {
            "model_id": model_id,
            "description": desc,
            "h5_file": f"{model_id}.h5",
            "file_size_kb": file_size_kb,
            "training_time_seconds": round(training_time_sec, 2),
            "epochs_trained": len(history.history["loss"]),
            "metrics": eval_metrics,
        }
        results.append(model_result)

        print(f"\n[Resultado] {desc}:")
        print(f"  - Test Accuracy:  {eval_metrics['accuracy']}%")
        print(f"  - Test F1-Score:  {eval_metrics['f1_score']}%")
        print(f"  - Latencia Muestral: {eval_metrics['latency_ms']} ms")
        print(f"  - Tamano Archivo: {file_size_kb} KB (.h5 guardado)")
        print(f"  - Tiempo Entreno: {round(training_time_sec, 1)}s ({len(history.history['loss'])} epocas)")

    best_model = max(results, key=lambda r: (r["metrics"]["f1_score"], r["metrics"]["accuracy"]))

    final_report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset": "SisFall (Universidad de Antioquia)",
        "total_samples": int(X_train.shape[0] + X_val.shape[0] + X_test.shape[0]),
        "input_shape": list(input_shape),
        "classes": class_names,
        "best_model": {
            "model_id": best_model["model_id"],
            "h5_file": best_model["h5_file"],
            "accuracy": best_model["metrics"]["accuracy"],
            "f1_score": best_model["metrics"]["f1_score"],
            "latency_ms": best_model["metrics"]["latency_ms"],
        },
        "all_models": results
    }

    report_path = REPORTS_DIR / "models_comparison_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2, ensure_ascii=False)

    print("\n=======================================================")
    print("[M-10 ML] COMPARATIVA FINAL Y SELECCION DEL MEJOR MODELO .H5")
    print("=======================================================\n")
    print(f"{'Modelo':<45} | {'Acc (%)':<8} | {'F1 (%)':<8} | {'Lat (ms)':<9} | {'Size (KB)':<10} | {'Tiempo':<8}")
    print("-" * 100)
    for r in results:
        star = "  [MEJOR MODELO]" if r["model_id"] == best_model["model_id"] else ""
        print(f"{r['description']:<45} | {r['metrics']['accuracy']:<8} | {r['metrics']['f1_score']:<8} | {r['metrics']['latency_ms']:<9} | {r['file_size_kb']:<10} | {r['training_time_seconds']}s{star}")

    print(f"\n[OK] Mejor modelo seleccionado: {best_model['description']}")
    print(f"[OK] Archivo guardado: {MODELS_DIR / best_model['h5_file']}")
    print(f"[OK] Reporte completo guardado en: {report_path}")

if __name__ == "__main__":
    train_and_benchmark_all()
