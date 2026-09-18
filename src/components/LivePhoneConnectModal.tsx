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
  ShieldAlert,
  Globe,
  Sliders,
  Sparkles,
  Zap,
  Battery,
  Clock,
  ExternalLink,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { Worker } from '../types';
import { api } from '../lib/api';

interface LivePhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  selectedWorker?: Worker;
  onStreamTelemetry: (payload: any) => Promise<any>;
  onOpenSimulatorForWorker?: (worker: Worker) => void;
}

interface NetworkIface {
  name: string;
  ip: string;
  isWifi: boolean;
  isRecommended?: boolean;
}

export const LivePhoneConnectModal: React.FC<LivePhoneConnectModalProps> = ({
  isOpen,
  onClose,
  workers,
  selectedWorker,
  onStreamTelemetry,
  onOpenSimulatorForWorker,
}) => {
  // Default to worker MIN-087 if found, otherwise selectedWorker or workers[0]
  const defaultWorker = 
    (selectedWorker) ||
    workers.find(w => w.code === 'MIN-087') ||
    workers[0];

  const [activeWorker, setActiveWorker] = useState<Worker>(defaultWorker);
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkIface[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [customHost, setCustomHost] = useState<string>('');
  const [useCustomHost, setUseCustomHost] = useState<boolean>(false);
  const [port, setPort] = useState<string>(window.location.port || '3000');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isDeviceMotionActive, setIsDeviceMotionActive] = useState(false);
  const [liveMotionData, setLiveMotionData] = useState<{ x: number; y: number; z: number; alpha: number }>({ x: 0, y: 9.81, z: 0, alpha: 0 });

  // Sync with selectedWorker prop when changed
  useEffect(() => {
    if (selectedWorker) {
      setActiveWorker(selectedWorker);
    } else {
      const min087 = workers.find(w => w.code === 'MIN-087');
      if (min087) setActiveWorker(min087);
    }
  }, [selectedWorker, workers]);

  // Fetch local network IP interfaces
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    api.getNetworkInterfaces().then((res) => {
      if (!isMounted) return;
      if (res && res.interfaces && res.interfaces.length > 0) {
        setNetworkInterfaces(res.interfaces);
        // Find recommended (Wi-Fi) interface or fallback
        const recommended = res.interfaces.find(i => i.isRecommended) || res.interfaces[0];
        if (recommended && !selectedHost) {
          setSelectedHost(recommended.ip);
        }
      }
    }).catch(() => {
      // Fallback to window.location.hostname
      if (!selectedHost) setSelectedHost(window.location.hostname || 'localhost');
    });

    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine active host for QR and URL
  const effectiveHost = useCustomHost && customHost.trim()
    ? customHost.trim()
    : selectedHost || window.location.hostname || 'localhost';

  const portStr = port ? `:${port}` : '';
  const mobileUrl = `${window.location.protocol}//${effectiveHost}${portStr}/?mobile=1&workerId=${activeWorker.id}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(mobileUrl)}&color=D4AF37&bgcolor=0A0C10&margin=1`;

  // Check if active worker has received live telemetry recently
  const lastTelemetryDate = activeWorker.lastTelemetryAt ? new Date(activeWorker.lastTelemetryAt) : null;
  const timeDiffSec = lastTelemetryDate ? Math.floor((Date.now() - lastTelemetryDate.getTime()) / 1000) : 999999;
  const isTransmittingLive = timeDiffSec < 35;

  const currentSvm = activeWorker.currentAcceleration?.svm 
    ? activeWorker.currentAcceleration.svm.toFixed(2) 
    : '9.85';
  const currentBattery = activeWorker.deviceBattery ?? 90;
  const currentSignal = activeWorker.signalStrength ?? -65;
  const deviceUuid = activeWorker.deviceUuid || `SMP-MÓVIL-${activeWorker.code.replace('MIN-', '') || '087'}`;

  const copyToClipboard = (text: string, isCurl = false) => {
    navigator.clipboard.writeText(text);
    if (isCurl) {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const curlSnippet = `curl -X POST "${window.location.protocol}//${effectiveHost}${portStr}/api/telemetry/stream" \\
  -H "Content-Type: application/json" \\
  -d '{
    "workerId": "${activeWorker.id}",
    "accelX": 0.20,
    "accelY": 9.81,
    "accelZ": 0.80,
    "gyroAlpha": 10.0,
    "gyroBeta": 12.0,
    "gyroGamma": 5.0,
    "batteryLevel": ${currentBattery},
    "signalStrength": ${currentSignal}
  }'`;

  // Handle local browser DeviceMotionEvent
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

          onStreamTelemetry({
            workerId: activeWorker.id,
            accelX: parseFloat(x.toFixed(2)),
            accelY: parseFloat(y.toFixed(2)),
            accelZ: parseFloat(z.toFixed(2)),
            gyroAlpha: parseFloat(alpha.toFixed(1)),
            batteryLevel: currentBattery,
            signalStrength: currentSignal,
          });
        }
      });
    } else {
      alert('Tu navegador no soporta DeviceMotionEvent.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="metal-card-dark rounded-2xl p-5 sm:p-6 border border-slate-700 max-w-3xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 shadow">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Conexión & Vinculación con Dispositivo Móvil / Smartphone
              </h2>
              <p className="text-[11px] text-slate-400">
                Escanea el código QR desde tu celular o usa los adaptadores de red disponibles para transmitir telemetría en tiempo real.
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

        {/* Worker Selector */}
        <div className="p-3 rounded-xl bg-[#0F1115] border border-[#D4AF37]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 font-bold flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#D4AF37]" /> Minero / Smartphone a Vincular:
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-bold">
              {deviceUuid}
            </span>
          </div>

          <select
            value={activeWorker.id}
            onChange={(e) => {
              const f = workers.find(w => w.id === e.target.value);
              if (f) setActiveWorker(f);
            }}
            className="bg-[#1A1C22] border border-white/10 rounded-lg px-3 py-1.5 text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.deviceUuid || 'Sin UUID'})
              </option>
            ))}
          </select>
        </div>

        {/* Multi-Network Interface Selector (Fixes scanning & IP changes!) */}
        <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-cyan-500/25 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-cyan-400" /> Selección de Red para el Celular (Adaptadores IP Detectados):
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Puerto: <strong className="text-white">{port}</strong>
            </span>
          </div>

          <p className="text-[11px] text-gray-400">
            Tu smartphone y esta PC deben estar en la misma red Wi-Fi o acceder por la IP asignada. Elige la red correspondiente:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {networkInterfaces.map((iface) => {
              const isSelected = !useCustomHost && selectedHost === iface.ip;
              return (
                <button
                  key={iface.ip}
                  type="button"
                  onClick={() => {
                    setSelectedHost(iface.ip);
                    setUseCustomHost(false);
                  }}
                  className={`p-2 rounded-xl text-left border transition-all text-xs cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400'
                      : 'bg-[#14161E] border-white/10 text-gray-300 hover:border-cyan-500/50 hover:bg-[#1A1E29]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate text-[11px] flex items-center gap-1">
                      {iface.isWifi ? <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> : <Radio className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      {iface.name.split(' (')[0]}
                    </span>
                    {iface.isRecommended && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
                        ⭐ Wi-Fi
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[12px] font-bold text-cyan-300 mt-1">
                    {iface.ip}
                  </div>
                </button>
              );
            })}

            {/* Custom IP / Tunnel Button */}
            <button
              type="button"
              onClick={() => setUseCustomHost(true)}
              className={`p-2 rounded-xl text-left border transition-all text-xs cursor-pointer flex flex-col justify-between ${
                useCustomHost
                  ? 'bg-amber-950/40 border-amber-400 text-white ring-1 ring-amber-400'
                  : 'bg-[#14161E] border-white/10 text-gray-300 hover:border-amber-500/50 hover:bg-[#1A1E29]'
              }`}
            >
              <span className="font-semibold text-[11px] flex items-center gap-1 text-amber-300">
                <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Red Manual / Ngrok / Hotspot
              </span>
              <span className="font-mono text-[11px] text-gray-400 mt-1">
                {useCustomHost && customHost ? customHost : 'Ingresar otra IP...'}
              </span>
            </button>
          </div>

          {/* Custom Host & Port Inputs (If custom selected) */}
          {useCustomHost && (
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Ejemplo: 192.168.1.150 o midominio.ngrok-free.app"
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                className="flex-1 bg-[#14161E] border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-400 w-full"
              />
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <span className="text-gray-400 text-xs font-mono">Puerto:</span>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-20 bg-[#14161E] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Real-time Telemetry & Device Status Card */}
        <div className={`p-4 rounded-xl border transition-all ${
          isTransmittingLive 
            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20' 
            : 'bg-[#0F1115] border-white/10'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isTransmittingLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className="text-xs font-bold text-white">
                {isTransmittingLive 
                  ? '🟢 Smartphone Conectado & Transmitiendo en Vivo' 
                  : '🟡 Esperando Transmisión del Dispositivo Móvil'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              {timeDiffSec < 35 
                ? `Actualizado hace ${timeDiffSec}s` 
                : `Último registro: ${lastTelemetryDate ? lastTelemetryDate.toLocaleTimeString() : 'Pendiente'}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 text-xs font-mono">
            <div className="p-2 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Smartphone UUID:</span>
              <span className="text-xs font-bold text-[#D4AF37] truncate block">{deviceUuid}</span>
            </div>

            <div className="p-2 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Cinemática SVM:</span>
              <span className="text-xs font-bold text-emerald-400">{currentSvm} m/s²</span>
            </div>

            <div className="p-2 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Batería Móvil:</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <Battery className="w-3.5 h-3.5 text-emerald-400" /> {currentBattery}%
              </span>
            </div>

            <div className="p-2 rounded-lg bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-400 block font-sans">Señal RF:</span>
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" /> {currentSignal} dBm
              </span>
            </div>
          </div>

          {/* Direct shortcut to simulation */}
          {onOpenSimulatorForWorker && (
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onOpenSimulatorForWorker(activeWorker);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-black font-bold text-xs flex items-center gap-1.5 shadow hover:opacity-90 transition-all cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                Ejecutar Simulación con estos Datos
              </button>
            </div>
          )}
        </div>

        {/* QR Code & Direct Mobile Link Box */}
        <div className="p-4 rounded-xl bg-[#0F1115] border border-[#D4AF37]/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2 text-xs">
              <QrCode className="w-4 h-4 text-[#D4AF37]" />
              Escanear con la Cámara del Smartphone:
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
              IP: {effectiveHost}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="p-2.5 rounded-2xl bg-[#0A0C10] border border-[#D4AF37]/40 shadow-xl shrink-0">
              <img
                src={qrImgUrl}
                alt="Código QR para conectar smartphone móvil"
                className="w-40 h-40 rounded-lg object-contain bg-black"
              />
              <span className="block text-[9px] text-center text-gray-400 font-mono mt-1">
                Apunta con la cámara
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300 flex-1 w-full">
              <p className="leading-relaxed">
                Apunta la cámara de tu smartphone para abrir directamente la <strong className="text-white">Consola de Transmisión del Minero</strong> ({activeWorker.name} - {activeWorker.code}).
              </p>

              <div className="p-2.5 rounded-lg bg-[#1A1C22] border border-white/10 font-mono text-[11px] flex items-center justify-between gap-2 overflow-hidden">
                <span className="truncate text-amber-200">{mobileUrl}</span>
                <button
                  onClick={() => copyToClipboard(mobileUrl)}
                  className="px-2.5 py-1 rounded bg-[#D4AF37] hover:bg-amber-400 text-black font-bold text-[10px] shrink-0 flex items-center gap-1 cursor-pointer transition-all"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3" />}
                  {copiedLink ? 'Copiado' : 'Copiar Link'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`/?mobile=1&workerId=${activeWorker.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/30 text-[11px] font-semibold transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Abrir Transmisor Móvil en Pestaña de Prueba
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: REST API cURL */}
        <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-200 flex items-center gap-2 text-xs">
              <Code2 className="w-4 h-4 text-[#D4AF37]" />
              Envío Manual vía cURL / Terminal:
            </h3>
            <button
              onClick={() => copyToClipboard(curlSnippet, true)}
              className="text-[10px] px-2.5 py-1 rounded bg-[#1A1C22] hover:bg-white/10 text-gray-300 flex items-center gap-1 font-mono cursor-pointer transition-colors"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCurl ? 'Copiado' : 'Copiar cURL'}
            </button>
          </div>

          <pre className="p-2.5 rounded-lg bg-[#0A0C10] border border-white/5 text-[11px] font-mono text-amber-200/90 overflow-x-auto">
            {curlSnippet}
          </pre>
        </div>

      </div>
    </div>
  );
};
