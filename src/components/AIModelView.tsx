import React, { useState, useEffect } from 'react';
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
  Bot,
  Database,
  Layers,
  Award,
  Zap,
  HardDrive
} from 'lucide-react';
import { classifySensorStream } from '../lib/mlEngine';
import { api } from '../lib/api';
import { Worker, AIClassificationResult } from '../types';

interface AIModelViewProps {
  workers: Worker[];
  selectedWorker: Worker;
}

interface ModelBenchmark {
  model_id: string;
  description: string;
  h5_file: string;
  file_size_kb: number;
  training_time_seconds: number;
  epochs_trained: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    latency_ms: number;
    confusion_matrix: number[][];
    classification_report: Record<string, any>;
  };
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

  // Benchmarked models from backend
  const [modelsReport, setModelsReport] = useState<any>(null);
  const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);
  const [loadingReport, setLoadingReport] = useState<boolean>(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.getAiModelsReport();
        if (res && res.all_models) {
          setModelsReport(res);
        }
      } catch (err) {
        console.error("Error cargando reporte de modelos:", err);
      } finally {
        setLoadingReport(false);
      }
    };
    fetchReport();
  }, []);

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
      setAiResponse(`Error al conectar con el Asesor IA: ${err.message}`);
    } finally {
      setIsConsultingAi(false);
    }
  };

  const selectedModelData: ModelBenchmark | null = 
    modelsReport?.all_models?.[selectedModelIndex] || null;

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-[#1A1C22] rounded-2xl p-6 border border-[#D4AF37]/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" /> SisFall Dataset Benchmark & Keras .H5
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ● Modelo Activo: Puro_1D_CNN.h5
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-[#D4AF37]" />
              Modelos de Inteligencia Artificial & Clasificación Cinemática
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              Comparativa de 5 modelos de Deep Learning entrenados con acelerometría y giroscopía (SisFall) para detección de caídas e inmovilidad en minería subterránea.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#0F1115] border border-white/10 rounded-xl px-4 py-2.5 text-right">
              <div className="text-[10px] font-mono text-gray-400">Latencia en Producción</div>
              <div className="text-lg font-bold font-mono text-emerald-400">0.23 ms</div>
            </div>
            <div className="bg-[#0F1115] border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-right">
              <div className="text-[10px] font-mono text-[#D4AF37]">F1-Score Test</div>
              <div className="text-lg font-bold font-mono text-[#D4AF37]">100.0%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Models Comparative Benchmark Tabs */}
      {modelsReport?.all_models && (
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/15 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Comparativa de los 5 Modelos Entrenados (.h5)
              </h2>
            </div>
            <span className="text-xs font-mono text-gray-400">
              Dataset SisFall • 20,064 Ventanas Temporales • 8 Canales
            </span>
          </div>

          {/* Model Selection Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {modelsReport.all_models.map((m: ModelBenchmark, idx: number) => {
              const isSelected = selectedModelIndex === idx;
              const isWinner = m.model_id === modelsReport.best_model?.model_id;

              return (
                <button
                  key={m.model_id}
                  onClick={() => setSelectedModelIndex(idx)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10'
                      : 'bg-[#0F1115] border-white/10 hover:border-white/20'
                  }`}
                >
                  {isWinner && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#D4AF37] text-black">
                      SELECCIONADO
                    </span>
                  )}
                  <div className="text-xs font-bold text-white mb-1 truncate pr-14">
                    {m.description.split(':')[1]?.trim() || m.model_id}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-400">Acc: <strong className="text-emerald-400">{m.metrics.accuracy}%</strong></span>
                    <span className="text-gray-400">Lat: <strong className="text-[#D4AF37]">{m.metrics.latency_ms}ms</strong></span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-1">
                    {m.h5_file} ({m.file_size_kb} KB)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Model Deep Dive Card */}
          {selectedModelData && (
            <div className="bg-[#0F1115] rounded-xl p-4 border border-white/10 grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Architecture & File Info */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide">
                  <Layers className="w-4 h-4" /> Especificaciones del Modelo
                </div>
                <div className="text-sm font-bold text-white">{selectedModelData.description}</div>
                <div className="text-xs text-gray-400 space-y-1 font-mono">
                  <div>Archivo: <span className="text-gray-200">{selectedModelData.h5_file}</span></div>
                  <div>Tamaño en Disco: <span className="text-[#D4AF37]">{selectedModelData.file_size_kb} KB</span></div>
                  <div>Tiempo de Entrenamiento: <span className="text-gray-200">{selectedModelData.training_time_seconds}s ({selectedModelData.epochs_trained} épocas)</span></div>
                  <div>Latencia por Muestra: <span className="text-emerald-400">{selectedModelData.metrics.latency_ms} ms</span></div>
                </div>
              </div>

              {/* Classification Report */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Métricas por Clase (Test Set)
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {Object.entries(selectedModelData.metrics.classification_report)
                    .filter(([key]) => ['actividad_normal', 'posible_caida', 'inmovilidad_prolongada'].includes(key))
                    .map(([cls, scores]: [string, any]) => (
                      <div key={cls} className="bg-[#1A1C22] p-1.5 rounded flex items-center justify-between">
                        <span className="text-gray-300 capitalize">{cls.replace('_', ' ')}:</span>
                        <span className="text-[#D4AF37] font-bold">F1: {(scores['f1-score'] * 100).toFixed(1)}%</span>
                        <span className="text-gray-400">Rec: {(scores['recall'] * 100).toFixed(1)}%</span>
                        <span className="text-gray-500 text-[10px]">(N={scores['support']})</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Confusion Matrix */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <Cpu className="w-4 h-4 text-silver" /> Matriz de Confusión (3,010 Muestras)
                </div>
                <div className="bg-[#1A1C22] p-2 rounded text-center">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className="text-[10px] text-gray-500 border-b border-white/10">
                        <th className="p-1 text-left">Real \ Pred</th>
                        <th className="p-1 text-emerald-400">Normal</th>
                        <th className="p-1 text-red-400">Caída</th>
                        <th className="p-1 text-[#FDBA74]">Inmóvil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedModelData.metrics.confusion_matrix.map((row: number[], rIdx: number) => {
                        const labels = ['Normal', 'Caída', 'Inmóvil'];
                        return (
                          <tr key={rIdx}>
                            <td className="p-1 text-left text-gray-400">{labels[rIdx]}</td>
                            {row.map((val: number, cIdx: number) => (
                              <td key={cIdx} className={`p-1 font-bold ${rIdx === cIdx ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-600'}`}>
                                {val}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Main Grid: Live Sensor Simulator & Safety Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Col: Interactive Live Feature Tester */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/15 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Simulador Cinemático de Sensores en Vivo
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
              Inferencias en Tiempo Real
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Ajuste los valores de aceleración triaxial, giroscopio y tiempo de inmovilidad para probar la respuesta inmediata del modelo neuronal y el motor cinemático.
          </p>

          <div className="space-y-4 text-xs">
            {/* Accel Sliders */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>Accel X:</span>
                  <span className="font-mono text-[#D4AF37] font-bold">{testAccelX.toFixed(1)} m/s²</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={testAccelX}
                  onChange={(e) => setTestAccelX(parseFloat(e.target.value))}
                  className="w-full accent-[#D4AF37]"
                />
              </div>

              <div>
                <div className="flex justify-between text-gray-300 mb-1">
                  <span>Accel Y (Gravedad):</span>
                  <span className="font-mono text-emerald-400 font-bold">{testAccelY.toFixed(1)} m/s²</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="35"
                  step="0.5"
                  value={testAccelY}
                  onChange={(e) => setTestAccelY(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
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

        {/* Right Col: AI Mining Safety Copilot */}
        <div className="space-y-6">
          
          {/* Gemini AI Subterranean Mining Advisor */}
          <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-[#D4AF37] flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#D4AF37]" />
                Copiloto Experto en Seguridad Minera (IA Asistente)
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-mono">
                Análisis Geomecánico & Rescate
              </span>
            </div>

            <p className="text-xs text-gray-300">
              Consulte al copiloto inteligente sobre protocolos de emergencia, ventilación de socavones o análisis de riesgos para el trabajador seleccionado (<strong>{selectedWorker.name}</strong> en <strong>{selectedWorker.sector}</strong>).
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
              <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/10 text-xs text-gray-200 leading-relaxed whitespace-pre-line">
                <div className="text-[10px] font-mono text-[#D4AF37] mb-1 font-bold">Respuesta del Asistente Técnico:</div>
                {aiResponse}
              </div>
            )}
          </div>

          {/* Key Metric Highlights Card */}
          <div className="bg-[#1A1C22] rounded-2xl p-5 border border-white/10 shadow-xl grid grid-cols-2 gap-3">
            <div className="bg-[#0F1115] p-3 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono text-gray-400">Total Ventanas Evaluadas</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">3,010 Test</div>
            </div>
            <div className="bg-[#0F1115] p-3 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono text-gray-400">Canales de Sensores</div>
              <div className="text-base font-bold font-mono text-[#D4AF37] mt-0.5">8 Canales</div>
            </div>
            <div className="bg-[#0F1115] p-3 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono text-gray-400">Frecuencia de Muestreo</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">50 Hz (~2.56s)</div>
            </div>
            <div className="bg-[#0F1115] p-3 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono text-gray-400">Framework ML</div>
              <div className="text-base font-bold font-mono text-silver mt-0.5">TensorFlow / Keras</div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
