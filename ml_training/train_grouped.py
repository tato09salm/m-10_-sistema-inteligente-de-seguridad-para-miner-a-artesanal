# -*- coding: utf-8 -*-
"""
M-10 · Paso 3: entrenamiento con partición POR SUJETO (sin fuga de información).

Correcciones respecto al pipeline anterior (train_all_models.py):
  - Partición por SUJETO: 5 sujetos SA al azar + 1 SE (distinto de SE06) para
    prueba; el resto (incluido SE06) a desarrollo con StratifiedGroupKFold
    (n_splits=5, shuffle=True, random_state=42) estratificado por presencia de
    caídas del sujeto. Mismos folds para las 5 arquitecturas.
  - Normalización por canal ajustada SOLO con el train de cada fold.
  - Early stopping con validación tomada de SUJETOS del train del fold
    (nunca del fold evaluado ni del test).
  - class_weight calculado SOLO con el train del fold (único cambio respecto
    al entrenamiento anterior; se reporta explícitamente).
  - Guardado incremental tras cada modelo/fold + reports/progress_log.jsonl.
    Reanudable: si ya existe el resultado de un (modelo, fold), se omite.
  - Presupuesto: se cronometra UN fold por arquitectura y se proyecta el total
    (folds restantes + entrenamiento final). Si la proyección supera 1.5 h se
    usa n_splits=3 y se reporta (sin pedir confirmación).
  - Predicciones fuera de fold de todos los sujetos de desarrollo; el
    entrenamiento final usa TODO el desarrollo y evalúa UNA sola vez en test.
  - Evaluación adicional pedida por el plan: ruido gaussiano a SNR 20 dB sobre
    las señales RAW del test (diagnóstico, no selección de modelo).

Arquitecturas e hiperparámetros: SIN CAMBIOS respecto a train_all_models.py
(EPOCHS=20, BATCH_SIZE=128, LR=1e-3, Adam, sparse_categorical_crossentropy,
EarlyStopping(val_accuracy, patience=5, restore_best_weights=True),
ReduceLROnPlateau(val_loss, factor=0.5, patience=3, min_lr=1e-5)).
"""
import os
import sys
import json
import time
import random
import shutil
import argparse
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
from tensorflow.keras import layers, models, callbacks, optimizers
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, confusion_matrix, classification_report)
from sklearn.utils.class_weight import compute_class_weight

# ----------------------------------------------------------------- semillas
SEED = 42
np.random.seed(SEED)
random.seed(SEED)
tf.random.set_seed(SEED)

ROOT = Path(__file__).resolve().parent
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "saved_models"
REPORTS_DIR = ROOT / "reports"
CV_DIR = REPORTS_DIR / "cv_results"
FINAL_DIR = REPORTS_DIR / "final"
PROGRESS_LOG = REPORTS_DIR / "progress_log.jsonl"
TIME_BUDGET_S = int(1.5 * 3600)

EPOCHS = 20
BATCH_SIZE = 128
LEARNING_RATE = 1e-3
VAL_SUBJECT_FRACTION = 0.25       # sujetos de validación tomados del train del fold
NOISE_SNR_DB = 20.0               # robustez al ruido gaussiano en test
N_CLASSES = 3
CLASS_NAMES = ["Normal", "Posible_Caida", "Baja_actividad"]

for d in (MODELS_DIR, REPORTS_DIR, CV_DIR, FINAL_DIR):
    d.mkdir(parents=True, exist_ok=True)


def log_progress(**kwargs):
    kwargs.setdefault("ts", time.strftime("%Y-%m-%d %H:%M:%S"))
    with open(PROGRESS_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(kwargs, ensure_ascii=False, default=str) + "\n")


def reset_seeds():
    np.random.seed(SEED)
    random.seed(SEED)
    tf.random.set_seed(SEED)


# ----------------------------------------------------------------- modelos
# (copiados SIN CAMBIOS de train_all_models.py)

def build_1d_cnn(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Conv1D(64, kernel_size=5, padding="same", activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Conv1D(128, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Puro_1D_CNN")


def build_bilstm(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.Bidirectional(layers.LSTM(32))(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Puro_Bi_LSTM")


def build_gru(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.GRU(64, return_sequences=True)(inp)
    x = layers.Dropout(0.3)(x)
    x = layers.GRU(64)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Puro_GRU")


def build_cnn_lstm(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    x = layers.Conv1D(64, kernel_size=5, padding="same", activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    x = layers.Conv1D(128, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(pool_size=2)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.LSTM(64)(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(64, activation="relu")(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Hibrido_CNN_LSTM")


class TemporalAttention(layers.Layer):
    """(idéntica a train_all_models.py; se añade get_config para serializar .h5)"""

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


def build_attention_res_gru(input_shape, num_classes):
    inp = layers.Input(shape=input_shape, name="input_sensor_stream")
    c1 = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(inp)
    c1 = layers.BatchNormalization()(c1)
    gru_out = layers.GRU(64, return_sequences=True)(c1)
    res = layers.Add()([c1, gru_out])
    att = TemporalAttention()(res)
    x = layers.Dense(64, activation="relu")(att)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(num_classes, activation="softmax", name="output_probabilities")(x)
    return models.Model(inputs=inp, outputs=out, name="Hibrido_Attention_ResGRU")


MODEL_FACTORIES = [
    ("Puro_1D_CNN", build_1d_cnn,
     "1. Puro: 1D-CNN (Red Convolucional 1D)"),
    ("Puro_Bi_LSTM", build_bilstm,
     "2. Puro: Bi-LSTM (Bidirectional LSTM)"),
    ("Puro_GRU", build_gru,
     "3. Puro: GRU (Gated Recurrent Unit)"),
    ("Hibrido_CNN_LSTM", build_cnn_lstm,
     "4. Hibrido: CNN-LSTM (Convolucional + Recurrente)"),
    ("Hibrido_Attention_ResGRU", build_attention_res_gru,
     "5. Hibrido: Conv1D + Attention + Residual GRU"),
]


# ----------------------------------------------------------------- utilidades
def classes_metrics(y_true, y_pred):
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_per_class": precision_score(y_true, y_pred, average=None,
                                               labels=list(range(N_CLASSES)), zero_division=0).tolist(),
        "recall_per_class": recall_score(y_true, y_pred, average=None,
                                         labels=list(range(N_CLASSES)), zero_division=0).tolist(),
        "f1_per_class": f1_score(y_true, y_pred, average=None,
                                 labels=list(range(N_CLASSES)), zero_division=0).tolist(),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=list(range(N_CLASSES))).tolist(),
    }


def compute_cw(y_fit):
    """class_weight 'balanced' calculado SOLO con el train usado en fit()."""
    cw_vals = compute_class_weight("balanced", classes=np.arange(N_CLASSES),
                                   y=y_fit.astype(int))
    return {int(c): float(w) for c, w in zip(np.arange(N_CLASSES), cw_vals)}


def fit_stats_normalization(X_fit):
    mu = X_fit.reshape(-1, X_fit.shape[2]).mean(axis=0)
    sd = X_fit.reshape(-1, X_fit.shape[2]).std(axis=0) + 1e-8
    return mu.astype(np.float64), sd.astype(np.float64)


def normalize_split(X, mu, sd):
    return ((X - mu) / sd).astype(np.float32)


def model_weights_to_h5(model, path: Path):
    """Guarda los pesos en formato .h5 (compatibilidad con el proyecto)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        model.save_weights(str(path))
        return "save_weights"
    except Exception as e:
        alt = path.with_suffix(".weights.h5")
        model.save_weights(str(alt))
        log_progress(event="warn", message=f"save_weights fallback: {e}")
        return "save_weights_fallback"


def train_model(factory, input_shape, X_fit, y_fit, X_val, y_val, cw, tag):
    """Un entrenamiento con hiperparámetros IDÉNTICOS al pipeline anterior."""
    reset_seeds()
    model = factory(input_shape, N_CLASSES)
    model.compile(optimizer=optimizers.Adam(learning_rate=LEARNING_RATE),
                  loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    cbs = [
        callbacks.EarlyStopping(monitor="val_accuracy", patience=5,
                                restore_best_weights=True, verbose=0),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3,
                                    min_lr=1e-5, verbose=0),
    ]
    t0 = time.time()
    hist = model.fit(X_fit, y_fit.astype(np.int64),
                     validation_data=(X_val, y_val.astype(np.int64)),
                     epochs=EPOCHS, batch_size=BATCH_SIZE,
                     class_weight=cw, callbacks=cbs, verbose=2)
    secs = time.time() - t0
    return model, hist.history, secs


# ----------------------------------------------------------------- datos
def load_data():
    X = np.load(PROCESSED_DIR / "X.npy")
    y = np.load(PROCESSED_DIR / "y.npy")
    groups = np.load(PROCESSED_DIR / "groups.npy").astype(str)
    age_group = np.load(PROCESSED_DIR / "age_group.npy").astype(str)
    record_ids = np.load(PROCESSED_DIR / "record_ids.npy").astype(str)
    activity = np.load(PROCESSED_DIR / "activity.npy").astype(str)
    return X, y, groups, age_group, record_ids, activity, X.shape[1:]


def pick_test_subjects(subjects):
    """5 SA al azar + 1 SE (≠SE06), RandomState(42). Guarda reports/test_subjects.json."""
    out_path = REPORTS_DIR / "test_subjects.json"
    if out_path.exists():
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)["test_subjects"]
    sa = sorted(s for s in subjects if s.startswith("SA"))
    se_pool = sorted(s for s in subjects if s.startswith("SE") and s != "SE06")
    rng = np.random.RandomState(SEED)
    test_sa = [str(s) for s in rng.choice(sa, size=5, replace=False)]
    test_se = str(rng.choice(se_pool, size=1)[0])
    payload = {
        "seed": SEED,
        "method": "RandomState(42): (1) choice sa_subjects_sorted size=5 replace=False; "
                  "(2) choice se_pool_sorted (SE sin SE06) size=1",
        "test_subjects": test_sa + [test_se],
        "sa_chosen": test_sa, "se_chosen": test_se,
        "se06_in_development": True,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log_progress(stage="setup", event="test_subjects_selected", **payload)
    return payload["test_subjects"]


def pick_val_subjects(candidates, fold_idx):
    """Validación interna: SUJETOS del train del fold (nunca del fold evaluado ni test).

    Devuelve (fit_subj, val_subj) garantizando ≥1 sujeto con caídas en val.
    """
    rng = np.random.RandomState(SEED + 1000 + fold_idx)
    order = list(candidates)
    rng.shuffle(order)
    n_val = max(2, int(round(len(order) * VAL_SUBJECT_FRACTION)))
    val_subj = set(order[:n_val])
    fit_subj = set(order[n_val:])
    # ajuste: si val no tiene sujetos con caídas, intercambiar con el mejor de fit
    while sum(fall_subject[s] for s in val_subj) < 1:
        pool = [s for s in fit_subj if fall_subject[s]]
        sw = [s for s in val_subj if not fall_subject[s]]
        if not pool or not sw:
            break                      # no hay con qué ajustar (no debería ocurrir)
        take = sorted(pool)[0]
        give = sorted(sw)[0]
        val_subj = (val_subj - {give}) | {take}
        fit_subj = (fit_subj - {take}) | {give}
    val_subj = sorted(val_subj)
    fit_subj = sorted(fit_subj)
    assert set(val_subj).isdisjoint(fit_subj)
    assert set(val_subj).issubset(set(candidates))
    assert sum(fall_subject[s] for s in val_subj) >= 1
    return fit_subj, val_subj


# ----------------------------------------------------------------- partición
def build_assignment(n_folds, dev_subjects):
    """StratifiedGroupKFold(n_splits, shuffle=True, random_state=42) por sujeto.

    Estratificación: presencia de caídas del sujeto (ventanas clase 1 > 0),
    para repartir equitativamente los sujetos con caídas entre los folds.
    """
    has_fall = np.array([fall_subject[s] for s in dev_subjects], dtype=int)
    Xs = np.arange(len(dev_subjects)).reshape(-1, 1)
    sgr = StratifiedGroupKFold(n_splits=n_folds, shuffle=True, random_state=SEED)
    folds = []
    for tr_idx, ev_idx in sgr.split(Xs, y=has_fall, groups=dev_subjects):
        folds.append({
            "train_subjects": [dev_subjects[i] for i in tr_idx],
            "eval_subjects": [dev_subjects[i] for i in ev_idx],
        })

    # ------- asserts de integridad (pedidos por el usuario)
    test_set = set(test_subjects)
    for k, fold in enumerate(folds):
        tr, ev = set(fold["train_subjects"]), set(fold["eval_subjects"])
        assert tr.isdisjoint(ev), f"fold {k}: train y evaluación comparten sujetos"
        assert tr | ev == set(dev_subjects), f"fold {k}: no cubre todo el desarrollo"
        assert ev.isdisjoint(test_set), f"fold {k}: la evaluación toca sujetos de test"
        n_fall = sum(fall_subject[s] for s in ev)
        assert n_fall >= 3, (f"fold {k}: solo {n_fall} sujetos con caídas en la "
                             "evaluación (se exige ≥3)")
    # record_id no repetido entre conjuntos
    subj_of_record = {r: g for r, g in zip(record_ids, groups)}
    for k, fold in enumerate(folds):
        ev_set = set(fold["eval_subjects"])
        tr_set = set(fold["train_subjects"])
        for r, s in subj_of_record.items():
            if s in ev_set:
                assert s not in tr_set, f"record {r} en dos conjuntos (fold {k})"
    test_records = {r for r, s in subj_of_record.items() if s in test_set}
    dev_records = {r for r, s in subj_of_record.items() if s not in test_set}
    assert test_records.isdisjoint(dev_records), "record_id repetido entre test y desarrollo"

    # ------- reporte por fold
    print(f"\n=== ASIGNACIÓN DE FOLDS (n_splits={n_folds}, StratifiedGroupKFold "
          f"shuffle=True, random_state={SEED}, estratificado por presencia de caídas) ===")
    for k, fold in enumerate(folds):
        ev = set(fold["eval_subjects"])
        mask = np.isin(groups, list(ev))
        cells = " | ".join(f"{CLASS_NAMES[c]}: {int(((y == c) & mask).sum())}"
                           for c in range(N_CLASSES))
        n_fall_subj = sum(fall_subject[s] for s in ev)
        n_fall_rec = len({r for r, s in subj_of_record.items()
                          if s in ev and r.startswith("F")})
        print(f"  fold {k}: {len(ev)} sujetos eval ({n_fall_subj} con caídas) | "
              f"regs. de caída F##: {n_fall_rec}")
        print(f"     sujetos eval: {', '.join(sorted(ev))}")
        print(f"     ventanas: {cells}")
    log_progress(stage="assignment", event="folds_built", n_splits=n_folds,
                 folds=[{"fold": k, "eval_subjects": sorted(set(f["eval_subjects"])),
                         "n_fall_subjects_eval": int(sum(fall_subject[s] for s in f["eval_subjects"]))}
                        for k, f in enumerate(folds)])
    return folds


def save_assignment(folds, n_folds):
    payload = {
        "seed": SEED,
        "n_splits": n_folds,
        "method": "StratifiedGroupKFold(n_splits, shuffle=True, random_state=42) "
                  "por sujeto; estratificación = sujeto con caídas (sí/no)",
        "folds": [{"fold": k,
                   "train_subjects": sorted(set(f["train_subjects"])),
                   "eval_subjects": sorted(set(f["eval_subjects"]))}
                  for k, f in enumerate(folds)],
    }
    with open(REPORTS_DIR / "fold_assignment.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


# ----------------------------------------------------------------- entrenar fold
def run_fold(fold_idx, folds, input_shape):
    """Entrena las 5 arquitecturas en ese fold (salto si ya existe el resultado)."""
    fold = folds[fold_idx]
    ev_subj = sorted(set(fold["eval_subjects"]))
    tr_subj = sorted(set(fold["train_subjects"]))
    fit_subj, val_subj = pick_val_subjects(tr_subj, fold_idx)

    ev_mask = np.isin(groups, ev_subj)
    val_mask = np.isin(groups, val_subj)
    fit_mask = np.isin(groups, fit_subj)
    X_eval_raw, y_eval = X[ev_mask], y[ev_mask]

    results = {}
    for model_id, factory, desc in MODEL_FACTORIES:
        ddir = CV_DIR / model_id / f"fold{fold_idx}"
        mpath = ddir / "metrics.json"
        if mpath.exists():
            with open(mpath, encoding="utf-8") as f:
                cached = json.load(f)
            # resumen solo con resultados de LA MISMA asignación de folds
            if cached.get("eval_subjects") == ev_subj:
                results[model_id] = cached
                log_progress(stage="cv", model=model_id, fold=fold_idx,
                             event="skipped_existing_result")
                continue
            log_progress(stage="cv", model=model_id, fold=fold_idx, event="stale_result",
                         cached_eval_subjects=cached.get("eval_subjects"),
                         current_eval_subjects=ev_subj,
                         message="resultado antiguo con otra asignación; se reentrena")

        log_progress(stage="cv", model=model_id, fold=fold_idx,
                     event="start", fit_subjects=fit_subj, val_subjects=val_subj)
        t_start = time.time()

        X_fit_raw = X[fit_mask]
        mu, sd = fit_stats_normalization(X_fit_raw)
        X_fit = normalize_split(X_fit_raw, mu, sd)
        X_val = normalize_split(X[val_mask], mu, sd)
        X_eval = normalize_split(X_eval_raw, mu, sd)
        y_fit, y_val = y[fit_mask], y[val_mask]

        cw = compute_cw(y_fit)
        model, hist, secs = train_model(factory, input_shape, X_fit, y_fit,
                                        X_val, y_val, cw,
                                        tag=f"cv:{model_id}:fold{fold_idx}")
        y_prob = model.predict(X_eval, batch_size=256, verbose=0).astype(np.float32)
        y_pred = np.argmax(y_prob, axis=1)

        ddir.mkdir(parents=True, exist_ok=True)
        np.save(ddir / "y_true.npy", y_eval.astype(np.int8))
        np.save(ddir / "y_pred.npy", y_pred.astype(np.int8))
        np.save(ddir / "y_prob.npy", y_prob)
        model_weights_to_h5(model, ddir / f"{model_id}_fold{fold_idx}.h5")
        met = classes_metrics(y_eval, y_pred)
        met.update({
            "model_id": model_id, "fold": fold_idx,
            "eval_subjects": ev_subj, "train_subjects": tr_subj,
            "val_subjects": val_subj,
            "class_weight_fit_only": cw,
            "n_windows": {"eval": int(ev_mask.sum()), "fit": int(fit_mask.sum()),
                          "val": int(val_mask.sum())},
            "epochs_trained": len(hist["loss"]),
            "history": hist,
            "train_seconds": round(secs, 2),
            "normalization": {"mean": mu.tolist(), "std": sd.tolist(),
                              "fit_source": "train del fold (fit_subjects)", },
        })
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(met, f, indent=2, ensure_ascii=False)

        print(f"    [fold {fold_idx}·{model_id}] "
              f"acc={met['accuracy']*100:.2f}% · F1_macro={met['f1_macro']*100:.2f}% · "
              f"recall_caída={met['recall_per_class'][1]*100:.2f}% · {secs:.1f}s · "
              f"epochs={met['epochs_trained']}")
        log_progress(stage="cv", model=model_id, fold=fold_idx, event="done",
                     seconds=round(secs, 2), epochs=met["epochs_trained"],
                     acc=round(met["accuracy"], 5), f1_macro=round(met["f1_macro"], 5),
                     recall_fall=round(met["recall_per_class"][1], 5),
                     class_weight=cw, total_fold_wall=time.time() - t_start)
        results[model_id] = met
        del model

    return results


# ----------------------------------------------------------------- entrenamiento final
def run_final(model_result_metrics, model_id, factory, input_shape):
    """Entrena con TODO el desarrollo y evalúa UNA sola vez en el test (limpio + SNR 20 dB)."""
    ddir = FINAL_DIR / model_id
    mpath = ddir / "metrics_test.json"
    if mpath.exists():
        with open(mpath, encoding="utf-8") as f:
            return json.load(f)

    # validación interna con SUJETOS de desarrollo (nunca test)
    fit_subj, val_subj = pick_val_subjects(dev_subjects, fold_idx=9999)

    val_mask = np.isin(groups, val_subj)
    fit_mask = np.isin(groups, fit_subj)
    test_mask = np.isin(groups, test_subjects)
    assert set(val_subj).isdisjoint(set(test_subjects))
    assert set(fit_subj).isdisjoint(set(test_subjects))

    log_progress(stage="final", model=model_id, event="start",
                 fit_subjects=fit_subj, val_subjects=val_subj)
    t_start = time.time()

    X_fit_raw = X[fit_mask]
    mu, sd = fit_stats_normalization(X_fit_raw)
    X_fit = normalize_split(X_fit_raw, mu, sd)
    X_val = normalize_split(X[val_mask], mu, sd)
    X_test_norm = normalize_split(X[test_mask], mu, sd)
    y_fit, y_val, y_test = y[fit_mask], y[val_mask], y[test_mask]

    cw = compute_cw(y_fit)
    model, hist, secs = train_model(factory, input_shape, X_fit, y_fit, X_val, y_val, cw,
                                    tag=f"final:{model_id}")

    # --- ÚNICA evaluación en test (señal limpia)
    t_pred = time.time()
    y_prob_test = model.predict(X_test_norm, batch_size=256, verbose=0).astype(np.float32)
    latency_ms = (time.time() - t_pred) * 1000.0 / X_test_norm.shape[0]
    y_pred_test = np.argmax(y_prob_test, axis=1)

    # --- diagnóstico de robustez: ruido gaussiano SNR 20 dB sobre la señal RAW
    #     (ruido por canal con la potencia de señal de cada ventana del test; seed 42)
    rng_noise = np.random.RandomState(SEED)
    X_test_raw = X[test_mask].astype(np.float64)
    sig_pow = (X_test_raw ** 2).mean(axis=1, keepdims=True)         # (n,1,8)
    noise_std = np.sqrt(sig_pow / (10 ** (NOISE_SNR_DB / 10.0)))
    X_noisy = X_test_raw + rng_noise.normal(0.0, 1.0, size=X_test_raw.shape) * noise_std
    X_noisy_f = X_noisy.astype(np.float32)
    del X_test_raw, X_noisy
    X_noisy_norm = normalize_split(X_noisy_f, mu, sd)
    y_prob_noisy = model.predict(X_noisy_norm, batch_size=256, verbose=0).astype(np.float32)
    y_pred_noisy = np.argmax(y_prob_noisy, axis=1)

    ddir.mkdir(parents=True, exist_ok=True)
    np.save(ddir / "y_true_test.npy", y_test.astype(np.int8))
    np.save(ddir / "y_pred_test.npy", y_pred_test.astype(np.int8))
    np.save(ddir / "y_prob_test.npy", y_prob_test)
    np.save(ddir / "y_pred_test_snr20.npy", y_pred_noisy.astype(np.int8))
    np.save(ddir / "y_prob_test_snr20.npy", y_prob_noisy)
    np.save(ddir / "subject_test.npy", groups[test_mask])
    np.save(ddir / "record_ids_test.npy", record_ids[test_mask])
    np.save(ddir / "activity_test.npy", activity[test_mask])

    h5_file = MODELS_DIR / f"{model_id}_grouped.h5"
    try:
        model.save(str(h5_file), overwrite=True)
        saved_as = h5_file.name
    except Exception as e:
        alt = MODELS_DIR / f"{model_id}_grouped.keras"
        model.save(str(alt))
        saved_as = alt.name
        log_progress(stage="final", model=model_id, event="warn",
                     message=f".h5 no disponible ({e}); se guardó .keras")

    met = classes_metrics(y_test, y_pred_test)
    met_noisy = classes_metrics(y_test, y_pred_noisy)
    payload = {
        "model_id": model_id, "n_folds": n_folds_used,
        "fit_subjects": fit_subj, "val_subjects": val_subj,
        "test_subjects": test_subjects,
        "class_weight_development_train_only": cw,
        "n_windows": {"fit": int(fit_mask.sum()), "val": int(val_mask.sum()),
                      "test": int(test_mask.sum())},
        "epochs_trained": len(hist["loss"]),
        "train_seconds": round(secs, 2),
        "latency_ms_per_sample": round(latency_ms, 3),
        "normalization": {"mean": mu.tolist(), "std": sd.tolist(),
                          "fit_source": "train completo del desarrollo (fit_subjects)"},
        "metrics_test_clean": met,
        "metrics_test_snr20dB": met_noisy,
        "noise": {"snr_db": NOISE_SNR_DB,
                  "method": "gaussiano blanco por canal; sigma=sqrt(potencia señal / 10^(SNR/10)) "
                            "calculada por ventana y canal; seed 42"},
        "model_file": saved_as,
    }
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    model_weights_to_h5(model, ddir / f"{model_id}_final.weights.h5")

    m = met
    print(f"    [final·{model_id}] TEST acc={m['accuracy']*100:.2f}% · "
          f"F1_macro={m['f1_macro']*100:.2f}% · recall_caída={m['recall_per_class'][1]*100:.2f}% · "
          f"SNR20dB acc={met_noisy['accuracy']*100:.2f}% · {secs:.1f}s")
    log_progress(stage="final", model=model_id, event="done",
                 seconds=round(secs, 2), epochs=len(hist["loss"]),
                 acc=round(m["accuracy"], 5), f1_macro=round(m["f1_macro"], 5),
                 recall_fall=round(m["recall_per_class"][1], 5),
                 acc_snr20=round(met_noisy["accuracy"], 5),
                 class_weight=cw)
    del model
    return payload


def assemble_oof(model_id, folds):
    """Predicciones FUERA DE FOLD de todos los sujetos de desarrollo."""
    odir = CV_DIR / model_id
    out = odir / "oof_predictions.npz"
    if out.exists():
        return
    n = X.shape[0]
    oof_true = np.full(n, -1, dtype=np.int8)
    oof_pred = np.full(n, -1, dtype=np.int8)
    oof_prob = np.zeros((n, N_CLASSES), dtype=np.float32)
    covered = np.zeros(n, dtype=bool)
    dev_mask = ~np.isin(groups, test_subjects)
    for k in range(n_folds_used):
        ddir = odir / f"fold{k}"
        if not (ddir / "metrics.json").exists():
            print(f"    [oof·{model_id}] fold {k} incompleto; OOF pendiente")
            return
        ev_subj = sorted(set(folds[k]["eval_subjects"]))
        mask = np.isin(groups, ev_subj)
        yt = np.load(ddir / "y_true.npy"); yp = np.load(ddir / "y_pred.npy")
        pb = np.load(ddir / "y_prob.npy")
        assert mask.sum() == yt.shape[0], f"fold {k}: tamaño inconsistente para OOF"
        assert not covered[mask].any(), "solapamiento de sujetos entre folds de evaluación"
        oof_true[mask] = yt
        oof_pred[mask] = yp
        oof_prob[mask] = pb
        covered[mask] = True
    # el OOF debe cubrir TODAS las ventanas de desarrollo y NINGUNA de test
    assert covered[dev_mask].all(), "OOF no cubre todas las ventanas de desarrollo"
    assert not covered[~dev_mask].any(), "OOF cubrió ventanas de test (imposible: no están en folds)"
    assert (oof_true[covered] >= 0).all()
    np.savez_compressed(out, y_true=oof_true[covered], y_pred=oof_pred[covered],
                        y_prob=oof_prob[covered], subject=groups[covered],
                        record_id=record_ids[covered], activity=activity[covered],
                        age_group=age_group[covered], index=np.flatnonzero(covered))
    assert set(np.unique(groups[covered]).tolist()).isdisjoint(set(test_subjects)), \
        "un sujeto de test apareció en el OOF"
    log_progress(stage="oof", model=model_id, event="saved", n_windows=int(covered.sum()),
                 note="solo ventanas de desarrollo (fuera de fold)")


# ----------------------------------------------------------------- principal
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Paso 3: CV por sujeto + entrenamiento final")
    ap.add_argument("--force-n-folds", type=int, default=None, metavar="N",
                    help="Forzar n_splits (omita el probe de tiempo; se presupone que la "
                         "decisión de presupuesto ya se tomó en una pasada anterior)")
    args = ap.parse_args()

    T_MAIN = time.time()
    print("[Paso 3] Cargando datos...")
    X, y, groups, age_group, record_ids, activity, input_shape = load_data()
    subjects = sorted(set(groups.tolist()))
    fall_subject = {s: bool(((y == 1) & (groups == s)).any()) for s in subjects}

    test_subjects = pick_test_subjects(subjects)
    dev_subjects = [s for s in subjects if s not in set(test_subjects)]
    print(f"  test: {test_subjects}")
    print(f"  desarrollo: {len(dev_subjects)} sujetos (SE06 incluido: "
          f"{'SE06' in dev_subjects})")

    if args.force_n_folds:
        n_folds_used = args.force_n_folds
        folds = build_assignment(n_folds_used, dev_subjects)
        save_assignment(folds, n_folds_used)
        log_progress(stage="probe", event="forced_n_folds", n_splits=n_folds_used,
                     note=(f"n_splits={n_folds_used} forzado: la medición ya hecha con el "
                           "esquema de 5 folds proyecto 155.5 min > 90 min de presupuesto "
                           "(1.5 h), por lo que esta decisión ya estaba tomada."))
        print(f"  [AVISO] n_folds={n_folds_used} forzado por CLI (decisión de presupuesto ya tomada).")
    else:
        n_folds_used = 5
        folds = build_assignment(n_folds_used, dev_subjects)
        save_assignment(folds, n_folds_used)

        # ---- PROBE: cronometrar UN fold por arquitectura y proyectar el total
        print("\n=== PROBE DE TIEMPO: fold 0 por arquitectura ===")
        probe_t0 = time.time()
        for model_id, _, _ in MODEL_FACTORIES:
            run_fold(0, folds, input_shape)
        probe_secs = time.time() - probe_t0

        per_arch = {}
        for model_id, _, _ in MODEL_FACTORIES:
            p = CV_DIR / model_id / "fold0" / "metrics.json"
            with open(p, encoding="utf-8") as f:
                per_arch[model_id] = json.load(f)["train_seconds"]
        sum_probe = sum(per_arch.values())
        total_win = X.shape[0]
        dev_win = int((~np.isin(groups, test_subjects)).sum())
        fold_fit_est = dev_win * (n_folds_used - 1) / n_folds_used * 0.75
        final_fit_est = dev_win * 0.75
        final_scale = final_fit_est / fold_fit_est
        projected_remaining = sum_probe * (n_folds_used - 1) + sum_probe * final_scale
        projected_total = projected_remaining + probe_secs
        print(f"\n  tiempos fold 0 (s): {json.dumps(per_arch)}")
        print(f"  proyección (5 folds + final): {projected_total/60:.1f} min "
              f"(presupuesto: {TIME_BUDGET_S/60:.0f} min)")
        log_progress(stage="probe", event="projection",
                     fold0_seconds=per_arch, n_splits=5,
                     projected_total_minutes=round(projected_total / 60, 1),
                     budget_minutes=TIME_BUDGET_S / 60,
                     final_scale_ratio=round(final_scale, 3))

        if projected_total > TIME_BUDGET_S:
            n_folds_used = 3
            # results del probe (5 folds) se archivan: el fold 0 del esquema de 3
            # folds es distinto y se reentrena
            stamp = time.strftime("%Y%m%d_%H%M%S")
            archive = REPORTS_DIR / f"_probe_discarded_5fold_{stamp}"
            if CV_DIR.exists():
                shutil.move(str(CV_DIR), str(archive))
                (archive / "README.txt").write_text(
                    "Resultados del fold 0 del esquema de 5 folds, usados SOLO para "
                    "estimar tiempos. Se descartaron al cambiar a n_splits=3 "
                    "(presupuesto de 1.5 h). NO usar como resultados del paper.\n",
                    encoding="utf-8")
                CV_DIR.mkdir(parents=True, exist_ok=True)
                (REPORTS_DIR / "fold_assignment.json").rename(
                    REPORTS_DIR / "fold_assignment_5fold_probe.json")
            folds = build_assignment(n_folds_used, dev_subjects)
            save_assignment(folds, n_folds_used)
            projected_total = (sum_probe * (n_folds_used - 1) + sum_probe * final_scale
                               + probe_secs)
            print(f"\n  [AVISO] La proyección excede 1.5 h → se usa n_folds=3. "
                  f"Nueva proyección: {projected_total/60:.1f} min. "
                  "Se descartó el fold 0 de prueba (esquema de 5 folds) y se archivó en "
                  f"{archive.name}.")
            log_progress(stage="probe", event="switch_to_3_folds",
                         reason="proyección > 1.5 h",
                         archived_probe_dir=archive.name,
                         new_projection_minutes=round(projected_total / 60, 1))

    # ---- CV completa
    print(f"\n=== CV: {n_folds_used} folds x {len(MODEL_FACTORIES)} arquitecturas ===")
    for k in range(n_folds_used):
        print(f"\n-- fold {k} --")
        run_fold(k, folds, input_shape)

    # ---- OOF por arquitectura
    print("\n=== Ensamblando predicciones fuera de fold (OOF) ===")
    for model_id, _, _ in MODEL_FACTORIES:
        assemble_oof(model_id, folds)

    # ---- resumen CV
    print("\n=== Resumen CV (media ± desv. entre folds) ===")
    cv_summary = {}
    for model_id, _, _ in MODEL_FACTORIES:
        accs, f1s, rfs = [], [], []
        for k in range(n_folds_used):
            with open(CV_DIR / model_id / f"fold{k}" / "metrics.json", encoding="utf-8") as f:
                m = json.load(f)
            accs.append(m["accuracy"]); f1s.append(m["f1_macro"])
            rfs.append(m["recall_per_class"][1])
        cv_summary[model_id] = {
            "accuracy_mean": float(np.mean(accs)), "accuracy_std": float(np.std(accs)),
            "f1_macro_mean": float(np.mean(f1s)), "f1_macro_std": float(np.std(f1s)),
            "recall_fall_mean": float(np.mean(rfs)), "recall_fall_std": float(np.std(rfs)),
        }
        print(f"  {model_id:<26}: acc={np.mean(accs)*100:5.2f}±{np.std(accs)*100:4.2f}% · "
              f"F1_macro={np.mean(f1s)*100:5.2f}±{np.std(f1s)*100:4.2f}% · "
              f"recall_caída={np.mean(rfs)*100:5.2f}±{np.std(rfs)*100:4.2f}%")

    # ---- entrenamiento final + ÚNICA evaluación en test
    print("\n=== ENTRENAMIENTO FINAL (todo el desarrollo) + evaluación en test ===")
    final_payloads = {}
    for model_id, factory, _ in MODEL_FACTORIES:
        final_payloads[model_id] = run_final(None, model_id, factory, input_shape)

    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "seed": SEED, "n_folds": n_folds_used,
        "test_subjects": test_subjects,
        "cv_summary_mean_std": cv_summary,
        "final_models": {k: {kk: vv for kk, vv in v.items()
                             if kk not in ("metrics_test_clean", "metrics_test_snr20dB")}
                         for k, v in final_payloads.items()},
        "hyperparameters_unchanged": {
            "epochs": EPOCHS, "batch_size": BATCH_SIZE, "learning_rate": LEARNING_RATE,
            "optimizer": "Adam", "loss": "sparse_categorical_crossentropy",
            "early_stopping": "val_accuracy patience=5 restore_best_weights",
            "reduce_lr": "val_loss factor=0.5 patience=3 min_lr=1e-5",
            "only_change": "class_weight 'balanced' del train de cada fold/final",
        },
    }
    with open(REPORTS_DIR / "training_summary_grouped.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n=== TABLA FINAL (test, ÚNICA evaluación) ===")
    print(f"{'modelo':<26} | {'acc%':>7} | {'F1_macro%':>9} | {'recall_caída%':>13} | "
          f"{'acc SNR20%':>10} | {'lat ms':>7}")
    for model_id, fn, _ in MODEL_FACTORIES:
        m = final_payloads[model_id]["metrics_test_clean"]
        mn = final_payloads[model_id]["metrics_test_snr20dB"]
        print(f"{model_id:<26} | {m['accuracy']*100:7.2f} | {m['f1_macro']*100:9.2f} | "
              f"{m['recall_per_class'][1]*100:13.2f} | {mn['accuracy']*100:10.2f} | "
              f"{final_payloads[model_id]['latency_ms_per_sample']:7.3f}")

    log_progress(stage="pipeline", event="completed", total_seconds=round(time.time() - T_MAIN, 1))
    print(f"\n[OK] Paso 3 completo en {(time.time() - T_MAIN)/60:.1f} min. "
          "Artefactos: reports/cv_results/, reports/final/, reports/test_subjects.json, "
          "reports/fold_assignment.json, reports/progress_log.jsonl, "
          "reports/training_summary_grouped.json")
