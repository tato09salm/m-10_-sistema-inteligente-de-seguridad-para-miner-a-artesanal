# -*- coding: utf-8 -*-
"""
M-10 · FASE 3 (manual): exporta a TFLite el modelo FINAL entrenado con los 38 sujetos
(train_cv38.py --final <modelo>) y comprueba que el .tflite reproduce al modelo Keras.

    cd ml_training
    python export_final_cv38.py --model Puro_1D_CNN --route directa

--route: la que funcionó en la Fase 1 para ese modelo (columna "Ruta" de
         reports/paper_assets/v2/tflite_resultados_v2.csv): directa | batch1 | batch1+unroll

No hay test independiente: la fidelidad se comprueba como concordancia de clases
entre Keras y TFLite sobre 2000 ventanas al azar (es una prueba de conversión, no de
desempeño; el desempeño es el de la CV fuera de fold).
Salidas: saved_models/tflite_cv38/*.tflite y reports/paper_assets/cv38/tflite_final_cv38.csv
"""
import os
import sys
import csv
import json
from pathlib import Path

import numpy as np

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf                           # noqa: E402
import export_tflite_latency as ex                # noqa: E402
from fase1_tflite_5modelos import variant_model   # noqa: E402

ROOT = Path(__file__).resolve().parent
SEED = 42


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=ex.ALL_MODELS)
    ap.add_argument("--route", default="directa", choices=["directa", "batch1", "batch1+unroll"])
    a = ap.parse_args()

    info = json.loads((ROOT / "reports" / "cv38" / "final" / a.model / "final_info.json")
                      .read_text(encoding="utf-8"))
    mu = np.array(info["normalization"]["mean"])
    sd = np.array(info["normalization"]["std"])
    X = np.load(ROOT / "data" / "processed" / "X.npy").astype(np.float32)
    y = np.load(ROOT / "data" / "processed" / "y.npy").astype(np.int64)
    groups = np.load(ROOT / "data" / "processed" / "groups.npy").astype(str)

    model = tf.keras.models.load_model(str(ROOT / "saved_models" / info["model_file"]),
                                       compile=False, custom_objects=ex.CUSTOM_OBJECTS)
    kw = {"directa": {}, "batch1": {"batch1": True},
          "batch1+unroll": {"batch1": True, "unroll": True}}[a.route]
    conv_model = model if not kw else variant_model(model, **kw)

    rng = np.random.RandomState(SEED)
    fit_idx = np.flatnonzero(np.isin(groups, info["fit_subjects"]))
    chosen = []
    for c in np.unique(y[fit_idx]):
        ic = fit_idx[y[fit_idx] == c]
        chosen.append(rng.choice(ic, size=int(round(500 * len(ic) / len(fit_idx))), replace=False))
    rep = np.concatenate(chosen)
    rng.shuffle(rep)
    X_rep = ((X[rep[:500]] - mu) / sd).astype(np.float32)

    probe_idx = rng.choice(len(X), size=2000, replace=False)
    X_probe = ((X[probe_idx] - mu) / sd).astype(np.float32)
    p_keras = model.predict(X_probe, batch_size=128, verbose=0)
    yk = p_keras.argmax(1)
    if kw:
        pv = conv_model.predict(X_probe[:256], batch_size=1, verbose=0)
        d = float(np.abs(pv - p_keras[:256]).max())
        print(f"Equivalencia de la variante: dif. máx. prob = {d:.2e}")
        assert d < 1e-4, "la variante no reproduce el modelo; no continuar"

    out_dir = ROOT / "saved_models" / "tflite_cv38"
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for fmt in ("float32", "int8"):
        try:
            b, _ = ex.convert_float32(conv_model) if fmt == "float32" \
                else ex.convert_int8_full(conv_model, X_rep)
        except Exception as e:
            print(f"[{fmt}] FALLA: {e!r}")
            rows.append({"Modelo": a.model, "Formato": fmt, "Ruta": a.route, "Convierte": "no",
                         "Tamano_KB": "", "Concordancia_con_Keras_pct": ""})
            continue
        (out_dir / f"{a.model}_cv38_{fmt}.tflite").write_bytes(b)
        yt, _ = ex.tflite_predict(b, X_probe, want_int8=(fmt == "int8"))
        conc = float((yt == yk).mean() * 100)
        rows.append({"Modelo": a.model, "Formato": fmt, "Ruta": a.route, "Convierte": "sí",
                     "Tamano_KB": round(len(b) / 1024, 1),
                     "Concordancia_con_Keras_pct": round(conc, 2)})
        print(f"[{fmt}] {len(b)/1024:.1f} KB · concordancia con Keras = {conc:.2f} %")
    dst = ROOT / "reports" / "paper_assets" / "cv38"
    dst.mkdir(parents=True, exist_ok=True)
    with open(dst / "tflite_final_cv38.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print("[OK] guardado", dst / "tflite_final_cv38.csv")


if __name__ == "__main__":
    main()
