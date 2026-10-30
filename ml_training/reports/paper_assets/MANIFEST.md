# MANIFEST — Activos para el artículo (fases A–E) · M-10

Maquinaria generada a partir del dataset REAL de SisFall (4 505 registros, 38
sujetos, 40 707 ventanas: 33 111 / 3 596 / 4 000; test = 6 888 ventanas), con partición POR SUJETO
(sin fuga), CV de 3 folds × 5 arquitecturas y una única evaluación en test
(SA16, SA10, SA01, SA09, SA18, SE13). Semilla general: 42.

**Modelo recomendado para despliegue (una frase):**
_Puro_1D_CNN en formato TFLite int8 completo (66,0 KB, exactitud de test 97,88 %,
recall de caída 98,13 %, sin FlexOps) porque es el único de los dos candidatos
que es convertible y desplegable en TFLite Micro, y su exactitud es
estadísticamente indistinguible de la de los modelos recurrentes según las
pruebas no paramétricas de la Tabla 4._

---

## 1. Tablas (fase A) — `make_paper_tables.py`

| Archivo | Se usa como | Contenido | Fuente de datos |
|---|---|---|---|
| `tabla2_hiperparametros.csv` | Tabla 2 | Arquitectura, dropout 0.3, Adam, lr 0.001, lote 128, tamaño h5 (KB), épocas final/CV, tiempo de entrenamiento | `reports/final/*/metrics_test.json`, `reports/cv_results/*/fold*/metrics.json`, tamaños de `saved_models/*_grouped.h5` |
| `tabla3_desempeno.csv` | Tabla 3 | Exactitud/F1/recall de caída de test con IC95 Clopper–Pearson, pérdida de prueba, latencia Keras (PC), CV media±DE (3 folds), IC95 OOF por bootstrap de sujeto (1000 remuestreos, seed 42) | `y_prob_test.npy`/`y_true_test.npy`/`y_pred_test.npy`, `tflite_latencia.csv` |
| `tabla4_estadistica.csv` | Tabla 4 | 37 filas: Shapiro–Wilk por sujeto (5), Friedman global (2), Wilcoxon pareado 10 pares × 2 métricas con Bonferroni (20), McNemar por ventana OOF (10); SIN ANOVA | `cv_results/*/oof_predictions.npz` |
| `tabla_por_clase.csv` | Tabla por clase (suplementario/tabla adicional) | Precisión/Recall/F1/soporte por clase (3 clases), prueba y OOF, para `Puro_1D_CNN` | `metrics_test.json` + OOF |
| `tabla_eventos.csv` | Tabla de eventos (suplementario) | 375 registros F## de test por modelo: detección con ≥1 ventana y con ≥2 ventanas, proporciones e IC95 | `record_ids_test.npy` + predicciones |
| `modelo_seleccionado.json` | Nota de selección | Modelo elegido regla y razón textual | resultado de TFLite (fase C) |

## 2. Figuras (fase B) — `make_paper_figures.py` (PNG 300 dpi, ancho 6.5 in, paleta Okabe–Ito, español, sin título interno)

| Archivo | Se usa como | Contenido |
|---|---|---|
| `fig3_distribucion_clases.png` | Figura 3 | Barras del total de ventanas reales por clase (33 111 / 3 596 / 4 000 de 40 707) |
| `fig4_firma_caida.png` + `fig4_datos.txt` | Figura 4 | Firma de caída REAL de registro F01_SA01_R01 del test (pico SVM 86.21 m/s², giro 239.6 °/s), 2.56 s a 50 Hz |
| `fig5_matriz_confusion_Puro_1D_CNN.png` | Figura 5a | Matrices de confusión 3×3 del modelo seleccionado (absoluta y % por fila) |
| `fig5_matriz_confusion_Hibrido_CNN_LSTM.png` | Figura 5b | Matrices de confusión del modelo híbrido candidato |
| `fig6_escenario_caida.png` + `fig6_resultado.json` | Figura 6 | Escenario sintético de caída (SVM pico 32.50 m/s², 380 °/s, inmovilidad post-impacto) inferido VÍA BACKEND por Puro_1D_CNN: probabilidades softmax (Posible caída 93.22 %) y latencias en PC: Keras 5.131 ms (p95 5.581) · TFLite int8 0.0288 ms |

## 3. Conversión y latencias (fase C) — `export_tflite_latency.py`

| Archivo | Se usa como | Contenido |
|---|---|---|
| `tflite_resultados.csv` | Tabla TFLite del artículo | Puro_1D_CNN float32 (198.5 KB, 97.52 %) y **int8 completo (66.0 KB, 97.88 %, recall caída 98.13 %)**; Hibrido_CNN_LSTM: sin filas (no convierte) |
| `tflite_latencia.csv` | Tabla de latencias | TFLite Interpreter 1 hilo (PC): int8 0.0288 ms media, float32 0.0572 ms; Keras 1 ventana (PC): 1D_CNN 5.131 / Bi_LSTM 478.50 / GRU 337.52 / CNN_LSTM 40.97 / Attention 173.42 ms |
| `tflite_conversion_log.json` | Evidencia de la falla | Error `tf.TensorListReserve requires element_shape to be static` (float32, int8 builtin y dinámica); con SELECT_TF_OPS el intérprete estándar lanza `FlexTensorListReserve failed to prepare` → **Hibrido_CNN_LSTM NO desplegable en TFLite Micro** |
| `entorno_latencia.txt` | Configuración de medición | i7-13645HX, Python 3.12.10, TF 2.21.0, numpy 2.5.4, aviso explícito "PC, NO ESP32" |
| `../saved_models/tflite/Puro_1D_CNN_float32.tflite`, `Puro_1D_CNN_int8.tflite` | Artefactos de despliegue | Modelos convertidos (int8: representative = 500 ventanas TRAIN estratificadas, seed 42) |
| `hardware_measurement_protocol.md` | Protocolo de hardware | Qué medir en ESP32-S3 (latencia, tensor arena, corriente, LoRaWAN, integridad) — **todo PENDIENTE DE MEDICIÓN, sin valores inventados** |

## 4. Backend (fase D) — `ml_engine.py` + `verify_backend_faseD.py`

| Archivo | Se usa como | Contenido |
|---|---|---|
| `backend/ml_engine.py` (actualizado) | Integración | Modelo `Puro_1D_CNN_grouped.h5` de 3 clases; conversión m/s²→g (÷9.80665); normalización por canal con media/DE del train del desarrollo; campo `probabilities` (softmax); heurística "movimiento_inusual" conservada y marcada NO VALIDADA |
| `fig6_via_backend.json` | Verificación D | Escenario fig6 reproducible vía `classify_sensor_stream`: actividad `posible_caida`, riesgo crítico, probabilidades {actividad_normal 0.0003, posible_caida 0.9322, baja_actividad 0.0675} (coincide con la vía directa del script, 93.22 %), latencia end-to-end del motor en PC 39.367 ms (p95 40.319 ms) |
| `verify_backend_faseD.py` | Prueba de arranque | TestClient: `GET /api/health` → 200 OK (BD `mineria` con esquema creado vía `Base.metadata.create_all`) + inferencia de prueba |

### Verificación del arranque / health
- `GET /api/health` → 200: `{"status": "ok", "database": "PostgreSQL (Connected: mineria)", ...}`.
- La BD PostgreSQL local `mineria` quedó creada (solo DDL del esquema, sin sembrar datos). Nota de estado: el backend la espera según `backend/config.py`.

### Explicación del "98.4 %" de la sección 3.6 del artículo
- El número NO proviene de inferencia en vivo del sistema: es una **cadena de texto fija** en el frontend, `src/components/Sidebar.tsx:102` (`badge: '98.4%'`).
- Origen probable del valor: el benchmark sintético antiguo (98.42 aparece en `app.py:215` sobre un escenario no validado con el dataset real).
- La vista "Monitor de IA" consume `/api/ai/models/report`, que sirve `ml_training/reports/models_comparison_report.json` (reporte ANTIGUO, con inmovilidad_prolongada y métricas no reproducibles).
- **Estado: NO RECALCULABLE en esta fase** — el frontend lo tiene como texto plano (y corregirlo significaría tocar el frontend, que está fuera del alcance). Los valores correctos del modelo actual, si se actualiza el origen de datos, serían 97.52 % (test Keras) o 97.88 % (TFLite int8) de Puro_1D_CNN — ya medidos en Tabla 3 y `tflite_resultados.csv`.

## 5. Apariciones de "Inmovilidad Prolongada" y "Gemelo Digital" (LISTADO, sin renombrar)

Listado completo en `../_string_hits.txt` (97 coincidencias archivo:línea, cabeceras `[término]`). Resumen de los puntos clave:

**"Inmovilidad Prolongada" / `inmovilidad_prolongada`** (ya no es salida del modelo; solo queda como etiqueta heurística de fusión y como referencias antiguas sin tocar):
- Código activo backend: `backend/ml_engine.py:53,152-153,176-177` (heurística documentada como regla de fusión, no salida del modelo), `backend/main.py:533,538,543,664`, `backend/models.py:132`, `backend/seed_data.py:63,197,250,253`.
- Mock/legacy local: `app.py:215,392,439,531,546,564,778,797,990,1004,1011-1014,1026,1052,1221,1376`, `server.ts:262-267,377,544-546`, `viteApiPlugin.ts:444-446,910-923,1012`, `reports_generator.py:82`, `index.html:7,9`, `metadata.json:3`, `README.md:82`.
- Frontend (no tocado): `src/types.ts:3`, `src/lib/mlEngine.ts:97,177`, `src/lib/mockData.ts:53,224,227,439`, `src/components/{DashboardView.tsx:59,79; HistoryView.tsx:152,175; MobileTransmitterView.tsx:41; MonitoringView.tsx:382; ReportsView.tsx:279; SmartphoneSimulatorModal.tsx:341; AIModelView.tsx:230,394,403}`.
- Data/reportes antiguos: `ml_training/reports/models_comparison_report.json:12,66,131,196,261,326` y su copia `_backup_pre_revision/...:12,66,...` (idéntico), `ml_training/view_results.py:57`.

**"Gemelo digital"** (término de producto/plataforma, sin relación con el modelo ML):
- `README.md:3,17,51,99,192,196,245,385`, `backend/main.py:930,958`, `viteApiPlugin.ts:1200`.

## 6. Pendientes / fallas documentadas

1. **Hibrido_CNN_LSTM no desplegable en TFLite Micro** (requiere Flex ops; ver `tflite_conversion_log.json`).
2. **Latencias en ESP32-S3 no medidas** → `hardware_measurement_protocol.md` (todo PENDIENTE DE MEDICIÓN).
3. **Badge "98.4 %" no recalculable sin tocar el frontend** ( ver §4 ). Si se desea corregir: actualizar `Sidebar.tsx:102` y `_backup_pre_revision`-based report `/api/ai/models/report` hacia los CSV de esta carpeta.
4. Artículo y frontend sin modificar, según el alcance acordado.

## 7. Scripts generadores (todos reproducibles, seed 42)

`ml_training/make_paper_tables.py`, `ml_training/make_paper_figures.py`,
`ml_training/export_tflite_latency.py`, `ml_training/verify_backend_faseD.py`.
Ejecutar en ese orden tras `train_grouped.py` (fases A→B→C→D dependen de la capa anterior).
