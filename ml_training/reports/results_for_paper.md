# Resultados para el artículo (revisión anti-fuga) — dataset REAL de SisFall

Generado: 2026-10-30 02:12:25 · SEED global 42.

## Diseño experimental

- Dataset REAL de SisFall v1.0 (UDEA/SISTEMIC): 38 sujetos, 4 505 registros, 40 707 ventanas (128 pasos @ 50 Hz, 50 % solape, 8 canales).
- Etiquetado por código de actividad (ver `labeling_rules.md`): 33 111 Normal (81.3 %), 3 596 Posible_Caida (8.8 %), 4 000 Baja_actividad (9.8 %); 14 384 ventanas de registros F## SIN el pico de SVM excluidas.
- Prueba: 6 sujetos (SA16, SA10, SA01, SA09, SA18, SE13) — 5 SA al azar + 1 SE (distinto de SE06, seed 42). SE06 en desarrollo.
- CV: StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42) por sujeto, estratificado por presencia de caídas; 3 folds iguales para las 5 arquitecturas; sin fuga: sujetos y record_id disjuntos entre train/eval/test (asserts).
- Único cambio respecto al entrenamiento previo: `class_weight` 'balanced' calculado SOLO con el train del fold (ver model_class_weights.csv).

## Tabla por modelo — test (ÚNICA evaluación, señales limpias)

| Modelo | Exactitud % | F1 macro % | Recall caída % | Precisión caída % | Ex. IC95% (CP) | Recall caída IC95% (CP) | Latencia ms | Épocas |
|---|---|---|---|---|---|---|---|---|
| Puro_1D_CNN | 97.52 | 95.22 | 98.00 | 99.86 | [97.1, 97.9] | [96.7, 98.9] | 0.105 | 8 |
| Puro_Bi_LSTM | 97.74 | 95.90 | 98.93 | 99.07 | [97.4, 98.1] | [97.9, 99.5] | 1.023 | 20 |
| Puro_GRU | 97.59 | 95.54 | 98.80 | 99.73 | [97.2, 97.9] | [97.7, 99.4] | 0.404 | 16 |
| Hibrido_CNN_LSTM | 98.20 | 96.49 | 99.07 | 99.73 | [97.9, 98.5] | [98.1, 99.6] | 0.137 | 11 |
| Hibrido_Attention_ResGRU | 97.20 | 94.92 | 98.80 | 99.46 | [96.8, 97.6] | [97.7, 99.4] | 0.264 | 9 |

`class_weight` por modelo (fit solo con train del desarrollo): ver reports/metrics_csv/model_class_weights.csv.

## Métricas por clase — test

| Modelo | Clase | Precisión % | Recall % | F1 % | Soporte |
|---|---|---|---|---|---|
| Puro_1D_CNN | Normal | 98.46 | 98.52 | 98.49 | 5458 |
| Puro_1D_CNN | Posible_Caida | 99.86 | 98.00 | 98.92 | 750 |
| Puro_1D_CNN | Baja_actividad | 87.55 | 88.97 | 88.26 | 680 |
| Puro_Bi_LSTM | Normal | 99.18 | 97.95 | 98.56 | 5458 |
| Puro_Bi_LSTM | Posible_Caida | 99.07 | 98.93 | 99.00 | 750 |
| Puro_Bi_LSTM | Baja_actividad | 85.98 | 94.71 | 90.13 | 680 |
| Puro_GRU | Normal | 98.80 | 98.17 | 98.48 | 5458 |
| Puro_GRU | Posible_Caida | 99.73 | 98.80 | 99.26 | 750 |
| Puro_GRU | Baja_actividad | 86.29 | 91.62 | 88.87 | 680 |
| Hibrido_CNN_LSTM | Normal | 98.37 | 99.38 | 98.87 | 5458 |
| Hibrido_CNN_LSTM | Posible_Caida | 99.73 | 99.07 | 99.40 | 750 |
| Hibrido_CNN_LSTM | Baja_actividad | 94.91 | 87.79 | 91.21 | 680 |
| Hibrido_Attention_ResGRU | Normal | 98.94 | 97.54 | 98.24 | 5458 |
| Hibrido_Attention_ResGRU | Posible_Caida | 99.46 | 98.80 | 99.13 | 750 |
| Hibrido_Attention_ResGRU | Baja_actividad | 82.68 | 92.65 | 87.38 | 680 |

## Matrices de confusión (test, limpio) — filas = real, columnas = predicción

**Puro_1D_CNN**: [[5377, 1, 80], [9, 735, 6], [75, 0, 605]]

**Puro_Bi_LSTM**: [[5346, 7, 105], [8, 742, 0], [36, 0, 644]]

**Puro_GRU**: [[5358, 2, 98], [8, 741, 1], [57, 0, 623]]

**Hibrido_CNN_LSTM**: [[5424, 2, 32], [7, 743, 0], [83, 0, 597]]

**Hibrido_Attention_ResGRU**: [[5324, 4, 130], [7, 741, 2], [50, 0, 630]]

## Eventos independientes (registros F## del test)

Un registro F## aporta exactamente 2 ventanas de caída (contienen el pico de SVM). `≥1 ventana` = al menos una ventana del registro clasificada como caída; `2 ventanas` = ambas.

| Modelo | Condición | Registros F## | Detectados ≥1 ventana | Detectados 2 ventanas | Recall evento ≥1 | Recall evento 2 |
|---|---|---|---|---|---|---|
| Puro_1D_CNN | clean | 375 | 375 | 360 | 100.0% [99.0, 100.0] | 96.0% |
| Puro_1D_CNN | snr20 | 375 | 375 | 360 | 100.0% n/a (solo clean) | 96.0% |
| Puro_Bi_LSTM | clean | 375 | 373 | 369 | 99.5% [98.1, 99.9] | 98.4% |
| Puro_Bi_LSTM | snr20 | 375 | 373 | 368 | 99.5% n/a (solo clean) | 98.1% |
| Puro_GRU | clean | 375 | 372 | 369 | 99.2% [97.7, 99.8] | 98.4% |
| Puro_GRU | snr20 | 375 | 372 | 370 | 99.2% n/a (solo clean) | 98.7% |
| Hibrido_CNN_LSTM | clean | 375 | 372 | 371 | 99.2% [97.7, 99.8] | 98.9% |
| Hibrido_CNN_LSTM | snr20 | 375 | 373 | 371 | 99.5% n/a (solo clean) | 98.9% |
| Hibrido_Attention_ResGRU | clean | 375 | 373 | 368 | 99.5% [98.1, 99.9] | 98.1% |
| Hibrido_Attention_ResGRU | snr20 | 375 | 373 | 368 | 99.5% n/a (solo clean) | 98.1% |

(IC95% = Clopper-Pearson exacto sobre el evento, calculado en la condición limpia.)

## Por sujeto y grupo etario (test)

| Modelo | Grupo etario | n sujetos | Exactitud media ± d.e. % | Recall caída media (sujetos con caídas) % |
|---|---|---|---|---|
| Puro_1D_CNN | SA | 5 | 97.27 ± 1.00 | 98.00 |
| Puro_1D_CNN | SE | 1 | 99.29 ± 0.00 | n/a (sin sujetos con caídas) |
| Puro_Bi_LSTM | SA | 5 | 97.57 ± 1.06 | 98.93 |
| Puro_Bi_LSTM | SE | 1 | 98.94 ± 0.00 | n/a (sin sujetos con caídas) |
| Puro_GRU | SA | 5 | 97.33 ± 1.10 | 98.80 |
| Puro_GRU | SE | 1 | 99.41 ± 0.00 | n/a (sin sujetos con caídas) |
| Hibrido_CNN_LSTM | SA | 5 | 98.10 ± 0.31 | 99.07 |
| Hibrido_CNN_LSTM | SE | 1 | 98.94 ± 0.00 | n/a (sin sujetos con caídas) |
| Hibrido_Attention_ResGRU | SA | 5 | 96.92 ± 1.13 | 98.80 |
| Hibrido_Attention_ResGRU | SE | 1 | 99.17 ± 0.00 | n/a (sin sujetos con caídas) |

Detalle por sujeto: reports/metrics_csv/test_metrics_per_subject.csv y oof_metrics_per_subject.csv.

## CV fuera de fold (media sujetos de desarrollo)

| Modelo | Exactitud OOF % | Recall caída OOF % |
|---|---|---|
| Puro_1D_CNN | 96.89 | 94.10 |
| Puro_Bi_LSTM | 96.27 | 97.79 |
| Puro_GRU | 96.87 | 98.77 |
| Hibrido_CNN_LSTM | 95.61 | 98.10 |
| Hibrido_Attention_ResGRU | 95.33 | 96.56 |

Resumen por fold (media ± d.e.): reports/training_summary_grouped.json.

## Pruebas estadísticas (con MÉTRICA y UNIDAD de análisis)

| Prueba | Métrica | Unidad de análisis | Modelos | Estadístico | p | Conclusión |
|---|---|---|---|---|---|---|
| Shapiro-Wilk | exactitud (accuracy) | sujeto (n=32, fuera de fold, desarrollo) | Puro_1D_CNN | 0.7174 | 2e-06 | distribución NO normal |
| Shapiro-Wilk | exactitud (accuracy) | sujeto (n=32, fuera de fold, desarrollo) | Puro_Bi_LSTM | 0.6 | 0.0 | distribución NO normal |
| Shapiro-Wilk | exactitud (accuracy) | sujeto (n=32, fuera de fold, desarrollo) | Puro_GRU | 0.7462 | 5e-06 | distribución NO normal |
| Shapiro-Wilk | exactitud (accuracy) | sujeto (n=32, fuera de fold, desarrollo) | Hibrido_CNN_LSTM | 0.7728 | 1.3e-05 | distribución NO normal |
| Shapiro-Wilk | exactitud (accuracy) | sujeto (n=32, fuera de fold, desarrollo) | Hibrido_Attention_ResGRU | 0.8039 | 4.8e-05 | distribución NO normal |
| Friedman | exactitud (accuracy) | sujeto como bloque (n=32, k=5 modelos, fuera de fold) | Puro_1D_CNN; Puro_Bi_LSTM; Puro_GRU; Hibrido_CNN_LSTM; Hibrido_Attention_ResGRU | 26.3205 | 2.7e-05 | diferencias globales significativas (p<0.05) |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_1D_CNN vs Puro_Bi_LSTM | 0.0063 | 0.673234 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_1D_CNN vs Puro_GRU | 0.0005 | 0.873346 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_1D_CNN vs Hibrido_CNN_LSTM | 0.0137 | 0.000204 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_1D_CNN vs Hibrido_Attention_ResGRU | 0.0162 | 0.008625 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_Bi_LSTM vs Puro_GRU | -0.0059 | 0.236676 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_Bi_LSTM vs Hibrido_CNN_LSTM | 0.0073 | 0.001834 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_Bi_LSTM vs Hibrido_Attention_ResGRU | 0.0099 | 0.056036 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_GRU vs Hibrido_CNN_LSTM | 0.0132 | 2.2e-05 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Puro_GRU vs Hibrido_Attention_ResGRU | 0.0158 | 0.000994 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | exactitud (accuracy) | sujeto (fuera de fold) | Hibrido_CNN_LSTM vs Hibrido_Attention_ResGRU | 0.0026 | 0.76131 | sin diferencia significativa tras Bonferroni |
| Friedman | recall de caída (clase 1) | sujeto CON caídas como bloque (n=19, fuera de fold) | Puro_1D_CNN; Puro_Bi_LSTM; Puro_GRU; Hibrido_CNN_LSTM; Hibrido_Attention_ResGRU | 21.3856 | 0.000266 |  |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_1D_CNN vs Puro_Bi_LSTM | -0.0368 | 0.005694 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_1D_CNN vs Puro_GRU | -0.0467 | 0.001503 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_1D_CNN vs Hibrido_CNN_LSTM | -0.04 | 0.019729 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_1D_CNN vs Hibrido_Attention_ResGRU | -0.0245 | 0.4993 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_Bi_LSTM vs Puro_GRU | -0.0098 | 0.024764 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_Bi_LSTM vs Hibrido_CNN_LSTM | -0.0032 | 0.5379 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_Bi_LSTM vs Hibrido_Attention_ResGRU | 0.0123 | 0.073705 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_GRU vs Hibrido_CNN_LSTM | 0.0067 | 0.112717 | sin diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Puro_GRU vs Hibrido_Attention_ResGRU | 0.0221 | 0.002655 | diferencia significativa tras Bonferroni |
| Wilcoxon (post-hoc par a par) | recall de caída (clase 1) | sujeto con caídas (fuera de fold) | Hibrido_CNN_LSTM vs Hibrido_Attention_ResGRU | 0.0155 | 0.003534 | diferencia significativa tras Bonferroni |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_1D_CNN vs Puro_Bi_LSTM | b=599;c=387 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_1D_CNN vs Puro_GRU | b=428;c=422 | 0.863845 | sin diferencia emparejada significativa |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_1D_CNN vs Hibrido_CNN_LSTM | b=742;c=308 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_1D_CNN vs Hibrido_Attention_ResGRU | b=862;c=335 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_Bi_LSTM vs Puro_GRU | b=389;c=595 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_Bi_LSTM vs Hibrido_CNN_LSTM | b=714;c=492 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_Bi_LSTM vs Hibrido_Attention_ResGRU | b=907;c=592 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_GRU vs Hibrido_CNN_LSTM | b=674;c=246 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Puro_GRU vs Hibrido_Attention_ResGRU | b=803;c=282 | 0.0 | diferencia emparejada significativa (p<0.05) |
| McNemar exacto | acierto por ventana | ventana (fuera de fold) | Hibrido_CNN_LSTM vs Hibrido_Attention_ResGRU | b=618;c=525 | 0.006479 | diferencia emparejada significativa (p<0.05) |

Wilcoxon par a par con corrección de Bonferroni (m=10 pares): ver reports/metrics_csv/statistical_tests.csv (`p_bonferroni`).

## Robustez al ruido gaussiano (SNR 20 dB) — test

| Modelo | Exactitud limpia % | Exactitud SNR20 % | Recall caída limpia % | Recall caída SNR20 % | Δ exactitud pp |
|---|---|---|---|---|---|
| Puro_1D_CNN | 97.52 | 97.71 | 98.00 | 98.00 | +0.19 |
| Puro_Bi_LSTM | 97.74 | 97.66 | 98.93 | 98.80 | -0.07 |
| Puro_GRU | 97.59 | 97.66 | 98.80 | 98.93 | +0.07 |
| Hibrido_CNN_LSTM | 98.20 | 98.27 | 99.07 | 99.20 | +0.07 |
| Hibrido_Attention_ResGRU | 97.20 | 97.55 | 98.80 | 98.80 | +0.35 |

Ruido blanco gaussiano por canal; σ = sqrt(P_señal / 10^(SNR/10)) por ventana y canal; seed 42. Único diagnóstico (no selección de modelo).

## Tabla ANTES (pipeline con fuga) vs DESPUÉS (partición por sujeto)

El pipeline *ANTES* entrenaba sobre datos sintéticos (fallback) con fuga de información: exactitud 100 % en las 5 arquitecturas. El pipeline *DESPUÉS* usa el dataset real, partición por sujeto y una única evaluación en test.

| Modelo | Antes: exactitud % (sintético con fuga, 4 clases) | Después: exactitud % (SisFall real, test por sujeto) | Después F1 macro % |
|---|---|---|---|
| Puro_1D_CNN | 100.0 | 97.52 | 95.22 |
| Puro_Bi_LSTM | 100.0 | 97.74 | 95.90 |
| Puro_GRU | 100.0 | 97.59 | 95.54 |
| Hibrido_CNN_LSTM | 100.0 | 98.20 | 96.49 |
| Hibrido_Attention_ResGRU | 100.0 | 97.20 | 94.92 |

Backup original: ml_training/_backup_pre_revision/ (modelos .h5, reports/models_comparison_report.json, datos).

## Frases del artículo invalidadas

Cualquier afirmación de exactitud ~100 %, F1 ~100 % o desempeño comparado sobre el dataset 'SisFall' de la versión previa queda INVALIDADA: esos resultados provenían de un fallback sintético con fuga de información (incluida fuga de sujetos entre train/eval/test). Los resultados válidos para el artículo son los de esta tabla y los CSV adjuntos; ningún número de exactitud/F1 previo puede citarse.

Afirmaciones concretas a eliminar o sustituir en todo material académico (referencia: README del proyecto, sección de modelo):

- Tabla comparativa con exactitud y F1-macro de 100.0 % para las 5 arquitecturas (Puro_1D_CNN, Puro_Bi_LSTM, Puro_GRU, Hibrido_CNN_LSTM, Hibrido_Attention_ResGRU).
- "Sensibilidad Perfecta: 100 % de sensibilidad en la clase Posible Caída (0 falsos negativos), garantizando que ningún accidente pase desapercibido".
- "Conjunto de prueba independiente de 3,010 muestras" (ese split contenía sujetos presentes también en el train: fuga de sujetos; y los datos eran sintéticos).
- Partición 70/15/15 de "20,064 muestras" del "SisFall Benchmark" (las cifras corresponden al fallback sintético, NO al dataset real: el real produce 40,707 ventanas etiquetadas y 14,384 excluidas).
- "Validación Cruzada Estratificada (K=5 y K=10) con variabilidad de exactitud menor al 0.08 % entre folds" (la CV previa era por ventanas, no por sujetos; la nueva es StratifiedGroupKFold por sujeto con otra variabilidad).
- Todas las cifras de la batería estadística previa (Shapiro-Wilk W=0.942 p=0.081; Friedman χ²=18.42 p<0.001; ANOVA F=7.842 p=0.00084; Wilcoxon W=15.0 p=0.0021; McNemar χ²=0.0 p=1.000) quedan invalidadas y se reportan de nuevo con bloques por sujeto y métricas reales.
- La afirmación de "0 falsos negativos" / "concordancia perfecta" en la matriz de confusión: con partición por sujeto y dataset real no puede afirmarse

Referencias: `labeling_rules.md`, `reproducibility.md`, `reports/metrics_csv/`.
