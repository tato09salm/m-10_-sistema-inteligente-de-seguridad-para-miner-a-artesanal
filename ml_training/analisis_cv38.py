# -*- coding: utf-8 -*-
"""
M-10 · FASE 2b (manual): análisis del RESULTADO PRINCIPAL (CV de 5 folds por sujeto
sobre los 38 sujetos) a partir de las predicciones fuera de fold (OOF).

No entrena nada. Ejecutar cuando train_cv38.py haya terminado los 5 modelos:
    cd ml_training
    python analisis_cv38.py

Salidas en reports/paper_assets/cv38/ :
  tabla2_hiperparametros_cv38.csv   tabla3_desempeno_cv38.csv
  tabla4_estadistica_cv38.csv       tabla_por_clase_cv38.csv
  tabla_eventos_cv38.csv            metricas_por_sujeto_cv38.csv
  fig5_matriz_confusion_cv38_<modelo>.png      resumen_cv38.md
Todos los números salen de las predicciones guardadas (nada se estima a mano).
IC: bootstrap por SUJETO (1000 remuestreos, semilla 42, mismos sujetos remuestreados
para todos los modelos) y Clopper-Pearson por ventana donde se indica.
"""
import os
import sys
import csv
import json
from pathlib import Path

import numpy as np
from scipy import stats

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import compute_metrics as cm      # reutiliza funciones ya validadas (IC, Wilcoxon, McNemar...)

ROOT = Path(__file__).resolve().parent
CV_DIR = ROOT / "reports" / "cv38" / "cv_results"
ASSETS = ROOT / "reports" / "paper_assets" / "cv38"
LAT_CSV = ROOT / "reports" / "paper_assets" / "v2" / "tflite_latencia_v2.csv"
MODELS = ["Puro_1D_CNN", "Puro_Bi_LSTM", "Puro_GRU", "Hibrido_CNN_LSTM",
          "Hibrido_Attention_ResGRU"]
ARQ = {"Puro_1D_CNN": "Conv1D(64)-BN-MaxPool-Conv1D(128)-GAP-Dense",
       "Puro_Bi_LSTM": "BiLSTM(64)-Dropout-BiLSTM(32)-Dense",
       "Puro_GRU": "GRU(64, seq)-Dropout-GRU(64)-Dense",
       "Hibrido_CNN_LSTM": "Conv1D(64)-Pool-Conv1D(128)-LSTM(64)-Dense",
       "Hibrido_Attention_ResGRU": "Conv1D-Atención-ResGRU(64)-Dense"}
CLASES = ["Actividad normal", "Posible caída", "Baja actividad"]
K = 3
B = 1000
SEED = 42
ASSETS.mkdir(parents=True, exist_ok=True)


def write_csv(name, rows):
    if not rows:
        return
    fields = list(rows[0].keys())
    with open(ASSETS / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"  escrito {name} ({len(rows)} filas)")


def confusion(yt, yp):
    cmx = np.zeros((K, K), dtype=np.int64)
    np.add.at(cmx, (yt.astype(int), yp.astype(int)), 1)
    return cmx


def f1_macro_from_cm(C):
    f = []
    for c in range(K):
        tp = C[..., c, c]
        fp = C[..., :, c].sum(-1) - tp
        fn = C[..., c, :].sum(-1) - tp
        den = 2 * tp + fp + fn
        f.append(np.where(den > 0, 2 * tp / np.maximum(den, 1), 0.0))
    return np.mean(f, axis=0)


def main():
    oof = {}
    for m in MODELS:
        p = CV_DIR / m / "oof_predictions.npz"
        if not p.exists():
            print(f"[ERROR] Falta {p}. Ejecuta primero train_cv38.py para los 5 modelos.")
            sys.exit(1)
        z = np.load(p, allow_pickle=False)
        oof[m] = {k: z[k] for k in z.files}
    ref = oof[MODELS[0]]
    for m in MODELS:    # misma ventana, mismo orden en todos los modelos
        assert (oof[m]["y_true"] == ref["y_true"]).all() and (oof[m]["subject"] == ref["subject"]).all()
    yt, subj = ref["y_true"], ref["subject"].astype(str)
    subjects = sorted(set(subj.tolist()))
    fall_subj = [s for s in subjects if ((yt == 1) & (subj == s)).any()]
    print(f"[CV38] {len(yt)} ventanas · {len(subjects)} sujetos · {len(fall_subj)} con caídas")

    # confusión por sujeto (para bootstrap por sujeto)
    rng = np.random.default_rng(SEED)
    idx = rng.integers(0, len(subjects), size=(B, len(subjects)))
    C_subj = {m: np.stack([confusion(yt[subj == s], oof[m]["y_pred"][subj == s]) for s in subjects])
              for m in MODELS}
    fall_idx = [subjects.index(s) for s in fall_subj]
    idx_fall = rng.integers(0, len(fall_subj), size=(B, len(fall_subj)))

    # ---------------- Tabla 3 + por clase
    folds_acc = {}
    for m in MODELS:
        a = []
        for k in range(5):
            p = CV_DIR / m / f"fold{k}" / "metrics.json"
            a.append(json.loads(p.read_text(encoding="utf-8"))["accuracy"])
        folds_acc[m] = a
    lat = {}
    if LAT_CSV.exists():
        for r in csv.DictReader(open(LAT_CSV, encoding="utf-8")):
            lat[(r["Modelo"], r["Formato"])] = r["mediana_ms"]
    t3, t_cls = [], []
    for m in MODELS:
        yp = oof[m]["y_pred"]
        C = C_subj[m].sum(0)
        n = C.sum()
        acc = np.trace(C) / n
        f1m = float(f1_macro_from_cm(C))
        rec_fall = C[1, 1] / max(1, C[1].sum())
        lo_cp, hi_cp = cm.clopper_pearson(int(C[1, 1]), int(C[1].sum()))
        Cb = C_subj[m][idx].sum(1)                                        # (B,K,K)
        acc_b = np.trace(Cb, axis1=1, axis2=2) / Cb.sum((1, 2))
        f1_b = f1_macro_from_cm(Cb)
        Cf = C_subj[m][fall_idx][idx_fall].sum(1)                          # solo sujetos con caídas
        rf_b = Cf[:, 1, 1] / np.maximum(1, Cf[:, 1].sum(1))
        ypn = oof[m]["y_pred_snr20"]
        rec_fall_n = ((ypn == 1) & (yt == 1)).sum() / max(1, (yt == 1).sum())
        mp = ROOT / "saved_models" / f"{m}_grouped.h5"
        t3.append({
            "Modelo": m,
            "Exactitud_OOF": round(acc * 100, 2),
            "Exactitud_IC95_inf": round(np.percentile(acc_b, 2.5) * 100, 2),
            "Exactitud_IC95_sup": round(np.percentile(acc_b, 97.5) * 100, 2),
            "F1_macro_OOF": round(f1m * 100, 2),
            "F1_macro_IC95_inf": round(np.percentile(f1_b, 2.5) * 100, 2),
            "F1_macro_IC95_sup": round(np.percentile(f1_b, 97.5) * 100, 2),
            "Recall_caida_OOF": round(rec_fall * 100, 2),
            "Recall_caida_IC95_CP_inf": round(lo_cp * 100, 2),
            "Recall_caida_IC95_CP_sup": round(hi_cp * 100, 2),
            "Recall_caida_IC95_boot_inf": round(np.percentile(rf_b, 2.5) * 100, 2),
            "Recall_caida_IC95_boot_sup": round(np.percentile(rf_b, 97.5) * 100, 2),
            "Exactitud_CV_media_folds": round(np.mean(folds_acc[m]) * 100, 2),
            "Exactitud_CV_DE_folds": round(np.std(folds_acc[m], ddof=1) * 100, 2),
            "Exactitud_SNR20_OOF": round((ypn == yt).mean() * 100, 2),
            "Recall_caida_SNR20_OOF": round(rec_fall_n * 100, 2),
            "Latencia_keras_mediana_ms": lat.get((m, "keras_float32"), ""),
            "Latencia_tflite_int8_mediana_ms": lat.get((m, "int8"), ""),
            "Tamano_h5_KB": round(mp.stat().st_size / 1024, 1) if mp.exists() else "",
        })
        for c in range(K):
            tp = C[c, c]
            pr = tp / max(1, C[:, c].sum())
            rc = tp / max(1, C[c].sum())
            t_cls.append({"Modelo": m, "Clase": CLASES[c], "Precision": round(pr * 100, 2),
                          "Recall": round(rc * 100, 2),
                          "F1": round(100 * 2 * pr * rc / max(1e-12, pr + rc), 2),
                          "Soporte": int(C[c].sum())})
    write_csv("tabla3_desempeno_cv38.csv", t3)
    write_csv("tabla_por_clase_cv38.csv", t_cls)

    # ---------------- Tabla 2
    t2 = []
    for m in MODELS:
        ep, ts = [], []
        for k in range(5):
            j = json.loads((CV_DIR / m / f"fold{k}" / "metrics.json").read_text(encoding="utf-8"))
            ep.append(j["epochs_trained"]); ts.append(j["train_seconds"])
        t2.append({"Modelo": m, "Arquitectura": ARQ[m], "Dropout": 0.3, "Optimizador": "Adam",
                   "TasaAprendizaje": 0.001, "Lote": 128,
                   "Tamano_h5_KB": next(r["Tamano_h5_KB"] for r in t3 if r["Modelo"] == m),
                   "Epocas_media_folds": round(float(np.mean(ep)), 1),
                   "Tiempo_medio_por_fold_s": round(float(np.mean(ts)), 1)})
    write_csv("tabla2_hiperparametros_cv38.csv", t2)

    # ---------------- métricas por sujeto y estadística
    per_sub = {m: cm.per_subject_metrics(yt, oof[m]["y_pred"], subj) for m in MODELS}
    rows_sub = []
    for m in MODELS:
        for r in per_sub[m]:
            rows_sub.append({"Modelo": m, "Sujeto": r["subject"],
                             "Grupo": "SA" if r["subject"].startswith("SA") else "SE",
                             "Exactitud": round(r["accuracy"] * 100, 2),
                             "Recall_caida": "" if np.isnan(r["fall_recall"]) else round(r["fall_recall"] * 100, 2),
                             "Ventanas": r["n_windows"], "Ventanas_caida": r["n_fall_windows"]})
    write_csv("metricas_por_sujeto_cv38.csv", rows_sub)

    acc_vec = {m: np.array([r["accuracy"] for r in per_sub[m]]) for m in MODELS}
    rec_vec = {m: np.array([r["fall_recall"] for r in per_sub[m] if r["has_falls"]]) for m in MODELS}
    t4 = []

    def add(prueba, metrica, unidad, n, est, p, pb, concl):
        t4.append({"Prueba": prueba, "Metrica": metrica, "UnidadAnalisis": unidad, "n": n,
                   "Estadistico": est, "p_cruda": p, "p_Bonferroni": pb, "Conclusion": concl})

    for m in MODELS:
        w, p = stats.shapiro(acc_vec[m])
        add(f"Shapiro-Wilk ({m})", "Exactitud por sujeto", "sujeto", len(acc_vec[m]),
            f"W={w:.4f}", f"{p:.4g}", "",
            "Normalidad no rechazada" if p > 0.05 else "Normalidad rechazada (p<0,05)")
    for etiqueta, vec, unidad in (("Exactitud por sujeto", acc_vec, "sujeto"),
                                  ("Recall de caída por sujeto", rec_vec, "sujeto con caídas")):
        mat = [vec[m] for m in MODELS]
        chi, p = stats.friedmanchisquare(*mat)
        nn = len(mat[0])
        W = chi / (nn * (len(MODELS) - 1))
        add("Friedman (omnibus no paramétrico)", etiqueta, unidad, nn,
            f"chi2={chi:.3f}; W de Kendall={W:.3f}", f"{p:.4g}", "",
            "Diferencias significativas entre los 5 modelos" if p < 0.05
            else "Sin diferencias significativas")
        for r in cm.wilcoxon_pairwise([vec[m] for m in MODELS], MODELS, etiqueta, unidad, 10):
            add(f"Wilcoxon: {r['model_a']} vs {r['model_b']}", etiqueta, unidad, nn,
                f"diferencia media={r['mean_diff']*100:+.2f} pp", f"{r['p_wilcoxon']:.4g}",
                f"{r['p_bonferroni']:.4g}",
                "Significativa" if r["significant_bonferroni_0.05"] else "No significativa")
    for i in range(len(MODELS)):
        for j in range(i + 1, len(MODELS)):
            r = cm.mcnemar_exact(yt, oof[MODELS[i]]["y_pred"], oof[MODELS[j]]["y_pred"])
            add(f"McNemar exacto: {MODELS[i]} vs {MODELS[j]}", "Acierto por ventana",
                "ventana (fuera de fold)", len(yt),
                f"b={r['b_A_ok_B_bad']}, c={r['c_A_bad_B_ok']}", f"{r['p_mcnemar_exact']:.4g}",
                f"{min(1.0, r['p_mcnemar_exact']*10):.4g}",
                "Significativa" if r["p_mcnemar_exact"] * 10 < 0.05 else "No significativa")
    write_csv("tabla4_estadistica_cv38.csv", t4)

    # ---------------- eventos independientes
    t_ev = []
    for m in MODELS:
        ev = cm.detection_events(ref["record_id"].astype(str), ref["activity"].astype(str),
                                 yt, oof[m]["y_pred"])
        n = len(ev)
        any_ = sum(e["detected_any"] for e in ev)
        both = sum(e["detected_both"] for e in ev)
        l1, h1 = cm.clopper_pearson(any_, n)
        l2, h2 = cm.clopper_pearson(both, n)
        t_ev.append({"Modelo": m, "Registros_caida": n,
                     "Detectados_ge1_ventana": any_, "Prop_ge1": round(100 * any_ / n, 2),
                     "IC95_inf_ge1": round(l1 * 100, 2), "IC95_sup_ge1": round(h1 * 100, 2),
                     "Detectados_2_ventanas": both, "Prop_2": round(100 * both / n, 2),
                     "IC95_inf_2": round(l2 * 100, 2), "IC95_sup_2": round(h2 * 100, 2)})
    write_csv("tabla_eventos_cv38.csv", t_ev)

    # ---------------- figuras: matriz de confusión
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
        for m in MODELS:
            C = C_subj[m].sum(0)
            fig, ax = plt.subplots(1, 2, figsize=(6.5, 3.0))
            for a, data, ttl, fmt in ((ax[0], C, "Conteos", "{:d}"),
                                      (ax[1], C / C.sum(1, keepdims=True) * 100, "% por fila", "{:.1f}")):
                a.imshow(data, cmap="Blues", vmin=0, vmax=None if ttl == "Conteos" else 100)
                a.set_xticks(range(K)); a.set_yticks(range(K))
                a.set_xticklabels(["Normal", "Caída", "Baja act."], rotation=20)
                a.set_yticklabels(["Normal", "Caída", "Baja act."])
                a.set_xlabel("Clase predicha"); a.set_ylabel("Clase real"); a.set_title(ttl, fontsize=9)
                for i in range(K):
                    for j in range(K):
                        v = data[i, j]
                        col = "white" if v > (data.max() * 0.6) else "black"
                        a.text(j, i, fmt.format(int(v)) if ttl == "Conteos" else fmt.format(v),
                               ha="center", va="center", color=col, fontsize=8)
            fig.tight_layout()
            fig.savefig(ASSETS / f"fig5_matriz_confusion_cv38_{m}.png", dpi=300)
            plt.close(fig)
        print("  figuras de matriz de confusión generadas")
    except Exception as e:
        print("  [AVISO] no se pudieron generar las figuras:", e)

    # ---------------- resumen legible
    best = max(t3, key=lambda r: (r["Exactitud_OOF"], r["F1_macro_OOF"]))
    L = ["# Resumen CV 38 sujetos (5 folds por sujeto)\n\n",
         f"- Ventanas: {len(yt)} · sujetos: {len(subjects)} (con caídas: {len(fall_subj)})\n",
         f"- Mayor exactitud OOF: **{best['Modelo']}** ({best['Exactitud_OOF']} %)\n\n",
         "| Modelo | Exactitud (IC95 boot. sujeto) | F1 macro | Recall caída (IC95 CP) | SNR20 acc |\n"
         "|---|---|---|---|---|\n"]
    for r in t3:
        L.append(f"| {r['Modelo']} | {r['Exactitud_OOF']} [{r['Exactitud_IC95_inf']}, "
                 f"{r['Exactitud_IC95_sup']}] | {r['F1_macro_OOF']} | {r['Recall_caida_OOF']} "
                 f"[{r['Recall_caida_IC95_CP_inf']}, {r['Recall_caida_IC95_CP_sup']}] | "
                 f"{r['Exactitud_SNR20_OOF']} |\n")
    (ASSETS / "resumen_cv38.md").write_text("".join(L), encoding="utf-8")
    print("\n" + "".join(L))
    print("[OK] Análisis terminado. Archivos en", ASSETS)


if __name__ == "__main__":
    main()
