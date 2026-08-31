import React, { useState } from 'react';
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
  Zap 
} from 'lucide-react';
import { Worker } from '../types';
import { PRESET_ACTIVITIES, calculateSVM, calculateGyroNorm } from '../lib/mlEngine';

interface SmartphoneSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  onStreamTelemetry: (payload: any) => Promise<any>;
}

export const SmartphoneSimulatorModal: React.FC<SmartphoneSimulatorModalProps> = ({
  isOpen,
  onClose,
  workers,
  onStreamTelemetry,
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(workers[0]?.id || 'w-1');
  const [accelX, setAccelX] = useState<number>(0.8);
  const [accelY, setAccelY] = useState<number>(9.81);
  const [accelZ, setAccelZ] = useState<number>(1.2);
  const [gyroAlpha, setGyroAlpha] = useState<number>(15);
  const [gyroBeta, setGyroBeta] = useState<number>(20);
  const [gyroGamma, setGyroGamma] = useState<number>(10);
  const [immobilitySec, setImmobilitySec] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  if (!isOpen) return null;

  const currentSvm = calculateSVM(accelX, accelY, accelZ);
  const currentGyroNorm = calculateGyroNorm(gyroAlpha, gyroBeta, gyroGamma);

  const handleApplyPreset = (preset: typeof PRESET_ACTIVITIES[0]) => {
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
      });
      setLastResponse(res);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="metal-card-dark rounded-2xl p-6 border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Simulador de Sensores de Smartphone (Acelerómetro + Giroscopio)
              </h2>
              <p className="text-[11px] text-slate-400">
                Emulador cinemático para probar la detección de riesgos en tiempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Worker Destination Selector */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-amber-400" /> Minero Destino del Sensor:
          </span>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.sector})
              </option>
            ))}
          </select>
        </div>

        {/* Preset Hazard Scenarios */}
        <div>
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-2 flex items-center justify-between">
            <span>Escenarios Mineros Predefinidos:</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_ACTIVITIES.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className="p-2.5 rounded-xl border bg-slate-950/80 border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 text-left transition-all group"
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

        {/* Custom Sliders */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" /> Calibración Manual de Sensores
            </span>
            <span className="font-mono text-amber-400 font-bold">
              SVM Total: {currentSvm.toFixed(2)} m/s² (~{(currentSvm / 9.81).toFixed(2)}g)
            </span>
          </div>

          {/* Accel Y (Gravity & Impact) */}
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Accel Y (Longitudinal / Impacto):</span>
              <span className="font-mono text-amber-400 font-bold">{accelY.toFixed(2)} m/s²</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.2"
              value={accelY}
              onChange={(e) => setAccelY(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Accel X & Z */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Accel X (Lateral):</span>
                <span className="font-mono text-cyan-400">{accelX.toFixed(2)} m/s²</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.2"
                value={accelX}
                onChange={(e) => setAccelX(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Accel Z (Profundidad):</span>
                <span className="font-mono text-purple-400">{accelZ.toFixed(2)} m/s²</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.2"
                value={accelZ}
                onChange={(e) => setAccelZ(parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          </div>

          {/* Gyroscope & Immobility */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Giroscopio (Yaw α):</span>
                <span className="font-mono text-orange-400">{gyroAlpha.toFixed(0)} °/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                step="5"
                value={gyroAlpha}
                onChange={(e) => setGyroAlpha(parseFloat(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Inmovilidad Sostenida:</span>
                <span className="font-mono text-red-400">{immobilitySec}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={immobilitySec}
                onChange={(e) => setImmobilitySec(parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>
          </div>
        </div>

        {/* Live Response & Transmit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {lastResponse && (
            <div className="text-[11px] text-slate-300 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                IA Clasificó: <strong className="text-amber-400 font-sans uppercase">{lastResponse.aiClassification?.activity.replace('_', ' ')}</strong> ({(lastResponse.aiClassification?.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          )}

          <button
            id="btn-transmit-telemetry-sim"
            onClick={handleTransmit}
            disabled={isSending}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-xs transition-all ml-auto"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Transmitiendo...' : 'Transmitir Paquete a API M-10'}
          </button>
        </div>

      </div>
    </div>
  );
};
