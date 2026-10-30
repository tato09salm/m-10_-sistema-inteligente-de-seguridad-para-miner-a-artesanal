# Reproducibilidad — pipeline de ML M-10 (revisión anti-fuga)

Este documento describe cómo reproducir **exactamente** los resultados reportados
en `reports/results_for_paper.md`, tras la revisión que eliminó la fuga de
información y los datos sintéticos.

## 1. Hardware y software

| Componente | Valor |
|---|---|
| CPU | Intel Core i7-13645HX (entrenamiento en CPU) |
| RAM | 16 GB |
| GPU | **No usada**: TensorFlow no detectó ninguna GPU en esta máquina (`tf.config.list_physical_devices('GPU') == []`). TensorFlow-CPU nativo en Windows (≥2.11 no soporta GPU nativa en Windows). |
| SO | Windows (x86-64) |
| Python | 3.12 (instalación global, sin venv) |
| numpy | 2.5.4 |
| pandas | 3.1.0 |
| scipy | 1.18.1 |
| scikit-learn | 1.9.1 |
| TensorFlow | 2.21.0 (paquete `tensorflow-cpu`) |

Entorno definido en los scripts (igual que el pipeline anterior):
`TF_CPP_MIN_LOG_LEVEL=2`, `TF_ENABLE_ONEDNN_OPTS=0`; salida UTF-8 forzada en Windows.

## 2. Datos

- **Dataset REAL**: *SisFall: A Fall and Movement Dataset* — Sucerquia, López y
  Vargas-Bonilla, Sensors 2017, 17(1):198. Universidad de Antioquia, laboratorio
  SISTEMIC. Ubicado en `ml_training/data/SisFall_dataset/` con las carpetas
  `SA01..SA23` y `SE01..SE15` (38 sujetos, 4 505 registros .txt a 200 Hz).
- El pipeline `preprocess_sisfall.py` **falla con error claro** si el dataset real no
  está presente. No existe fallback sintético: el generador
  `generate_curated_sisfall_benchmark()` (senos + ruido con decaimiento exponencial)
  fue **eliminado**, y `download_sisfall.py` quedó deshabilitado (no descarga).
- Verificación de integridad en el Paso 0: 38 carpetas, 4 505 registros con formato
  de 9 valores por línea terminada en `;` con ~3 000 líneas los registros F##.

## 3. Pipeline y comandos exactos

Todos los comandos se ejecutan desde la raíz del proyecto
(`m-10_-sistema-inteligente-de-seguridad-para-miner-a-artesanal/`):

```powershell
# Paso 1-2: lectura, unidades, submuestreo 200->50 Hz, ventaneo y etiquetado
python ml_training\preprocess_sisfall.py

# Paso 3: CV por sujeto + entrenamiento final + única evaluación en test
python ml_training\train_grouped.py              # hace el probe de tiempo y decide n_folds
python ml_training\train_grouped.py --force-n-folds 3   # reanudación del esquema ya decidido

# Paso 4: métricas, IC, eventos, ruido SNR 20 dB y estadística
python ml_training\compute_metrics.py
```

### Decisión de n_folds (protocolo de presupuesto, 1.5 h)

El script cronometra UN fold por arquitectura y proyecta el total (folds restantes +
entrenamiento final). Con la medición del esquema de 5 folds (fold 0 real: 82.2 s
1D-CNN, 774.1 s Bi-LSTM, 410.5 s GRU, 128.0 s CNN-LSTM, 96.0 s Attention-ResGRU) la
proyección fue **155.5 min > 90 min de presupuesto**, por lo que se usó
**StratifiedGroupKFold(n_splits=3)**, tal como lo permite el protocolo sin pedir
confirmación (cada fold de evaluación quedó con 6, 7 y 6 sujetos con caídas).

Trazabilidad de ejecuciones descartadas (conservadas como evidencia, NO válidas para
el paper):
- `_probe_discarded_5fold_20261029_232959/`: fold 0 piloto del esquema de 5 folds
  (solo sirvió para estimar tiempos).
- `_invalid_mixed_5fold_folds/`: folds 3–4 de una reanudación con asignación mezclada
  (se corrigió añadiendo verificación de `eval_subjects` al reanudar).
- El guardado incremental (`progress_log.jsonl`) registra cada evento;
  `train_grouped.py` omite cualquier (modelo, fold) con métricas ya existentes y con
  sujetos de evaluación idénticos a la asignación vigente.

Duraciones de referencia: Paso 1-2 ≈ 14 s; el Paso 3 reporta su propia proyección y
cronometra un fold piloto por arquitectura antes de entrenar todo (presupuesto 1.5 h;
si se excede usa 3 folds y lo reporta en `reports/progress_log.jsonl`).

## 4. Semillas y determinismo

- Semilla global: **SEED = 42**, fijada con `np.random.seed(42)`,
  `random.seed(42)` y `tf.random.set_seed(42)` (re-fijada antes de construir cada modelo).
- `preprocess_sisfall.py`: sin muestreo aleatorio (el pipeline es determinista);
  decimación FIR con `zero_phase=True`.
- Selección de sujetos de prueba: `np.random.RandomState(42)` →
  1) `choice(sa_sorted, 5, replace=False)`; 2) `choice(se_sorted_sin_SE06, 1)`.
  Resultado guardado en `reports/test_subjects.json`.
- Folds: `StratifiedGroupKFold(n_splits, shuffle=True, random_state=42)` sobre los
  sujetos de desarrollo, estratificado por presencia de caídas (sujeto con ≥1 ventana
  clase 1). Misma partición para las 5 arquitecturas. Resultado en
  `reports/fold_assignment.json`.
- Validación interna (early stopping): sujetos del train de cada fold con
  `RandomState(42 + 1000 + fold)`; en el entrenamiento final,
  `RandomState(42 + 9999)` sobre los sujetos de desarrollo. Nunca se usa el fold
  evaluado ni el test para validar.
- Ruido SNR 20 dB: `RandomState(42)`; ruido blanco gaussiano por canal con
  σ = sqrt(P_señal / 10^(20/10)), P_señal por ventana y canal sobre la señal RAW
  del test; el modelo se re-evalúa sobre esa señal ruidosa normalizada.

## 5. Hiperparámetros (SIN cambios respecto al pipeline anterior)

| Parámetro | Valor |
|---|---|
| Épocas máximas | 20 |
| Tamaño de lote | 128 |
| Optimizador | Adam, lr = 1e-3 |
| Pérdida | sparse_categorical_crossentropy |
| EarlyStopping | monitor=val_accuracy, patience=5, restore_best_weights=True |
| ReduceLROnPlateau | monitor=val_loss, factor=0.5, patience=3, min_lr=1e-5 |
| Único cambio | `class_weight` = "balanced", calculado SOLO con el train del fold (o con el train completo del desarrollo en el modelo final); se reporta por modelo/fold |

5 arquitecturas idénticas a `train_all_models.py` (Puro_1D_CNN, Puro_Bi_LSTM,
Puro_GRU, Hibrido_CNN_LSTM, Hibrido_Attention_ResGRU). La única diferencia de
implementación en `TemporalAttention` es la adición de `get_config()` para poder
serializar en .h5; no altera el cálculo.

## 6. Preprocesamiento (resumen; detalle en reports/labeling_rules.md)

- ADXL345: bits→g con factor `2·16/2^13 = 3.90625e-03 g/bit`; ITG3200: bits→°/s con
  factor `2·2000/2^16 = 6.10352e-02 °/s/bit`. Solo ADXL345 + ITG3200 (8 canales con
  SVM [g] y norma del giroscopio [°/s] añadidos).
- Submuestreo 200 → 50 Hz: `scipy.signal.decimate(q=4, ftype='fir', zero_phase=True)`.
- Ventanas: 128 pasos (2.56 s), paso 64 (50 % solape); incompletas descartadas.
- Etiquetado por código de actividad: clase 2 = SOLO {D12, D13, D14}; clase 1 =
  ventanas de F## que contienen el pico de SVM (1 o 2 por registro; el resto de
  ventanas F## se EXCLUYE, 14 384); clase 0 = resto (D07–D10, D11, D17, D18, D19
  incluidos como hard-negatives). sin umbrales de señal para etiquetar.
- Sin normalización en el preprocesamiento: media/desviación por canal ajustada
  SOLO con el train de cada fold (y con el train del desarrollo para el final).

## 7. Quirk del zip oficial: archivos D17_SE15_R## dentro de SA15/

El zip oficial de SisFall contiene 5 archivos `D17_SE15_R01.txt .. R05.txt` dentro
de la carpeta `SA15/`, **con contenido distinto** a los `D17_SE15_R##.txt` de la
carpeta `SE15/` (dimensión y md5 diferentes; verificación md5 en la bitácora).

Resolución adoptada:
- El **sujeto se atribuye por CARPETA** (el único criterio coherente con el
  protocolo de 5 trials por código y sujeto: SA15 no tenía ningún D17 de otro modo
  y SE15 quedaría con 10).
- El `record_id` se renombra a `D17_SA15_R##` para los 5 archivos de la carpeta
  SA15, preservando la unicidad: 4 505 registros únicos = 4 505 archivos .txt.
- SA15 recupera su ensayo D17 y SE15 conserva sus 5; la decisión está documentada
  en `dataset_metadata.json` (`quirk_sa15_se15`, lista `renamed_records`),
  en `reports/labeling_rules.md` y en los asserts del pipeline.
- Es el único desajuste nombre-carpeta de todo el dataset.

## 8. Garantías anti-fuga (asserts en train_grouped.py)

- Sujetos de train y evaluación disjuntos en cada fold; test disjunto de todo fold.
- Validación interna compuesta SOLO por sujetos del train del fold.
- Ningún `record_id` repetido entre train/eval/test.
- Cada fold de evaluación contiene ≥3 sujetos con caídas (imprime cuántos).
- La normalización se ajusta solo con el train del fold.
- Predicciones fuera de fold (OOF) de todos los sujetos de desarrollo; el test se
  evalúa UNA sola vez con el modelo final (además de un diagnóstico SNR 20 dB).

## 9. Artefactos de evidencia

| Artefacto | Ruta |
|---|---|
| Datos procesados | `ml_training/data/processed/` (X.npy, y.npy, groups.npy, age_group.npy, record_ids.npy, activity.npy, window_idx.npy, peak_pos.npy, dataset_metadata.json) |
| Métricas por fold / pregunta | `ml_training/reports/cv_results/{modelo}/fold{k}/` (+ `oof_predictions.npz`) |
| Modelo final y test | `ml_training/reports/final/{modelo}/`, pesos en `ml_training/saved_models/{modelo}_grouped.*` |
| Registro incremental | `ml_training/reports/progress_log.jsonl` (una línea por evento: inicio/fin/salto) |
| Sujetos de prueba / folds | `ml_training/reports/test_subjects.json`, `fold_assignment.json` |
| Entregable del artículo | `ml_training/reports/results_for_paper.md` + `ml_training/reports/metrics_csv/*.csv` |
| Reglas de etiquetado | `ml_training/reports/labeling_rules.md` |
| Métricas antiguas (fuga) | `ml_training/_backup_pre_revision/reports/models_comparison_report.json` |
