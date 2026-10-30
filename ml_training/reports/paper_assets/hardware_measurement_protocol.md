# Protocolo de medición en hardware — ESP32-S3 (M-10)

**Estado: TODO LO LISTADO AQUÍ ESTÁ PENDIENTE DE MEDICIÓN.** Este documento define
*Cómo* se deben medir los valores de hardware que faltan en el artículo. Ningún
número de esta página puede citarse como resultado: todavía no se ha medido nada
en el dispositivo.

**Contexto de por qué es necesario:** las latencias reportadas en las Tablas 3 y
`tflite_latencia.csv` se midieron **en PC (intel i7-13645HX, TFLite Interpreter,
1 hilo)** y **NO** son transferibles a un ESP32-S3. El modelo desplegable
seleccionado — `Puro_1D_CNN`, cuantización **int8 completa** (66,0 KB, sin Flex,
exactitud de test 97,88 %, recall de caída 98,13 %) — es el candidato a
desplegar; su latencia, consumo y alcance reales solo pueden establecerse en el
ESP32-S3.

## 1. Dispositivo y versión de software a registrar (llenar al medir)

| Ítem | Pendiente de medición |
|---|---|
| Placa / versión exacta (ej. DevKitC-1, N16R8) | PENDIENTE |
| Modelo exacto de CPU (ESP32-S3 ⚠ depende de la placa) | PENDIENTE |
| RAM interna disponible (SRAM total y libre en tiempo de ejecución) | PENDIENTE |
| PSRAM (presentes KB / MB, habilitado sí/no) | PENDIENTE |
| Flash (MB, modo, frecuencia) | PENDIENTE |
| Versión de ESP-IDF / Arduino core | PENDIENTE |
| Versión de TFLite Micro (repositorio/commit exacto) | PENDIENTE |
| Frecuencia de CPU usada en cada corrida (MHz) | PENDIENTE |

## 2. Latencia en el dispositivo (µs por ventana)

**Preparación:** compilar un firmware mínimo con el modelo
`Puro_1D_CNN_int8.tflite` incrustado (`extern const unsigned char model[]`
convertido con `xxd -i` o `esptool`-compatible), ventana de entrada int8
(1, 128, 8) ya normalizada (escala/zero-point del modelo, no del PC).

**Procedimiento:** 50 inferencias de calentamiento (descartadas) + 200 medidas,
una por ventana, usando `esp_timer_get_time()` (µs, 64 bits). Registrar media,
mediana, p95 y desviación estándar. Repetir con las frecuencias de CPU previstas
(y anotar cada una). La CPU debe estar en reposo: sin WiFi/LoRa activos y sin
otras tareas periódicas corriendo durante la medición (si no se puede, anotar).

**Resultados:**
- Latencia media (µs): **PENDIENTE DE MEDICIÓN**
- p95 (µs): **PENDIENTE DE MEDICIÓN**
- Desviación estándar (µs): **PENDIENTE DE MEDICIÓN**
- Headroom respecto al período de muestreo objetivo (50 Hz → 20 ms/ventana de
  deslizamiento: cabe a 1 muestra/instante; se debe reportar el margen en %):
  **PENDIENTE DE MEDICIÓN**

## 3. Memoria: tensor arena y footprint

Método: instrumentar con el tamaño máximo reportado por TFLite Micro
(`MicroInterpreter::GetTensorArenaUsage`) o integrar un "malloc hook";
registrar también los bytes ocupados en flash por el binario final y por el
modelo embutido.

- Tensor arena mínima que no produce fallo de asignación (bytes, y el valor de
  seguridad usado, e.g. ×1.1 o ×1.2): **PENDIENTE DE MEDICIÓN**
- ¿Cabe en SRAM interna? (si no, ¿requiere PSRAM y cuánto)? : **PENDIENTE**
- Tamaño del binario de firmware (bytes): **PENDIENTE DE MEDICIÓN**
- RAM estática usada (reportado por el linker, secciones .data+.bss): **PENDIENTE**

## 4. Consumo de energía y autonomía

**Preparación:** medir con un medidor de corriente dedicado (INA219/INA226,
analizador de potencia USB u osciloscopio + shunt según disponibilidad; el
equipo de hardware define el montaje). Medir la corriente en tres escenarios en
condiciones idénticas: a) reposo sin transmitir; b) inferencia continua;
c) ciclo de operación previsto (monitorización → inferencia → transmisión LoRaWAN).

- Corriente activa en inferencia (mA): **PENDIENTE DE MEDICIÓN**
- Corriente de reposo / deep-sleep (µA o mA): **PENDIENTE DE MEDICIÓN**
- Corriente de transmisión LoRaWAN (mA, SF usada): **PENDIENTE DE MEDICIÓN**
- Energía por ciclo completado (mJ o mAs): **PENDIENTE DE MEDICIÓN**
- Batería utilizada (mAh, química, tensión) y autonomía estimada CON esa
  medición (horas, según % de tiempo de radio activo medido): **PENDIENTE DE
  MEDICIÓN**

## 5. Alcance de comunicaciones (LoRaWAN / LoRa)

Procedimiento: fijar SF/BW/país, probar desde el punto más
profundo del socavón hasta la gateway, con línea de vista y con obstáculos, 3
intentos de paquete cada 10 s por punto; registrar RSSI/SNR recibidos.

- Alcance underground (m, topología usada): **PENDIENTE DE MEDICIÓN**
- RSSI/SNR/PER en cada punto (tabla completa): **PENDIENTE DE MEDICIÓN**
- Paquetes perdidos con obstáculo (humano en el frente): **PENDIENTE DE MEDICIÓN**
- Payload por alerta (bytes, formato seleccionado): **PENDIENTE DE MEDICIÓN**

## 6. Exactitud del modelo en el dispositivo (verificación de integridad)

Procedimiento: los mismos 6 888 vectores de test usados en PC, pero pasados como
bufers adjuntos al binario (o 500 elegidos de forma determinística y
estratificada, seed 42); comparar la clase predicha por el ESP32-S3 con la
predicha por el TFLite Interpreter en PC (debe coincidir 100 % al ser la misma
aritmética int8; las diferencias evidencian bugs de cuantización/pre/post).

- Desacuerdo respecto al PC (ventanas): **PENDIENTE DE MEDICIÓN** (esperado 0)

## 7. Reporte de los valores (una vez medidos)

Actualizar `ml_training/reports/paper_assets/tflite_resultados.csv` (agregar
columnas de dispositivo) o crear `hardware_resultados.csv`, y la sección de
hardware del artículo. **Ningún valor de este protocolo puede inferirse:** los
números del ESP32-S3 solo cuentan si salen de las mediciones aquí descritas.

---

*M-10 · Protocolo generado junto con la Fase C (TFLite + latencias PC).
Autoría de valores pendientes: equipo de hardware.*
