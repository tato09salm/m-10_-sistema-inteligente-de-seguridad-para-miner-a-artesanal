import sys
import json
from pathlib import Path

# UTF-8 terminal support
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

REPORT_PATH = Path(__file__).resolve().parent / "reports" / "models_comparison_report.json"

def display_results():
    if not REPORT_PATH.exists():
        print(f"[Error] No se encontro el reporte en {REPORT_PATH}")
        return

    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("=" * 80)
    print("[M-10 ML] REPORTE DE ENTRENAMIENTO Y COMPARATIVA DE MODELOS DEEP LEARNING")
    print(f" Dataset: {data.get('dataset')} | Muestras Totales: {data.get('total_samples'):,}")
    print(f" Forma Entrada: {data.get('input_shape')} | Fecha: {data.get('timestamp')}")
    print("=" * 80)

    print("\nRESUMEN COMPARATIVO:\n")
    print(f"{'Modelo':<42} | {'Exactitud':<10} | {'F1-Score':<10} | {'Latencia':<11} | {'Tamano .h5':<10}")
    print("-" * 92)

    best_id = data.get("best_model", {}).get("model_id")

    for m in data.get("all_models", []):
        m_id = m.get("model_id")
        desc = m.get("description")
        acc = f"{m['metrics']['accuracy']}%"
        f1 = f"{m['metrics']['f1_score']}%"
        lat = f"{m['metrics']['latency_ms']} ms"
        size = f"{m['file_size_kb']} KB"
        star = "  [SELECCIONADO]" if m_id == best_id else ""
        print(f"{desc:<42} | {acc:<10} | {f1:<10} | {lat:<11} | {size:<10}{star}")

    print("\n" + "=" * 80)
    print("DETALLE POR MODELO Y MATRICES DE CONFUSION")
    print("=" * 80)

    for idx, m in enumerate(data.get("all_models", []), 1):
        print(f"\n[{idx}] {m.get('description')} ({m.get('h5_file')})")
        print(f"    - Tiempo de Entrenamiento: {m.get('training_time_seconds')} seg ({m.get('epochs_trained')} epocas)")
        print(f"    - Latencia de Inferencia por Muestra: {m['metrics']['latency_ms']} ms")
        print(f"    - Metricas Globales: Exactitud = {m['metrics']['accuracy']}% | F1-Score = {m['metrics']['f1_score']}% | Precision = {m['metrics']['precision']}% | Recall = {m['metrics']['recall']}%")
        
        print("\n    Metricas por Clase:")
        rep = m["metrics"]["classification_report"]
        for cls_name in ["actividad_normal", "posible_caida", "inmovilidad_prolongada"]:
            if cls_name in rep:
                c = rep[cls_name]
                print(f"      - {cls_name:<24}: Precision = {c['precision']*100:.1f}%, Recall = {c['recall']*100:.1f}%, F1 = {c['f1-score']*100:.1f}% (N={int(c['support'])})")

        print("\n    Matriz de Confusion (Test Set 3,010 muestras):")
        cm = m["metrics"]["confusion_matrix"]
        print(f"      Predicho ->     [Normal]   [Caida]   [Inmovil]")
        print(f"      Real Normal:    {cm[0][0]:>8}  {cm[0][1]:>8}  {cm[0][2]:>8}")
        print(f"      Real Caida:     {cm[1][0]:>8}  {cm[1][1]:>8}  {cm[1][2]:>8}")
        print(f"      Real Inmovil:   {cm[2][0]:>8}  {cm[2][1]:>8}  {cm[2][2]:>8}")
        print("-" * 80)

    print("\n[OK] El modelo seleccionado en produccion es: Puro_1D_CNN.h5 (activo en backend/ml_engine.py)")

if __name__ == "__main__":
    display_results()
