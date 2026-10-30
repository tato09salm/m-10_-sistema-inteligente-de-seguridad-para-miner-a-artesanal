# -*- coding: utf-8 -*-
"""
M-10 · Fase A: tablas CSV UTF-8 para el artículo en ml_training/reports/paper_assets/.

tabla2_hiperparametros.csv, tabla3_desempeno.csv, tabla4_estadistica.csv,
tabla_por_clase.csv, tabla_eventos.csv.
Números con punto decimal, valores porcentuales salvo Perdida_prueba (nats).
Requiere: export_tflite_latency.py ejecutado (para la selección del modelo).
"""
import json
import csv
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
MODELS_DIR = ROOT / "saved_models"
ASSETS = REPORTS_DIR / "paper_assets"
BACKUP_JSON = ROOT / "_backup_pre_revision" / "reports" / "models_comparison_report.json"

SEED = 42
N_CLASSES = 3
ALL_MODELS = ["Puro_1D_CNN", "Puro_Bi_LSTM", "Puro_GRU",
              "Hibrido_CNN_LSTM", "Hibrido_Attention_ResGRU"]
ALPHA = 0.05

ASSETS.mkdir(parents=True, exist_ok=True)


def load_metrics(mid):
    with open(FINAL_DIR / mid / "metrics_test.json", encoding="utf-8") as f:
        return json.load(f)


def load_oof(mid):
    z = np.load(CV_DIR / mid / "oof_predictions.npz", allow_pickle=False)
    return {k: z[k] for k in z.files}


def clopper_pearson(k, n, alpha=ALPHA):
    if n == 0:
        return float("nan"), float("nan")
    lo = 0.0 if k == 0 else stats.beta.ppf(alpha / 2, k, n - k + 1)
    hi = 1.0 if k == n else stats.beta.ppf(1 - alpha / 2, k + 1, n - k)
    return float(lo), float(hi)


def write_csv(name, rows):
    if not rows:
        raise RuntimeError(f"sin filas para {name}")
    with open(ASSETS / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"  [OK] {name} ({len(rows)} filas)")


# =================================================================== selección
def select_model(rows_tflite):
    """Regla C: Hibrido_CNN_LSTM si convierte a int8 sin Flex y el recall de
    caída int8 no cae >1 pp respecto a float32; si no, Puro_1D_CNN."""
    by = {}
    for r in rows_tflite:
        by.setdefault(r["Modelo"], {})[r["Formato"]] = r
    cand = by.get("Hibrido_CNN_LSTM", {})
    r32 = cand.get("float32")
    r8 = cand.get("int8")
    if r32 and r8 and r8["Convierte_sin_FlexOps"] == "sí":
        drop = r32["Recall_caida"] - r8["Recall_caida"]
        if drop <= 1.0:
            return "Hibrido_CNN_LSTM", (f"Hibrido_CNN_LSTM: convierte a TFLite "
                                        f"int8 sin Flex y el recall de caída int8 "
                                        f"cae {drop:.2f} pp (≤1 pp) frente a float32")
    return "Puro_1D_CNN", ("Puro_1D_CNN: Hibrido_CNN_LSTM no cumple la regla "
                          "(int8 completo sin Flex y caída de recall ≤1 pp)")


def main():
    metr = {m: load_metrics(m) for m in ALL_MODELS}
    oof = {m: load_oof(m) for m in ALL_MODELS}

    with open(ASSETS / "tflite_resultados.csv", encoding="utf-8") as f:
        tflite_rows = list(csv.DictReader(f))
        for r in tflite_rows:
            for k in ("Tamano_KB", "Exactitud", "F1_macro", "Recall_caida",
                      "Recall_caida_IC95_inf", "Recall_caida_IC95_sup"):
                r[k] = float(r[k])
    selected, reason = select_model(tflite_rows)
    print(f"Modelo seleccionado: {selected}\n  ({reason})")

    # latencias Keras (del tflite_latencia.csv, motor Keras_model_x(PC))
    with open(ASSETS / "tflite_latencia.csv", encoding="utf-8") as f:
        lat_keras = {r["Modelo"]: r for r in csv.DictReader(f)
                     if r["Motor"].startswith("Keras")}

    # ---------------------------------------------- 1) tabla2_hiperparametros
    with open(BACKUP_JSON, encoding="utf-8") as f:
        backup = json.load(f)
    arch_desc = {r["model_id"]: r["description"] for r in backup["all_models"]}

    rows2 = []
    for mid in ALL_MODELS:
        met = metr[mid]
        epochs_cv = []
        for k in range(met["n_folds"]):
            with open(CV_DIR / mid / f"fold{k}" / "metrics.json", encoding="utf-8") as f:
                epochs_cv.append(json.load(f)["epochs_trained"])
        rows2.append({
            "Modelo": mid,
            "Arquitectura": arch_desc.get(mid, mid),
            "Dropout": 0.3,
            "Optimizador": "Adam",
            "TasaAprendizaje": 0.001,
            "Lote": 128,
            "Tamano_h5_KB": round((MODELS_DIR / f"{mid}_grouped.h5").stat().st_size / 1024, 1),
            "Epocas_final": met["epochs_trained"],
            "Epocas_CV_media": round(float(np.mean(epochs_cv)), 2),
            "Tiempo_entrenamiento_final_s": met["train_seconds"],
        })
    write_csv("tabla2_hiperparametros.csv", rows2)

    # ---------------------------------------------- 2) tabla3_desempeno
    rows3 = []
    for mid in ALL_MODELS:
        met = metr[mid]
        t = met["metrics_test_clean"]
        y_true = np.load(FINAL_DIR / mid / "y_true_test.npy")
        y_prob = np.load(FINAL_DIR / mid / "y_prob_test.npy")
        y_pred = np.load(FINAL_DIR / mid / "y_pred_test.npy")
        # pérdida de prueba: entropía cruzada con las probabilidades del modelo
        eps = 1e-12
        loss = float(-np.mean(np.log(np.clip(y_prob[np.arange(len(y_true)), y_true], eps, 1))))

        n_fall = int((y_true == 1).sum())
        k_fall = int(((y_true == 1) & (y_pred == 1)).sum())
        lo, hi = clopper_pearson(k_fall, n_fall)

        # CV exactitud media ± DE (n=3 folds)
        accs = []
        for k in range(met["n_folds"]):
            with open(CV_DIR / mid / f"fold{k}" / "metrics.json", encoding="utf-8") as f:
                accs.append(json.load(f)["accuracy"])

        # bootstrap por SUJETO de la exactitud OOF (1000 remuestreos, seed 42)
        z = oof[mid]
        yt, yp, subj = z["y_true"], z["y_pred"], z["subject"]
        subj_list = sorted(set(subj.tolist()))
        acc_subj = np.array([float((yt[subj == s] == yp[subj == s]).mean())
                             for s in subj_list])
        rng = np.random.RandomState(SEED)
        n_subj = len(subj_list)
        means = np.empty(1000)
        for b in range(1000):
            idx = rng.randint(0, n_subj, size=n_subj)
            means[b] = acc_subj[idx].mean()
        oof_lo, oof_hi = np.percentile(means, [2.5, 97.5])

        lk = lat_keras[mid]
        rows3.append({
            "Modelo": mid,
            "Exactitud_prueba": round(t["accuracy"] * 100, 2),
            "F1_macro_prueba": round(t["f1_macro"] * 100, 2),
            "Recall_caida_prueba": round(t["recall_per_class"][1] * 100, 2),
            "Recall_caida_IC95_inf": round(lo * 100, 2),
            "Recall_caida_IC95_sup": round(hi * 100, 2),
            "Latencia_keras_ms": float(lk["media_ms"]),
            "Latencia_keras_p95_ms": float(lk["p95_ms"]),
            "Tamano_KB": rows2[ALL_MODELS.index(mid)]["Tamano_h5_KB"],
            "Exactitud_CV_media": round(float(np.mean(accs)) * 100, 2),
            "Exactitud_CV_DE": round(float(np.std(accs)) * 100, 2),
            "Exactitud_OOF_IC95_inf": round(oof_lo * 100, 2),
            "Exactitud_OOF_IC95_sup": round(oof_hi * 100, 2),
            "Perdida_prueba": round(loss, 4),
        })
    write_csv("tabla3_desempeno.csv", rows3)

    # ---------------------------------------------- 3) tabla4_estadistica
    rows4 = []
    # vectores por sujeto a partir del OOF (una sola fuente, seed determinista)
    subj_acc, subj_rec_fall, fall_subjects = {}, {}, None
    for mid in ALL_MODELS:
        z = oof[mid]
        yt, yp, subj = z["y_true"], z["y_pred"], z["subject"].astype(str)
        subjects = sorted(set(subj.tolist()))
        subj_acc[mid] = np.array([float((yt[subj == s] == yp[subj == s]).mean())
                                  for s in subjects])
        fs = [s for s in subjects if (yt[subj == s] == 1).any()]
        if fall_subjects is None:
            fall_subjects = fs
        subj_rec_fall[mid] = np.array([float(((yt[subj == s] == 1) &
                                              (yp[subj == s] == 1)).sum() /
                                             (yt[subj == s] == 1).sum())
                                       for s in fs])

    n_pairs = len(ALL_MODELS) * (len(ALL_MODELS) - 1) // 2

    def add(prueba, metrica, unidad, n, estad, p_raw, p_bonf, concl):
        rows4.append({"Prueba": prueba, "Metrica": metrica,
                      "UnidadAnalisis": unidad, "n": n,
                      "Estadistico": (round(float(estad), 4)
                                      if estad is not None and estad == estad else estad),
                      "p_cruda": (float(p_raw) if p_raw is not None and p_raw == p_raw
                                  else p_raw),
                      "p_Bonferroni": (round(float(p_bonf), 6)
                                       if p_bonf is not None and p_bonf == p_bonf else p_bonf),
                      "Conclusion": concl})

    # Shapiro-Wilk (exactitud por sujeto, OOF)
    for mid in ALL_MODELS:
        v = subj_acc[mid]
        W, p = stats.shapiro(v)
        add("Shapiro-Wilk", "Exactitud", "sujeto", len(v), W, p, None,
            "distribución NO normal (se justifica el uso de pruebas no paramétricas)"
            if p <= ALPHA else "compatible con normalidad")

    # Friedman
    fr_sq, fr_p = stats.friedmanchisquare(*[subj_acc[m] for m in ALL_MODELS])
    add("Friedman", "Exactitud", "sujeto", len(subj_acc[ALL_MODELS[0]]), fr_sq,
        fr_p, None, "diferencias globales significativas entre modelos (p<0.05)"
        if fr_p < ALPHA else "sin diferencias globales")

    fr_sq, fr_p = stats.friedmanchisquare(*[subj_rec_fall[m] for m in ALL_MODELS])
    add("Friedman", "Recall de caída", "sujeto", len(fall_subjects), fr_sq,
        fr_p, None, "diferencias globales significativas entre modelos (p<0.05)"
        if fr_p < ALPHA else "sin diferencias globales")

    # Wilcoxon par a par (exactitud y recall de caída), Bonferroni m=10 pares/familia
    for metrica, vecs, unidad in (
            ("Exactitud", subj_acc, "sujeto"),
            ("Recall de caída", subj_rec_fall, "sujeto (con caídas)")):
        for i in range(len(ALL_MODELS)):
            for j in range(i + 1, len(ALL_MODELS)):
                a, b = ALL_MODELS[i], ALL_MODELS[j]
                st, p = stats.wilcoxon(vecs[a].astype(float),
                                       vecs[b].astype(float), zero_method="wilcox")
                pb = min(1.0, p * n_pairs)
                add(f"Wilcoxon {a} vs {b}", metrica, unidad, len(vecs[a]), st, p, pb,
                    "significativa tras Bonferroni" if pb < ALPHA
                    else "no significativa tras Bonferroni")

    # McNemar exacto por ventana (OOF)
    for i in range(len(ALL_MODELS)):
        for j in range(i + 1, len(ALL_MODELS)):
            a, b = ALL_MODELS[i], ALL_MODELS[j]
            za, zb = oof[a], oof[b]
            ca = za["y_pred"] == za["y_true"]
            cb = zb["y_pred"] == zb["y_true"]
            nn = int((ca & ~cb).sum())
            c = int((~ca & cb).sum())
            p = float(stats.binomtest(nn, nn + c, 0.5).pvalue) if (nn + c) else 1.0
            add(f"McNemar {a} vs {b}", "Acierto por ventana", "ventana",
                int(za["y_true"].shape[0]), None, p, None,
                f"b={nn}, c={c}; diferencia emparejada significativa (p<0.05)"
                if p < ALPHA else f"b={nn}, c={c}; sin diferencia significativa")

    write_csv("tabla4_estadistica.csv", rows4)

    # ---------------------------------------------- 4) tabla_por_clase
    es_names = ["Actividad normal", "Posible caída", "Baja actividad"]
    rows_pc = []
    for mid in [selected, "Puro_1D_CNN"]:
        t = metr[mid]["metrics_test_clean"]
        z = oof[mid]
        for evaluacion, precision_s, recall_s, f1_s in (
                ("prueba", t["precision_per_class"], t["recall_per_class"],
                 t["f1_per_class"]),):
            for cix in range(N_CLASSES):
                rows_pc.append({
                    "Modelo": mid, "Evaluacion": evaluacion,
                    "Clase": es_names[cix],
                    "Precision": round(precision_s[cix] * 100, 2),
                    "Recall": round(recall_s[cix] * 100, 2),
                    "F1": round(f1_s[cix] * 100, 2),
                    "Soporte": int(((np.load(FINAL_DIR / mid / "y_true_test.npy")) == cix).sum()),
                })
        # OOF
        yt, yp = z["y_true"], z["y_pred"]
        for cix in range(N_CLASSES):
            tp = int(((yt == cix) & (yp == cix)).sum())
            fp = int(((yt != cix) & (yp == cix)).sum())
            fn = int(((yt == cix) & (yp != cix)).sum())
            prec = tp / max(1, tp + fp)
            rec = tp / max(1, tp + fn)
            f1c = 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)
            rows_pc.append({
                "Modelo": mid, "Evaluacion": "OOF (fuera de fold)",
                "Clase": es_names[cix],
                "Precision": round(prec * 100, 2),
                "Recall": round(rec * 100, 2),
                "F1": round(f1c * 100, 2),
                "Soporte": int((yt == cix).sum()),
            })
    write_csv("tabla_por_clase.csv", rows_pc)

    # ---------------------------------------------- 5) tabla_eventos
    rows_ev = []
    for mid in ALL_MODELS:
        rid = np.load(FINAL_DIR / mid / "record_ids_test.npy").astype(str)
        acty = np.load(FINAL_DIR / mid / "activity_test.npy").astype(str)
        yt = np.load(FINAL_DIR / mid / "y_true_test.npy")
        yp = np.load(FINAL_DIR / mid / "y_pred_test.npy")
        is_fall_rec = np.char.startswith(rid, "F") & np.char.startswith(
            np.char.upper(acty), "F")
        # registros F## (agrupar por rid)
        recs = {}
        for r, t, p in zip(rid[is_fall_rec], yt[is_fall_rec], yp[is_fall_rec]):
            d = recs.setdefault(r, {"nt": 0, "np": 0})
            d["nt"] += int(t == 1)
            d["np"] += int(p == 1)
        n_rec = len(recs)
        n_any = sum(1 for d in recs.values() if d["nt"] > 0 and d["np"] >= 1)
        n_both = sum(1 for d in recs.values() if d["np"] >= d["nt"] and d["np"] > 0)
        lo1, hi1 = clopper_pearson(n_any, n_rec)
        lo2, hi2 = clopper_pearson(n_both, n_rec)
        rows_ev.append({
            "Modelo": mid,
            "Registros_F_en_prueba": n_rec,
            "Detectados_1ventana": n_any,
            "Detectados_2ventanas": n_both,
            "Proporcion_1ventana": round(n_any / n_rec, 4),
            "IC95_1ventana_inf": round(lo1, 4),
            "IC95_1ventana_sup": round(hi1, 4),
            "Proporcion_2ventanas": round(n_both / n_rec, 4),
            "IC95_2ventanas_inf": round(lo2, 4),
            "IC95_2ventanas_sup": round(hi2, 4),
        })
    write_csv("tabla_eventos.csv", rows_ev)

    # nota del modelo seleccionado
    with open(ASSETS / "modelo_seleccionado.json", "w", encoding="utf-8") as f:
        json.dump({"modelo": selected, "regla": reason}, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] Fase A completa. Modelo seleccionado: {selected}")


if __name__ == "__main__":
    main()
