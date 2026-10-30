# -*- coding: utf-8 -*-
"""
M-10 · Paso 4: métricas, intervalos de confianza, eventos independientes,
robustez al ruido (SNR 20 dB) y pruebas estadísticas con bloques por sujeto.

Entradas (generadas por train_grouped.py):
  - reports/final/{model_id}/metrics_test.json, y_true_test.npy,
    y_pred_test.npy, y_pred_test_snr20.npy, subject_test.npy,
    record_ids_test.npy, activity_test.npy
  - reports/cv_results/{model_id}/oof_predictions.npz (fuera de fold)
  - reports/test_subjects.json, fold_assignment.json
  - reports/training_summary_grouped.json
  - _backup_pre_revision/reports/models_comparison_report.json ("Antes")

Salidas:
  - reports/results_for_paper.md (entregable para el artículo)
  - reports/metrics_csv/*.csv

Cada prueba estadística indica la MÉTRICA y la UNIDAD DE ANÁLISIS usada.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
from scipy import stats

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
FINAL_DIR = ROOT / "reports" / "final"
CV_DIR = ROOT / "reports" / "cv_results"
REPORTS_DIR = ROOT / "reports"
CSV_DIR = REPORTS_DIR / "metrics_csv"
BACKUP_JSON = ROOT / "_backup_pre_revision" / "reports" / "models_comparison_report.json"
CSV_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
N_CLASSES = 3
CLASS_NAMES = ["Normal", "Posible_Caida", "Baja_actividad"]
MODEL_IDS = ["Puro_1D_CNN", "Puro_Bi_LSTM", "Puro_GRU",
             "Hibrido_CNN_LSTM", "Hibrido_Attention_ResGRU"]
ALPHA = 0.05


def pct(x):
    return f"{x * 100:.2f}"


def clopper_pearson(k, n, alpha=ALPHA):
    """IC exacto (Clopper-Pearson) para una proporción k/n."""
    if n == 0:
        return (float("nan"), float("nan"))
    lo = 0.0 if k == 0 else stats.beta.ppf(alpha / 2, k, n - k + 1)
    hi = 1.0 if k == n else stats.beta.ppf(1 - alpha / 2, k + 1, n - k)
    return float(lo), float(hi)


def load_final_arts(model_id):
    d = FINAL_DIR / model_id
    arts = {"model_id": model_id}
    with open(d / "metrics_test.json", encoding="utf-8") as f:
        arts["final"] = json.load(f)
    arts["y_true"] = np.load(d / "y_true_test.npy")
    arts["y_pred"] = np.load(d / "y_pred_test.npy")
    arts["y_pred_noise"] = np.load(d / "y_pred_test_snr20.npy")
    arts["subject"] = np.load(d / "subject_test.npy").astype(str)
    arts["record_id"] = np.load(d / "record_ids_test.npy").astype(str)
    arts["activity"] = np.load(d / "activity_test.npy").astype(str)
    return arts


def load_oof(model_id):
    p = CV_DIR / model_id / "oof_predictions.npz"
    if not p.exists():
        return None
    z = np.load(p, allow_pickle=False)
    return {k: z[k] for k in z.files}


def per_subject_metrics(y_true, y_pred, subject, fold_idx=None):
    """Exactitud y recall de caída por sujeto (unidad: sujeto)."""
    rows = []
    for s in sorted(set(subject.tolist())):
        m = subject == s
        yt, yp = y_true[m], y_pred[m]
        n_fall = int((yt == 1).sum())
        fall_recall = float(((yp == 1) & (yt == 1)).sum() / n_fall) if n_fall else np.nan
        rows.append({
            "subject": s,
            "accuracy": float((yt == yp).mean()),
            "fall_recall": fall_recall,
            "n_windows": int(m.sum()),
            "n_fall_windows": n_fall,
            "has_falls": n_fall > 0,
        })
    return rows


def detection_events(record_id, activity, y_true, y_pred):
    """Eventos independientes: registros F## del test detectados.

    Un registro F## tiene 2 ventanas de caída (contienen el pico de SVM).
    detected_any = ≥1 ventana predicha como caída; detected_both = las 2 ventanas.
    """
    rows = []
    fall_records = sorted({r for r, a in zip(record_id, activity) if a.upper().startswith("F")})
    for r in fall_records:
        m = record_id == r
        rows.append({
            "record": r,
            "n_fall_windows": int((y_true[m] == 1).sum()),
            "n_pred_fall_windows": int((y_pred[m] == 1).sum()),
            "detected_any": int((y_true[m] == 1).any() and (y_pred[m] == 1).any()),
            "detected_both": int((y_pred[m] == 1).all()),
        })
    return rows


def wilcoxon_pairwise(vectors, names, metric, unit, bonferroni_m):
    """Wilcoxon con correction de Bonferroni (par a par)."""
    out = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            x, yname = vectors[i], vectors[j]
            try:
                res = stats.wilcoxon(np.asarray(x, dtype=float),
                                     np.asarray(yname, dtype=float),
                                     alternative="two-sided", zero_method="wilcox",
                                     nan_policy="omit")
                w_p = float(res.pvalue)
            except ValueError:
                # diferencias todas cero
                w_p = 1.0
            d = np.asarray(x, dtype=float) - np.asarray(yname, dtype=float)
            out.append({
                "test": "Wilcoxon (post-hoc par a par)",
                "metric": metric, "unit": unit,
                "models": f"{names[i]} vs {names[j]}",
                "model_a": names[i], "model_b": names[j],
                "statistic": round(float(np.nanmean(d)), 6),
                "p_value": w_p,
                "conclusion": "diferencia significativa tras Bonferroni"
                if (not np.isnan(w_p)) and (w_p * bonferroni_m < ALPHA)
                else "sin diferencia significativa tras Bonferroni",
                "p_wilcoxon": w_p,
                "p_bonferroni": min(1.0, w_p * bonferroni_m) if not np.isnan(w_p) else np.nan,
                "significant_bonferroni_0.05":
                    bool(w_p * bonferroni_m < ALPHA) if not np.isnan(w_p) else False,
                "mean_diff": float(np.nanmean(d)),
            })
    return out


def mcnemar_exact(y_true, y_pred_a, y_pred_b):
    """McNemar exacto (binomial de dos colas) por ventana.

    Métrica: acierto/clase correcta en la ventana; unidad: ventana (fuera de fold).
    b = acierta A y falla B; c = falla A y acierta B.
    """
    ca = y_pred_a == y_true
    cb = y_pred_b == y_true
    b = int(((ca) & (~cb)).sum())
    c = int(((~ca) & (cb)).sum())
    n = b + c
    p = float(stats.binomtest(b, n, 0.5, alternative="two-sided").pvalue) if n > 0 else 1.0
    return {"b_A_ok_B_bad": b, "c_A_bad_B_ok": c, "n_discordant": n,
            "p_mcnemar_exact": p,
            "significant_0.05": bool(p < ALPHA) if n > 0 else False}


# =====================================================================
def main():
    results = {}

    with open(REPORTS_DIR / "test_subjects.json", encoding="utf-8") as f:
        test_subjects = json.load(f)["test_subjects"]
    fold_info = json.loads((REPORTS_DIR / "fold_assignment.json").read_text(encoding="utf-8"))

    # ------------------------------------------------------------- 1) test
    final_arts = {m: load_final_arts(m) for m in MODEL_IDS}
    oof = {m: load_oof(m) for m in MODEL_IDS}

    test_tables = []
    for m in MODEL_IDS:
        a = final_arts[m]
        met = a["final"]["metrics_test_clean"]
        nos = a["final"]["metrics_test_snr20dB"]
        test_tables.append({
            "model": m, "acc": met["accuracy"], "f1_macro": met["f1_macro"],
            "prec_macro": met["precision_macro"], "rec_macro": met["recall_macro"],
            "recall_fall": met["recall_per_class"][1], "prec_fall": met["precision_per_class"][1],
            "acc_snr20": nos["accuracy"], "recall_fall_snr20": nos["recall_per_class"][1],
            "f1_macro_snr20": nos["f1_macro"],
            "latency_ms": a["final"]["latency_ms_per_sample"],
            "epochs": a["final"]["epochs_trained"],
            "class_weight_fit_only": a["final"]["class_weight_development_train_only"],
        })

    per_class_rows = []
    for m in MODEL_IDS:
        met = final_arts[m]["final"]["metrics_test_clean"]
        for c in range(N_CLASSES):
            per_class_rows.append({
                "model": m, "split": "test", "class": CLASS_NAMES[c],
                "precision": met["precision_per_class"][c],
                "recall": met["recall_per_class"][c],
                "f1": met["f1_per_class"][c],
                "support": int((final_arts[m]["y_true"] == c).sum()),
            })

    # ------------------------------------------------------------- 2) eventos
    events_tables = []
    for m in MODEL_IDS:
        a = final_arts[m]
        det = detection_events(a["record_id"], a["activity"], a["y_true"], a["y_pred"])
        n_rec = len(det)
        n_any = sum(d["detected_any"] for d in det)
        n_both = sum(d["detected_both"] for d in det)
        ci_any = clopper_pearson(n_any, n_rec)
        ci_both = clopper_pearson(n_both, n_rec)
        n_fall_win = int((a["y_true"] == 1).sum())
        k_fall_pt = int(((a["y_true"] == 1) & (a["y_pred"] == 1)).sum())
        ci_fall_win = clopper_pearson(k_fall_pt, n_fall_win)
        acc_k = int((a["y_true"] == a["y_pred"]).sum())
        ci_acc = clopper_pearson(acc_k, len(a["y_true"]))
        for snr, ypred in (("clean", a["y_pred"]), ("snr20", a["y_pred_noise"])):
            events_tables.append({
                "model": m, "condition": snr,
                "n_fall_records": n_rec,
                "detected_any_records": n_any if snr == "clean" else
                sum(d["detected_any"] for d in detection_events(
                    a["record_id"], a["activity"], a["y_true"], ypred)),
                "detected_both_records": n_both if snr == "clean" else
                sum(d["detected_both"] for d in detection_events(
                    a["record_id"], a["activity"], a["y_true"], ypred)),
                "ci_any_lo": ci_any[0] if snr == "clean" else np.nan,
                "ci_any_hi": ci_any[1] if snr == "clean" else np.nan,
                "ci_both_lo": ci_both[0] if snr == "clean" else np.nan,
                "ci_both_hi": ci_both[1] if snr == "clean" else np.nan,
                "fall_windows": n_fall_win,
                "fall_recall_window": float(((a["y_true"] == 1) & (ypred == 1)).mean()),
                "ci_fall_recall_lo": ci_fall_win[0] if snr == "clean" else np.nan,
                "ci_fall_recall_hi": ci_fall_win[1] if snr == "clean" else np.nan,
                "ci_accuracy_lo": ci_acc[0] if snr == "clean" else np.nan,
                "ci_accuracy_hi": ci_acc[1] if snr == "clean" else np.nan,
            })

    # ------------------------------------------------------------- 3) por sujeto / grupo etario
    subject_rows = []
    group_rows = []
    for m in MODEL_IDS:
        a = final_arts[m]
        rows = per_subject_metrics(a["y_true"], a["y_pred"], a["subject"])
        for r in rows:
            r["model"] = m
            r["split"] = "test"
            r["age_group"] = "SA" if r["subject"].startswith("SA") else "SE"
            subject_rows.append(r)
        for g in ("SA", "SE"):
            vals = [r for r in rows if r["age_group"] == g]
            if not vals:
                continue
            accs = [r["accuracy"] for r in vals]
            frs = [r["fall_recall"] for r in vals if not np.isnan(r["fall_recall"])]
            group_rows.append({
                "model": m, "split": "test", "group": g,
                "n_subjects": len(vals),
                "acc_mean": float(np.mean(accs)), "acc_std": float(np.std(accs, ddof=0)),
                "fall_recall_mean_subjects": float(np.mean(frs)) if frs else np.nan,
            })

    # ------------------------------------------------------------- 4) OOF (CV)
    oof_summary = []
    for m in MODEL_IDS:
        if oof[m] is None:
            continue
        yt, yp = oof[m]["y_true"], oof[m]["y_pred"]
        oof_summary.append({
            "model": m,
            "oof_accuracy": float((yt == yp).mean()),
            "oof_f1_macro": float(np.mean([f1_of(yt, yp, c) for c in range(N_CLASSES)])),
            "oof_recall_fall": float(((yt == 1) & (yp == 1)).sum() / max(1, (yt == 1).sum())),
        })

    # per-subject OOF vectors for statistics
    subj_vectors_acc, subj_vectors_recall, subj_names = {}, {}, MODEL_IDS
    oof_subject_rows = []
    for m in MODEL_IDS:
        if oof[m] is None:
            continue
        rows = per_subject_metrics(oof[m]["y_true"], oof[m]["y_pred"], oof[m]["subject"])
        for r in rows:
            r["model"] = m
            r["split"] = "oof_cv"
            r["age_group"] = "SA" if r["subject"].startswith("SA") else "SE"
            oof_subject_rows.append(r)
        subj_vectors_acc[m] = np.array([r["accuracy"] for r in rows])
        with_falls = [r for r in rows if r["has_falls"]]
        subj_vectors_recall[m] = np.array([r["fall_recall"] for r in with_falls])
        subj_names_fallwo = [r["subject"] for r in with_falls]

    # ------------------------------------------------------------- 5) estadística
    stat_rows = []
    acc_ok = all(m in subj_vectors_acc for m in MODEL_IDS)
    n_models = len(MODEL_IDS)
    n_pairs = n_models * (n_models - 1) // 2

    if acc_ok:
        # 5.1 Shapiro-Wilk sobre exactitud OOF por sujeto
        for m in MODEL_IDS:
            v = subj_vectors_acc[m].astype(float)
            w, p = stats.shapiro(v)
            stat_rows.append({
                "test": "Shapiro-Wilk", "metric": "exactitud (accuracy)",
                "unit": "sujeto (n=%d, fuera de fold, desarrollo)" % len(v),
                "models": m, "statistic": float(w), "p_value": float(p),
                "conclusion": "distribución compatible con normalidad" if p > ALPHA
                else "distribución NO normal",
            })

        # 5.2 Friedman (bloques = sujetos)
        fr_stat, fr_p = stats.friedmanchisquare(*[subj_vectors_acc[m].astype(float)
                                                  for m in MODEL_IDS])
        stat_rows.append({
            "test": "Friedman", "metric": "exactitud (accuracy)",
            "unit": "sujeto como bloque (n=%d, k=5 modelos, fuera de fold)" % len(subj_vectors_acc[MODEL_IDS[0]]),
            "models": "; ".join(MODEL_IDS), "statistic": float(fr_stat), "p_value": float(fr_p),
            "conclusion": "diferencias globales significativas (p<0.05)" if fr_p < ALPHA
            else "sin evidencia de diferencias globales",
        })

        # 5.3 Wilcoxon par a par con Bonferroni (accuracy; y recall de caída)
        stat_rows += wilcoxon_pairwise([subj_vectors_acc[m] for m in MODEL_IDS],
                                       MODEL_IDS, "exactitud (accuracy)", "sujeto (fuera de fold)",
                                       n_pairs)
        if all(len(subj_vectors_recall[m]) == len(subj_vectors_recall[MODEL_IDS[0]])
               for m in MODEL_IDS if m in subj_vectors_recall):
            stat_rows.append({
                "test": "Friedman", "metric": "recall de caída (clase 1)",
                "unit": "sujeto CON caídas como bloque (n=%d, fuera de fold)"
                        % len(subj_vectors_recall[MODEL_IDS[0]]),
                "models": "; ".join(MODEL_IDS),
                "statistic": float(stats.friedmanchisquare(
                    *[subj_vectors_recall[m].astype(float) for m in MODEL_IDS])[0]),
                "p_value": float(stats.friedmanchisquare(
                    *[subj_vectors_recall[m].astype(float) for m in MODEL_IDS])[1]),
                "conclusion": "",
            })
            stat_rows += wilcoxon_pairwise([subj_vectors_recall[m] for m in MODEL_IDS],
                                           MODEL_IDS, "recall de caída (clase 1)",
                                           "sujeto con caídas (fuera de fold)", n_pairs)
        else:
            stat_rows.append({
                "test": "Nota", "metric": "recall de caída", "unit": "sujeto",
                "models": "", "statistic": np.nan, "p_value": np.nan,
                "conclusion": "subconjuntos de sujetos con caídas no idénticos entre "
                              "modelos; pruebas pareadas omitidas",
            })

        # 5.4 McNemar por ventana (fuera de fold; unidad: ventana)
        mcn_rows = []
        for i in range(n_models):
            for j in range(i + 1, n_models):
                a, b = MODEL_IDS[i], MODEL_IDS[j]
                if oof[a] is None or oof[b] is None:
                    continue
                res = mcnemar_exact(oof[a]["y_true"], oof[a]["y_pred"], oof[b]["y_pred"])
                res.update({"model_a": a, "model_b": b,
                            "metric": "acierto por ventana (correct/incorrect)",
                            "unit": "ventana (fuera de fold, n=%d)" % len(oof[a]["y_true"])})
                mcn_rows.append(res)
                stat_rows.append({
                    "test": "McNemar exacto", "metric": "acierto por ventana",
                    "unit": "ventana (fuera de fold)",
                    "models": f"{a} vs {b}",
                    "statistic": f"b={res['b_A_ok_B_bad']};c={res['c_A_bad_B_ok']}",
                    "p_value": res["p_mcnemar_exact"],
                    "conclusion": "diferencia emparejada significativa (p<0.05)"
                    if res["significant_0.05"] else "sin diferencia emparejada significativa",
                })

    # ------------------------------------------------------------- 6) antes / después
    before = None
    if BACKUP_JSON.exists():
        with open(BACKUP_JSON, encoding="utf-8") as f:
            before = json.load(f)

    # ------------------------------------------------------------- CSVs
    import csv
    def write_csv(name, rows, fields=None):
        if not rows:
            return
        fields = fields or list(rows[0].keys())
        with open(CSV_DIR / name, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in rows:
                w.writerow({k: ("" if r.get(k) is None else
                                (json.dumps(r[k]) if isinstance(r[k], (dict, list)) else r[k]))
                            for k in fields})

    write_csv("test_metrics_per_model.csv", test_tables)
    write_csv("test_metrics_per_class.csv", per_class_rows)
    write_csv("event_detection.csv", events_tables)
    write_csv("test_metrics_per_subject.csv", subject_rows)
    write_csv("test_metrics_per_age_group.csv", group_rows)
    write_csv("oof_metrics_per_subject.csv", oof_subject_rows)
    write_csv("statistical_tests.csv", stat_rows)
    if stat_rows and acc_ok:
        write_csv("mcnemar_pairs.csv", mcn_rows)

    with open(CSV_DIR / "model_class_weights.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["model", "class", "class_weight (train development only)"])
        for r in test_tables:
            cw = r["class_weight_fit_only"]
            for c in range(N_CLASSES):
                w.writerow([r["model"], c, cw[str(c)] if isinstance(cw, dict) else cw.get(c)])

    # mejores y peores sujetos (test) — referencia para el artículo
    results = {"test_tables": test_tables, "group_rows": group_rows}

    # ------------------------------------------------------------- results_for_paper.md
    L = []
    L.append("# Resultados para el artículo (revisión anti-fuga) — dataset REAL de SisFall\n\n")
    L.append(f"Generado: {time.strftime('%Y-%m-%d %H:%M:%S')} · SEED global 42.\n\n")
    L.append("## Diseño experimental\n\n")
    L.append("- Dataset REAL de SisFall v1.0 (UDEA/SISTEMIC): 38 sujetos, 4 505 registros, 40 707 ventanas "
             "(128 pasos @ 50 Hz, 50 % solape, 8 canales).\n")
    L.append("- Etiquetado por código de actividad (ver `labeling_rules.md`): 33 111 Normal (81.3 %), "
             "3 596 Posible_Caida (8.8 %), 4 000 Baja_actividad (9.8 %); "
             "14 384 ventanas de registros F## SIN el pico de SVM excluidas.\n")
    L.append(f"- Prueba: {len(test_subjects)} sujetos ({', '.join(test_subjects)}) — "
             "5 SA al azar + 1 SE (distinto de SE06, seed 42). SE06 en desarrollo.\n")
    L.append(f"- CV: StratifiedGroupKFold(n_splits={fold_info['n_splits']}, shuffle=True, "
             "random_state=42) por sujeto, estratificado por presencia de caídas; "
             f"{fold_info['n_splits']} folds iguales para las 5 arquitecturas; "
             "sin fuga: sujetos y record_id disjuntos entre train/eval/test (asserts).\n")
    L.append("- Único cambio respecto al entrenamiento previo: `class_weight` 'balanced' "
             "calculado SOLO con el train del fold (ver model_class_weights.csv).\n\n")

    L.append("## Tabla por modelo — test (ÚNICA evaluación, señales limpias)\n\n")
    L.append("| Modelo | Exactitud % | F1 macro % | Recall caída % | Precisión caída % | "
             "Ex. IC95% (CP) | Recall caída IC95% (CP) | Latencia ms | Épocas |\n")
    L.append("|---|---|---|---|---|---|---|---|---|\n")
    for r in test_tables:
        a = final_arts[r["model"]]
        ev = next(e for e in events_tables if e["model"] == r["model"] and e["condition"] == "clean")
        ci_acc = (ev["ci_accuracy_lo"], ev["ci_accuracy_hi"])
        ci_fr = (ev["ci_fall_recall_lo"], ev["ci_fall_recall_hi"])
        cw_s = ", ".join(f"{cls}={r['class_weight_fit_only'][str(cls)] if isinstance(r['class_weight_fit_only'], dict) else r['class_weight_fit_only'][cls]:.2f}"
                         for cls in range(N_CLASSES))
        L.append(f"| {r['model']} | {pct(r['acc'])} | {pct(r['f1_macro'])} | "
                 f"{pct(r['recall_fall'])} | {pct(r['prec_fall'])} | "
                 f"[{ci_acc[0]*100:.1f}, {ci_acc[1]*100:.1f}] | "
                 f"[{ci_fr[0]*100:.1f}, {ci_fr[1]*100:.1f}] | {r['latency_ms']} | {r['epochs']} |\n")
    L.append("\n`class_weight` por modelo (fit solo con train del desarrollo): ver "
             "reports/metrics_csv/model_class_weights.csv.\n\n")

    L.append("## Métricas por clase — test\n\n")
    L.append("| Modelo | Clase | Precisión % | Recall % | F1 % | Soporte |\n|---|---|---|---|---|---|\n")
    for r in per_class_rows:
        L.append(f"| {r['model']} | {r['class']} | {pct(r['precision'])} | "
                 f"{pct(r['recall'])} | {pct(r['f1'])} | {r['support']} |\n")
    L.append("\n")

    L.append("## Matrices de confusión (test, limpio) — filas = real, columnas = predicción\n\n")
    for m in MODEL_IDS:
        cm = final_arts[m]["final"]["metrics_test_clean"]["confusion_matrix"]
        L.append(f"**{m}**: {cm}\n\n")

    L.append("## Eventos independientes (registros F## del test)\n\n")
    L.append("Un registro F## aporta exactamente 2 ventanas de caída (contienen el pico de SVM). "
             "`≥1 ventana` = al menos una ventana del registro clasificada como caída; "
             "`2 ventanas` = ambas.\n\n")
    L.append("| Modelo | Condición | Registros F## | Detectados ≥1 ventana | Detectados 2 ventanas | "
             "Recall evento ≥1 | Recall evento 2 |\n|---|---|---|---|---|---|---|\n")
    for r in events_tables:
        def _ci(lo, hi):
            return f"[{lo*100:.1f}, {hi*100:.1f}]" if not (np.isnan(lo) or np.isnan(hi)) else "n/a (solo clean)"
        L.append(f"| {r['model']} | {r['condition']} | {r['n_fall_records']} | "
                 f"{r['detected_any_records']} | {r['detected_both_records']} | "
                 f"{r['detected_any_records']/max(1,r['n_fall_records'])*100:.1f}% "
                 f"{_ci(r['ci_any_lo'], r['ci_any_hi'])} | "
                 f"{r['detected_both_records']/max(1,r['n_fall_records'])*100:.1f}% |\n")
    L.append("\n(IC95% = Clopper-Pearson exacto sobre el evento, calculado en la condición limpia.)\n\n")

    L.append("## Por sujeto y grupo etario (test)\n\n")
    L.append("| Modelo | Grupo etario | n sujetos | Exactitud media ± d.e. % | Recall caída media (sujetos con caídas) % |\n|---|---|---|---|---|\n")
    for r in group_rows:
        fr = r["fall_recall_mean_subjects"]
        fr_disp = pct(fr) if fr == fr else "n/a (sin sujetos con caídas)"
        L.append(f"| {r['model']} | {r['group']} | {r['n_subjects']} | "
                 f"{pct(r['acc_mean'])} ± {pct(r['acc_std'])} | "
                 f"{fr_disp} |\n")
    L.append("\nDetalle por sujeto: reports/metrics_csv/test_metrics_per_subject.csv y "
             "oof_metrics_per_subject.csv.\n\n")

    L.append("## CV fuera de fold (media sujetos de desarrollo)\n\n")
    L.append("| Modelo | Exactitud OOF % | Recall caída OOF % |\n|---|---|---|\n")
    for r in oof_summary if oof_summary else []:
        L.append(f"| {r['model']} | {pct(r['oof_accuracy'])} | {pct(r['oof_recall_fall'])} |\n")
    L.append("\nResumen por fold (media ± d.e.): reports/training_summary_grouped.json.\n\n")

    L.append("## Pruebas estadísticas (con MÉTRICA y UNIDAD de análisis)\n\n")
    L.append("| Prueba | Métrica | Unidad de análisis | Modelos | Estadístico | p | Conclusión |\n|---|---|---|---|---|---|---|\n")
    for r in stat_rows:
        stat_v = r.get("statistic", "")
        if isinstance(stat_v, (int, float, np.floating)) and stat_v == stat_v:
            stat_disp = round(float(stat_v), 4)
        elif isinstance(stat_v, str) and stat_v:
            stat_disp = stat_v
        else:
            stat_disp = "n/a"
        p_v = r.get("p_value", float("nan"))
        p_disp = round(float(p_v), 6) if (isinstance(p_v, (int, float)) and p_v == p_v) else "n/a"
        L.append(f"| {r['test']} | {r['metric']} | {r['unit']} | {r['models']} | "
                 f"{stat_disp} | {p_disp} | {r.get('conclusion', '')} |\n")
    L.append("\nWilcoxon par a par con corrección de Bonferroni (m=10 pares): "
             "ver reports/metrics_csv/statistical_tests.csv (`p_bonferroni`).\n\n")

    L.append("## Robustez al ruido gaussiano (SNR 20 dB) — test\n\n")
    L.append("| Modelo | Exactitud limpia % | Exactitud SNR20 % | Recall caída limpia % | "
             "Recall caída SNR20 % | Δ exactitud pp |\n|---|---|---|---|---|---|\n")
    for r in test_tables:
        L.append(f"| {r['model']} | {pct(r['acc'])} | {pct(r['acc_snr20'])} | "
                 f"{pct(r['recall_fall'])} | {pct(r['recall_fall_snr20'])} | "
                 f"{float(r['acc_snr20'] - r['acc'])*100:+.2f} |\n")
    L.append("\nRuido blanco gaussiano por canal; σ = sqrt(P_señal / 10^(SNR/10)) por ventana y "
             "canal; seed 42. Único diagnóstico (no selección de modelo).\n\n")

    if before:
        L.append("## Tabla ANTES (pipeline con fuga) vs DESPUÉS (partición por sujeto)\n\n")
        L.append("El pipeline *ANTES* entrenaba sobre datos sintéticos (fallback) con fuga de "
                 "información: exactitud 100 % en las 5 arquitecturas. El pipeline *DESPUÉS* usa "
                 "el dataset real, partición por sujeto y una única evaluación en test.\n\n")
        L.append("| Modelo | Antes: exactitud % (sintético con fuga, 4 clases) | "
                 "Después: exactitud % (SisFall real, test por sujeto) | Después F1 macro % |\n")
        L.append("|---|---|---|---|\n")
        old = {r["model_id"]: r["metrics"] for r in before["all_models"]}
        for r in test_tables:
            L.append(f"| {r['model']} | {old.get(r['model'], {}).get('accuracy', 'n/a')} | "
                     f"{pct(r['acc'])} | {pct(r['f1_macro'])} |\n")
        L.append("\nBackup original: ml_training/_backup_pre_revision/ (modelos .h5, "
                 "reports/models_comparison_report.json, datos).\n\n")

    L.append("## Frases del artículo invalidadas\n\n")
    L.append("Cualquier afirmación de exactitud ~100 %, F1 ~100 % o desempeño comparado sobre el "
             "dataset 'SisFall' de la versión previa queda INVALIDADA: esos resultados provenían de "
             "un fallback sintético con fuga de información (incluida fuga de sujetos entre "
             "train/eval/test). Los resultados válidos para el artículo son los de esta tabla y los "
             "CSV adjuntos; ningún número de exactitud/F1 previo puede citarse.\n\n")
    L.append("Afirmaciones concretas a eliminar o sustituir en todo material académico "
             "(referencia: README del proyecto, sección de modelo):\n\n")
    for c in [
        "Tabla comparativa con exactitud y F1-macro de 100.0 % para las 5 arquitecturas "
        "(Puro_1D_CNN, Puro_Bi_LSTM, Puro_GRU, Hibrido_CNN_LSTM, Hibrido_Attention_ResGRU).",
        "\"Sensibilidad Perfecta: 100 % de sensibilidad en la clase Posible Caída "
        "(0 falsos negativos), garantizando que ningún accidente pase desapercibido\".",
        "\"Conjunto de prueba independiente de 3,010 muestras\" (ese split contenía sujetos "
        "presentes también en el train: fuga de sujetos; y los datos eran sintéticos).",
        "Partición 70/15/15 de \"20,064 muestras\" del \"SisFall Benchmark\" (las cifras "
        "corresponden al fallback sintético, NO al dataset real: el real produce 40,707 ventanas "
        "etiquetadas y 14,384 excluidas).",
        "\"Validación Cruzada Estratificada (K=5 y K=10) con variabilidad de exactitud menor "
        "al 0.08 % entre folds\" (la CV previa era por ventanas, no por sujetos; la nueva es "
        "StratifiedGroupKFold por sujeto con otra variabilidad).",
        "Todas las cifras de la batería estadística previa (Shapiro-Wilk W=0.942 p=0.081; "
        "Friedman χ²=18.42 p<0.001; ANOVA F=7.842 p=0.00084; Wilcoxon W=15.0 p=0.0021; "
        "McNemar χ²=0.0 p=1.000) quedan invalidadas y se reportan de nuevo con bloques por "
        "sujeto y métricas reales.",
        "La afirmación de \"0 falsos negativos\" / \"concordancia perfecta\" en la matriz de "
        "confusión: con partición por sujeto y dataset real no puede afirmarse",
    ]:
        L.append(f"- {c}\n")
    L.append("\n")
    L.append("Referencias: `labeling_rules.md`, `reproducibility.md`, "
             "`reports/metrics_csv/`.\n")

    with open(REPORTS_DIR / "results_for_paper.md", "w", encoding="utf-8") as f:
        f.write("".join(L))

    print("[OK] Paso 4 completo:")
    print("  - reports/results_for_paper.md")
    print("  - reports/metrics_csv/*.csv (9 archivos)")
    print(f"\nTest: {len(test_tables)} modelos · pruebas estadísticas: {len(stat_rows)}")


def f1_of(yt, yp, c):
    tp = int(((yt == c) & (yp == c)).sum())
    fp = int(((yt != c) & (yp == c)).sum())
    fn = int(((yt == c) & (yp != c)).sum())
    return tp / max(1, tp + (fp + fn) / 2)


if __name__ == "__main__":
    main()
