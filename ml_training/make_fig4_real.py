# -*- coding: utf-8 -*-
"""
M-10 · Figura 4 con un registro REAL de SisFall (F01_SA01_R01 por defecto).
Usa las MISMAS funciones del pipeline (preprocess_sisfall.py): conversión de
unidades, submuestreo a 50 Hz con antialiasing y la ventana de 128 pasos de la
rejilla que contiene el pico de SVM (la que se etiqueta "Posible caída").

Uso (PowerShell, dentro de ml_training):
    python make_fig4_real.py
    python make_fig4_real.py F05_SA10_R02      # otro registro, si lo prefieres
Salida: reports/paper_assets/cv38/fig4_ventana_caida_real.png  (+ valores en consola)
"""
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import preprocess_sisfall as ps

rec = sys.argv[1] if len(sys.argv) > 1 else "F01_SA01_R01"
cands = list(ps.DATASET_ROOT.glob(f"**/{rec}.txt"))
if not cands:
    sys.exit(f"No se encontró {rec}.txt en {ps.DATASET_ROOT}")
arr = ps.convert_units(ps.load_record(cands[0]))
a50 = ps.decimate_to_50hz(arr)
svm = np.sqrt((a50[:, :3] ** 2).sum(1)); gn = np.sqrt((a50[:, 3:] ** 2).sum(1))
peak = int(np.argmax(svm))
starts = [s for s in ps.grid_starts(len(a50)) if s <= peak < s + ps.WINDOW_SIZE]
s = starts[0]; sl = slice(s, s + ps.WINDOW_SIZE)
t = np.arange(ps.WINDOW_SIZE) / ps.FS_TARGET
A, G, S, N = a50[sl, :3], a50[sl, 3:], svm[sl], gn[sl]

plt.rcParams.update({"font.size": 6.5, "axes.spines.top": False, "axes.spines.right": False})
fig, (a1, a2) = plt.subplots(2, 1, figsize=(3.15, 3.0), sharex=True)
for i, (lab, c) in enumerate(zip(["Acel. X", "Acel. Y", "Acel. Z"], ["#4F9DDE", "#7B4FC9", "#E0568A"])):
    a1.plot(t, A[:, i], lw=0.9, color=c, label=lab)
a1.plot(t, S, lw=1.6, color="#E0A21B", label="SVM")
a1.set_ylabel("Aceleración (g)"); a1.legend(ncol=2, frameon=False, fontsize=5.5, loc="upper left")
for i, (lab, c) in enumerate(zip(["Giro X", "Giro Y", "Giro Z"], ["#1FB58F", "#1C7FA3", "#E0568A"])):
    a2.plot(t, G[:, i], lw=0.9, color=c, label=lab)
a2.plot(t, N, lw=1.6, color="#1F2A44", label="Norma del giroscopio")
a2.set_ylabel("Velocidad angular (°/s)"); a2.set_xlabel("Tiempo (s)")
a2.legend(ncol=2, frameon=False, fontsize=5.5, loc="upper left")
for a in (a1, a2):
    a.axvline((peak - s) / ps.FS_TARGET, color="#999999", ls=":", lw=1)
fig.tight_layout()
out = Path("reports/paper_assets/cv38"); out.mkdir(parents=True, exist_ok=True)
fig.savefig(out / "fig4_ventana_caida_real.png", dpi=600)
pre = S[: max(1, peak - s)]
print(f"Registro: {rec} | ventana inicia en paso {s} | pico SVM en t={(peak - s) / 50:.2f} s de la ventana")
print(f"SVM mínimo previo al impacto: {pre.min():.2f} g | SVM pico: {S.max():.2f} g ({S.max()*9.80665:.1f} m/s²)")
print(f"Giroscopio máx. (norma): {N.max():.0f} °/s")
print("Guardado:", out / "fig4_ventana_caida_real.png")
