# -*- coding: utf-8 -*-
"""
M-10 · Fase C: exportación a TFLite (Hibrido_CNN_LSTM y Puro_1D_CNN) y medición
de latencia (TFLite Interpreter 1 hilo AND Keras para los 5 modelos).

Reglas:
  - float32 y int8 completo (representative dataset: 500 ventanas de TRAIN
    estratificadas por clase, seed 42; entrada/salida int8).
  - Si el int8 completo falla -> cuantización dinámica (se reporta).
  - Si la conversión requiere Select TF Ops/Flex -> se declara NO desplegable
    en TFLite Micro, con el error documentado.
  - Evaluación de cada .tflite en el test (sujetos no vistos): exactitud,
    F1 macro, recall de caída con IC Clopper-Pearson.
  - Latencia en PC (NO en ESP32): 50 inferencias de calentamiento + 200 medidas
    con time.perf_counter, entrada de UNA ventana (1,128,8), Interpreter con
    1 hilo. CPU en reposo (no hay otras cargas corriendo).

Salidas (ml_training/reports/paper_assets/):
  - tflite_resultados.csv, tflite_latencia.csv, latencia_keras.csv
  - entorno_latencia.txt (CPU, Python, TF, numpy)
  - saved in ml_training/saved_models/tflite/*.tflite
  - tflite_conversion_log.json (errores de conversión documentados)
"""
import os
import sys
import json
import time
import platform
from pathlib import Path

import numpy as np

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow.keras import layers
from sklearn.metrics import f1_score, accuracy_score
from scipy import stats

SEED = 42
ROOT = Path(__file__).resolve().parent
PROCESSED = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "saved_models"
FINAL_DIR = ROOT / "reports" / "final"
ASSETS = ROOT / "reports" / "paper_assets"
TFLITE_DIR = MODELS_DIR / "tflite"
N_CLASSES = 3

TARGET_MODELS = ["Hibrido_CNN_LSTM", "Puro_1D_CNN"]
ALL_MODELS = ["Puro_1D_CNN", "Puro_Bi_LSTM", "Puro_GRU",
              "Hibrido_CNN_LSTM", "Hibrido_Attention_ResGRU"]


class TemporalAttention(layers.Layer):
    """Idéntica a train_grouped.py (necesaria para cargar el h5 de Attention)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def build(self, input_shape):
        self.W = self.add_weight(name="att_weight", shape=(input_shape[-1], 1),
                                 initializer="normal")
        self.b = self.add_weight(name="att_bias", shape=(input_shape[1], 1),
                                 initializer="zeros")
        super().build(input_shape)

    def call(self, x):
        e = tf.keras.backend.tanh(tf.keras.backend.dot(x, self.W) + self.b)
        a = tf.keras.backend.softmax(e, axis=1)
        output = x * a
        return tf.keras.backend.sum(output, axis=1)

    def get_config(self):
        return super().get_config()


CUSTOM_OBJECTS = {"TemporalAttention": TemporalAttention}


def load_model_file(model_id):
    p = MODELS_DIR / f"{model_id}_grouped.h5"
    return tf.keras.models.load_model(str(p), compile=False,
                                      custom_objects=CUSTOM_OBJECTS)


def clopper_pearson(k, n, alpha=0.05):
    if n == 0:
        return float("nan"), float("nan")
    lo = 0.0 if k == 0 else stats.beta.ppf(alpha / 2, k, n - k + 1)
    hi = 1.0 if k == n else stats.beta.ppf(1 - alpha / 2, k + 1, n - k)
    return float(lo), float(hi)


def load_test_and_rep(model_id, n_rep=500):
    """Test normalizado + generador representative (500 ventanas TRAIN estratificadas)."""
    d = FINAL_DIR / model_id
    with open(d / "metrics_test.json", encoding="utf-8") as f:
        met = json.load(f)
    mu = np.array(met["normalization"]["mean"], dtype=np.float64)
    sd = np.array(met["normalization"]["std"], dtype=np.float64)

    X = np.load(PROCESSED / "X.npy").astype(np.float32)
    y = np.load(PROCESSED / "y.npy").astype(np.int64)
    groups = np.load(PROCESSED / "groups.npy").astype(str)

    test_subj = met["test_subjects"]
    fit_subj = met["fit_subjects"]

    X_test = (X[np.isin(groups, test_subj)] - mu) / sd
    y_test = y[np.isin(groups, test_subj)]

    rng = np.random.RandomState(SEED)
    fit_idx = np.flatnonzero(np.isin(groups, fit_subj))
    # estratificado por clase, proporcional, seed 42
    chosen = []
    for c in np.unique(y[fit_idx]):
        idx_c = fit_idx[y[fit_idx] == c]
        k = int(round(n_rep * len(idx_c) / len(fit_idx)))
        chosen.append(rng.choice(idx_c, size=k, replace=False))
    rep_idx = np.concatenate(chosen)
    rng.shuffle(rep_idx)
    rep_idx = rep_idx[:n_rep]
    X_rep = ((X[rep_idx] - mu) / sd).astype(np.float32)
    return X_test, y_test, X_rep, met


# ------------------------------------------------------------------ conversión
def convert_float32(model):
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    return conv.convert(), "builtin"


def convert_int8_full(model, X_rep):
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = _rep_gen(X_rep)
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    return conv.convert(), "builtin_int8"


def _rep_gen(X_rep):
    def gen():
        for i in range(X_rep.shape[0]):
            yield [X_rep[i:i + 1].astype(np.float32)]
    return gen


def convert_int8_flex(model, X_rep):
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = _rep_gen(X_rep)
    conv.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS_INT8, tf.lite.OpsSet.SELECT_TF_OPS]
    conv._experimental_lower_tensor_list_ops = True
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    return conv.convert(), "flex_int8"


def convert_dynamic(model):
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    return conv.convert(), "builtin_dynamic"


# ------------------------------------------------------------------ evaluación
def quant_params(detail):
    """Escala y zero_point del tensor a partir de input/output_details."""
    if "quantization_scales" in detail:
        scales, zps = detail["quantization_scales"], detail["quantization_zero_points"]
        scale = float(np.asarray(scales).ravel()[0]) if np.size(scales) else 0.0
        zp = int(np.asarray(zps).ravel()[0]) if np.size(zps) else 0
    else:
        scale, zp = detail["quantization"]
        scale, zp = float(scale), int(zp)
    return scale, zp


def tflite_predict(model_bytes, X, want_int8=False):
    interp = tf.lite.Interpreter(model_content=model_bytes, num_threads=1)
    interp.allocate_tensors()
    idet = interp.get_input_details()[0]
    odet = interp.get_output_details()[0]
    if want_int8:
        q_in_scale, q_in_zp = quant_params(idet)
        q_out_scale, q_out_zp = quant_params(odet)
    preds = np.empty(X.shape[0], dtype=np.int64)
    probs_fall = np.empty(X.shape[0], dtype=np.float64)
    for i in range(X.shape[0]):
        if want_int8:
            x = np.round(X[i:i + 1] / q_in_scale + q_in_zp)
            x = np.clip(x, np.iinfo(idet["dtype"]).min,
                        np.iinfo(idet["dtype"]).max).astype(idet["dtype"])
        else:
            x = X[i:i + 1].astype(idet["dtype"])
        interp.set_tensor(idet["index"], x)
        interp.invoke()
        out = interp.get_tensor(odet["index"])[0]
        if want_int8:
            out = (out.astype(np.float64) - q_out_zp) * q_out_scale
        preds[i] = int(np.argmax(out))
        probs_fall[i] = float(out[1] / max(1e-12, out.sum()))
    return preds, probs_fall


def eval_metrics(y_true, y_pred):
    n_fall = int((y_true == 1).sum())
    k_fall = int(((y_true == 1) & (y_pred == 1)).sum())
    lo, hi = clopper_pearson(k_fall, n_fall)
    return accuracy_score(y_true, y_pred), float(
        f1_score(y_true, y_pred, average="macro", zero_division=0)), \
        k_fall / n_fall, lo, hi


# ------------------------------------------------------------------ latencia
def measure(fn, warmup=50, reps=200):
    for _ in range(warmup):
        fn()
    times = []
    for _ in range(reps):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000.0)
    a = np.array(times)
    return {"media_ms": float(a.mean()), "mediana_ms": float(np.median(a)),
            "p95_ms": float(np.percentile(a, 95)), "de_ms": float(a.std(ddof=1))}


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    TFLITE_DIR.mkdir(parents=True, exist_ok=True)
    conv_log = {"seed_representative": SEED, "n_representative": 500,
                "representative_source": "ventanas TRAIN (sujetos fit del "
                                         "entrenamiento final), estratificadas "
                                         "por clase proporcionalmente",
                "stratified_seed": SEED,
                "latency_protocol": "PC (NO ESP32): 50 calentamiento + 200 "
                                    "medidas time.perf_counter, entrada "
                                    "(1,128,8), Interpreter 1 hilo",
                "conversions": {}}
    rows_csv, lat_rows = [], []
    single_window = None

    for model_id in TARGET_MODELS:
        print(f"\n=== {model_id} ===")
        model = load_model_file(model_id)
        X_test, y_test, X_rep, met = load_test_and_rep(model_id)
        single_window = X_test[0:1].astype(np.float32)
        formats = {}

        # ---------------- float32
        try:
            b, route = convert_float32(model)
            formats["float32"] = {"bytes": b, "flex": False, "route": route,
                                  "input_int8": False}
            print(f"  float32 OK ({len(b)/1024:.1f} KB)")
        except Exception as e:
            conv_log["conversions"][f"{model_id}:float32"] = {"error": repr(e)}
            print(f"  float32 FALLO: {e}")

        # ---------------- int8 completo
        try:
            b, route = convert_int8_full(model, X_rep)
            formats["int8"] = {"bytes": b, "flex": False, "route": route,
                               "input_int8": True}
            print(f"  int8 (builtin) OK ({len(b)/1024:.1f} KB)")
        except Exception as e:
            conv_log["conversions"][f"{model_id}:int8_builtin"] = {"error": repr(e)}
            print(f"  int8 builtin FALLA: {type(e).__name__}: {e}")
            try:
                b, route = convert_int8_flex(model, X_rep)
                formats["int8_flex"] = {"bytes": b, "flex": True, "route": route,
                                        "input_int8": True}
                conv_log["conversions"][f"{model_id}:int8_flex"] = {
                    "note": "int8 builtin falló; requiere SELECT_TF_OPS/Flex "
                            "=> NO desplegable en TFLite Micro",
                    "error_builtin": repr(e)}
                print(f"  int8 solo con SELECT_TF_OPS (Flex) => NO TFLite Micro "
                      f"({len(b)/1024:.1f} KB)")
            except Exception as e2:
                conv_log["conversions"][f"{model_id}:int8_flex"] = {"error": repr(e2)}
                print(f"  int8 con Flex TAMBIÉN falla: {e2}")

        # ---------------- cuantización dinámica (fallback)
        if "int8" not in formats and "int8_flex" not in formats:
            try:
                b, route = convert_dynamic(model)
                formats["dynamic"] = {"bytes": b, "flex": False, "route": route,
                                      "input_int8": False}
                conv_log["conversions"][f"{model_id}:dynamic"] = {
                    "note": "int8 completo imposible; se usó cuantización "
                            "dinámica (pesos int8, activaciones float)"}
                print(f"  cuantización dinámica OK ({len(b)/1024:.1f} KB)")
            except Exception as e:
                conv_log["conversions"][f"{model_id}:dynamic"] = {"error": repr(e)}
                print(f"  cuantización dinámica FALLO: {e}")

        # ---------------- evaluar cada formato en el test
        for fmt, info in formats.items():
            p_tflite = TFLITE_DIR / f"{model_id}_{fmt}.tflite"
            p_tflite.write_bytes(info["bytes"])
            size_kb = len(info["bytes"]) / 1024.0

            yp, _ = tflite_predict(info["bytes"], X_test,
                                   want_int8=info["input_int8"])

            acc, f1m, rf, lo, hi = eval_metrics(y_test, yp)
            sin_flex = "sí" if not info["flex"] else "no"
            rows_csv.append({
                "Modelo": model_id, "Formato": fmt,
                "Tamano_KB": round(size_kb, 1),
                "Exactitud": round(acc * 100, 2),
                "F1_macro": round(f1m * 100, 2),
                "Recall_caida": round(rf * 100, 2),
                "Recall_caida_IC95_inf": round(lo * 100, 2),
                "Recall_caida_IC95_sup": round(hi * 100, 2),
                "Convierte_sin_FlexOps": sin_flex,
            })
            print(f"  [{fmt}] tam={size_kb:.1f}KB acc={acc*100:.2f} "
                  f"F1={f1m*100:.2f} recall_caída={rf*100:.2f} "
                  f"[{lo*100:.2f},{hi*100:.2f}] sinFlex={sin_flex}")

            # ---------------- latencia TFLite (1 ventana, 1 hilo)
            interp = tf.lite.Interpreter(model_content=info["bytes"], num_threads=1)
            interp.allocate_tensors()
            idet = interp.get_input_details()[0]
            odet = interp.get_output_details()[0]
            if info["input_int8"]:
                s_in, zp_in = quant_params(idet)
                in_arr = np.clip(np.round(single_window / s_in + zp_in),
                                 np.iinfo(idet["dtype"]).min,
                                 np.iinfo(idet["dtype"]).max
                                 ).astype(idet["dtype"])
            else:
                in_arr = single_window.astype(idet["dtype"])

            def _invoke(idet=idet, odet=odet, in_arr=in_arr, interp=interp):
                interp.set_tensor(idet["index"], in_arr)
                interp.invoke()
                _ = interp.get_tensor(odet["index"])

            lat = measure(_invoke)
            lat_rows.append({"Modelo": model_id, "Formato": fmt,
                             "Motor": "TFLite_Interpreter_1hilo(PC)", **lat})
            print(f"      latencia: {lat['media_ms']:.3f} ms (p95 {lat['p95_ms']:.3f})")

        del model
        tf.keras.backend.clear_session()

    # ------------------------------------------------- latencia Keras (5 modelos)
    print("\n=== Latencia Keras (5 modelos, PC, 1 ventana) ===")
    mfiles = {mid: MODELS_DIR / f"{mid}_grouped.h5" for mid in ALL_MODELS}
    win = single_window if single_window is not None else \
        np.zeros((1, 128, 8), dtype=np.float32)
    import tensorflow as tf2
    xf = tf2.constant(win, dtype=tf2.float32)
    for mid in ALL_MODELS:
        m = load_model_file(mid)
        lat = measure(lambda m=m, xf=xf: m(xf, training=False))
        lat_rows.append({"Modelo": mid, "Formato": "keras_float32",
                         "Motor": "Keras_model_x(PC)", **lat})
        print(f"  {mid:<26} {lat['media_ms']:.3f} ms (p95 {lat['p95_ms']:.3f})")
        del m
        tf.keras.backend.clear_session()

    # ------------------------------------------------- CSV + logs
    import csv
    fields = ["Modelo", "Formato", "Tamano_KB", "Exactitud", "F1_macro",
              "Recall_caida", "Recall_caida_IC95_inf", "Recall_caida_IC95_sup",
              "Convierte_sin_FlexOps"]
    with open(ASSETS / "tflite_resultados.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows_csv)

    with open(ASSETS / "tflite_latencia.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Modelo", "Formato", "Motor",
                                          "media_ms", "mediana_ms",
                                          "p95_ms", "de_ms"])
        w.writeheader()
        w.writerows(lat_rows)

    with open(ASSETS / "tflite_conversion_log.json", "w", encoding="utf-8") as f:
        json.dump(conv_log, f, indent=2, ensure_ascii=False)

    env = {
        "cpu": platform.processor(),
        "machine": platform.machine(),
        "python": platform.python_version(),
        "tensorflow": tf.__version__,
        "numpy": np.__version__,
        "os": f"{platform.system()} {platform.release()}",
        "aviso": "Las latencias son en PC y NO en ESP32-S3. Medición con CPU en reposo.",
    }
    with open(ASSETS / "entorno_latencia.txt", "w", encoding="utf-8") as f:
        for k, v in env.items():
            f.write(f"{k}: {v}\n")

    # versión por consola
    print("\n=== ENTORNO ===")
    print(f"CPU: {env['cpu']} | Python {env['python']} | TF {env['tensorflow']} "
          f"| numpy {env['numpy']}")
    print("[OK] Fase C completa.")


if __name__ == "__main__":
    main()
