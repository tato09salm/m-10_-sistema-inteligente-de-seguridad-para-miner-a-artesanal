import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Activity, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ZoomIn,
  RefreshCw
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

interface HistoryViewProps {
  workers: Worker[];
  selectedWorker: Worker;
  onSelectWorker: (worker: Worker) => void;
  telemetryHistory: SensorTelemetry[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  workers,
  selectedWorker,
  onSelectWorker,
  telemetryHistory,
}) => {
  const [filterActivity, setFilterActivity] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const chartData = telemetryHistory.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    svm: item.svm,
    gyroNorm: item.gyroNorm,
    jerk: item.jerk,
    accelX: item.accelX,
    accelY: item.accelY,
    accelZ: item.accelZ,
    activity: item.activityClass,
  }));

  const filteredHistory = telemetryHistory.filter(item => {
    const matchActivity = filterActivity === 'todos' || item.activityClass === filterActivity;
    return matchActivity;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#D4AF37]" />
              Historial de Monitoreo Cinemático & Series de Tiempo
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-mono font-bold">
              Registros en PostgreSQL
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Consulta forense de acelerometría y giroscopía para auditorías de seguridad e investigación de accidentes.
          </p>
        </div>

        {/* Worker Selector */}
        <div className="flex items-center gap-3 bg-[#1A1C22] border border-[#D4AF37]/10 rounded-xl p-2 px-3 self-start sm:self-auto shadow-md">
          <div className="text-[10px] text-gray-400 font-mono">Minero:</div>
          <select
            value={selectedWorker.id}
            onChange={(e) => {
              const found = workers.find(w => w.id === e.target.value);
              if (found) onSelectWorker(found);
            }}
            className="bg-[#0F1115] border border-white/10 text-xs text-[#D4AF37] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#D4AF37] font-semibold"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name} ({w.sector})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Historical Time-series Chart */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D4AF37]" />
              Traza Cinemática Continua (SVM, Giroscopio y Jerk)
            </h2>
            <p className="text-[11px] text-gray-400">Evolución de magnitudes en la ventana de tiempo seleccionada.</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#0F1115] text-gray-300 font-mono border border-white/5">
              {telemetryHistory.length} paquetes registrados
            </span>
          </div>
        </div>

        <div className="h-64 w-full bg-[#0F1115] rounded-xl p-2 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262A35" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} domain={[-5, 45]} />
              <Tooltip contentStyle={{ backgroundColor: '#0F1115', borderColor: '#D4AF37', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
              <Line type="monotone" dataKey="svm" name="SVM (Aceleración Total)" stroke="#D4AF37" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gyroNorm" name="Norma Giroscopio" stroke="#C0C0C0" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="jerk" name="Jerk (Impacto)" stroke="#B87333" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Telemetry Table */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            Tabla de Registros de Telemetría (PostgreSQL sensor_telemetry)
          </h2>

          <div className="flex items-center gap-2">
            <select
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value)}
              className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="todos">Todas las Actividades</option>
              <option value="actividad_normal">Solo Actividad Normal</option>
              <option value="movimiento_inusual">Solo Movimiento Inusual</option>
              <option value="posible_caida">Solo Posibles Caídas</option>
              <option value="inmovilidad_prolongada">Solo Inmovilidad &gt;30s</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase">
                <th className="p-2.5">Fecha / Hora</th>
                <th className="p-2.5">Accel X (m/s²)</th>
                <th className="p-2.5">Accel Y (m/s²)</th>
                <th className="p-2.5">Accel Z (m/s²)</th>
                <th className="p-2.5 text-[#D4AF37]">SVM Total</th>
                <th className="p-2.5 text-silver">Giroscopio</th>
                <th className="p-2.5">Jerk</th>
                <th className="p-2.5">Clasificación IA</th>
                <th className="p-2.5">Nivel Riesgo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px] text-gray-300">
              {filteredHistory.slice().reverse().map((point) => {
                const isFall = point.activityClass === 'posible_caida';
                const isImm = point.activityClass === 'inmovilidad_prolongada';
                const isUnus = point.activityClass === 'movimiento_inusual';

                return (
                  <tr key={point.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-2.5 text-gray-400">{new Date(point.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2.5">{point.accelX.toFixed(2)}</td>
                    <td className="p-2.5">{point.accelY.toFixed(2)}</td>
                    <td className="p-2.5">{point.accelZ.toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-[#D4AF37]">{point.svm.toFixed(2)}</td>
                    <td className="p-2.5 text-silver">{point.gyroNorm.toFixed(1)}°/s</td>
                    <td className="p-2.5">{point.jerk.toFixed(1)}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        isFall ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                        isImm ? 'bg-[#B87333]/20 text-[#FDBA74] border border-[#B87333]/40' :
                        isUnus ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {point.activityClass.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-2.5 uppercase text-[10px] font-bold">
                      <span className={`${
                        point.riskLevel === 'critico' ? 'text-red-400' :
                        point.riskLevel === 'alto' ? 'text-[#FDBA74]' :
                        point.riskLevel === 'medio' ? 'text-[#D4AF37]' : 'text-emerald-400'
                      }`}>
                        {point.riskLevel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
