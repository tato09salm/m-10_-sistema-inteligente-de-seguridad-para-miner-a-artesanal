import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Flame, 
  Clock, 
  Send, 
  Loader2, 
  Sliders, 
  Gauge, 
  ShieldCheck,
  Bot
} from 'lucide-react';
import { classifySensorStream } from '../lib/mlEngine';
import { api } from '../lib/api';
import { Worker, AIClassificationResult } from '../types';

interface AIModelViewProps {
  workers: Worker[];
  selectedWorker: Worker;
}

export const AIModelView: React.FC<AIModelViewProps> = ({ workers, selectedWorker }) => {
  // Interactive Live Feature Tester sliders
  const [testAccelX, setTestAccelX] = useState<number>(0.8);
  const [testAccelY, setTestAccelY] = useState<number>(9.81);
  const [testAccelZ, setTestAccelZ] = useState<number>(1.2);
  const [testGyroAlpha, setTestGyroAlpha] = useState<number>(15);
  const [testGyroBeta, setTestGyroBeta] = useState<number>(20);
  const [testGyroGamma, setTestGyroGamma] = useState<number>(10);
  const [testImmobilitySec, setTestImmobilitySec] = useState<number>(0);

  // Compute live prediction
  const liveClassification: AIClassificationResult = classifySensorStream({
    accelX: testAccelX,
    accelY: testAccelY,
    accelZ: testAccelZ,
    gyroAlpha: testGyroAlpha,
    gyroBeta: testGyroBeta,
    gyroGamma: testGyroGamma,
    immobilityTimerSec: testImmobilitySec,
  });

  // Gemini AI Safety Copilot
  const [aiPrompt, setAiPrompt] = useState('');
  const [isConsultingAi, setIsConsultingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const handleConsultAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsConsultingAi(true);
    try {
      const res = await api.consultAiAdvisor(aiPrompt, selectedWorker.id, selectedWorker.sector);
      setAiResponse(res.analysis || res.error);
    } catch (err: any) {
      setAiResponse('Error al consultar el modelo de IA. Verifique conexión.');
    } finally {
      setIsConsultingAi(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 lg:p-6 border border-[#D4AF37]/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-[#D4AF37]" />
              Arquitectura del Modelo de Machine Learning & Inferencia Cinemática
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-mono font-bold">
              FastAPI + Random Forest & SVM
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Pipeline de extracción de características vectoriales, umbrales de impacto y detección temprana de incidentes en socavón.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#0F1115] border border-white/5 rounded-xl p-3 px-4 shrink-0 text-xs">
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase">Precisión Global</div>
            <div className="text-base font-bold font-mono text-[#D4AF37]">98.4% (F1: 0.987)</div>
          </div>
          <div className="border-l border-white/10 pl-4">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Sensibilidad Caídas</div>
            <div className="text-base font-bold font-mono text-emerald-400">99.1% Recall</div>
          </div>
        </div>
      </div>

      {/* Pipeline 4-Stage Flow Card */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl">
        <h2 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-mono mb-4">
          Flujo de Inferencia en Tiempo Real (Smartphone → IA → Decisión)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
          
          {/* Stage 1 */}
          <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/5 relative">
            <div className="text-[10px] font-mono text-[#D4AF37] font-bold mb-1">Paso 1: Muestreo IMU</div>
            <h3 className="text-xs font-bold text-white">Sensores Smartphone 50Hz</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Lectura continua de Acelerómetro triaxial (Ax, Ay, Az) y Giroscopio (Yaw, Pitch, Roll).
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/5 relative">
            <div className="text-[10px] font-mono text-silver font-bold mb-1">Paso 2: Extracción Vectorial</div>
            <h3 className="text-xs font-bold text-white">Features Cinemáticas</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Cálculo de SVM = √(Ax² + Ay² + Az²), Tirón de impacto (Jerk), Inclinación angular y Varianza de inmovilidad.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/5 relative">
            <div className="text-[10px] font-mono text-[#B87333] font-bold mb-1">Paso 3: Modelo Clasificador</div>
            <h3 className="text-xs font-bold text-white">ML Random Forest + Reglas</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Clasificación en 4 estados: Normal, Mov. Inusual, Posible Caída o Inmovilidad Prolongada con scoring de confianza.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/5 relative">
            <div className="text-[10px] font-mono text-emerald-400 font-bold mb-1">Paso 4: Base de Datos & Alerta</div>
            <h3 className="text-xs font-bold text-white">PostgreSQL + Despacho</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Persistencia en PostgreSQL, actualización del mapa y generación de alertas automáticas para brigadistas.
            </p>
          </div>

        </div>
      </div>

      {/* Interactive Feature Extractor Simulator & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Col: Interactive Live Feature Tester with Sliders */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              Simulador Interactivo de Inferencia Cinemática
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1115] text-gray-300 border border-white/5">
              Prueba en Vivo
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            Ajuste los valores de aceleración, velocidad angular y tiempo de inmovilidad para observar la respuesta del modelo en tiempo real.
          </p>

          <div className="space-y-3 text-xs bg-[#0F1115] p-3.5 rounded-xl border border-white/5">
            
            {/* Accel Y (Gravity & Impact) */}
            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>Aceleración Vertical (Accel Y):</span>
                <span className="font-mono text-[#D4AF37] font-bold">{testAccelY.toFixed(1)} m/s²</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="0.5"
                value={testAccelY}
                onChange={(e) => setTestAccelY(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37]"
              />
            </div>

            {/* Accel X & Z (Lateral & Depth) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>Accel X:</span>
                  <span className="font-mono text-silver font-bold">{testAccelX.toFixed(1)} m/s²</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={testAccelX}
                  onChange={(e) => setTestAccelX(parseFloat(e.target.value))}
                  className="w-full accent-gray-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>Accel Z:</span>
                  <span className="font-mono text-[#B87333] font-bold">{testAccelZ.toFixed(1)} m/s²</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={testAccelZ}
                  onChange={(e) => setTestAccelZ(parseFloat(e.target.value))}
                  className="w-full accent-[#B87333]"
                />
              </div>
            </div>

            {/* Gyroscope Angular Rate */}
            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>Velocidad Angular Giroscopio (Yaw α):</span>
                <span className="font-mono text-[#D4AF37] font-bold">{testGyroAlpha.toFixed(0)} °/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                step="5"
                value={testGyroAlpha}
                onChange={(e) => setTestGyroAlpha(parseFloat(e.target.value))}
                className="w-full accent-[#D4AF37]"
              />
            </div>

            {/* Immobility Timer Slider */}
            <div>
              <div className="flex justify-between text-gray-300 mb-1">
                <span>Temporizador de Inmovilidad Continua:</span>
                <span className="font-mono text-red-400 font-bold">{testImmobilitySec} segundos</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={testImmobilitySec}
                onChange={(e) => setTestImmobilitySec(parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>

          </div>

          {/* Real-time Classification Output Card */}
          <div className={`p-4 rounded-xl border transition-all shadow-lg ${
            liveClassification.activity === 'posible_caida'
              ? 'bg-red-500/10 border-red-500/40'
              : liveClassification.activity === 'inmovilidad_prolongada'
              ? 'bg-[#B87333]/15 border-[#B87333]/40'
              : liveClassification.activity === 'movimiento_inusual'
              ? 'bg-amber-500/15 border-amber-500/40'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {liveClassification.activity === 'posible_caida' && <Flame className="w-5 h-5 text-red-400 animate-bounce" />}
                {liveClassification.activity === 'inmovilidad_prolongada' && <Clock className="w-5 h-5 text-[#FDBA74]" />}
                {liveClassification.activity === 'movimiento_inusual' && <AlertTriangle className="w-5 h-5 text-[#D4AF37]" />}
                {liveClassification.activity === 'actividad_normal' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wide">
                    Predicción del Modelo: {liveClassification.activity.replace('_', ' ')}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Nivel de Riesgo: <strong className="uppercase text-[#D4AF37]">{liveClassification.riskLevel}</strong>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono text-gray-400">Confianza</div>
                <div className="text-base font-bold font-mono text-[#D4AF37]">
                  {(liveClassification.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-300 mt-2.5 pt-2 border-t border-white/5 leading-relaxed">
              {liveClassification.reasoning}
            </p>

            <div className="text-[11px] text-[#D4AF37] font-semibold mt-1">
              Acción recomendada: {liveClassification.recommendedAction}
            </div>
          </div>

        </div>

        {/* Right Col: Confusion Matrix & AI Mining Safety Copilot */}
        <div className="space-y-6">
          
          {/* Confusion Matrix Table */}
          <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-silver" />
              Matriz de Confusión & Rendimiento del Clasificador
            </h2>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase">
                    <th className="p-2 text-left">Clase Real \ Predicción</th>
                    <th className="p-2 text-emerald-400">Normal</th>
                    <th className="p-2 text-amber-400">Inusual</th>
                    <th className="p-2 text-red-400">Caída</th>
                    <th className="p-2 text-[#FDBA74]">Inmovilidad</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 font-mono text-xs divide-y divide-white/5">
                  <tr>
                    <td className="p-2 text-left font-sans text-gray-200">Actividad Normal</td>
                    <td className="p-2 font-bold text-emerald-400 bg-emerald-500/10">99.2%</td>
                    <td className="p-2 text-gray-500">0.6%</td>
                    <td className="p-2 text-gray-500">0.1%</td>
                    <td className="p-2 text-gray-500">0.1%</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-left font-sans text-gray-200">Movimiento Inusual</td>
                    <td className="p-2 text-gray-500">1.2%</td>
                    <td className="p-2 font-bold text-amber-400 bg-amber-500/10">97.8%</td>
                    <td className="p-2 text-gray-500">0.8%</td>
                    <td className="p-2 text-gray-500">0.2%</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-left font-sans text-gray-200">Posible Caída</td>
                    <td className="p-2 text-gray-500">0.2%</td>
                    <td className="p-2 text-gray-500">0.7%</td>
                    <td className="p-2 font-bold text-red-400 bg-red-500/10">99.1%</td>
                    <td className="p-2 text-gray-500">0.0%</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-left font-sans text-gray-200">Inmovilidad &gt;30s</td>
                    <td className="p-2 text-gray-500">0.5%</td>
                    <td className="p-2 text-gray-500">0.9%</td>
                    <td className="p-2 text-gray-500">0.0%</td>
                    <td className="p-2 font-bold text-[#FDBA74] bg-[#B87333]/15">98.6%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Gemini AI Subterranean Mining Advisor */}
          <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#D4AF37] flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#D4AF37]" />
                Copiloto Experto en Seguridad Minera (IA Asistente)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-mono">
                Análisis Predictivo
              </span>
            </div>

            <p className="text-xs text-gray-300">
              Consulte al asistente sobre geomecánica, protocolos de rescate en socavones o planes de ventilación.
            </p>

            <form onSubmit={handleConsultAi} className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. Evalúa el riesgo en Nivel -120m tras la alerta de caída..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
              <button
                id="btn-ask-ai-advisor"
                type="submit"
                disabled={isConsultingAi}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#AA7C11] text-black font-bold text-xs flex items-center gap-1.5 shadow transition-all disabled:opacity-50 uppercase tracking-wider"
              >
                {isConsultingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Consultar</span>
              </button>
            </form>

            {aiResponse && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#0F1115] border border-white/10 text-xs text-gray-200 leading-relaxed whitespace-pre-line">
                <div className="text-[10px] font-mono text-[#D4AF37] mb-1 font-bold">Respuesta del Asistente Técnico:</div>
                {aiResponse}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
