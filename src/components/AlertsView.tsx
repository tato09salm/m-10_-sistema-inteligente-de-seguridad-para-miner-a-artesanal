import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  Clock, 
  Activity, 
  CheckCircle2, 
  ShieldAlert, 
  Filter, 
  Search, 
  UserCheck, 
  Radio, 
  Volume2, 
  ArrowRight,
  FileText,
  HeartPulse
} from 'lucide-react';
import { Alert, AlertPriority, AlertStatus, Worker } from '../types';

interface AlertsViewProps {
  alerts: Alert[];
  workers: Worker[];
  onUpdateAlert: (id: string, data: { status?: AlertStatus; attendedBy?: string; resolutionNotes?: string }) => Promise<void>;
  onPlaySiren: (priority: 'critica' | 'alta' | 'media') => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  workers,
  onUpdateAlert,
  onPlaySiren,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPriority, setFilterPriority] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Attendance / Resolution Modal State
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<Alert | null>(null);
  const [actionType, setActionType] = useState<'attend' | 'resolve'>('attend');
  const [attendedByName, setAttendedByName] = useState('Supervisor Rodrigo Valenzuela');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    const matchSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.workerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.sector.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'todos' || a.status === filterStatus;
    const matchPriority = filterPriority === 'todos' || a.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleOpenActionModal = (alert: Alert, type: 'attend' | 'resolve') => {
    setSelectedAlertForAction(alert);
    setActionType(type);
    setAttendedByName(alert.attendedBy || 'Supervisor Rodrigo Valenzuela');
    setResolutionNotes(alert.resolutionNotes || (type === 'resolve' ? 'Trabajador evaluado en puesto de socorro. Sin lesiones graves. Reanudando labor.' : ''));
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForAction) return;

    setIsSubmitting(true);
    try {
      if (actionType === 'attend') {
        await onUpdateAlert(selectedAlertForAction.id, {
          status: 'en_atencion',
          attendedBy: attendedByName,
          resolutionNotes: resolutionNotes || 'Brigada de auxilio despachada al socavón.',
        });
      } else {
        await onUpdateAlert(selectedAlertForAction.id, {
          status: 'resuelta',
          attendedBy: attendedByName,
          resolutionNotes: resolutionNotes || 'Incidente resuelto y verificado.',
        });
      }
      setSelectedAlertForAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#B87333]" />
              Gestión Integral de Alertas de Seguridad Minera
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-mono font-bold">
              {alerts.filter(a => a.status === 'activa').length} Activas
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Registro cronológico de incidentes cinemáticos, protocolos de rescate y trazabilidad de atención.
          </p>
        </div>

        {/* Siren Sound Test Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => onPlaySiren('critica')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1.5 shadow uppercase tracking-wider"
          >
            <Volume2 className="w-3.5 h-3.5 text-red-400" />
            Probar Sirena
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#1A1C22] rounded-xl p-4 border border-[#D4AF37]/10 shadow-xl flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por minero, código, socavón..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F1115] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Estados (Activas, En Atención, Resueltas)</option>
            <option value="activa">Solo Activas (Pendientes)</option>
            <option value="en_atencion">En Atención / Brigada</option>
            <option value="resuelta">Resueltas</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todas las Prioridades</option>
            <option value="critica">Prioridad Crítica (Caídas)</option>
            <option value="alta">Prioridad Alta (Inmovilidad)</option>
            <option value="media">Prioridad Media (Sacudidas)</option>
            <option value="baja">Prioridad Baja</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed List */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const isCrit = alert.priority === 'critica';
          const isHigh = alert.priority === 'alta';
          const isResolved = alert.status === 'resuelta';
          const isInProgress = alert.status === 'en_atencion';

          return (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl ${
                isResolved
                  ? 'bg-[#1A1C22]/60 border-white/5 opacity-75'
                  : isCrit
                  ? 'bg-red-500/10 border-red-500/30'
                  : isHigh
                  ? 'bg-[#B87333]/15 border-[#B87333]/40'
                  : 'bg-[#1A1C22] border-[#D4AF37]/10'
              }`}
            >
              <div className="flex items-start gap-3.5">
                {/* Icon */}
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  isResolved
                    ? 'bg-white/10 text-gray-400'
                    : isCrit
                    ? 'bg-red-500 text-white animate-pulse'
                    : isHigh
                    ? 'bg-[#B87333] text-white'
                    : 'bg-[#D4AF37] text-black font-bold'
                }`}>
                  {isResolved ? <CheckCircle2 className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                    
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isCrit ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                      isHigh ? 'bg-[#B87333]/20 text-[#FDBA74] border border-[#B87333]/40' :
                      'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                    }`}>
                      {alert.priority}
                    </span>

                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      isResolved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                      isInProgress ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' :
                      'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}>
                      Estado: {alert.status === 'activa' ? 'Pendiente' : alert.status === 'en_atencion' ? 'En Atención' : 'Resuelta'}
                    </span>

                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {alert.description}
                  </p>

                  {/* Incident details & metrics */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-1 flex-wrap">
                    <span>Minero: <strong className="text-white">{alert.workerName}</strong> ({alert.workerCode})</span>
                    <span>•</span>
                    <span>Ubicación: <strong className="text-[#D4AF37]">{alert.sector}</strong></span>
                    <span>•</span>
                    <span className="font-mono text-[#D4AF37]">SVM: {alert.metrics.svm} m/s²</span>
                    {alert.metrics.jerk > 0 && <span className="font-mono text-[#B87333]">• Jerk: {alert.metrics.jerk} m/s³</span>}
                    {alert.metrics.immobilitySec && <span className="font-mono text-orange-400">• Inmovilidad: {alert.metrics.immobilitySec}s</span>}
                  </div>

                  {/* Resolution Notes preview if any */}
                  {alert.resolutionNotes && (
                    <div className="mt-2 p-2 rounded-lg bg-[#0F1115] border border-white/5 text-[11px] text-gray-300 flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gray-400 font-semibold">{alert.attendedBy || 'Supervisor'}: </span>
                        <span>{alert.resolutionNotes}</span>
                        {alert.resolvedAt && (
                          <span className="text-[10px] text-gray-500 block font-mono">
                            Resuelto: {new Date(alert.resolvedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {alert.status === 'activa' && (
                  <button
                    id={`btn-attend-${alert.id}`}
                    onClick={() => handleOpenActionModal(alert, 'attend')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] hover:bg-[#AA7C11] text-black shadow-md flex items-center gap-1.5 transition-all uppercase tracking-wider"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Atender Alerta
                  </button>
                )}

                {alert.status === 'en_atencion' && (
                  <button
                    id={`btn-resolve-${alert.id}`}
                    onClick={() => handleOpenActionModal(alert, 'resolve')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 transition-all uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar Resuelta
                  </button>
                )}

                {alert.status === 'resuelta' && (
                  <button
                    onClick={() => handleOpenActionModal(alert, 'resolve')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white"
                  >
                    Editar Notas
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Attend or Resolve Alert */}
      {selectedAlertForAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C22] rounded-2xl p-6 border border-[#D4AF37]/20 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#D4AF37]" />
                {actionType === 'attend' ? 'Atención de Alerta & Despacho de Brigada' : 'Cierre y Resolución de Incidente'}
              </h2>
              <button
                onClick={() => setSelectedAlertForAction(null)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#0F1115] border border-white/5 text-xs space-y-1">
              <div className="font-bold text-white">{selectedAlertForAction.title}</div>
              <div className="text-gray-400">
                Minero: <strong className="text-white">{selectedAlertForAction.workerName}</strong> en <strong className="text-[#D4AF37]">{selectedAlertForAction.sector}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmAction} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Responsable de Atención / Supervisor:</label>
                <input
                  type="text"
                  required
                  value={attendedByName}
                  onChange={(e) => setAttendedByName(e.target.value)}
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-semibold">
                  {actionType === 'attend' ? 'Instrucciones & Acciones Inmediatas:' : 'Informe de Resolución & Estado del Minero:'}
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describa las acciones tomadas en el socavón..."
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedAlertForAction(null)}
                  className="px-4 py-2 rounded-lg bg-[#0F1115] hover:bg-[#1F2229] text-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg font-bold shadow-md uppercase tracking-wider text-xs ${
                    actionType === 'attend'
                      ? 'bg-[#D4AF37] hover:bg-[#AA7C11] text-black'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  }`}
                >
                  {actionType === 'attend' ? 'Confirmar Atención' : 'Finalizar y Marcar Resuelta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
