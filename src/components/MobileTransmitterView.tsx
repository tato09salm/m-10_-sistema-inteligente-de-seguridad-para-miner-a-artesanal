import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Activity, 
  Wifi, 
  Battery, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  RefreshCw,
  Power,
  Flame,
  ArrowLeft
} from 'lucide-react';
import { Worker } from '../types';
import { api } from '../lib/api';

interface MobileTransmitterViewProps {
  worker: Worker;
  onBackToApp?: () => void;
  onWorkerUpdated?: (updated: Worker) => void;
}

export const MobileTransmitterView: React.FC<MobileTransmitterViewProps> = ({
  worker,
  onBackToApp,
  onWorkerUpdated
}) => {
  const [isActive, setIsActive] = useState(false);
  const [motionData, setMotionData] = useState({
    x: 0,
    y: 9.81,
    z: 0.8,
    svm: 9.85,
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [batteryLevel, setBatteryLevel] = useState<number>(90);
  const [lastActivity, setLastActivity] = useState<'actividad_normal' | 'posible_caida' | 'inmovilidad_prolongada'>('actividad_normal');
  const [packetsSent, setPacketsSent] = useState(0);
  const [lastResponseMsg, setLastResponseMsg] = useState<string>('Listo para conectar');
  const [isFallSimulated, setIsFallSimulated] = useState(false);
  const [deviceAssigned, setDeviceAssigned] = useState(Boolean(worker.deviceUuid));

  const motionRef = useRef(motionData);
  motionRef.current = motionData;

  // Battery detection if available in mobile browser
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Ensure worker has a device UUID registered
  useEffect(() => {
    async function ensureDeviceLink() {
      if (!worker.deviceUuid) {
        const generatedUuid = `SMP-MÓVIL-${worker.code.replace('MIN-', '') || '7447'}`;
        try {
          const updated = await api.updateWorker(worker.id, {
            deviceUuid: generatedUuid,
            deviceBattery: batteryLevel,
            status: 'en_socavon' as any,
          });
          setDeviceAssigned(true);
          if (onWorkerUpdated) onWorkerUpdated(updated);
        } catch (err) {
          console.warn('No se pudo actualizar UUID del trabajador en BD:', err);
        }
      }
    }
    ensureDeviceLink();
  }, [worker.id]);

  // Handle mobile sensor permissions and listener
  const startSensors = async () => {
    // iOS Safari 13+ requires explicit user permission
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          alert('Permiso de sensores denegado por el navegador del móvil.');
          return;
        }
      } catch (err) {
        console.warn('Error solicitando permisos DeviceMotion:', err);
      }
    }

    if (!window.DeviceMotionEvent) {
      alert('Este navegador no cuenta con soporte nativo para DeviceMotionEvent. Puedes usar los botones de simulación.');
    }

    setIsActive(true);

    window.addEventListener('devicemotion', (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      const rot = event.rotationRate;
      if (acc) {
        const x = acc.x || 0;
        const y = acc.y || 9.81;
        const z = acc.z || 0;
        const svm = Math.sqrt(x * x + y * y + z * z);

        setMotionData({
          x: parseFloat(x.toFixed(2)),
          y: parseFloat(y.toFixed(2)),
          z: parseFloat(z.toFixed(2)),
          svm: parseFloat(svm.toFixed(2)),
          alpha: parseFloat((rot?.alpha || 0).toFixed(1)),
          beta: parseFloat((rot?.beta || 0).toFixed(1)),
          gamma: parseFloat((rot?.gamma || 0).toFixed(1)),
        });

        // Detect fall automatically from extreme physical motion
        if (svm > 26.0) {
          setLastActivity('posible_caida');
          setIsFallSimulated(true);
          setTimeout(() => {
            setIsFallSimulated(false);
            setLastActivity('actividad_normal');
          }, 4000);
        }
      }
    });
  };

  // Stream loop: Sends reading every 400ms when active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      const cur = motionRef.current;
      try {
        const res = await api.streamTelemetry({
          workerId: worker.id,
          accelX: cur.x,
          accelY: cur.y,
          accelZ: cur.z,
          gyroAlpha: cur.alpha,
          gyroBeta: cur.beta,
          gyroGamma: cur.gamma,
          batteryLevel: batteryLevel,
          signalStrength: -65,
        });

        setPacketsSent((p) => p + 1);
        if (res.newAlert) {
          setLastResponseMsg(`🚨 Alerta disparada: ${res.newAlert.type}`);
        } else {
          setLastResponseMsg(`Transmisión OK • SVM: ${cur.svm} m/s²`);
        }
      } catch (err) {
        setLastResponseMsg('Reconectando con servidor central...');
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isActive, worker.id, batteryLevel]);

  // Simulation helpers
  const triggerSimulatedFall = async () => {
    setIsFallSimulated(true);
    setLastActivity('posible_caida');
    const spikeMotion = { x: 4.5, y: 28.5, z: 12.2, svm: 31.3, alpha: 45, beta: 30, gamma: 20 };
    setMotionData(spikeMotion);

    try {
      const res = await api.streamTelemetry({
        workerId: worker.id,
        accelX: 4.5,
        accelY: 28.5,
        accelZ: 12.2,
        gyroAlpha: 45,
        gyroBeta: 30,
        gyroGamma: 20,
        batteryLevel: batteryLevel,
        signalStrength: -65,
      });
      setPacketsSent((p) => p + 1);
      setLastResponseMsg('💥 Impacto/Caída enviada a la Red Neuronal');
    } catch {}

    setTimeout(() => {
      setIsFallSimulated(false);
      setLastActivity('actividad_normal');
      setMotionData({ x: 0.2, y: 9.81, z: 0.8, svm: 9.85, alpha: 2, beta: 1, gamma: 0 });
    }, 4500);
  };

  const triggerSOS = async () => {
    await triggerSimulatedFall();
    alert(`🚨 ALERTA SOS ENVIADA A CENTRAL DE CONTROL:\nMinero: ${worker.name}\nLabor: ${worker.sector}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-gray-100 flex flex-col justify-between p-4 sm:p-6 font-sans select-none">
      
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 mr-1"
              title="Volver a la consola principal"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="p-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
              M-10 Mobile Sensor Hub
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">Dispositivo Minero Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1A1C22] border border-white/10 text-[11px] font-mono">
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>{batteryLevel}%</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1A1C22] border border-white/10 text-[11px] font-mono">
            <Radio className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
            <span className={isActive ? 'text-emerald-400' : 'text-gray-500'}>
              {isActive ? 'EN VIVO' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>

      {/* Worker Identification Badge */}
      <div className="my-4 p-4 rounded-2xl bg-[#14161D] border border-[#D4AF37]/25 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3.5">
          <img
            src={worker.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
            alt={worker.name}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-[#D4AF37]/40 shadow"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-black/40 border border-[#D4AF37]/30">
                {worker.code}
              </span>
              <span className="text-[10px] font-mono text-gray-400">DNI {worker.dni}</span>
            </div>
            <h2 className="text-base font-bold text-white truncate mt-1">{worker.name}</h2>
            <p className="text-xs text-gray-300 flex items-center gap-1">
              <span>{worker.role}</span> • <span className="text-[#D4AF37] font-semibold">{worker.sector}</span>
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <span>UUID: <strong className="text-[#D4AF37]">{worker.deviceUuid || 'SMP-MÓVIL-7447'}</strong></span>
          <span>Turno: {worker.shift} ({worker.bloodType})</span>
        </div>
      </div>

      {/* Live Motion Gauge / Status Display */}
      <div className={`p-5 rounded-2xl border transition-all space-y-4 text-center ${
        isFallSimulated
          ? 'bg-red-950/40 border-red-500/60 shadow-2xl shadow-red-900/50'
          : isActive
          ? 'bg-[#14161D] border-emerald-500/30'
          : 'bg-[#14161D] border-white/10'
      }`}>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#D4AF37]" /> Magnitud de Aceleración (SVM)
          </span>
          <span className="font-mono text-[10px] text-gray-500">
            {packetsSent} paquetes transmitidos
          </span>
        </div>

        {/* Big SVM Display */}
        <div className="py-2">
          <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tight transition-colors ${
            isFallSimulated ? 'text-red-400 animate-pulse' : motionData.svm > 20 ? 'text-amber-400' : 'text-[#D4AF37]'
          }`}>
            {motionData.svm.toFixed(1)}
            <span className="text-sm font-normal text-gray-400 ml-1">m/s²</span>
          </div>

          <div className="mt-2">
            {isFallSimulated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-bold uppercase tracking-wider animate-bounce">
                <ShieldAlert className="w-4 h-4" /> Posible Caída / Impacto Crítico
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Telemetría Estable (Actividad Normal)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-gray-400 text-xs font-semibold">
                Sensores Apagados
              </span>
            )}
          </div>
        </div>

        {/* 3-Axis Readout Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-500 block">Eje X (Lateral)</span>
            <span className="text-sm font-bold text-gray-200">{motionData.x} m/s²</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-500 block">Eje Y (Vertical)</span>
            <span className="text-sm font-bold text-gray-200">{motionData.y} m/s²</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] text-gray-500 block">Eje Z (Frontal)</span>
            <span className="text-sm font-bold text-gray-200">{motionData.z} m/s²</span>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 font-mono italic">
          {lastResponseMsg}
        </p>
      </div>

      {/* Main Activation & Controls */}
      <div className="space-y-3 pt-3">
        {!isActive ? (
          <button
            onClick={startSensors}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-black font-black text-sm uppercase tracking-wider shadow-xl hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Power className="w-5 h-5" />
            Conectar & Activar Sensores del Móvil
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={triggerSimulatedFall}
              className="py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              Probar Caída
            </button>

            <button
              onClick={triggerSOS}
              className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Botón SOS
            </button>
          </div>
        )}

        <div className="p-3 rounded-xl bg-[#14161D] border border-white/10 text-[11px] text-gray-400 space-y-1">
          <div className="flex items-center gap-1.5 text-gray-300 font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Instrucciones para Probar:</span>
          </div>
          <p>
            1. Al activar, si caminas o sacudes tu teléfono, el acelerómetro enviará los datos directamente a la consola central.
          </p>
          <p>
            2. La red neuronal 1D-CNN clasificará en tiempo real si el movimiento es normal o corresponde a una caída.
          </p>
        </div>
      </div>

    </div>
  );
};
