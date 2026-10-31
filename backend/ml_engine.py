import os
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
import numpy as np

# Suppress TensorFlow verbose info logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml_training" / "saved_models" / "Hibrido_CNN_LSTM_cv38_final.h5"

# Normalización por canal calculada SOLO con los sujetos de ajuste (fit) del modelo
# final (ver ml_training/reports/cv38/final/Hibrido_CNN_LSTM/final_info.json).
# Modelo final: Hibrido_CNN_LSTM entrenado con los 38 sujetos de SisFall real
# (aceleración en g, giroscopio en °/s). El backend recibe aceleración en m/s²
# -> se convierte. No hay test independiente: el desempeño es el de la
# validación cruzada por sujeto (5 folds, predicciones fuera de fold).
NORMALIZATION_MEAN = [0.0014527755556628108, -0.8217237591743469, -0.1399737149477005,
                      -0.2534436881542206, 2.3006606101989746, -0.2107565850019455,
                      1.0670877695083618, 37.640743255615234]
NORMALIZATION_STD = [0.36880505084991455, 0.5653885006904602, 0.44487422704696655,
                     41.73246383666992, 35.33156967163086, 29.045255661010742,
                     0.4569784700870514, 49.14042282104492]
_G_TO_MS2 = 9.80665

_neural_model = None

def get_loaded_model():
    global _neural_model
    if _neural_model is None and MODEL_PATH.exists():
        try:
            import tensorflow as tf
            _neural_model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            print(f"[ML Engine] Modelo neuronal cargado exitosamente desde: {MODEL_PATH.name}")
        except Exception as e:
            print(f"[ML Engine] Aviso: No se pudo cargar el archivo .h5 ({e}). Usando motor cinemático híbrido.")
            _neural_model = False
    return _neural_model if _neural_model is not False else None

def calculate_svm(x: float, y: float, z: float) -> float:
    return math.sqrt(x * x + y * y + z * z)

def calculate_gyro_norm(alpha: float = 0.0, beta: float = 0.0, gamma: float = 0.0) -> float:
    return math.sqrt(alpha * alpha + beta * beta + gamma * gamma)

def calculate_tilt_angle(x: float, y: float, z: float) -> float:
    norm = calculate_svm(x, y, z)
    if norm == 0:
        return 0.0
    cos_theta = min(1.0, max(-1.0, abs(z) / norm))
    return math.degrees(math.acos(cos_theta))

# Modelo de 3 salidas validado con CV POR SUJETO sobre el dataset REAL
# de SisFall (sin fuga de información):
#   0 actividad_normal | 1 posible_caida | 2 baja_actividad (D12-D14).
# NOTA: la etiqueta "inmovilidad_prolongada" ya NO es una salida del modelo;
# la inmovilidad se trata como regla heurística aparte (ver abajo).
# La clase "movimiento_inusual" solo existe como regla heurística NO VALIDADA.
CLASS_NAMES = ["actividad_normal", "posible_caida", "baja_actividad"]

def classify_sensor_stream(
    current: Dict[str, Any],
    previous: Optional[Dict[str, Any]] = None,
    recent_window: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    if recent_window is None:
        recent_window = []

    x = float(current.get("accelX", 0.0))
    y = float(current.get("accelY", 9.81))
    z = float(current.get("accelZ", 0.0))
    alpha = float(current.get("gyroAlpha", 0.0))
    beta = float(current.get("gyroBeta", 0.0))
    gamma = float(current.get("gyroGamma", 0.0))

    svm = calculate_svm(x, y, z)
    gyro_norm = calculate_gyro_norm(alpha, beta, gamma)
    tilt_angle = calculate_tilt_angle(x, y, z)

    # Compute Jerk
    jerk = 0.0
    if previous:
        prev_svm = calculate_svm(
            float(previous.get("accelX", 0.0)),
            float(previous.get("accelY", 9.81)),
            float(previous.get("accelZ", 0.0))
        )
        dt = 0.2
        if "timestamp" in current and "timestamp" in previous:
            try:
                t1 = float(current["timestamp"])
                t2 = float(previous["timestamp"])
                dt = max((t1 - t2) / 1000.0, 0.05)
            except Exception:
                dt = 0.2
        jerk = abs(svm - prev_svm) / dt

    # Windowed variance for immobility
    variance = 0.5
    if len(recent_window) > 3:
        svms = [
            calculate_svm(float(r.get("accelX", 0.0)), float(r.get("accelY", 9.81)), float(r.get("accelZ", 0.0)))
            for r in recent_window
        ]
        mean = sum(svms) / len(svms)
        variance = sum((b - mean) ** 2 for b in svms) / len(svms)

    immobility_sec = current.get("immobilityTimerSec")
    if immobility_sec is None:
        immobility_sec = 35.0 if (len(recent_window) > 3 and variance < 0.03) else 0.0
    else:
        immobility_sec = float(immobility_sec)

    # 1. Check Neural .h5 Model Inference
    model = get_loaded_model()
    neural_activity = None
    neural_confidence = 0.95
    neural_probs = None

    if model is not None and len(recent_window) >= 8:
        try:
            # Construct a 128-step input window tensor from real recent history
            # Unidades de ENTRADA del modelo: aceleración en g, giroscopio °/s.
            window_pts = []
            for item in recent_window[-128:]:
                ax_i = float(item.get("accelX", 0.0)) / _G_TO_MS2   # m/s² -> g
                ay_i = float(item.get("accelY", 9.81)) / _G_TO_MS2  # m/s² -> g
                az_i = float(item.get("accelZ", 0.0)) / _G_TO_MS2   # m/s² -> g
                gx_i = float(item.get("gyroAlpha", 0.0))            # °/s
                gy_i = float(item.get("gyroBeta", 0.0))             # °/s
                gz_i = float(item.get("gyroGamma", 0.0))            # °/s
                svm_i = calculate_svm(ax_i, ay_i, az_i)             # g
                gnorm_i = calculate_gyro_norm(gx_i, gy_i, gz_i)     # °/s
                window_pts.append([ax_i, ay_i, az_i, gx_i, gy_i, gz_i, svm_i, gnorm_i])

            # Ventana de las últimas 128 muestras DISTINTAS cuando el búfer
            # está lleno (recent_window ya incluye el punto actual como su
            # última entrada). Con búfer corto (<128), rellenar repitiendo por
            # el frente el punto más antiguo y añadir el punto actual como
            # muestra 128.
            if len(recent_window) < 128:
                current_pt = [x / _G_TO_MS2, y / _G_TO_MS2, z / _G_TO_MS2,
                              alpha, beta, gamma,
                              svm / _G_TO_MS2, gyro_norm]
                while len(window_pts) < 127:
                    window_pts.insert(0, window_pts[0] if window_pts
                                      else list(current_pt))
                window_pts.append(list(current_pt))

            # Normalización por canal (media/DE del train del desarrollo)
            input_tensor = (np.array([window_pts[-128:]], dtype=np.float32)
                            - np.asarray(NORMALIZATION_MEAN, dtype=np.float32)) \
                           / np.asarray(NORMALIZATION_STD, dtype=np.float32)
            probs = model.predict(input_tensor, verbose=0)[0]
            neural_probs = probs
            pred_class_idx = int(np.argmax(probs))
            neural_confidence = float(probs[pred_class_idx])
            if pred_class_idx < len(CLASS_NAMES):
                neural_activity = CLASS_NAMES[pred_class_idx]
        except Exception as err:
            print(f"[ML Engine] Aviso: inferencia neuronal omitida ({err}). Se usan reglas cinemáticas.")

    # Hybrid Rules & Neural Ensemble
    # Heurísticas (posible_caida / inmovilidad_prolongada / movimiento_inusual):
    #   - "posible_caida" e "inmovilidad_prolongada" son reglas de fusión basadas
    #     en umbrales empíricos de cinemática y temporización.
    #   - "movimiento_inusual" NO proviene del modelo entrenado y NO ha sido
    #     validada contra SisFall real: se conserva por compatibilidad y su
    #     resultado debe interpretarse como provisional (no validado).
    activity = "actividad_normal"
    confidence = 0.92
    risk_level = "bajo"
    reasoning = "Patrón de movimiento cinemático normal compatible con labores de minería subterránea."
    recommended_action = "Mantener monitoreo continuo de rutina."

    is_fall_impact = svm > 26.0 or (svm > 22.0 and jerk > 40.0) or (svm > 20.0 and gyro_norm > 220.0)
    had_free_fall = any(
        calculate_svm(float(r.get("accelX", 0.0)), float(r.get("accelY", 9.81)), float(r.get("accelZ", 0.0))) < 5.0
        for r in recent_window
    )

    if is_fall_impact or (had_free_fall and svm > 18.0) or neural_activity == "posible_caida":
        activity = "posible_caida"
        confidence = max(0.95, neural_confidence)
        risk_level = "critico"
        reasoning = f"Impacto severo detectado (SVM: {svm:.1f} m/s², Jerk: {jerk:.1f} m/s³). Inferencia Red Neuronal SisFall: {round(confidence*100, 1)}% certeza."
        recommended_action = "¡ALERTA CRÍTICA! Enviar brigadista de primeros auxilios y verificar signos vitales."
    elif immobility_sec >= 30.0 or (variance < 0.02 and 8.5 < svm < 11.0 and immobility_sec >= 20.0) or neural_activity == "inmovilidad_prolongada":
        activity = "inmovilidad_prolongada"
        confidence = max(0.92, min(0.99, 0.85 + (immobility_sec / 200.0)))
        risk_level = "critico" if immobility_sec > 60.0 else "alto"
        reasoning = f"Inmovilidad absoluta sostenida por más de {round(immobility_sec)} segundos (Varianza: {variance:.3f}). Posible desmayo o atrapamiento."
        recommended_action = "Activar canal de radio de emergencia y despachar supervisor al cuadrante."
    elif svm > 17.0 or gyro_norm > 190.0 or jerk > 30.0 or variance > 8.0:
        activity = "movimiento_inusual"  # HEURÍSTICA NO VALIDADA (ver comentario arriba)
        confidence = 0.89
        risk_level = "medio"
        reasoning = f"Aceleración o rotación anómala fuera de umbrales típicos (SVM: {svm:.1f} m/s², Giroscopio: {gyro_norm:.1f}°/s)."
        recommended_action = "Monitorear evolución y verificar estabilidad del frente de extracción."
    else:
        activity = "actividad_normal"
        confidence = max(0.94, neural_confidence)
        risk_level = "bajo"
        reasoning = f"Cinemática estable (SVM: {svm:.1f} m/s², Giroscopio: {gyro_norm:.1f}°/s). Actividad minera estándar."
        recommended_action = "Operación normal."

    payload = {
        "activity": activity,
        "confidence": round(confidence, 3),
        "riskLevel": risk_level,
        "features": {
            "svm": round(svm, 2),
            "maxJerk": round(jerk, 2),
            "gyroMagnitude": round(gyro_norm, 2),
            "immobilityDurationSec": round(immobility_sec),
            "tiltAngleDeg": round(tilt_angle, 1),
            "vibrationEnergy": round(variance, 3),
        },
        "reasoning": reasoning,
        "detectedAt": datetime.now(timezone.utc).isoformat(),
        "recommendedAction": recommended_action,
        "modelUsed": "SisFall Hibrido_CNN_LSTM_cv38_final.h5 (dataset real, 3 clases, "
                     "validación cruzada por sujeto, 38 sujetos)",
    }
    # Probabilidades softmax del modelo (si la inferencia neuronal se ejecutó)
    if neural_probs is not None:
        payload["probabilities"] = {
            CLASS_NAMES[i]: round(float(neural_probs[i]), 4)
            for i in range(len(CLASS_NAMES))}
    return payload
