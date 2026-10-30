# -*- coding: utf-8 -*-
"""
M-10 · Fase B: figuras PNG 300 dpi en ml_training/reports/paper_assets/.

Estilo: fondo blanco, sin título dentro de la figura, fuente sans-serif 9-10 pt,
etiquetas/leyendas en español, paleta Okabe-Ito (apta para daltonismo), ejes con
unidades, ancho 6.5 in sin título, cuadrícula ligera.

fig3_distribucion_clases.png      — barras 40 707 ventanas por clase
fig4_firma_caida.png              — ventana REAL de caída SisFall (2 paneles)
fig5_matriz_confusion_<model>.png — Puro_1D_CNN y Hibrido_CNN_LSTM (2 paneles c/u)
fig6_escenario_caida.png          — escenario sintético (SVM pico 32.50 m/s²,
                                    380 °/s, inmovilidad) por el modelo
                                    seleccionado (Puro_1D_CNN)
"""
import json
import sys
import os
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

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent
PROCESSED = ROOT / "data" / "processed"
FINAL_DIR = ROOT / "reports" / "final"
ASSETS = ROOT / "reports" / "paper_assets"
MODELS_DIR = ROOT / "saved_models"
SEED = 42
N_CLASSES = 3
SELECTED = "Puro_1D_CNN"
COMPARADO = "Hibrido_CNN_LSTM"

OKABE_ITO = ["#0072B2", "#D55E00", "#009E73", "#CC79A7",
             "#E69F00", "#56B4E9", "#999999"]
CLASES_ES = ["Actividad normal", "Posible caída", "Baja actividad"]

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Arial", "Helvetica"],
    "font.size": 9,
    "axes.titlesize": 10,
    "axes.labelsize": 9.5,
    "legend.fontsize": 8.5,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "axes.edgecolor": "#333333",
    "axes.linewidth": 0.7,
    "grid.alpha": 0.18,
    "grid.linewidth": 0.5,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
})
G = 9.80665


def guardar(fig, name, h_in):
    fig.set_size_inches(6.5, h_in)
    fig.tight_layout()
    p = ASSETS / name
    fig.savefig(p, dpi=300)
    plt.close(fig)
    print(f"  [OK] {name} ({p.stat().st_size/1024:.0f} KB)")


def es_pct(v, dec=2):
    """Formato con punto decimal (consistente con las tablas CSV)."""
    return f"{v:.{dec}f}"


# ------------------------------------------------------------------- fig 3
def fig3():
    y = np.load(PROCESSED / "y.npy").astype(int)
    counts = [int((y == c).sum()) for c in range(N_CLASSES)]
    total = np.sum(counts)
    fig, ax = plt.subplots()
    barras = ax.bar(np.arange(N_CLASSES), counts,
                    color=[OKABE_ITO[0], OKABE_ITO[1], OKABE_ITO[2]],
                    width=0.62, edgecolor="#333333", linewidth=0.6)
    for i, (b, c) in enumerate(zip(barras, counts)):
        ax.text(b.get_x() + b.get_width() / 2, c + total * 0.012,
                f"{c:,}\n({c / total * 100:.1f} %)".replace(",", " "),
                ha="center", va="bottom", fontsize=9)
    ax.set_xticks(np.arange(N_CLASSES))
    ax.set_xticklabels(CLASES_ES)
    ax.set_ylabel("Número de ventanas")
    ax.set_xlabel("Clase de actividad")
    ax.set_ylim(0, np.max(counts) * 1.16)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    guardar(fig, "fig3_distribucion_clases.png", 3.3)
    print(f"     total ventanas: {total:,} → 33,111 / 3,596 / 4,000")
    return counts


# ------------------------------------------------------------------- fig 4
def fig4():
    X = np.load(PROCESSED / "X.npy").astype(np.float32)
    groups = np.load(PROCESSED / "groups.npy").astype(str)
    rec_ids = np.load(PROCESSED / "record_ids.npy").astype(str)
    activity = np.load(PROCESSED / "activity.npy").astype(str)
    peak_pos = np.load(PROCESSED / "peak_pos.npy")
    window_idx = np.load(PROCESSED / "window_idx.npy").astype(int)

    # ventana REAL de caída de un sujeto SA (determinista): primer registro F##
    # del primer sujeto SA del test (SA01), ventana que contiene el pico de SVM
    test_subjects = json.loads((ROOT / "reports" / "test_subjects.json")
                               .read_text(encoding="utf-8"))["test_subjects"]
    sa_test = sorted(s for s in test_subjects if s.startswith("SA"))
    rec_sel, row_sel = None, None
    for s in sa_test:
        idx = [i for i in range(len(groups))
               if groups[i] == s and activity[i].upper().startswith("F")]
        if not idx:
            continue
        locs = ((peak_pos[idx] >= window_idx[idx]) &
                (peak_pos[idx] < window_idx[idx] + 128))
        idx_in = [idx[k] for k in np.flatnonzero(locs)]
        if not idx_in:
            continue
        rec_sel = rec_ids[idx_in[0]]
        row_sel = int(idx_in[0])
        break
    assert rec_sel is not None, "no hay ventana de caída SA en test"

    w = X[row_sel]                            # canales en unidades crudas
    pos_in_w = int(peak_pos[row_sel] - window_idx[row_sel])
    t = np.arange(128) / 50.0                 # 2.56 s

    svm_ms2 = w[:, 6] * G                     # SVM canal 6 en m/s²
    gyro_norm = w[:, 7]                       # norma giroscopio en °/s
    svm_peak = float(w[pos_in_w, 6]) * G
    gyro_peak = float(gyro_norm[pos_in_w])

    fig, (ax1, ax2) = plt.subplots(2, 1, sharex=True)
    ax1.plot(t, w[:, 0] * G, color=OKABE_ITO[3], lw=1.0, label="ax")
    ax1.plot(t, w[:, 1] * G, color=OKABE_ITO[1], lw=1.0, label="ay")
    ax1.plot(t, w[:, 2] * G, color=OKABE_ITO[0], lw=1.0, label="az")
    ax1.plot(t, svm_ms2, color=OKABE_ITO[2], lw=1.6, label="SVM")
    ax1.axvline(t[pos_in_w], color="#333333", lw=0.8, ls="--")
    ax1.set_ylabel("Aceleración (m/s²)")
    ax1.legend(ncol=4, frameon=False, loc="upper left")
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.grid(True)

    ax2.plot(t, w[:, 3], color=OKABE_ITO[3], lw=1.0, label="gx")
    ax2.plot(t, w[:, 4], color=OKABE_ITO[1], lw=1.0, label="gy")
    ax2.plot(t, w[:, 5], color=OKABE_ITO[0], lw=1.0, label="gz")
    ax2.plot(t, gyro_norm, color=OKABE_ITO[2], lw=1.6, label="‖ω‖")
    ax2.axvline(t[pos_in_w], color="#333333", lw=0.8, ls="--")
    ax2.set_ylabel("Velocidad angular (°/s)")
    ax2.set_xlabel("Tiempo (s)")
    ax2.set_xlim(0, 2.56)
    ax2.legend(ncol=4, frameon=False, loc="upper left")
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    ax2.grid(True)

    guardar(fig, "fig4_firma_caida.png", 5.0)
    with open(ASSETS / "fig4_datos.txt", "w", encoding="utf-8") as f:
        f.write(f"registro usado: {rec_sel} (sujeto {groups[row_sel]}, "
                f"actividad {activity[row_sel]})\n")
        f.write("ventana: 128 pasos a 50 Hz (2,56 s), contiene el pico de SVM\n")
        f.write(f"pico de SVM: {svm_peak:.4f} m/s² ({svm_peak / G:.4f} g)"
                f" en t = {t[pos_in_w]:.4f} s (paso {pos_in_w} de 128)\n")
        f.write(f"norma del giroscopio en el pico: {gyro_peak:.4f} °/s\n")
        f.write("conversión: m/s² = g × 9,80665; canales del dataset:\n")
        f.write("  [accel_x, accel_y, accel_z] en g; [gyro_x, gyro_y, "
                "gyro_z] en °/s; SVM en g; norma giroscopio en °/s\n")
        f.write("pipeline: SisFall real · ventana seleccionada de forma "
                "determinista (primer sujeto SA del test con registro F##, "
                "ventana que contiene el pico)\n")
    print(f"     registro: {rec_sel} · pico SVM {svm_peak:.2f} m/s² · "
          f"gyro {gyro_peak:.1f} °/s")


# ------------------------------------------------------------------- fig 5
def fig5(mid):
    met = json.loads((FINAL_DIR / mid / "metrics_test.json")
                     .read_text(encoding="utf-8"))
    cm = np.array(met["metrics_test_clean"]["confusion_matrix"], dtype=float)
    cmn = cm / cm.sum(axis=1, keepdims=True) * 100.0

    fig, (axc, axn) = plt.subplots(1, 2)
    for (ax, M, fmt, vmax) in ((axc, cm, "{:.0f}", None),
                               (axn, cmn, "{:.1f} %", 100)):
        im = ax.imshow(M, cmap="Blues", vmin=0, vmax=vmax or M.max() * 1.05)
        for i in range(N_CLASSES):
            for j in range(N_CLASSES):
                col = "white" if M[i, j] > (vmax or M.max()) * 0.55 else "#222222"
                ax.text(j, i, fmt.format(M[i, j]), ha="center", va="center",
                        color=col, fontsize=9)
        ax.set_xticks(range(N_CLASSES))
        ax.set_yticks(range(N_CLASSES))
        ax.set_xticklabels(["Normal", "Posible caída", "Baja actividad"],
                           rotation=30, ha="right")
        ax.set_yticklabels(["Normal", "Posible caída", "Baja actividad"])
        ax.set_xlabel("Predicción")
        if ax is axc:
            ax.set_ylabel("Clase real")
        fig.colorbar(im, ax=ax, fraction=0.046, pad=0.03)
    guardar(fig, f"fig5_matriz_confusion_{mid}.png", 3.1)


# ------------------------------------------------------------------- fig 6
def construir_escenario():
    """Ventana 128 pasos @50 Hz del escenario inyectado (unidades crudas del
    dataset: aceleración en g, giroscopio en °/s)."""
    rng = np.random.RandomState(SEED)
    n = 128
    t = np.arange(n) / 50.0
    # envolventes en pasos
    p_impacto = 42            # t = 0.84 s
    svm_peak_g = 32.50 / G    # 32.50 m/s² → g
    gyro_peak = 380.0

    svm_target = np.full(n, 1.0)
    svm_target[:int(0.40 * 50)] = 1.0                       # reposo
    fase_caible = int(0.40 * 50), int(0.80 * 50)
    svm_target[fase_caible[0]:fase_caible[1]] = np.linspace(
        1.0, 0.15, fase_caible[1] - fase_caible[0])          # caída libre
    # impacto: envolvente triangular ±4 pasos alrededor del pico
    env = np.zeros(n)
    for k in range(1, 6):
        env[p_impacto - k] = max(0.0, 1.0 - k / 6)
        env[p_impacto + k] = max(0.0, 1.0 - k / 6)
    env[p_impacto] = 1.0
    svm_impacto = env * svm_peak_g

    # tren de reposo tras el impacto (inmovilidad): SVM ≈ 1 g
    svm_target[p_impacto + 6:] = 1.0
    svm_signal = svm_target.copy()
    svm_signal[p_impacto - 5:p_impacto + 6] = np.maximum(
        svm_target[p_impacto - 5:p_impacto + 6], svm_impacto[p_impacto - 5:p_impacto + 6])

    # canales de aceleración: repartir el vector para que la norma sea SVM
    ax = np.zeros(n); ay = np.zeros(n); az = np.ones(n)
    # fase de caída libre: az cae hacia ~0.05 g
    for i in range(*fase_caible):
        az[i] = svm_target[i]
    # impacto: componente principal en x y z
    ratio_x, ratio_z = 2.0 / np.sqrt(2.0**2 + 2.6**2 + 0.8**2), \
        2.6 / np.sqrt(2.0**2 + 2.6**2 + 0.8**2)
    ratio_y = 0.8 / np.sqrt(2.0**2 + 2.6**2 + 0.8**2)
    for i in range(p_impacto - 5, p_impacto + 6):
        ax[i] = svm_signal[i] * ratio_x
        ay[i] = svm_signal[i] * ratio_y
        az[i] = svm_signal[i] * ratio_z
    # reposo e inmovilidad: az ≈ 1 g
    ax[p_impacto + 6:] = 0.0
    ay[p_impacto + 6:] = 0.0
    az[p_impacto + 6:] = 1.0

    # giroscopio: picos alrededor del impacto; norma pico = 380 °/s
    envg = np.zeros(n)
    for k in range(1, 7):
        envg[max(0, p_impacto - k)] = max(envg[max(0, p_impacto - k)], 1.0 - k / 7)
        envg[min(n - 1, p_impacto + k)] = max(envg[min(n - 1, p_impacto + k)],
                                              1.0 - k / 7)
    envg[p_impacto] = 1.0
    go = np.zeros(n)
    gx = go.copy(); gy = go.copy(); gz = go.copy()
    for i in np.flatnonzero(envg > 0):
        gx[i] = envg[i] * gyro_peak * 0.45
        gy[i] = -envg[i] * gyro_peak * 0.35
        gz[i] = envg[i] * gyro_peak * np.sqrt(1 - 0.45**2 - 0.35**2)
    gyro_norm = np.sqrt(gx**2 + gy**2 + gz**2)
    svmpk_actual = np.sqrt(ax[p_impacto]**2 + ay[p_impacto]**2 + az[p_impacto]**2) * G
    # eliminar ruido directo por determinismo (sin ruido extra: reproducible)
    vent = np.stack([ax, ay, az, gx, gy, gz, svm_signal, gyro_norm], axis=1
                    ).astype(np.float32)
    return t, vent, dict(p_impacto=p_impacto,
                         svm_peak_ms2=float(svmpk_actual),
                         gyro_peak=float(gyro_norm[p_impacto]),
                         t_impacto=float(t[p_impacto]))


def fig6():
    import csv as _csv
    t, vent, info = construir_escenario()

    # Probabilidades por la MISMA vía end-to-end del sistema (backend/ml_engine):
    # ventana de 128 muestras a 20 ms en m/s² → conversión m/s²→g → softmax.
    pr = str(ROOT.parent)
    if pr not in sys.path:
        sys.path.insert(0, pr)
    import backend.ml_engine as mle
    recent_window = [
        {"accelX": float(vent[i, 0] * G), "accelY": float(vent[i, 1] * G),
         "accelZ": float(vent[i, 2] * G),
         "gyroAlpha": float(vent[i, 3]), "gyroBeta": float(vent[i, 4]),
         "gyroGamma": float(vent[i, 5]),
         "immobilityTimerSec": 0.0, "timestamp": float(i) * 20.0}
        for i in range(128)]
    current = dict(recent_window[-1])
    mle.get_loaded_model()
    res = mle.classify_sensor_stream(current, previous=None, recent_window=recent_window)
    probs = np.array([res["probabilities"][mle.CLASS_NAMES[i]]
                      for i in range(N_CLASSES)], dtype=np.float64)
    pred = int(np.argmax(probs))

    # latencias de la MISMA medición reportada en tabla3 (tflite_latencia.csv)
    lat, lat_p95, lat_tf8, lat_tf8_p95 = None, None, None, None
    with open(ASSETS / "tflite_latencia.csv", encoding="utf-8") as f:
        for r in _csv.DictReader(f):
            if r["Modelo"] == SELECTED:
                if r["Motor"].startswith("Keras"):
                    lat, lat_p95 = float(r["media_ms"]), float(r["p95_ms"])
                elif r["Formato"] == "int8":
                    lat_tf8, lat_tf8_p95 = float(r["media_ms"]), float(r["p95_ms"])

    svm_ms2 = vent[:, 6] * G
    gyro_norm = vent[:, 7]

    fig, (ax1, ax2) = plt.subplots(2, 1, height_ratios=[1.35, 1.0])
    ax1.plot(t, svm_ms2, color=OKABE_ITO[1], lw=1.7, label="SVM (aceleración)")
    ax1.plot(t, gyro_norm, color=OKABE_ITO[0], lw=1.2, label="Norma giroscopio")
    ax1.axvline(info["t_impacto"], color="#333333", lw=0.8, ls="--")
    ax1.annotate(f"impacto\n{es_pct(svm_ms2[info['p_impacto']], 2)} m/s² · "
                 f"{info['gyro_peak']:.0f} °/s",
                 xy=(info["t_impacto"], svm_ms2[info["p_impacto"]]),
                 xytext=(info["t_impacto"] + 0.25, svm_ms2[info["p_impacto"]] * 0.92),
                 fontsize=8.5, arrowprops=dict(arrowstyle="->", lw=0.7,
                                               color="#333333"))
    ax1.set_ylabel("Magnitud (m/s² · °/s)")
    ax1.legend(frameon=False, loc="center right", fontsize=8.5)
    ax1.set_xlabel("Tiempo (s)")
    ax1.set_xlim(0, 2.56)
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.grid(True)

    colores = [OKABE_ITO[i] for i in range(N_CLASSES)]
    barras = ax2.bar(np.arange(N_CLASSES), probs * 100.0, color=colores,
                     width=0.58, edgecolor="#333333", linewidth=0.6)
    for b, c, name in zip(barras, probs, CLASES_ES):
        ax2.text(b.get_x() + b.get_width() / 2, c * 100 + 2.5,
                 f"{es_pct(c * 100)} %", ha="center", va="bottom", fontsize=8.5)
    ax2.set_xticks(np.arange(N_CLASSES))
    ax2.set_xticklabels(CLASES_ES)
    ax2.set_ylabel("Probabilidad (%)")
    ax2.set_xlabel("Clase de actividad")
    ax2.set_ylim(0, 118)
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)

    pred_txt = (f"Predicción vía backend ({SELECTED}): {CLASES_ES[pred]} "
                f"({es_pct(probs[pred] * 100)} %) · latencias en PC, "
                f"NO en ESP32: Keras {es_pct(lat, 3)} ms (p95 {es_pct(lat_p95, 3)}), "
                f"TFLite int8 {es_pct(lat_tf8, 4)} ms (p95 {es_pct(lat_tf8_p95, 4)})")
    ax2.annotate(pred_txt, xy=(0.5, 0.02), xycoords="axes fraction",
                 ha="center", va="bottom", fontsize=8.5,
                 bbox=dict(boxstyle="round,pad=0.35", fc="#F2F2F2",
                           ec=OKABE_ITO[pred], lw=0.9))
    guardar(fig, "fig6_escenario_caida.png", 5.4)

    with open(ASSETS / "fig6_resultado.json", "w", encoding="utf-8") as f:
        json.dump({"modelo": SELECTED,
                   "via": "backend/ml_engine.classify_sensor_stream (end-to-end)",
                   "probabilidades_softmax": {
            CLASES_ES[i]: float(probs[i]) for i in range(N_CLASSES)},
            "prediccion": pred, "clase_predicha": CLASES_ES[pred],
            "latencia_keras_pc_ms": lat, "latencia_keras_pc_p95_ms": lat_p95,
            "latencia_tflite_int8_pc_ms": lat_tf8,
            "latencia_tflite_int8_pc_p95_ms": lat_tf8_p95,
            "escenario": info,
            "nota": "probabilidades obtenidas por la vía del backend (la ventana "
                    "recorre g→m/s²→g y la que reconstruye el motor difiere en "
                    "una muestra de la ventana exacta del escenario); latencias "
                    "medidas en PC (Keras y TFLite Interpreter 1 hilo); "
                    "NO corresponden a un ESP32-S3"},
           f, ensure_ascii=False, indent=2)
    print(f"     escenario (vía backend) → {CLASES_ES[pred]} "
          f"({probs[pred]*100:.2f} %) · Keras {lat:.3f} ms · "
          f"TFLite int8 {lat_tf8:.4f} ms (PC)")


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    print("=== Fase B: figuras ===")
    fig3()
    fig4()
    fig5(SELECTED)
    fig5(COMPARADO)
    fig6()
    print("[OK] Fase B completa.")
