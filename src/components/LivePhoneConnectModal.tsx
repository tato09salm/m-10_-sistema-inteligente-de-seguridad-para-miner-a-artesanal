import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Smartphone, 
  Wifi, 
  Code2, 
  Copy, 
  Check, 
  Activity, 
  Radio, 
  ShieldAlert 
} from 'lucide-react';
import { Worker } from '../types';

interface LivePhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  selectedWorker?: Worker;
  onStreamTelemetry: (payload: any) => Promise<any>;
}

export const LivePhoneConnectModal: React.FC<LivePhoneConnectModalProps> = ({
  isOpen,
  onClose,
  workers,
  selectedWorker = workers[0],
  onStreamTelemetry,
}) => {
  const [activeWorker, setActiveWorker] = useState<Worker>(selectedWorker || workers[0]);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isDeviceMotionActive, setIsDeviceMotionActive] = useState(false);
  const [liveMotionData, setLiveMotionData] = useState<{ x: number; y: number; z: number; alpha: number }>({ x: 0, y: 9.81, z: 0, alpha: 0 });

  useEffect(() => {
    if (selectedWorker) setActiveWorker(selectedWorker);
  }, [selectedWorker]);

  // Handle Browser DeviceMotionEvent (for testing on real phone web browser)
  const handleEnableDeviceMotion = async () => {
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          alert('Permiso de sensores no otorgado en este navegador.');
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    }

    if (window.DeviceMotionEvent) {
      setIsDeviceMotionActive(true);
      window.addEventListener('devicemotion', (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        const rot = event.rotationRate;
        if (acc) {
          const x = acc.x || 0;
          const y = acc.y || 9.81;
          const z = acc.z || 0;
          const alpha = rot?.alpha || 0;
          setLiveMotionData({ x, y, z, alpha });

          // Send to API
          onStreamTelemetry({
            workerId: activeWorker.id,
            accelX: parseFloat(x.toFixed(2)),
            accelY: parseFloat(y.toFixed(2)),
            accelZ: parseFloat(z.toFixed(2)),
            gyroAlpha: parseFloat(alpha.toFixed(1)),
            batteryLevel: 90,
          });
        }
      });
    } else {
      alert('Tu navegador no soporta DeviceMotionEvent.');
    }
  };

  if (!isOpen) return null;

  const curlSnippet = `curl -X POST "${window.location.origin}/api/telemetry/stream" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workerId": "${activeWorker.id}",
    "accelX": 1.25,
    "accelY": 9.81,
    "accelZ": 0.45,
    "gyroAlpha": 14.2,
    "gyroBeta": 18.0,
    "gyroGamma": 8.5,
    "batteryLevel": 88
  }'`;

  const pythonSnippet = `import requests, time

API_URL = "${window.location.origin}/api/telemetry/stream"

# Telemetría de Smartphone en Mina Subterránea
payload = {
    "workerId": "${activeWorker.id}",
    "accelX": 0.82,
    "accelY": 9.81,
    "accelZ": 1.10,
    "gyroAlpha": 12.0,
    "batteryLevel": 92
}

res = requests.post(API_URL, json=payload)
print("Respuesta IA M-10:", res.json())`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="metal-card-dark rounded-2xl p-6 border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Conexión de Smartphone Móvil Real & API REST
              </h2>
              <p className="text-[11px] text-slate-400">
                Vinculación de la app móvil mediante Web Accelerometer o endpoints REST.
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

        {/* Worker Selector */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-400" /> Minero a Vincular:
          </span>
          <select
            value={activeWorker.id}
            onChange={(e) => {
              const f = workers.find(w => w.id === e.target.value);
              if (f) setActiveWorker(f);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.deviceUuid})
              </option>
            ))}
          </select>
        </div>

        {/* Option 1: Browser Live Sensor Test */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Opción 1: Transmisión Directa desde Navegador Móvil
            </h3>
            {isDeviceMotionActive && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono animate-pulse">
                Sensores Activos
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Si abre este enlace en su smartphone personal, puede activar los sensores nativos del teléfono para enviar caídas y movimientos en tiempo real.
          </p>

          {!isDeviceMotionActive ? (
            <button
              onClick={handleEnableDeviceMotion}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow"
            >
              <Activity className="w-4 h-4" />
              Activar Sensores de este Dispositivo
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300 space-y-1">
              <div>Ax: {liveMotionData.x.toFixed(2)} m/s² | Ay: {liveMotionData.y.toFixed(2)} m/s² | Az: {liveMotionData.z.toFixed(2)} m/s²</div>
              <div className="text-emerald-400 font-semibold">¡Mueva o sacuda el teléfono para disparar la IA!</div>
            </div>
          )}
        </div>

        {/* Option 2: REST API cURL & Python Integration */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              Opción 2: Endpoint REST (FastAPI / Android / Python Client)
            </h3>
            <button
              onClick={() => copyToClipboard(curlSnippet)}
              className="text-[10px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-mono"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCurl ? 'Copiado' : 'Copiar cURL'}
            </button>
          </div>

          <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300/90 overflow-x-auto">
            {curlSnippet}
          </pre>
        </div>

      </div>
    </div>
  );
};
