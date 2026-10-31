# -*- coding: utf-8 -*-
"""
M-10 · FASE 1 (manual): conversión a TFLite de los 5 modelos, evaluación en el
test de sujetos no vistos y latencia en PC.

Ejecutar con el equipo EN REPOSO (sin entrenamientos ni otros procesos pesados):
    cd ml_training
    python fase1_tflite_5modelos.py

Qué hace
  Para cada modelo *_grouped.h5 intenta convertir a TFLite float32 e int8 completo
  siguiendo 3 rutas, en orden, hasta que el int8 completo funcione:
     1) directa            : from_keras_model(modelo original)
     2) batch1             : misma arquitectura con batch fijo = 1 (corrige el error
                             "TensorListReserve requires element_shape to be static")
     3) batch1+unroll      : además LSTM/GRU con unroll=True
  Las rutas 2 y 3 reconstruyen la MISMA arquitectura y copian los pesos (no se
  reentrena). Antes de convertir se VERIFICA que las predicciones coinciden con el
  modelo original.
  No se usan Flex Ops / Select TF Ops (no desplegable en TFLite Micro).

Salidas (reports/paper_assets/v2/):
  tflite_resultados_v2.csv, tflite_latencia_v2.csv, tflite_conversion_log_v2.json,
  seleccion_modelo_v2.md, entorno_latencia_v2.txt
  Archivos .tflite en saved_models/tflite_v2/
Las latencias son en PC y NO en ESP32-S3.
"""
import os
import sys
import csv
import json
import time
import argparse
import platform
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

import tensorflow as tf                      # noqa: E402
import export_tflite_latency as ex           # noqa: E402  (reutiliza funciones ya probadas)

ROOT = Path(__file__).resolve().parent
ASSETS_V2 = ROOT / "reports" / "paper_assets" / "v2"
TFLITE_V2 = ROOT / "saved_models" / "tflite_v2"
ALL_MODELS = ex.ALL_MODELS
N_VERIFY = 256                 # ventanas para comprobar equivalencia de variantes
TOL_PROB = 1e-4                # diferencia máxima de probabilidad admitida
LAT_SERIES, LAT_WARM, LAT_REPS = 3, 50, 200


# ------------------------------------------------------------ control de reposo
def check_idle(skip=False, max_wait_s=300, cpu_limit=10.0):
    """Exige CPU en reposo antes de medir latencias."""
    if skip:
        print("[AVISO] Control de reposo omitido (--skip-idle-check).")
        return {"cpu_before_pct": None, "skipped": True}
    try:
        import psutil
    except ImportError:
        print("\n[ERROR] Falta 'psutil' para comprobar que el equipo está en reposo.\n"
              "        Instálalo con:  pip install psutil\n"
              "        (o ejecuta con --skip-idle-check bajo tu responsabilidad)")
        raise SystemExit(1)
    me = os.getpid()
    t0 = time.time()
    while True:
        cpu = psutil.cpu_percent(interval=10)
        others = []
        for p in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                if p.info["pid"] == me:
                    continue
                nm = (p.info["name"] or "").lower()
                if "python" in nm:
                    others.append(f"{p.info['pid']}:{nm}")
            except Exception:
                pass
        print(f"  [reposo] CPU 10 s = {cpu:.1f} % | otros procesos python: "
              f"{others if others else 'ninguno'}")
        if cpu < cpu_limit and not others:
            return {"cpu_before_pct": cpu, "other_python": others, "skipped": False}
        if time.time() - t0 > max_wait_s:
            print("\n[ERROR] El equipo no está en reposo tras 5 minutos. Cierra los "
                  "procesos listados (entrenamientos, notebooks, etc.) y vuelve a ejecutar.")
            raise SystemExit(1)
        print("  esperando 30 s a que el equipo quede en reposo...")
        time.sleep(30)


def power_plan():
    try:
        import subprocess
        out = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True,
                             text=True, timeout=10)
        return out.stdout.strip() or out.stderr.strip()
    except Exception:
        return "no disponible (no es Windows o powercfg no responde)"


# ------------------------------------------------------------ variantes de modelo
def variant_model(model, batch1=False, unroll=False):
    """Misma arquitectura (config modificada) + mismos pesos."""
    cfg = model.get_config()

    def walk(o):
        if isinstance(o, dict):
            cn = o.get("class_name")
            c = o.get("config")
            if unroll and cn in ("LSTM", "GRU") and isinstance(c, dict):
                c["unroll"] = True
            if batch1 and cn == "InputLayer" and isinstance(c, dict):
                for key in ("batch_shape", "batch_input_shape"):
                    if key in c and c[key] is not None:
                        c[key] = [1] + list(c[key][1:])
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)

    walk(cfg)
    new = tf.keras.Model.from_config(cfg, custom_objects=ex.CUSTOM_OBJECTS)
    new.set_weights(model.get_weights())
    return new


def verify_equivalence(orig, var, X_probe):
    p0 = orig.predict(X_probe, batch_size=64, verbose=0)
    p1 = var.predict(X_probe, batch_size=1, verbose=0)
    dmax = float(np.abs(p0 - p1).max())
    same = bool((p0.argmax(1) == p1.argmax(1)).all())
    return dmax, same


# ------------------------------------------------------------ latencia
def latency_series(fn):
    series = []
    for _ in range(LAT_SERIES):
        series.append(ex.measure(fn, warmup=LAT_WARM, reps=LAT_REPS))
    worst = max(series, key=lambda s: s["de_ms"])
    return {
        "mediana_ms": float(np.median([s["mediana_ms"] for s in series])),   # mediana de medianas
        "media_ms": worst["media_ms"], "p95_ms": worst["p95_ms"], "de_ms": worst["de_ms"],
        "series_medianas_ms": [round(s["mediana_ms"], 4) for s in series],
    }


def tflite_invoker(model_bytes, single_window, input_int8):
    interp = tf.lite.Interpreter(model_content=model_bytes, num_threads=1)
    interp.allocate_tensors()
    idet = interp.get_input_details()[0]
    odet = interp.get_output_details()[0]
    if input_int8:
        s_in, zp_in = ex.quant_params(idet)
        arr = np.clip(np.round(single_window / s_in + zp_in),
                      np.iinfo(idet["dtype"]).min, np.iinfo(idet["dtype"]).max
                      ).astype(idet["dtype"])
    else:
        arr = single_window.astype(idet["dtype"])

    def run():
        interp.set_tensor(idet["index"], arr)
        interp.invoke()
        _ = interp.get_tensor(odet["index"])
    return run


# ------------------------------------------------------------ conversión aislada
ROUTE_KW = {"directa": {}, "batch1": {"batch1": True},
            "batch1+unroll": {"batch1": True, "unroll": True}}


def worker_convert(mid, route, fmt, out_path):
    """Se ejecuta en un proceso aparte: si el conversor de TF se cae (segfault), solo muere este."""
    orig = ex.load_model_file(mid)
    _, _, X_rep, _ = ex.load_test_and_rep(mid)
    kw = ROUTE_KW[route]
    m = orig if not kw else variant_model(orig, **kw)
    b, _ = ex.convert_float32(m) if fmt == "float32" else ex.convert_int8_full(m, X_rep)
    Path(out_path).write_bytes(b)


def convert_isolated(mid, route, fmt):
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "m.tflite")
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--worker",
                            mid, route, fmt, out], capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(out):
            tail = (r.stderr or "").strip().splitlines()[-1:] or [""]
            raise RuntimeError(f"el conversor terminó con código {r.returncode} "
                               f"(¿caída interna de TensorFlow?) {tail[0][:200]}")
        return Path(out).read_bytes()


# ------------------------------------------------------------ principal
def main():
    if len(sys.argv) >= 6 and sys.argv[1] == "--worker":
        worker_convert(*sys.argv[2:6])
        return
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=ALL_MODELS, choices=ALL_MODELS)
    ap.add_argument("--skip-idle-check", action="store_true")
    ap.add_argument("--no-latency", action="store_true",
                    help="solo conversión y evaluación (sin medir latencias)")
    args = ap.parse_args()

    ASSETS_V2.mkdir(parents=True, exist_ok=True)
    TFLITE_V2.mkdir(parents=True, exist_ok=True)
    log = {"routes": ["directa", "batch1", "batch1+unroll"],
           "flex_ops": "no se intentan (no desplegable en TFLite Micro)",
           "verify": {"n_windows": N_VERIFY, "tol_prob": TOL_PROB},
           "models": {}}
    rows, lat_rows = [], []

    # ---------------- conversión y evaluación
    best_bytes = {}                     # (modelo, formato) -> bytes, para latencia
    single_window = None
    for mid in args.models:
        print(f"\n=================== {mid} ===================")
        orig = ex.load_model_file(mid)
        X_test, y_test, X_rep, met = ex.load_test_and_rep(mid)
        single_window = X_test[0:1].astype(np.float32)
        X_probe = X_test[:N_VERIFY].astype(np.float32)
        mlog = {"attempts": []}
        chosen = {"float32": None, "int8": None}
        chosen_route = None

        for route, kw in (("directa", {}), ("batch1", {"batch1": True}),
                          ("batch1+unroll", {"batch1": True, "unroll": True})):
            print(f"\n  -- ruta: {route}")
            att = {"route": route}
            try:
                m = orig if not kw else variant_model(orig, **kw)
                if kw:
                    dmax, same = verify_equivalence(orig, m, X_probe)
                    att.update({"max_prob_diff": dmax, "same_classes": same})
                    print(f"     equivalencia con el original: dif. máx. prob = {dmax:.2e} | "
                          f"mismas clases = {same}")
                    if dmax > TOL_PROB or not same:
                        att["error"] = "la variante NO reproduce las predicciones del original"
                        print("     [DESCARTADA] " + att["error"])
                        mlog["attempts"].append(att)
                        continue
            except Exception as e:
                att["error"] = f"no se pudo construir la variante: {e!r}"
                print("     [FALLO]", att["error"])
                mlog["attempts"].append(att)
                continue

            try:
                b = convert_isolated(mid, route, "float32")
                att["float32_kb"] = round(len(b) / 1024, 1)
                if chosen["float32"] is None:
                    chosen["float32"] = (b, route)
                print(f"     float32 OK ({len(b)/1024:.1f} KB)")
            except Exception as e:
                att["float32_error"] = repr(e)[:600]
                print("     float32 FALLA:", repr(e)[:200])
            try:
                b = convert_isolated(mid, route, "int8")
                att["int8_kb"] = round(len(b) / 1024, 1)
                chosen["int8"] = (b, route)
                chosen_route = route
                print(f"     int8 completo OK ({len(b)/1024:.1f} KB)  -> ruta elegida")
                mlog["attempts"].append(att)
                break
            except Exception as e:
                att["int8_error"] = repr(e)[:600]
                print("     int8 completo FALLA:", repr(e)[:200])
            mlog["attempts"].append(att)

        # fallback documentado: cuantización dinámica si no hay int8 completo
        if chosen["int8"] is None and chosen["float32"] is not None:
            try:
                b, _ = ex.convert_dynamic(orig)
                chosen["dynamic"] = (b, "directa")
                print("  int8 completo imposible; cuantización dinámica OK "
                      f"({len(b)/1024:.1f} KB) [solo referencia]")
            except Exception as e:
                mlog["dynamic_error"] = repr(e)[:400]
        mlog["chosen_route_int8"] = chosen_route
        log["models"][mid] = mlog

        # ---- evaluar formatos obtenidos
        for fmt in ("float32", "int8", "dynamic"):
            if chosen.get(fmt) is None:
                if fmt != "dynamic":
                    rows.append({"Modelo": mid, "Formato": fmt, "Convierte": "no",
                                 "Ruta": "", "Sin_FlexOps": "", "Tamano_KB": "",
                                 "Exactitud": "", "F1_macro": "", "Recall_caida": "",
                                 "Recall_caida_IC95_inf": "", "Recall_caida_IC95_sup": ""})
                continue
            b, route = chosen[fmt]
            (TFLITE_V2 / f"{mid}_{fmt}.tflite").write_bytes(b)
            t0 = time.time()
            yp, _ = ex.tflite_predict(b, X_test, want_int8=(fmt == "int8"))
            acc, f1m, rf, lo, hi = ex.eval_metrics(y_test, yp)
            rows.append({"Modelo": mid, "Formato": fmt, "Convierte": "sí", "Ruta": route,
                         "Sin_FlexOps": "sí", "Tamano_KB": round(len(b) / 1024, 1),
                         "Exactitud": round(acc * 100, 2), "F1_macro": round(f1m * 100, 2),
                         "Recall_caida": round(rf * 100, 2),
                         "Recall_caida_IC95_inf": round(lo * 100, 2),
                         "Recall_caida_IC95_sup": round(hi * 100, 2)})
            best_bytes[(mid, fmt)] = (b, fmt == "int8")
            print(f"  [{fmt}|{route}] tam={len(b)/1024:.1f}KB acc={acc*100:.2f} "
                  f"F1={f1m*100:.2f} recall_caída={rf*100:.2f} [{lo*100:.2f},{hi*100:.2f}] "
                  f"({time.time()-t0:.0f}s de evaluación)")
        del orig
        tf.keras.backend.clear_session()

    # ---------------- resultados de conversión (antes de medir latencias)
    fields = ["Modelo", "Formato", "Convierte", "Ruta", "Sin_FlexOps", "Tamano_KB",
              "Exactitud", "F1_macro", "Recall_caida", "Recall_caida_IC95_inf",
              "Recall_caida_IC95_sup"]
    with open(ASSETS_V2 / "tflite_resultados_v2.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    with open(ASSETS_V2 / "tflite_conversion_log_v2.json", "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Guardado {ASSETS_V2 / 'tflite_resultados_v2.csv'}")

    # ---------------- latencias (CPU en reposo)
    env = {"cpu": platform.processor(), "machine": platform.machine(),
           "python": platform.python_version(), "tensorflow": tf.__version__,
           "numpy": np.__version__, "os": f"{platform.system()} {platform.release()}",
           "plan_de_energia": power_plan(),
           "aviso": "Latencias en PC; NO son latencias del ESP32-S3."}
    if not args.no_latency:
        print("\n=== MEDICIÓN DE LATENCIA (PC, 1 hilo, 1 ventana) ===")
        print("  Plan de energía:", env["plan_de_energia"])
        env["idle_check"] = check_idle(args.skip_idle_check)
        for (mid, fmt), (b, is_int8) in best_bytes.items():
            lat = latency_series(tflite_invoker(b, single_window, is_int8))
            lat_rows.append({"Modelo": mid, "Formato": fmt, "Motor": "TFLite_Interpreter_1hilo(PC)",
                             **lat})
            print(f"  TFLite {mid:<26}{fmt:<8} mediana={lat['mediana_ms']:.4f} ms "
                  f"(p95 {lat['p95_ms']:.4f})")
        xf = tf.constant(single_window, dtype=tf.float32)
        for mid in args.models:
            m = ex.load_model_file(mid)
            lat = latency_series(lambda m=m, xf=xf: m(xf, training=False))
            lat_rows.append({"Modelo": mid, "Formato": "keras_float32",
                             "Motor": "Keras_model_x(PC)", **lat})
            print(f"  Keras  {mid:<26}         mediana={lat['mediana_ms']:.4f} ms "
                  f"(p95 {lat['p95_ms']:.4f})")
            del m
            tf.keras.backend.clear_session()
        lf =["Modelo", "Formato", "Motor", "mediana_ms", "media_ms", "p95_ms", "de_ms",
              "series_medianas_ms"]
        with open(ASSETS_V2 / "tflite_latencia_v2.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=lf)
            w.writeheader()
            w.writerows(lat_rows)

    with open(ASSETS_V2 / "entorno_latencia_v2.txt", "w", encoding="utf-8") as f:
        for k, v in env.items():
            f.write(f"{k}: {v}\n")

    # ---------------- ayuda para la selección
    write_selection(rows)
    print("\n[OK] FASE 1 terminada. Revisa reports/paper_assets/v2/seleccion_modelo_v2.md")


def write_selection(rows):
    """Aplica la regla: int8 completo sin Flex y caída de recall <= 1 pp vs float32."""
    by = {}
    for r in rows:
        by.setdefault(r["Modelo"], {})[r["Formato"]] = r
    cand = []
    for mid, d in by.items():
        i8, f32 = d.get("int8"), d.get("float32")
        if not i8 or i8["Convierte"] != "sí":
            continue
        drop = None
        if f32 and f32["Convierte"] == "sí":
            drop = float(f32["Recall_caida"]) - float(i8["Recall_caida"])
        ok = drop is None or drop <= 1.0
        cand.append((mid, float(i8["Exactitud"]), float(i8["F1_macro"]),
                     float(i8["Recall_caida"]), float(i8["Tamano_KB"]), drop, ok))
    cand.sort(key=lambda t: (-t[1], -t[2]))
    L = ["# Selección del modelo a desplegar (Fase 1)\n\n",
         "Regla: int8 completo sin Flex Ops y caída de recall de caída (int8 vs float32) "
         "<= 1 punto porcentual; se prefiere mayor exactitud y F1 macro. Si dos modelos "
         "difieren menos de ~0,3 puntos, es un empate práctico y se elige el de menor "
         "tamaño y latencia (decisión del investigador, apoyada en la Fase 2).\n\n",
         "| Modelo | Exactitud int8 (%) | F1 macro (%) | Recall caída (%) | Tamaño (KB) | "
         "Δ recall vs float32 (pp) | Cumple regla |\n|---|---|---|---|---|---|---|\n"]
    for mid, a, f, r, kb, drop, ok in cand:
        L.append(f"| {mid} | {a:.2f} | {f:.2f} | {r:.2f} | {kb:.1f} | "
                 f"{'' if drop is None else f'{drop:.2f}'} | {'sí' if ok else 'NO'} |\n")
    no_conv = [m for m, d in by.items() if not d.get("int8") or d["int8"]["Convierte"] != "sí"]
    if no_conv:
        L.append("\nModelos SIN int8 completo desplegable: " + ", ".join(no_conv) + "\n")
    valid = [c for c in cand if c[6]]
    if valid:
        L.append(f"\n**Candidato por la regla:** {valid[0][0]}\n")
    with open(ASSETS_V2 / "seleccion_modelo_v2.md", "w", encoding="utf-8") as f:
        f.writelines(L)
    print("".join(L))


if __name__ == "__main__":
    main()
