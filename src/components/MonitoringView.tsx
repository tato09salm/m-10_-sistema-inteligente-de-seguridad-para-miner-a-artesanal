import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Smartphone, 
  Radio, 
  AlertTriangle, 
  Play, 
  Square, 
  RotateCcw, 
  Flame, 
  Clock, 
  Compass, 
  Gauge, 
  Zap, 
  TrendingUp, 
  CheckCircle2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Worker, SensorTelemetry, ActivityType } from '../types';
import { PRESET_ACTIVITIES } from '../lib/mlEngine';

interface MonitoringViewProps {
  workers: Worker[];
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
  telemetryHistory: SensorTelemetry[];
  onStreamCustomTelemetry: (payload: any) => Promise<any>;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  workers,
  selectedWorker,
  onSelectWorker,
  telemetryHistory,
  onStreamCustomTelemetry,
}) => {
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [activePreset, setActivePreset] = useState<string>('normal');
  const [customAccelX, setCustomAccelX] = useState<number>(0.8);
  const [customAccelY, setCustomAccelY] = useState<number>(9.81);
  const [customAccelZ, setCustomAccelZ] = useState<number>(1.2);
  const [immobilitySec, setImmobilitySec] = useState<number>(0);

  // Latest telemetry snapshot
  const latest = telemetryHistory[telemetryHistory.length - 1] || {
    accelX: selectedWorker.currentAcceleration?.x ?? 0.5,
    accelY: selectedWorker.currentAcceleration?.y ?? 9.81,
    accelZ: selectedWorker.currentAcceleration?.z ?? 1.2,
    svm: selectedWorker.currentAcceleration?.svm ?? 9.9,
    gyroAlpha: selectedWorker.currentGyroscope?.alpha ?? 12,
    gyroBeta: selectedWorker.currentGyroscope?.beta ?? 15,
    gyroGamma: selectedWorker.currentGyroscope?.gamma ?? 8,
    gyroNorm: 20,
    jerk: 3.2,
    activityClass: selectedWorker.lastActivity ?? 'actividad_normal',
    confidence: 0.94,
    riskLevel: selectedWorker.riskLevel ?? 'bajo',
  };

  // Formatted chart data
  const chartData = telemetryHistory.map((item, idx) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    accelX: item.accelX,
    accelY: item.accelY,
    accelZ: item.accelZ,
    svm: item.svm,
    gyroAlpha: item.gyroAlpha,
    gyroBeta: item.gyroBeta,
    gyroGamma: item.gyroGamma,
  }));

  // Trigger simulated preset hazard
  const handleApplyPreset = async (presetId: string) => {
    setActivePreset(presetId);
    const preset = PRESET_ACTIVITIES.find(p => p.id === presetId);
    if (!preset) return;

    setCustomAccelX(preset.readings.accelX);
    setCustomAccelY(preset.readings.accelY);
    setCustomAccelZ(preset.readings.accelZ);
    setImmobilitySec(preset.readings.immobilityTimerSec);

    await onStreamCustomTelemetry({
      workerId: selectedWorker.id,
      accelX: preset.readings.accelX,
      accelY: preset.readings.accelY,
      accelZ: preset.readings.accelZ,
      gyroAlpha: preset.readings.gyroAlpha,
      gyroBeta: preset.readings.gyroBeta,
      gyroGamma: preset.readings.gyroGamma,
      immobilitySec: preset.readings.immobilityTimerSec,
      batteryLevel: selectedWorker.deviceBattery,
    });
  };

  // Auto-pulse slight ambient noise if live streaming
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      // Small sensor drift to simulate live artisanal miner work
      const noise = (Math.random() - 0.5) * 0.4;
      const gyroNoise = (Math.random() - 0.5) * 4;

      onStreamCustomTelemetry({
        workerId: selectedWorker.id,
        accelX: parseFloat((customAccelX + noise).toFixed(2)),
        accelY: parseFloat((customAccelY + noise * 0.8).toFixed(2)),
        accelZ: parseFloat((customAccelZ + noise * 0.5).toFixed(2)),
        gyroAlpha: Math.max(0, (latest.gyroAlpha || 15) + gyroNoise),
        gyroBeta: Math.max(0, (latest.gyroBeta || 20) + gyroNoise),
        gyroGamma: Math.max(0, (latest.gyroGamma || 10) + gyroNoise),
        immobilitySec: immobilitySec,
        batteryLevel: selectedWorker.deviceBattery,
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveStreaming, selectedWorker.id, customAccelX, customAccelY, customAccelZ, immobilitySec]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Worker Selector */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 lg:p-6 border border-[#D4AF37]/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#D4AF37]" />
              Estación de Monitoreo Cinemático & Telemetría
            </h1>
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Osciloscopio digital multieje de aceleración (Acelerómetro) y velocidad angular (Giroscopio) emitidos desde el smartphone.
          </p>
        </div>

        {/* Worker Selector Dropdown */}
        <div className="flex items-center gap-3 bg-[#0F1115] border border-white/5 rounded-xl p-2 px-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-mono">Minero Monitoreado:</div>
            <div className="text-xs font-bold text-white">{selectedWorker.name}</div>
          </div>

          <select
            id="select-active-worker-monitor"
            value={selectedWorker.id}
            onChange={(e) => {
              const found = workers.find(w => w.id === e.target.value);
              if (found) onSelectWorker(found);
            }}
            className="bg-[#1A1C22] border border-[#D4AF37]/30 text-xs text-[#D4AF37] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#D4AF37] font-semibold"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.sector})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Status Card & Kinematic Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Status Indicator */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-xl ${
          selectedWorker.status === 'peligro' 
            ? 'bg-red-500/10 border-red-500/30' 
            : selectedWorker.status === 'advertencia' 
            ? 'bg-[#B87333]/15 border-[#B87333]/40' 
            : 'bg-[#1A1C22] border-[#D4AF37]/10'
        }`}>
          <div className={`p-2.5 rounded-lg ${
            selectedWorker.status === 'peligro' ? 'bg-red-500 text-white animate-pulse' :
            selectedWorker.status === 'advertencia' ? 'bg-[#B87333] text-white' :
            'bg-[#D4AF37] text-black font-bold'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Estado Cinemático</div>
            <div className="text-sm font-bold capitalize text-white">{selectedWorker.status}</div>
            <div className="text-[10px] text-[#D4AF37] font-mono">
              Actividad: {latest.activityClass.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Acceleration Magnitude (SVM) */}
        <div className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Magnitud (SVM)</span>
            <Gauge className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {latest.svm.toFixed(2)} <span className="text-xs text-[#D4AF37]">m/s²</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1 font-mono">
            Equivalente: ~{(latest.svm / 9.81).toFixed(2)}g
          </div>
        </div>

        {/* Gyroscope Angular Rate Norm */}
        <div className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Norma Giroscópica</span>
            <Compass className="w-4 h-4 text-silver" />
          </div>
          <div className="text-2xl font-bold font-mono text-silver">
            {(latest.gyroNorm || 18.4).toFixed(1)} <span className="text-xs text-gray-400">°/s</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            Rotación 3D en tiempo real
          </div>
        </div>

        {/* Shock Jerk Index */}
        <div className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Índice Jerk (Tirón)</span>
            <Zap className="w-4 h-4 text-[#B87333]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FDBA74]">
            {(latest.jerk || 2.4).toFixed(1)} <span className="text-xs text-[#B87333]">m/s³</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            Tasa cambio de aceleración
          </div>
        </div>

      </div>

      {/* Main Oscilloscope Waveform Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Real-time Accelerometer & Gyroscope Oscilloscope Graphs */}
        <div className="lg:col-span-2 bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-6">
          
          {/* Chart 1: Accelerometer (Ax, Ay, Az, SVM) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#D4AF37]" />
                  Osciloscopio Acelerométrico Tridimensional (m/s²)
                </h3>
                <p className="text-[10px] text-gray-400">Ejes X (lateral), Y (longitudinal gravedad), Z (profundidad) y Magnitud Total SVM.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 font-mono font-bold">
                  Umbral Caída: &gt;26.0 m/s²
                </span>
              </div>
            </div>

            <div className="h-56 w-full bg-[#0F1115] rounded-xl p-2 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2229" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[-5, 45]} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1C22', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Line type="monotone" dataKey="accelX" name="Accel X" stroke="#38bdf8" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="accelY" name="Accel Y" stroke="#4ade80" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="accelZ" name="Accel Z" stroke="#c084fc" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="svm" name="SVM Magnitud" stroke="#D4AF37" dot={false} strokeWidth={2.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Gyroscope (Alpha, Beta, Gamma) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-silver" />
                  Velocidad Angular del Giroscopio (°/s)
                </h3>
                <p className="text-[10px] text-gray-400">Rotación angular en grados por segundo (Roll, Pitch, Yaw).</p>
              </div>
            </div>

            <div className="h-44 w-full bg-[#0F1115] rounded-xl p-2 border border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2229" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} domain={[-20, 380]} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1C22', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Line type="monotone" dataKey="gyroAlpha" name="Yaw (α)" stroke="#D4AF37" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gyroBeta" name="Pitch (β)" stroke="#B87333" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gyroGamma" name="Roll (γ)" stroke="#C0C0C0" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right 1 Col: 3D/2D Smartphone Orientation Visualizer & Hazard Presets */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl flex flex-col justify-between space-y-4">
          
          {/* Smartphone 3D Tilt Visualizer Card */}
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-[#D4AF37]" />
              Orientación e Inclinación del Smartphone
            </h3>

            {/* Simulated 3D smartphone frame */}
            <div className="w-full h-44 rounded-xl bg-[#0F1115] border border-white/5 flex items-center justify-center relative overflow-hidden">
              <div 
                className="w-24 h-40 bg-[#1A1C22] border-2 border-[#D4AF37]/80 rounded-2xl p-2 shadow-2xl transition-transform duration-300 relative flex flex-col justify-between items-center"
                style={{
                  transform: `rotateZ(${(latest.gyroAlpha || 0) % 45}deg) rotateX(${Math.min(45, Math.max(-45, (latest.accelX * 3)))}deg) rotateY(${Math.min(45, Math.max(-45, (latest.accelZ * 3)))}deg)`,
                }}
              >
                {/* Smartphone speaker notch */}
                <div className="w-8 h-1 bg-gray-700 rounded-full" />

                {/* Smartphone screen info */}
                <div className="text-center">
                  <div className="text-[9px] font-mono text-[#D4AF37]">M-10 SENSOR</div>
                  <div className="text-[11px] font-bold text-white mt-1">
                    {latest.svm.toFixed(1)} m/s²
                  </div>
                  <div className="text-[8px] text-gray-400">
                    {latest.activityClass.replace('_', ' ')}
                  </div>
                </div>

                {/* Smartphone home bar */}
                <div className="w-6 h-1 bg-gray-700 rounded-full" />
              </div>

              <div className="absolute bottom-2 left-2 text-[10px] font-mono text-gray-500">
                Roll: {latest.gyroGamma?.toFixed(0)}° • Pitch: {latest.gyroBeta?.toFixed(0)}°
              </div>
            </div>
          </div>

          {/* Mining Hazard Scenario Presets */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
              <span>Simular Escenarios de Riesgo Minero:</span>
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {PRESET_ACTIVITIES.map((preset) => (
                <button
                  key={preset.id}
                  id={`btn-preset-${preset.id}`}
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    activePreset === preset.id
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white shadow-sm'
                      : 'bg-[#0F1115] border-white/5 text-gray-300 hover:border-[#D4AF37]/40'
                  }`}
                >
                  <div className="font-semibold leading-tight">{preset.name.split('/')[0]}</div>
                  <div className={`text-[9px] font-mono mt-0.5 ${
                    preset.expectedActivity === 'posible_caida' ? 'text-red-400 font-bold' :
                    preset.expectedActivity === 'inmovilidad_prolongada' ? 'text-[#B87333] font-bold' :
                    preset.expectedActivity === 'movimiento_inusual' ? 'text-[#D4AF37]' : 'text-emerald-400'
                  }`}>
                    {preset.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stream pause/resume */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isLiveStreaming
                  ? 'bg-[#0F1115] text-gray-300 hover:bg-[#1F2229] border border-white/5'
                  : 'bg-[#D4AF37] text-black font-bold hover:bg-[#AA7C11]'
              }`}
            >
              {isLiveStreaming ? <Square className="w-3.5 h-3.5 text-[#D4AF37]" /> : <Play className="w-3.5 h-3.5" />}
              {isLiveStreaming ? 'Pausar Telemetría' : 'Reanudar En Vivo'}
            </button>

            <span className="text-[10px] text-gray-500 font-mono">
              50 Hz (20ms/paquete)
            </span>
          </div>

        </div>

      </div>

    </div>
  );
};
