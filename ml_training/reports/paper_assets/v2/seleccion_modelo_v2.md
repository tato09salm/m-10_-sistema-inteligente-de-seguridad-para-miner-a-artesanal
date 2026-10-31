# Selección del modelo a desplegar (Fase 1)

Regla: int8 completo sin Flex Ops y caída de recall de caída (int8 vs float32) <= 1 punto porcentual; se prefiere mayor exactitud y F1 macro. Si dos modelos difieren menos de ~0,3 puntos, es un empate práctico y se elige el de menor tamaño y latencia (decisión del investigador, apoyada en la Fase 2).

| Modelo | Exactitud int8 (%) | F1 macro (%) | Recall caída (%) | Tamaño (KB) | Δ recall vs float32 (pp) | Cumple regla |
|---|---|---|---|---|---|---|
| Puro_GRU | 98.00 | 96.08 | 98.80 | 3167.6 | 0.00 | sí |
| Puro_1D_CNN | 97.88 | 95.86 | 98.13 | 66.0 | -0.13 | sí |
| Hibrido_CNN_LSTM | 97.76 | 95.81 | 99.33 | 263.5 | -0.26 | sí |
| Hibrido_Attention_ResGRU | 97.68 | 95.63 | 98.80 | 1899.9 | 0.00 | sí |
| Puro_Bi_LSTM | 92.41 | 88.67 | 98.53 | 4241.2 | 0.40 | sí |

**Candidato por la regla:** Puro_GRU
