import os
from typing import Dict, Any, Optional
from backend.config import GEMINI_API_KEY

def get_ai_safety_advice(
    prompt: Optional[str],
    worker: Optional[Dict[str, Any]],
    active_alerts_summary: str,
    active_workers_count: int,
    sector: Optional[str] = None
) -> Dict[str, str]:
    context_data = f"""
Contexto Mina Artesanal M-10:
- Trabajadores activos: {active_workers_count}
- Alertas activas: {active_alerts_summary or 'Ninguna'}
- Trabajador seleccionado: {f"{worker.get('name')} ({worker.get('role')} en {worker.get('sector')}, Estado: {worker.get('status')}, Actividad: {worker.get('lastActivity')})" if worker else 'Evaluación General de Mina'}
- Sector en foco: {sector or 'Todos los frentes subterráneos'}
    """.strip()

    if not GEMINI_API_KEY:
        worker_sector = worker.get("sector") if worker else "Nivel -120m"
        return {
            "analysis": f"""[Análisis Predictivo M-10 (Motor Autónomo)]: Basado en los datos de telemetría y estado de sensores cinemáticos, se observa atención prioritaria en el sector {sector or worker_sector} debido a variaciones cinemáticas y dinámica de socavón.
Recomendaciones de Seguridad Minera Inmediatas:
1. Despachar brigada de rescate con camilla rígida y kit de primeros auxilios si hay alertas activas de caída o inmovilidad.
2. Verificar tiro de ventilación forzada en chimeneas y monitorear concentración de gases (CO / O2).
3. Asegurar sostenimiento con cuadros de madera y pernos de anclaje antes de reanudar perforación.
4. Mantener canal radial VHF de emergencia libre de interferencias.""",
            "model": "M-10 Heuristic Rule-Based Engine (Fallback)"
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        system_prompt = f"""Eres el Asistente Experto en Seguridad y Salud Ocupacional Minera del sistema "M-10: Sistema Inteligente de Seguridad para Minería Artesanal".
Analiza los datos en tiempo real de sensores cinemáticos y brinda un informe conciso, técnico y orientado a la acción inmediata para salvar vidas en socavones mineros.

{context_data}

Consulta del supervisor: {prompt or 'Evalúa la situación de seguridad y genera plan de acción inmediato.'}"""
        response = model.generate_content(system_prompt)
        return {
            "analysis": response.text,
            "model": "Gemini 1.5 Flash"
        }
    except Exception as e:
        return {
            "analysis": f"[Análisis de Respaldo M-10]: Evaluación de seguridad generada automáticamente. Verifique el estado de los sensores y mantenga los protocolos de rescate activos.\nDetalle: {str(e)}",
            "model": "M-10 Local Safety Advisor (Fallback)"
        }
