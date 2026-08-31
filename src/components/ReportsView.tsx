import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  Users, 
  ShieldAlert, 
  FileSpreadsheet, 
  FileJson, 
  Clock, 
  TrendingDown, 
  TrendingUp,
  HardHat,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  LineChart, 
  Line 
} from 'recharts';
import { Worker, Alert } from '../types';

interface ReportsViewProps {
  workers: Worker[];
  alerts: Alert[];
}

const SECTOR_INCIDENT_STATS = [
  { sector: 'Socavón Principal', normal: 48, inusual: 4, caidas: 0, inmovilidad: 1 },
  { sector: 'Nivel -50m', normal: 38, inusual: 6, caidas: 0, inmovilidad: 1 },
  { sector: 'Galería Norte', normal: 29, inusual: 8, caidas: 1, inmovilidad: 2 },
  { sector: 'Chimenea 3', normal: 22, inusual: 7, caidas: 0, inmovilidad: 0 },
  { sector: 'Nivel -120m', normal: 31, inusual: 11, caidas: 2, inmovilidad: 1 },
  { sector: 'Frente de Extracción', normal: 25, inusual: 5, caidas: 0, inmovilidad: 0 },
];

const WEEKLY_TREND = [
  { day: 'Lun', alerts: 4, falls: 0, immobility: 1 },
  { day: 'Mar', alerts: 6, falls: 1, immobility: 0 },
  { day: 'Mié', alerts: 3, falls: 0, immobility: 0 },
  { day: 'Jue', alerts: 8, falls: 1, immobility: 2 },
  { day: 'Vie', alerts: 5, falls: 0, immobility: 1 },
  { day: 'Sáb', alerts: 7, falls: 1, immobility: 1 },
  { day: 'Dom', alerts: 2, falls: 0, immobility: 0 },
];

export const ReportsView: React.FC<ReportsViewProps> = ({ workers, alerts }) => {
  const [dateRange, setDateRange] = useState<'hoy' | 'semana' | 'mes'>('semana');
  const [selectedShift, setSelectedShift] = useState<string>('todos');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('todos');

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['ID_Alerta', 'Fecha_Hora', 'Codigo_Minero', 'Nombre_Minero', 'Socavon_Sector', 'Prioridad', 'Tipo_Actividad', 'Estado', 'SVM_ms2', 'Atendido_Por'];
    const rows = alerts.map(a => [
      a.id,
      `"${a.timestamp}"`,
      `"${a.workerCode}"`,
      `"${a.workerName}"`,
      `"${a.sector}"`,
      `"${a.priority}"`,
      `"${a.activityType}"`,
      `"${a.status}"`,
      a.metrics.svm,
      `"${a.attendedBy || 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `M10_Reporte_Seguridad_Minera_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const data = {
      system: 'M-10: Sistema Inteligente de Seguridad para Minería Artesanal',
      exportedAt: new Date().toISOString(),
      reportRange: dateRange,
      totalMonitoredWorkers: workers.length,
      alertsHistory: alerts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `M10_Auditoria_Minera_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#D4AF37]" />
              Reportes & Estadísticas de Seguridad Ocupacional Minera
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-mono font-bold">
              ISO 45001 / DS 024-2016-EM
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Análisis consolidado de tasas de accidentabilidad, índices de frecuencia cinemática y reportes exportables.
          </p>
        </div>

        {/* Export Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F1115] border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5 shadow uppercase tracking-wider"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Descargar CSV
          </button>

          <button
            id="btn-export-json"
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white transition-all flex items-center gap-1.5 uppercase tracking-wider"
          >
            <FileJson className="w-4 h-4 text-silver" />
            JSON Data
          </button>

          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] hover:bg-[#AA7C11] text-black transition-all flex items-center gap-1.5 shadow-md uppercase tracking-wider"
          >
            <Printer className="w-4 h-4" />
            Imprimir Informe
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#1A1C22] rounded-xl p-4 border border-[#D4AF37]/10 shadow-xl flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold">Período:</span>
          {(['hoy', 'semana', 'mes'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                dateRange === range
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'bg-[#0F1115] text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              {range === 'hoy' ? 'Hoy (Turno)' : range === 'semana' ? 'Esta Semana' : 'Este Mes'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Shift */}
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Turnos (Mañana / Tarde / Noche)</option>
            <option value="Mañana">Turno Mañana</option>
            <option value="Tarde">Turno Tarde</option>
            <option value="Noche">Turno Noche</option>
          </select>

          {/* Worker Filter */}
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Mineros</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/20 shadow-xl">
          <div className="text-xs text-[#D4AF37] font-semibold mb-1">Horas-Hombre Monitoreadas</div>
          <div className="text-2xl font-bold font-mono text-white">1,480 hrs</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> 100% Cobertura Digital
          </div>
        </div>

        <div className="bg-[#1A1C22] p-4 rounded-xl border border-[#B87333]/20 shadow-xl">
          <div className="text-xs text-[#B87333] font-semibold mb-1">Total Alertas Generadas</div>
          <div className="text-2xl font-bold font-mono text-white">{alerts.length}</div>
          <div className="text-[10px] text-gray-400 mt-1">
            {alerts.filter(a => a.status === 'resuelta').length} resueltas por brigada
          </div>
        </div>

        <div className="bg-[#1A1C22] p-4 rounded-xl border border-white/10 shadow-xl">
          <div className="text-xs text-silver font-semibold mb-1">Tasa de Falsos Positivos IA</div>
          <div className="text-2xl font-bold font-mono text-white">0.72%</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> Alta especificidad
          </div>
        </div>

        <div className="bg-[#1A1C22] p-4 rounded-xl border border-white/5 shadow-xl">
          <div className="text-xs text-gray-400 font-semibold mb-1">Tiempo Promedio de Respuesta</div>
          <div className="text-2xl font-bold font-mono text-[#D4AF37]">2.4 min</div>
          <div className="text-[10px] text-gray-500 mt-1">
            Desde detección hasta contacto radial
          </div>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Incidents by Mining Sector */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <HardHat className="w-4 h-4 text-[#D4AF37]" />
            Distribución de Eventos por Socavón / Sector
          </h2>
          <p className="text-[11px] text-gray-400 mb-4">
            Comparativo de actividad normal vs. movimientos anómalos y caídas por galería.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SECTOR_INCIDENT_STATS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262A35" />
                <XAxis dataKey="sector" stroke="#64748b" fontSize={9} interval={0} angle={-15} textAnchor="end" height={45} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F1115', borderColor: '#D4AF37', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="inusual" name="Mov. Inusual" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="caidas" name="Caídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inmovilidad" name="Inmovilidad" fill="#B87333" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Weekly Trend */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-silver" />
            Tendencia de Incidentes en los Últimos 7 Días
          </h2>
          <p className="text-[11px] text-gray-400 mb-4">
            Evolución diaria de alertas y correlación de caídas e inmovilidad prolongada.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={WEEKLY_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262A35" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0F1115', borderColor: '#D4AF37', borderRadius: '8px', fontSize: '11px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="alerts" name="Total Alertas" stroke="#D4AF37" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="falls" name="Caídas Detectadas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="immobility" name="Inmovilidad &gt;30s" stroke="#B87333" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
