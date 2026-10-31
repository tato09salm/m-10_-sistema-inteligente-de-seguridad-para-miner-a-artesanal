# -*- coding: utf-8 -*-
"""
M-10 · FASE 2 (manual): validación cruzada AGRUPADA POR SUJETO de 5 folds sobre
los 38 sujetos de SisFall + entrenamiento final con todos los sujetos.

Reutiliza (sin cambios) los modelos, hiperparámetros y utilidades de
train_grouped.py: EPOCHS=20, BATCH=128, Adam 1e-3, EarlyStopping(val_accuracy,
patience=5), ReduceLROnPlateau, class_weight 'balanced' solo con el train.

Diferencias respecto a train_grouped.py
  - NO hay sujetos de prueba aparte: los 38 sujetos participan en la CV; cada
    sujeto se evalúa UNA vez con un modelo que no lo vio (predicción fuera de fold).
  - Folds: StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42) por
    sujeto, estratificado por "sujeto con caídas (sí/no)". Asserts de integridad.
  - Early stopping con validación tomada de SUJETOS del train del fold.
  - Además de la predicción limpia se guarda la predicción con ruido gaussiano
    SNR 20 dB (diagnóstico de robustez).
  - Guardado incremental y reanudable: si un (modelo, fold) ya está hecho (mismos
    sujetos de evaluación) se omite.

Uso (desde la carpeta ml_training):
  python train_cv38.py --probe                    # cronometra el fold 0 de los 5 modelos
  python train_cv38.py                            # CV completa (5 modelos x 5 folds)
  python train_cv38.py --models Puro_1D_CNN       # solo algunos modelos
  python train_cv38.py --folds 0 1                # solo algunos folds
  python train_cv38.py --final Puro_1D_CNN        # modelo final con los 38 sujetos
  python train_cv38.py --summary                  # resumen de la CV ya hecha
Salidas en reports/cv38/ y saved_models/{modelo}_cv38_final.h5
"""
import os
import sys
import json
import time
import argparse
from pathlib import Path

import numpy as np

import train_grouped as tg          # modelos e hiperparámetros ORIGINALES

from sklearn.model_selection import StratifiedGroupKFold

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "reports" / "cv38"
CV_DIR = OUT / "cv_results"
FINAL_DIR = OUT / "final"
LOG = OUT / "progress_log_cv38.jsonl"
N_FOLDS = 5
SEED = tg.SEED
N_CLASSES = tg.N_CLASSES
MODEL_IDS = [m[0] for m in tg.MODEL_FACTORIES]
FACTORY = {m[0]: m[1] for m in tg.MODEL_FACTORIES}

for d in (OUT, CV_DIR, FINAL_DIR):
    d.mkdir(parents=True, exist_ok=True)


def log(**kw):
    kw.setdefault("ts", time.strftime("%Y-%m-%d %H:%M:%S"))
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(kw, ensure_ascii=False, default=str) + "\n")


# ------------------------------------------------------------------ datos
X, y, groups, age_group, record_ids, activity, input_shape = tg.load_data()
subjects = sorted(set(groups.tolist()))
fall_subject = {s: bool(((y == 1) & (groups == s)).any()) for s in subjects}


def pick_val_subjects(candidates, seed_offset):
    """Validación interna con SUJETOS del train (>=1 con caídas)."""
    rng = np.random.RandomState(SEED + 2000 + seed_offset)
    order = list(candidates)
    rng.shuffle(order)
    n_val = max(2, int(round(len(order) * tg.VAL_SUBJECT_FRACTION)))
    val, fit = set(order[:n_val]), set(order[n_val:])
    while sum(fall_subject[s] for s in val) < 1:
        pool = sorted(s for s in fit if fall_subject[s])
        give = sorted(s for s in val if not fall_subject[s])
        if not pool or not give:
            break
        val = (val - {give[0]}) | {pool[0]}
        fit = (fit - {pool[0]}) | {give[0]}
    assert val.isdisjoint(fit) and val | fit == set(candidates)
    assert sum(fall_subject[s] for s in val) >= 1
    return sorted(fit), sorted(val)


def build_folds():
    """5 folds por sujeto sobre los 38 sujetos. Guarda fold_assignment_cv38.json."""
    has_fall = np.array([fall_subject[s] for s in subjects], dtype=int)
    sgk = StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    folds = []
    for tr, ev in sgk.split(np.arange(len(subjects)).reshape(-1, 1), y=has_fall,
                            groups=subjects):
        folds.append({"train_subjects": [subjects[i] for i in tr],
                      "eval_subjects": [subjects[i] for i in ev]})
    # --------- asserts de integridad
    all_eval = []
    for k, f in enumerate(folds):
        tr, ev = set(f["train_subjects"]), set(f["eval_subjects"])
        assert tr.isdisjoint(ev), f"fold {k}: train y evaluación comparten sujetos"
        assert tr | ev == set(subjects), f"fold {k}: no cubre los 38 sujetos"
        nf = sum(fall_subject[s] for s in ev)
        assert nf >= 4, f"fold {k}: solo {nf} sujetos con caídas en evaluación (se exige >=4)"
        all_eval += list(ev)
    assert sorted(all_eval) == subjects, "cada sujeto debe evaluarse exactamente una vez"
    # ningún registro en dos conjuntos (cada registro pertenece a un único sujeto)
    rec_subject = {}
    for r, s in zip(record_ids, groups):
        assert rec_subject.setdefault(r, s) == s, f"record {r} pertenece a más de un sujeto"
    payload = {"seed": SEED, "n_splits": N_FOLDS,
               "method": "StratifiedGroupKFold(5, shuffle=True, random_state=42) por sujeto; "
                         "estratificado por sujeto con caídas (sí/no); 38 sujetos",
               "n_subjects": len(subjects),
               "n_subjects_with_falls": int(sum(fall_subject.values())),
               "folds": [{"fold": k, "train_subjects": sorted(f["train_subjects"]),
                          "eval_subjects": sorted(f["eval_subjects"]),
                          "n_eval_subjects_with_falls":
                              int(sum(fall_subject[s] for s in f["eval_subjects"]))}
                         for k, f in enumerate(folds)]}
    (OUT / "fold_assignment_cv38.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n=== FOLDS (38 sujetos) ===")
    for k, f in enumerate(payload["folds"]):
        print(f"  fold {k}: {len(f['eval_subjects'])} sujetos de evaluación "
              f"({f['n_eval_subjects_with_falls']} con caídas): {', '.join(f['eval_subjects'])}")
    return folds


def add_noise(X_raw, snr_db, seed):
    rng = np.random.RandomState(seed)
    Xr = X_raw.astype(np.float64)
    pw = (Xr ** 2).mean(axis=1, keepdims=True)
    std = np.sqrt(pw / (10 ** (snr_db / 10.0)))
    return (Xr + rng.normal(0.0, 1.0, size=Xr.shape) * std).astype(np.float32)


# ------------------------------------------------------------------ un (modelo, fold)
def run_model_fold(model_id, k, folds):
    f = folds[k]
    ev_subj = sorted(f["eval_subjects"])
    tr_subj = sorted(f["train_subjects"])
    ddir = CV_DIR / model_id / f"fold{k}"
    mpath = ddir / "metrics.json"
    if mpath.exists():
        cached = json.loads(mpath.read_text(encoding="utf-8"))
        if cached.get("eval_subjects") == ev_subj:
            print(f"    [fold {k}·{model_id}] ya existe -> se omite")
            log(model=model_id, fold=k, event="skipped_existing")
            return cached
        log(model=model_id, fold=k, event="stale_result_retrain")

    fit_subj, val_subj = pick_val_subjects(tr_subj, k)
    assert set(ev_subj).isdisjoint(fit_subj) and set(ev_subj).isdisjoint(val_subj)
    fit_m = np.isin(groups, fit_subj)
    val_m = np.isin(groups, val_subj)
    ev_m = np.isin(groups, ev_subj)

    mu, sd = tg.fit_stats_normalization(X[fit_m])          # SOLO train del fold
    X_fit = tg.normalize_split(X[fit_m], mu, sd)
    X_val = tg.normalize_split(X[val_m], mu, sd)
    X_ev = tg.normalize_split(X[ev_m], mu, sd)
    y_fit, y_val, y_ev = y[fit_m], y[val_m], y[ev_m]
    cw = tg.compute_cw(y_fit)

    log(model=model_id, fold=k, event="start", fit_subjects=fit_subj, val_subjects=val_subj)
    t0 = time.time()
    model, hist, secs = tg.train_model(FACTORY[model_id], input_shape, X_fit, y_fit,
                                       X_val, y_val, cw, tag=f"cv38:{model_id}:{k}")
    y_prob = model.predict(X_ev, batch_size=256, verbose=0).astype(np.float32)
    y_pred = y_prob.argmax(1)
    X_noisy = tg.normalize_split(add_noise(X[ev_m], tg.NOISE_SNR_DB, SEED + k), mu, sd)
    y_prob_n = model.predict(X_noisy, batch_size=256, verbose=0).astype(np.float32)
    y_pred_n = y_prob_n.argmax(1)

    ddir.mkdir(parents=True, exist_ok=True)
    np.save(ddir / "y_true.npy", y_ev.astype(np.int8))
    np.save(ddir / "y_pred.npy", y_pred.astype(np.int8))
    np.save(ddir / "y_prob.npy", y_prob)
    np.save(ddir / "y_pred_snr20.npy", y_pred_n.astype(np.int8))
    np.save(ddir / "y_prob_snr20.npy", y_prob_n)
    model.save_weights(str(ddir / f"{model_id}_fold{k}.weights.h5"))
    met = tg.classes_metrics(y_ev, y_pred)
    met["accuracy_snr20"] = float((y_pred_n == y_ev).mean())
    met["recall_fall_snr20"] = float(((y_pred_n == 1) & (y_ev == 1)).sum() / max(1, (y_ev == 1).sum()))
    met.update({"model_id": model_id, "fold": k, "eval_subjects": ev_subj,
                "train_subjects": tr_subj, "fit_subjects": fit_subj, "val_subjects": val_subj,
                "class_weight_fit_only": cw,
                "n_windows": {"eval": int(ev_m.sum()), "fit": int(fit_m.sum()),
                              "val": int(val_m.sum())},
                "epochs_trained": len(hist["loss"]), "train_seconds": round(secs, 2),
                "normalization": {"mean": mu.tolist(), "std": sd.tolist()}})
    mpath.write_text(json.dumps(met, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"    [fold {k}·{model_id}] acc={met['accuracy']*100:.2f}% · "
          f"F1={met['f1_macro']*100:.2f}% · recall_caída={met['recall_per_class'][1]*100:.2f}% · "
          f"{secs:.0f}s · épocas={met['epochs_trained']}")
    log(model=model_id, fold=k, event="done", seconds=round(secs, 1),
        acc=round(met["accuracy"], 5), f1=round(met["f1_macro"], 5),
        recall_fall=round(met["recall_per_class"][1], 5), wall=round(time.time() - t0, 1))
    del model
    import tensorflow as tf
    tf.keras.backend.clear_session()
    return met


def assemble_oof(model_id, folds):
    """Predicciones fuera de fold de los 38 sujetos (todas las ventanas)."""
    odir = CV_DIR / model_id
    n = X.shape[0]
    yt = np.full(n, -1, np.int8)
    yp = np.full(n, -1, np.int8)
    ypn = np.full(n, -1, np.int8)
    pb = np.zeros((n, N_CLASSES), np.float32)
    cov = np.zeros(n, bool)
    for k, f in enumerate(folds):
        d = odir / f"fold{k}"
        if not (d / "metrics.json").exists():
            return False
        m = np.isin(groups, sorted(f["eval_subjects"]))
        a = np.load(d / "y_true.npy")
        assert m.sum() == a.shape[0], f"fold {k}: tamaño inconsistente"
        assert not cov[m].any()
        yt[m], yp[m] = a, np.load(d / "y_pred.npy")
        ypn[m] = np.load(d / "y_pred_snr20.npy")
        pb[m] = np.load(d / "y_prob.npy")
        cov[m] = True
    assert cov.all(), "el OOF no cubre todas las ventanas"
    assert (yt == y).all(), "las etiquetas del OOF no coinciden con y.npy"
    np.savez_compressed(odir / "oof_predictions.npz", y_true=yt, y_pred=yp, y_pred_snr20=ypn,
                        y_prob=pb, subject=groups, record_id=record_ids, activity=activity,
                        age_group=age_group, index=np.arange(n))
    log(model=model_id, event="oof_saved", n_windows=int(n))
    return True


# ------------------------------------------------------------------ entrenamiento final
def train_final(model_id):
    d = FINAL_DIR / model_id
    info_p = d / "final_info.json"
    if info_p.exists():
        print(f"  [final·{model_id}] ya existe -> se omite ({info_p})")
        return
    fit_subj, val_subj = pick_val_subjects(subjects, 9999)
    fit_m, val_m = np.isin(groups, fit_subj), np.isin(groups, val_subj)
    mu, sd = tg.fit_stats_normalization(X[fit_m])
    X_fit, X_val = tg.normalize_split(X[fit_m], mu, sd), tg.normalize_split(X[val_m], mu, sd)
    cw = tg.compute_cw(y[fit_m])
    log(model=model_id, event="final_start", fit_subjects=fit_subj, val_subjects=val_subj)
    model, hist, secs = tg.train_model(FACTORY[model_id], input_shape, X_fit, y[fit_m],
                                       X_val, y[val_m], cw, tag=f"final38:{model_id}")
    d.mkdir(parents=True, exist_ok=True)
    h5 = ROOT / "saved_models" / f"{model_id}_cv38_final.h5"
    model.save(str(h5), overwrite=True)
    info = {"model_id": model_id, "model_file": h5.name,
            "model_size_kb": round(h5.stat().st_size / 1024, 1),
            "trained_with": "38 sujetos (75 % fit / 25 % validación por sujetos)",
            "fit_subjects": fit_subj, "val_subjects": val_subj,
            "class_weight": cw, "epochs_trained": len(hist["loss"]),
            "train_seconds": round(secs, 1),
            "normalization": {"mean": mu.tolist(), "std": sd.tolist()},
            "nota": "No hay test independiente: las estimaciones de desempeño son las "
                    "predicciones fuera de fold de la CV (reports/cv38/cv_results)."}
    info_p.write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  [final·{model_id}] guardado {h5.name} ({info['model_size_kb']} KB) · {secs:.0f}s")
    log(model=model_id, event="final_done", seconds=round(secs, 1))


def print_summary():
    print("\n=== Resumen CV (media ± DE entre folds; n=5) ===")
    for mid in MODEL_IDS:
        a, f, r = [], [], []
        for k in range(N_FOLDS):
            p = CV_DIR / mid / f"fold{k}" / "metrics.json"
            if p.exists():
                m = json.loads(p.read_text(encoding="utf-8"))
                a.append(m["accuracy"]); f.append(m["f1_macro"]); r.append(m["recall_per_class"][1])
        if a:
            print(f"  {mid:<26} folds={len(a)} acc={np.mean(a)*100:5.2f}±{np.std(a)*100:4.2f}% "
                  f"F1={np.mean(f)*100:5.2f}±{np.std(f)*100:4.2f}% "
                  f"recall_caída={np.mean(r)*100:5.2f}±{np.std(r)*100:4.2f}%")


# ------------------------------------------------------------------ principal
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=MODEL_IDS, choices=MODEL_IDS)
    ap.add_argument("--folds", nargs="+", type=int, default=list(range(N_FOLDS)))
    ap.add_argument("--probe", action="store_true",
                    help="solo fold 0 de cada modelo para estimar el tiempo total")
    ap.add_argument("--final", nargs="+", choices=MODEL_IDS, default=None,
                    help="entrena el/los modelos finales con los 38 sujetos")
    ap.add_argument("--summary", action="store_true")
    args = ap.parse_args()

    print(f"[CV38] {X.shape[0]} ventanas · {len(subjects)} sujetos "
          f"({sum(fall_subject.values())} con caídas)")
    if args.summary:
        print_summary()
        sys.exit(0)
    folds = build_folds()

    if args.final:
        for mid in args.final:
            train_final(mid)
        sys.exit(0)

    todo_folds = [0] if args.probe else args.folds
    t_all = time.time()
    per_model_secs = {}
    for k in todo_folds:
        print(f"\n-- fold {k} --")
        for mid in args.models:
            m = run_model_fold(mid, k, folds)
            per_model_secs.setdefault(mid, []).append(m["train_seconds"])
    if args.probe:
        tot = sum(v[0] for v in per_model_secs.values())
        # los folds tienen tamaños parecidos: proyección = 5 folds + entrenamiento final de 1 modelo
        print("\n=== PROYECCIÓN (a partir del fold 0) ===")
        for mid, v in per_model_secs.items():
            print(f"  {mid:<26} {v[0]/60:6.1f} min por fold -> {v[0]*N_FOLDS/60:6.1f} min x 5 folds")
        print(f"  TOTAL 5 modelos x 5 folds ≈ {tot*N_FOLDS/3600:.2f} h "
              f"(sin contar el modelo final)")
        sys.exit(0)

    print("\n=== Ensamblando predicciones fuera de fold ===")
    for mid in args.models:
        ok = assemble_oof(mid, folds)
        print(f"  {mid:<26} {'OOF listo' if ok else 'faltan folds (OOF pendiente)'}")
    print_summary()
    log(event="pipeline_done", total_min=round((time.time() - t_all) / 60, 1))
    print(f"\n[OK] Terminado en {(time.time()-t_all)/60:.1f} min.")
