# Resumen CV 38 sujetos (5 folds por sujeto)

- Ventanas: 40707 · sujetos: 38 (con caídas: 24)
- Mayor exactitud OOF: **Hibrido_Attention_ResGRU** (97.51 %)

| Modelo | Exactitud (IC95 boot. sujeto) | F1 macro | Recall caída (IC95 CP) | SNR20 acc |
|---|---|---|---|---|
| Puro_1D_CNN | 97.19 [96.41, 97.79] | 94.26 | 96.52 [95.87, 97.1] | 97.25 |
| Puro_Bi_LSTM | 97.38 [96.6, 97.98] | 94.99 | 98.5 [98.05, 98.87] | 97.39 |
| Puro_GRU | 97.18 [96.37, 97.85] | 94.55 | 98.25 [97.76, 98.65] | 97.2 |
| Hibrido_CNN_LSTM | 97.27 [96.43, 97.94] | 94.78 | 98.83 [98.42, 99.16] | 97.45 |
| Hibrido_Attention_ResGRU | 97.51 [96.86, 98.02] | 95.2 | 98.5 [98.05, 98.87] | 97.58 |
