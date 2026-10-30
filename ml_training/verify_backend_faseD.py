# -*- coding: utf-8 -*-
"""
M-10 · Verificación fase D:
  1. El backend FastAPI arranca (TestClient: GET /api/health).
  2. Una inferencia de prueba con backend/ml_engine.py funciona.
  3. Se reproduce el escenario de la Figura 6 (pico SVM 32.50 m/s², 380 °/s,
     inmovilidad post-impacto) y se reportan probabilidades softmax y latencia.
"""
import sys
import time
import json
from pathlib import Path

import numpy as np

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# 1) arranque del backend ------------------------------------------------
from fastapi.testclient import TestClient
from backend.main import app

# La BD local `mineria` está vacía: crear el esquema con los modelos ORM
# (solo DDL; sin sembrar datos de negocio) para que /api/health pueda contar.
from backend.database import engine, Base
import backend.models  # noqa: F401  (registra las tablas en Base.metadata)
Base.metadata.create_all(engine)

client = TestClient(app)
r = client.get("/api/health")
print(f"[1] GET /api/health -> {r.status_code}")
assert r.status_code == 200, r.text
print("    payload:", json.dumps(r.json(), ensure_ascii=False)[:200])

# escenario fig6 en unidades crudas del dataset (accel g, gyro °/s)
sys.path.insert(0, str(ROOT / "ml_training"))
from make_paper_figures import construir_escenario

t, vent, info = construir_escenario()
G = 9.80665
print(f"[2] escenario: pico SVM {info['svm_peak_ms2']:.2f} m/s² · "
      f"giro {info['gyro_peak']:.0f} °/s · impacto en t={info['t_impacto']:.2f} s")

# 3) inferencia con el backend (interfaz: accel m/s², gyro °/s) ----------
import backend.ml_engine as mle

# ventana como la construiría un smartphone a 20 ms vía /api/telemetry/stream
t0_ms = 0.0
recent_window = [
    {
        "accelX": float(vent[i, 0] * G), "accelY": float(vent[i, 1] * G),
        "accelZ": float(vent[i, 2] * G),
        "gyroAlpha": float(vent[i, 3]), "gyroBeta": float(vent[i, 4]),
        "gyroGamma": float(vent[i, 5]),
        "immobilityTimerSec": 0.0,
        # tasa del smartphone: 20 ms (50 Hz), timestamps en ms
        "timestamp": float(i) * 20.0,
    }
    for i in range(128)
]
current = dict(recent_window[-1])

# carga del modelo y medición de latencia end-to-end de la inferencia del motor
mle.get_loaded_model()
lats = []
res = None
for rep in range(50):
    _ = mle.classify_sensor_stream(current, previous=None, recent_window=recent_window)
for rep in range(200):
    t0 = time.perf_counter()
    res = mle.classify_sensor_stream(current, previous=None, recent_window=recent_window)
    lats.append((time.perf_counter() - t0) * 1000.0)
lat = float(np.mean(lats)); lat_p95 = float(np.percentile(lats, 95))

print(f"[3] modelo cargado: {Path(str(mle.MODEL_PATH)).name}")
print("    activity:", res["activity"], "| confidence:", res["confidence"],
      "| riskLevel:", res["riskLevel"])
print("    probabilities:", json.dumps(res.get("probabilities", {}), ensure_ascii=False))
print(f"    latencia classify_sensor_stream (PC): media {lat:.3f} ms · "
      f"p95 {lat_p95:.3f} ms | modelUsed: {res['modelUsed']}")

with open(ROOT / "ml_training" / "reports" / "paper_assets" / "fig6_via_backend.json",
          "w", encoding="utf-8") as f:
    json.dump({
        "escenario": "fig6 (caída a pique: pico SVM 32.50 m/s², 380 °/s, "
                     "inmovilidad post-impacto) vía backend/ml_engine.py",
        "activity": res["activity"], "confidence": res["confidence"],
        "riskLevel": res["riskLevel"],
        "probabilities": res.get("probabilities", {}),
        "latencia_backend_pc_ms": lat, "latencia_backend_pc_p95_ms": lat_p95,
        "features": res["features"],
        "nota": "latencia medida en PC (no ESP32-S3); incluye la evaluación de "
                "reglas de fusión + la inferencia del modelo",
    }, f, ensure_ascii=False, indent=2)
print("\n[OK] Fase D verificada: backend arranca e inferencia de prueba con "
      "probabilidades y latencia reportadas.")
