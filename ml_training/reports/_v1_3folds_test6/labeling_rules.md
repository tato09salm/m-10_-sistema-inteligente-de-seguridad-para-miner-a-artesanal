# Reglas de etiquetado — dataset REAL de SisFall (v1.0, UDEA/SISTEMIC)

Revisión anti-fuga (aprobada por el usuario antes de entrenar).

| Código | Fuente | Clase | Descripción (Readme oficial de SisFall) |
|---|---|---|---|
| D01 | ADL | 0 | Walking slowly |
| D02 | ADL | 0 | Walking quickly |
| D03 | ADL | 0 | Jogging slowly |
| D04 | ADL | 0 | Jogging quickly |
| D05 | ADL | 0 | Walking up/down stairs slowly |
| D06 | ADL | 0 | Walking up/down stairs quickly |
| D07 | ADL | 0 | Slowly sit in half-height chair, wait, up slowly |
| D08 | ADL | 0 | Quickly sit in half-height chair, wait, up quickly |
| D09 | ADL | 0 | Slowly sit in low-height chair, wait, up slowly |
| D10 | ADL | 0 | Quickly sit in low-height chair, wait, up quickly |
| D11 | ADL | 0 | Sitting, trying to get up, collapse into chair (hard-negative) |
| D12 | ADL | 2 | Sitting, lying slowly, wait, sit again (REPOSO) |
| D13 | ADL | 2 | Sitting, lying quickly, wait, sit again (REPOSO) |
| D14 | ADL | 2 | On back, change to lateral, wait, change back (REPOSO) |
| D15 | ADL | 0 | Standing, bending at knees, getting up |
| D16 | ADL | 0 | Standing, bending without knees, getting up |
| D17 | ADL | 0 | Standing, into car, seated, out (a Normal por decisión del usuario) |
| D18 | ADL | 0 | Stumble while walking (hard-negative) |
| D19 | ADL | 0 | Gently jump without falling |
| F01 | CAÍDA | 1 (solo ventana del pico) | Fall forward while walking caused by a slip |
| F02 | CAÍDA | 1 (solo ventana del pico) | Fall backward while walking caused by a slip |
| F03 | CAÍDA | 1 (solo ventana del pico) | Lateral fall while walking caused by a slip |
| F04 | CAÍDA | 1 (solo ventana del pico) | Fall forward while walking caused by a trip |
| F05 | CAÍDA | 1 (solo ventana del pico) | Fall forward while jogging caused by a trip |
| F06 | CAÍDA | 1 (solo ventana del pico) | Vertical fall while walking caused by fainting |
| F07 | CAÍDA | 1 (solo ventana del pico) | Fall while walking, hands on table to dampen fall, fainting |
| F08 | CAÍDA | 1 (solo ventana del pico) | Fall forward when trying to get up |
| F09 | CAÍDA | 1 (solo ventana del pico) | Lateral fall when trying to get up |
| F10 | CAÍDA | 1 (solo ventana del pico) | Fall forward when trying to sit down |
| F11 | CAÍDA | 1 (solo ventana del pico) | Fall backward when trying to sit down |
| F12 | CAÍDA | 1 (solo ventana del pico) | Lateral fall when trying to sit down |
| F13 | CAÍDA | 1 (solo ventana del pico) | Fall forward while sitting (fainting/asleep) |
| F14 | CAÍDA | 1 (solo ventana del pico) | Fall backward while sitting (fainting/asleep) |
| F15 | CAÍDA | 1 (solo ventana del pico) | Lateral fall while sitting (fainting/asleep) |

Notas:

- **Clase 0 "Normal"**: todos los ADLs excepto D12/D13/D14. Incluye D07–D10
  (los ciclos sentarse-levantar van a Normal, decisión del usuario) y D11, D18, D19
  como *hard-negatives* (casi-caídas y salto).
- **Clase 2 "Baja actividad (reposo)"**: SOLO ventanas de {D12, D13, D14}.
  D17 (sentado en coche) va a Normal por decisión explícita del usuario.
- **Clase 1 "Posible Caída"**: SOLO las ventanas (128 pasos, 50 % solape, 50 Hz)
  que contienen el pico de SVM del registro (argmax(SVM) sobre la señal a 50 Hz).
  Con ventana=128 y paso=64 el pico cae normalmente en 1 o 2 ventanas
  consecutivas; ambas se etiquetan como clase 1 (todas cumplen "contener el
  pico"). Las demás ventanas de los registros F## se **excluyen** del dataset
  (no pertenecen a ninguna clase) para no contaminar las clases con el reposo
  post-caída ni el contexto pre-caída.
  Si el pico cae en la cola no ventaneada del registro, se añade UNA ventana
  anclada al pico (múltiplo de 64 pasos, dentro de los límites del registro).
- El etiquetado es **por código de actividad**; NO se usan umbrales de max_svm,
  var_svm ni max_gyro. Se eliminó la heurística anterior y la clase 3.
- **No hay normalización global**: en el Paso 3 el escalado se ajusta solo con
  el train de cada fold.
- Unidades: ADXL345 bits→g con factor 0.00390625 (2·16/2^13); ITG3200
  bits→°/s con factor 0.0610352 (2·2000/2^16). Sensores usados:
  ADXL345 + ITG3200 (el canal MMA8451Q no participa).
- Submuestreo 200 → 50 Hz con `scipy.signal.decimate(q=4, ftype='fir', zero_phase=True)`.
- Ventaneo: 128 pasos a 50 Hz (2.56 s), paso 64
  (50 % de solapamiento). Las ventanas incompletas (<128 pasos) no se usan.
- Semilla de reproducibilidad: 42 (numpy/random; TF se fijará en el entrenamiento).
- **Quirk del zip oficial (documentado):** los archivos D17_SE15_R01..R05.txt
  existen en DOS carpetas (SA15/ y SE15/) con contenido distinto. El sujeto se
  atribuye por CARPETA y el record_id se renombra (D17_SA15_R##), de modo que
  SA15 recupera su D17 y SE15 conserva 5 trials por código; ninguno se pierde
  ni se duplica. (Es el único desajuste nombre/carpeta de todo el dataset.)

Fuente: Sucerquia et al., *SisFall: A Fall and Movement Dataset*, Sensors
2017, 17(1), 198; README oficial incluido en la carpeta de datos.
