import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Activity, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Sliders, 
  Sparkles, 
  Code2, 
  Radio, 
  Zap,
  Battery,
  Wifi,
  RefreshCw,
  Eye,
  ShieldAlert,
  ArrowDownToLine
} from 'lucide-react';
import { Worker } from '../types';
import { PRESET_ACTIVITIES, calculateSVM, calculateGyroNorm } from '../lib/mlEngine';

interface SmartphoneSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  selectedWorkerId?: string;
  onStreamTelemetry: (payload: any) => Promise<any>;
}

export const SmartphoneSimulatorModal: React.FC<SmartphoneSimulatorModalProps> = ({
  isOpen,
  onClose,
  workers,
  selectedWorkerId: initialSelectedWorkerId,
  onStreamTelemetry,
}) => {
  // Find default worker: initialSelectedWorkerId, or MIN-087, or workers[0]
  const defaultWorker = 
    workers.find(w => w.id === initialSelectedWorkerId) ||
    workers.find(w => w.code === 'MIN-087') ||
    workers[0];

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(defaultWorker?.id || 'w-1');
  const activeWorker = workers.find(w => w.id === selectedWorkerId) || workers[0];

  const [accelX, setAccelX] = useState<number>(0.2);
  const [accelY, setAccelY] = useState<number>(9.81);
  const [accelZ, setAccelZ] = useState<number>(0.8);
  const [gyroAlpha, setGyroAlpha] = useState<number>(10);
  const [gyroBeta, setGyroBeta] = useState<number>(12);
  const [gyroGamma, setGyroGamma] = useState<number>(5);
  const [immobilitySec, setImmobilitySec] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(90);
  const [signalStrength, setSignalStrength] = useState<number>(-65);
  
  const [isLiveMirrorActive, setIsLiveMirrorActive] = useState<boolean>(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Sync state if selectedWorkerId changes from outside
  useEffect(() => {
    if (initialSelectedWorkerId) {
      setSelectedWorkerId(initialSelectedWorkerId);
    }
  }, [initialSelectedWorkerId]);

  // Live Mirroring: If enabled, sync with activeWorker's latest telemetry in real time
  useEffect(() => {
    if (!isLiveMirrorActive || !activeWorker) return;

    if (activeWorker.currentAcceleration) {
      setAccelX(activeWorker.currentAcceleration.x ?? 0.2);
      setAccelY(activeWorker.currentAcceleration.y ?? 9.81);
      setAccelZ(activeWorker.currentAcceleration.z ?? 0.8);
    }
    if (activeWorker.currentGyroscope) {
      setGyroAlpha(activeWorker.currentGyroscope.alpha ?? 10);
      setGyroBeta(activeWorker.currentGyroscope.beta ?? 12);
      setGyroGamma(activeWorker.currentGyroscope.gamma ?? 5);
    }
    if (activeWorker.deviceBattery !== undefined) {
      setBatteryLevel(activeWorker.deviceBattery);
    }
    if (activeWorker.signalStrength !== undefined) {
      setSignalStrength(activeWorker.signalStrength);
    }
  }, [isLiveMirrorActive, activeWorker?.lastTelemetryAt, activeWorker?.currentAcceleration, activeWorker?.currentGyroscope]);

  if (!isOpen) return null;

  const currentSvm = calculateSVM(accelX, accelY, accelZ);
  const currentGyroNorm = calculateGyroNorm(gyroAlpha, gyroBeta, gyroGamma);

  // Helper to load last real data from mobile connection
  const handleLoadLastMobileData = () => {
    if (!activeWorker) return;
    if (activeWorker.currentAcceleration) {
      setAccelX(Number(activeWorker.currentAcceleration.x.toFixed(2)));
      setAccelY(Number(activeWorker.currentAcceleration.y.toFixed(2)));
      setAccelZ(Number(activeWorker.currentAcceleration.z.toFixed(2)));
    } else {
      setAccelX(0.2);
      setAccelY(9.81);
      setAccelZ(0.8);
    }

    if (activeWorker.currentGyroscope) {
      setGyroAlpha(Math.round(activeWorker.currentGyroscope.alpha));
      setGyroBeta(Math.round(activeWorker.currentGyroscope.beta));
      setGyroGamma(Math.round(activeWorker.currentGyroscope.gamma));
    }

    if (activeWorker.deviceBattery !== undefined) {
      setBatteryLevel(activeWorker.deviceBattery);
    }
    if (activeWorker.signalStrength !== undefined) {
      setSignalStrength(activeWorker.signalStrength);
    }

    setSyncFeedback('¡Datos cinemáticos del smartphone cargados en el simulador!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleApplyPreset = (preset: typeof PRESET_ACTIVITIES[0]) => {
    setIsLiveMirrorActive(false);
    setAccelX(preset.readings.accelX);
    setAccelY(preset.readings.accelY);
    setAccelZ(preset.readings.accelZ);
    setGyroAlpha(preset.readings.gyroAlpha);
    setGyroBeta(preset.readings.gyroBeta);
    setGyroGamma(preset.readings.gyroGamma);
    setImmobilitySec(preset.readings.immobilityTimerSec);
  };

  const handleTransmit = async () => {
    setIsSending(true);
    try {
      const res = await onStreamTelemetry({
        workerId: selectedWorkerId,
        accelX,
        accelY,
        accelZ,
        gyroAlpha,
        gyroBeta,
        gyroGamma,
        immobilitySec,
        batteryLevel,
        signalStrength,
      });
      setLastResponse(res);
    } finally {
      setIsSending(false);
    }
  };

  const lastDate = activeWorker?.lastTelemetryAt ? new Date(activeWorker.lastTelemetryAt) : null;
  const isRecent = lastDate && (Date.now() - lastDate.getTime()) < 35000;
  const deviceUuid = activeWorker?.deviceUuid || `SMP-MÓVIL-${activeWorker?.code.replace('MIN-', '') || '087'}`;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="metal-card-dark rounded-2xl p-5 sm:p-6 border border-slate-700 max-w-3xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Simulador Cinemático de Sensores & Sincronización en Tiempo Real
              </h2>
              <p className="text-[11px] text-slate-400">
                Prueba de algoritmos de detección de caídas 1D-CNN sincronizados con smartphones reales.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold p-1"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Worker Destination Selector & Device Banner */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300 font-bold">Minero / Smartphone Objetivo:</span>
          </div>
          <select
            value={selectedWorkerId}
            onChange={(e) => {
              setSelectedWorkerId(e.target.value);
              setIsLiveMirrorActive(false);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.deviceUuid || 'SMP-MÓVIL'})
              </option>
            ))}
          </select>
        </div>

        {/* Live Smartphone Connection Card (The requested telemetry block!) */}
        <div className="p-4 rounded-xl bg-[#0B0D12] border border-[#D4AF37]/35 space-y-3 shadow-lg relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isRecent ? 'bg-emerald-400 animate-ping' : 'bg-[#D4AF37]'}`} />
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                Smartphone: <span className="text-[#D4AF37] font-mono">{deviceUuid}</span>
              </span>
              {isRecent && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
                  Transmitiendo en Vivo
                </span>
              )}
            </div>

            {/* Toggle Live Mirror Mode */}
            <button
              type="button"
              onClick={() => setIsLiveMirrorActive(!isLiveMirrorActive)}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLiveMirrorActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLiveMirrorActive ? 'animate-spin' : ''}`} />
              {isLiveMirrorActive ? 'Modo Espejo Activo (En Vivo)' : 'Activar Modo Espejo en Tiempo Real'}
            </button>
          </div>

          {/* Telemetry Readout Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#14161E] border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Cinemática Actual:</span>
              <span className="text-xs font-bold text-emerald-400">
                SVM: {activeWorker?.currentAcceleration?.svm ? `${activeWorker.currentAcceleration.svm.toFixed(2)} m/s²` : '9.85 m/s²'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#14161E] border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Nivel de Batería:</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                {activeWorker?.deviceBattery ?? 90}% Batería
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#14161E] border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Intensidad de Señal:</span>
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                {activeWorker?.signalStrength ?? -65} dBm
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#14161E] border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Último Registro:</span>
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {lastDate ? lastDate.toLocaleTimeString() : '16:36:50'}
              </span>
            </div>
          </div>

          {/* Sync Button */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleLoadLastMobileData}
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Cargar estos Datos del Móvil al Simulador
            </button>

            {syncFeedback && (
              <span className="text-xs text-emerald-400 font-semibold animate-pulse flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {syncFeedback}
              </span>
            )}
          </div>
        </div>

        {/* Preset Hazard Scenarios & Baseline */}
        <div>
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-2 flex items-center justify-between">
            <span>Escenarios Mineros & Línea Base:</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Quick Baseline SMP-MOVIL-087 button */}
            <button
              onClick={() => {
                setIsLiveMirrorActive(false);
                setAccelX(0.2);
                setAccelY(9.81);
                setAccelZ(0.8);
                setGyroAlpha(10);
                setGyroBeta(12);
                setGyroGamma(5);
                setBatteryLevel(90);
                setSignalStrength(-65);
                setImmobilitySec(0);
              }}
              className="p-2.5 rounded-xl border bg-amber-950/30 border-[#D4AF37]/50 hover:border-amber-400 text-left transition-all group cursor-pointer"
            >
              <div className="text-xs font-bold text-[#D4AF37] group-hover:text-amber-200 leading-tight">
                📱 SMP-MÓVIL-087
              </div>
              <div className="text-[10px] font-mono mt-1 text-emerald-400 font-semibold">
                SVM 9.85 m/s² (Normal)
              </div>
            </button>

            {PRESET_ACTIVITIES.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className="p-2.5 rounded-xl border bg-slate-950/80 border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 text-left transition-all group cursor-pointer"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300 leading-tight">
                  {preset.name}
                </div>
                <div className={`text-[10px] font-mono mt-1 font-semibold ${
                  preset.expectedActivity === 'posible_caida' ? 'text-red-400' :
                  preset.expectedActivity === 'inmovilidad_prolongada' ? 'text-orange-400' :
                  preset.expectedActivity === 'movimiento_inusual' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {preset.category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Sliders & Sensor Controls */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5 text-xs">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" /> Calibración Manual de Sensores Cinemáticos
            </span>
            <span className="font-mono text-amber-400 font-bold text-sm">
              SVM: {currentSvm.toFixed(2)} m/s² (~{(currentSvm / 9.81).toFixed(2)}g)
            </span>
          </div>

          {/* Accel Y (Gravity & Impact) */}
          <div>
            <div className="flex justify-between text-slate-400 mb-1 font-mono">
              <span>Accel Y (Longitudinal / Impacto Vertical):</span>
              <span className="text-amber-400 font-bold">{accelY.toFixed(2)} m/s²</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.1"
              value={accelY}
              disabled={isLiveMirrorActive}
              onChange={(e) => setAccelY(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Accel X & Z */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono">
                <span>Accel X (Lateral):</span>
                <span className="text-cyan-400 font-bold">{accelX.toFixed(2)} m/s²</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.1"
                value={accelX}
                disabled={isLiveMirrorActive}
                onChange={(e) => setAccelX(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono">
                <span>Accel Z (Frontal / Caída):</span>
                <span className="text-purple-400 font-bold">{accelZ.toFixed(2)} m/s²</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.1"
                value={accelZ}
                disabled={isLiveMirrorActive}
                onChange={(e) => setAccelZ(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          {/* Gyroscope, Battery & Immobility */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono">
                <span>Giroscopio (Yaw α):</span>
                <span className="text-orange-400 font-bold">{gyroAlpha.toFixed(0)} °/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                step="5"
                value={gyroAlpha}
                disabled={isLiveMirrorActive}
                onChange={(e) => setGyroAlpha(parseFloat(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono">
                <span>Inmovilidad:</span>
                <span className="text-red-400 font-bold">{immobilitySec}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={immobilitySec}
                disabled={isLiveMirrorActive}
                onChange={(e) => setImmobilitySec(parseInt(e.target.value))}
                className="w-full accent-red-500 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono">
                <span>Batería:</span>
                <span className="text-emerald-400 font-bold">{batteryLevel}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={batteryLevel}
                disabled={isLiveMirrorActive}
                onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Live Response & Transmit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {lastResponse && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Inferencia 1D-CNN: <strong className="text-amber-400 font-sans uppercase font-bold">{lastResponse.aiClassification?.activity.replace('_', ' ')}</strong> 
                {' '}({(lastResponse.aiClassification?.confidence * 100).toFixed(0)}% certeza)
              </span>
            </div>
          )}

          <button
            id="btn-transmit-telemetry-sim"
            onClick={handleTransmit}
            disabled={isSending}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] hover:brightness-110 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-xs transition-all ml-auto cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Transmitiendo a IA...' : 'Ejecutar Simulación con estos Datos'}
          </button>
        </div>

      </div>
    </div>
  );
};
