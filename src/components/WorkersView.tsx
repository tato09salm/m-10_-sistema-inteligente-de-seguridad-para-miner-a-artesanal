import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Smartphone, 
  Battery, 
  BatteryMedium, 
  BatteryLow, 
  Wifi, 
  AlertTriangle, 
  Activity, 
  QrCode, 
  Edit, 
  Trash2, 
  ShieldAlert, 
  Phone, 
  Heart, 
  MapPin, 
  Clock, 
  Sparkles,
  ExternalLink,
  Plus,
  Check,
  X,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Worker, MiningSector, RiskLevel, WorkerStatus, MineTunnel } from '../types';

interface WorkersViewProps {
  workers: Worker[];
  tunnels?: MineTunnel[];
  onSelectWorkerForMonitoring?: (worker: Worker) => void;
  onNavigateToMonitoring?: (worker: Worker) => void;
  onSelectWorker?: (worker: Worker) => void;
  onCreateWorker?: (data: Partial<Worker>) => Promise<void>;
  onUpdateWorker?: (id: string, data: Partial<Worker>) => Promise<void>;
  onSaveWorker?: (data: Partial<Worker>) => Promise<void>;
  onDeleteWorker?: (id: string) => Promise<void>;
  onOpenPairingModal?: (worker: Worker) => void;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  workers,
  tunnels = [],
  onSelectWorkerForMonitoring,
  onNavigateToMonitoring,
  onSelectWorker,
  onCreateWorker,
  onUpdateWorker,
  onSaveWorker,
  onDeleteWorker,
  onOpenPairingModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedRisk, setSelectedRisk] = useState<string>('todos');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackToast({ msg, type });
    setTimeout(() => setFeedbackToast(null), 3800);
  };

  // Dynamic sectors list: Combine standard default mining sectors with all active socavones from DB
  const availableSectors = useMemo(() => {
    const defaultSectors = [
      'Socavón Principal',
      'Nivel -50m',
      'Nivel -120m',
      'Galería Norte',
      'Chimenea 3',
      'Frente de Extracción',
    ];
    if (!tunnels || tunnels.length === 0) return defaultSectors;
    const tunnelNames = tunnels.map((t) => t.name.trim()).filter(Boolean);
    return Array.from(new Set([...defaultSectors, ...tunnelNames]));
  }, [tunnels]);

  const handleSelectWorkerForLiveMonitoring = (worker: Worker) => {
    if (onNavigateToMonitoring) {
      onNavigateToMonitoring(worker);
    } else if (onSelectWorkerForMonitoring) {
      onSelectWorkerForMonitoring(worker);
    } else if (onSelectWorker) {
      onSelectWorker(worker);
    }
  };

  const handleOpenPairing = (worker: Worker) => {
    if (onOpenPairingModal) {
      onOpenPairingModal(worker);
    } else if (onSelectWorker) {
      onSelectWorker(worker);
    }
  };

  const handleDelete = async (worker: Worker) => {
    if (!window.confirm(`¿Estás seguro de dar de baja y retirar de la base de datos al minero "${worker.name}" (${worker.code})?`)) {
      return;
    }
    try {
      if (onDeleteWorker) {
        await onDeleteWorker(worker.id);
        showToast(`Minero "${worker.name}" eliminado de la base de datos.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar trabajador.', 'error');
    }
  };

  // Form State - Solo Datos del Trabajador
  const [formData, setFormData] = useState({
    name: '',
    dni: '',
    age: 32,
    role: 'Perforista de Veta Aurífera',
    sector: 'Nivel -120m',
    shift: 'Mañana' as 'Mañana' | 'Tarde' | 'Noche',
    status: 'normal' as WorkerStatus,
    riskLevel: 'bajo' as RiskLevel,
    bloodType: 'O+',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRel: 'Esposa',
  });

  const filteredWorkers = workers.filter((w) => {
    const matchSearch =
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.dni.includes(searchTerm) ||
      w.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.sector.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSector = selectedSector === 'todos' || w.sector === selectedSector;
    const matchStatus = selectedStatus === 'todos' || w.status === selectedStatus;
    const matchRisk = selectedRisk === 'todos' || w.riskLevel === selectedRisk;
    return matchSearch && matchSector && matchStatus && matchRisk;
  });

  const handleOpenCreate = () => {
    setEditingWorker(null);
    setFormData({
      name: '',
      dni: '',
      age: 30,
      role: 'Perforista de Veta Aurífera',
      sector: availableSectors[0] || 'Socavón Principal',
      shift: 'Mañana',
      status: 'normal',
      riskLevel: 'bajo',
      bloodType: 'O+',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRel: 'Esposa',
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name,
      dni: worker.dni,
      age: worker.age,
      role: worker.role,
      sector: worker.sector,
      shift: worker.shift,
      status: worker.status || 'normal',
      riskLevel: worker.riskLevel || 'bajo',
      bloodType: worker.bloodType || 'O+',
      emergencyContactName: worker.emergencyContact?.name || '',
      emergencyContactPhone: worker.emergencyContact?.phone || '',
      emergencyContactRel: worker.emergencyContact?.relationship || 'Familiar',
    });
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Por favor ingrese el nombre del trabajador.', 'error');
      return;
    }
    if (!formData.dni.trim()) {
      showToast('Por favor ingrese el DNI del trabajador.', 'error');
      return;
    }

    setIsSaving(true);
    const payload: Partial<Worker> = {
      name: formData.name.trim(),
      dni: formData.dni.trim(),
      age: Number(formData.age) || 30,
      role: formData.role.trim(),
      sector: formData.sector as any,
      shift: formData.shift,
      status: formData.status,
      riskLevel: formData.riskLevel,
      bloodType: formData.bloodType.trim(),
      emergencyContact: {
        name: formData.emergencyContactName.trim() || 'Contacto Familiar',
        phone: formData.emergencyContactPhone.trim() || '+51 900 000 000',
        relationship: formData.emergencyContactRel.trim() || 'Familiar',
      },
    };

    try {
      if (editingWorker) {
        if (onUpdateWorker) {
          await onUpdateWorker(editingWorker.id, payload);
        } else if (onSaveWorker) {
          await onSaveWorker({ ...payload, id: editingWorker.id });
        }
        showToast(`Ficha del minero "${formData.name}" actualizada con éxito en PostgreSQL.`, 'success');
      } else {
        if (onCreateWorker) {
          await onCreateWorker(payload);
        } else if (onSaveWorker) {
          await onSaveWorker(payload);
        }
        showToast(`Minero "${formData.name}" registrado exitosamente en PostgreSQL.`, 'success');
      }
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error('Error guardando minero:', err);
      showToast(err.message || 'Error al guardar el trabajador en la base de datos.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#D4AF37]" />
              Padrón & Gestión de Trabajadores Mineros
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1A1C22] border border-[#D4AF37]/20 text-[#D4AF37] font-mono">
              {workers.length} Registrados
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Administración del personal de socavón, smartphones asignados, estado cinemático y contactos de emergencia.
          </p>
        </div>

        <button
          id="btn-register-worker"
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] hover:bg-[#AA7C11] text-black shadow-lg shadow-[#D4AF37]/10 flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto uppercase tracking-wider"
        >
          <UserPlus className="w-4 h-4" />
          Registrar Minero
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-[#1A1C22] rounded-xl p-4 border border-[#D4AF37]/10 shadow-xl flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, código MIN, DNI o labor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F1115] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Sector Filter */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Socavones / Sectores</option>
            {availableSectors.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Estados</option>
            <option value="normal">Normal (Operando)</option>
            <option value="advertencia">Advertencia</option>
            <option value="peligro">Peligro Crítico</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-[#0F1115] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="todos">Todos los Riesgos</option>
            <option value="bajo">Riesgo Bajo</option>
            <option value="medio">Riesgo Medio</option>
            <option value="alto">Riesgo Alto</option>
            <option value="critico">Riesgo Crítico</option>
          </select>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkers.map((worker) => {
          const isDanger = worker.status === 'peligro';
          const isWarning = worker.status === 'advertencia';
          const hasDevice = Boolean(worker.deviceUuid && worker.deviceUuid.trim() !== '' && worker.deviceUuid !== 'Sin vincular');

          return (
            <div
              key={worker.id}
              className={`rounded-2xl p-5 border transition-all relative flex flex-col justify-between shadow-xl ${
                isDanger
                  ? 'bg-red-500/10 border-red-500/30'
                  : isWarning
                  ? 'bg-[#B87333]/15 border-[#B87333]/30'
                  : 'bg-[#1A1C22] border-[#D4AF37]/10 hover:border-[#D4AF37]/30'
              }`}
            >
              <div>
                {/* Top Row: Avatar, Code, Risk Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={worker.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt={worker.name}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#D4AF37]">{worker.code}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0F1115] text-gray-400 font-mono">
                          DNI {worker.dni}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-tight mt-0.5">{worker.name}</h3>
                      <p className="text-[11px] text-gray-400">{worker.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                        worker.riskLevel === 'critico'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : worker.riskLevel === 'alto'
                          ? 'bg-[#B87333]/20 text-[#FDBA74] border border-[#B87333]/40'
                          : worker.riskLevel === 'medio'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                      }`}
                    >
                      Riesgo {worker.riskLevel}
                    </span>

                    {!hasDevice && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-medium">
                        <Smartphone className="w-2.5 h-2.5" /> Sin Dispositivo
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Fields: Sector, Shift, Smartphone Telemetry */}
                <div className="mt-4 pt-3 border-t border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" /> Sector:
                    </span>
                    <span className="font-medium text-white">{worker.sector}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" /> Turno / Edad:
                    </span>
                    <span>{worker.shift} • {worker.age} años ({worker.bloodType})</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-silver" /> Smartphone:
                    </span>
                    {hasDevice ? (
                      <span className="font-mono text-[11px] text-[#D4AF37] font-semibold">{worker.deviceUuid}</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 italic">
                        Sin vincular (asignar después)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#B87333]" /> Cinemática Actual:
                    </span>
                    {hasDevice ? (
                      <span className="font-mono text-[#D4AF37] font-bold flex items-center gap-1.5">
                        {worker.lastTelemetryAt && (Date.now() - new Date(worker.lastTelemetryAt).getTime()) < 35000 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="En vivo" />
                        )}
                        SVM: {worker.currentAcceleration?.svm ? `${Number(worker.currentAcceleration.svm).toFixed(2)} m/s²` : '9.85 m/s²'}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic text-[11px]">
                        Requiere dispositivo móvil
                      </span>
                    )}
                  </div>

                  {/* Device Telemetry indicators */}
                  {hasDevice ? (
                    <div className="p-2 rounded-lg bg-[#0F1115] border border-white/5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1 text-gray-300">
                        {worker.deviceBattery && worker.deviceBattery > 50 ? (
                          <Battery className="w-3.5 h-3.5 text-emerald-400" />
                        ) : worker.deviceBattery && worker.deviceBattery > 20 ? (
                          <BatteryMedium className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <BatteryLow className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                        )}
                        <span>{worker.deviceBattery ?? 90}% Batería</span>
                      </div>

                      <div className="flex items-center gap-1 text-gray-300">
                        <Wifi className="w-3.5 h-3.5 text-silver" />
                        <span>{worker.signalStrength ?? -65} dBm</span>
                      </div>

                      <span className="text-[10px] text-gray-500 font-mono">
                        {worker.lastTelemetryAt ? new Date(worker.lastTelemetryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '16:36:50'}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#0F1115] border border-dashed border-[#D4AF37]/25 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-amber-300/85">
                        <Smartphone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                        <span>Móvil no asignado</span>
                      </div>
                      <button
                        onClick={() => handleOpenPairing(worker)}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#D4AF37] hover:bg-amber-400 text-black flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <QrCode className="w-3 h-3" />
                        Asignar Móvil
                      </button>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-1">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <span>Emergencia: <strong className="text-gray-200">{worker.emergencyContact.name}</strong> ({worker.emergencyContact.phone})</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                {hasDevice ? (
                  <>
                    <button
                      id={`btn-monitor-worker-${worker.id}`}
                      onClick={() => handleSelectWorkerForLiveMonitoring(worker)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Monitorear en Vivo
                    </button>

                    <button
                      id={`btn-pair-worker-${worker.id}`}
                      onClick={() => handleOpenPairing(worker)}
                      title="Reconectar / Cambiar Smartphone Móvil (Ver QR)"
                      className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white hover:border-[#D4AF37] transition-all cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    id={`btn-pair-worker-${worker.id}`}
                    onClick={() => handleOpenPairing(worker)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D4AF37] hover:bg-[#AA7C11] text-black font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Asignar Dispositivo Móvil
                  </button>
                )}

                <button
                  id={`btn-edit-worker-${worker.id}`}
                  onClick={() => handleOpenEdit(worker)}
                  title="Editar Datos del Trabajador"
                  className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white hover:border-[#D4AF37] transition-all cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  id={`btn-delete-worker-${worker.id}`}
                  onClick={() => handleDelete(worker)}
                  title="Eliminar Minero"
                  className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create / Edit Worker */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1C22] rounded-2xl p-6 border border-[#D4AF37]/20 max-w-xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D4AF37]" />
                {editingWorker ? `Editar Ficha: ${editingWorker.name} (${editingWorker.code})` : 'Registrar Nuevo Minero en Sistema M-10'}
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Aviso Asignación de Dispositivo */}
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#D4AF37]/25 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0" />
                <div className="text-[11px] text-gray-300 leading-relaxed">
                  <strong className="text-white block font-medium">Asignación de Dispositivo Móvil (Paso Posterior):</strong>
                  En esta ficha se registran únicamente los datos del trabajador y su labor. La asignación del smartphone o sensor móvil se realiza después desde la tarjeta del minero con <span className="text-[#D4AF37] font-semibold">"Asignar Móvil"</span> para captar las métricas de movimiento y caídas.
                </div>
              </div>

              {/* Sección 1: Datos Personales */}
              <div>
                <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-2">1. Información Personal</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-gray-400 mb-1 font-semibold">Nombres y Apellidos *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej. Santos Quispe Huamán"
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">DNI*</label>
                    <input
                      type="text"
                      required
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      placeholder="Ej. 45892134"
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Edad</label>
                    <input
                      type="number"
                      min="18"
                      max="75"
                      required
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Grupo Sanguíneo</label>
                    <select
                      value={formData.bloodType}
                      onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="O+">O Positivo (O+)</option>
                      <option value="O-">O Negativo (O-)</option>
                      <option value="A+">A Positivo (A+)</option>
                      <option value="A-">A Negativo (A-)</option>
                      <option value="B+">B Positivo (B+)</option>
                      <option value="B-">B Negativo (B-)</option>
                      <option value="AB+">AB Positivo (AB+)</option>
                      <option value="AB-">AB Negativo (AB-)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Estado Operativo</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkerStatus })}
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="normal">Normal (Operando)</option>
                      <option value="advertencia">Advertencia</option>
                      <option value="peligro">Peligro Crítico</option>
                      <option value="inactivo">Inactivo / Franco</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 2: Asignación Operativa & Labor */}
              <div>
                <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block mb-2">2. Asignación Operativa & Mina</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Rol / Labor Minera *</label>
                    <input
                      type="text"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="Ej. Perforista de Veta, Enmaderador..."
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Socavón / Labor Asignada *</label>
                    <select
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    >
                      {availableSectors.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1 font-semibold">Turno de Faena</label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                      className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Mañana">Mañana (06:00 - 14:00)</option>
                      <option value="Tarde">Tarde (14:00 - 22:00)</option>
                      <option value="Noche">Noche (22:00 - 06:00)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 3: Contacto de Emergencia */}
              <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> 3. Contacto de Emergencia Familiar
                  </span>
                  <span className="text-[10px] text-gray-500">Para rescate inmediato</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Nombre Familiar</label>
                    <input
                      type="text"
                      placeholder="Ej. Carmen Huamán"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="w-full bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Teléfono / Celular</label>
                    <input
                      type="text"
                      placeholder="+51 987 654 321"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Parentesco</label>
                    <input
                      type="text"
                      placeholder="Ej. Esposa, Madre"
                      value={formData.emergencyContactRel}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRel: e.target.value })}
                      className="w-full bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0F1115] hover:bg-[#1F2229] text-gray-300 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#AA7C11] text-black font-bold shadow-md uppercase tracking-wider text-[11px] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando en BD...</span>
                    </>
                  ) : (
                    <span>{editingWorker ? 'Guardar Cambios' : 'Registrar Minero'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {feedbackToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-fade-in ${
          feedbackToast.type === 'success'
            ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-900/30'
            : feedbackToast.type === 'error'
            ? 'bg-red-950/95 text-red-200 border-red-500/50 shadow-red-900/30'
            : 'bg-[#1A1C22]/95 text-amber-200 border-[#D4AF37]/50 shadow-black/50'
        }`}>
          {feedbackToast.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          {feedbackToast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
          {feedbackToast.type === 'info' && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{feedbackToast.msg}</span>
        </div>
      )}

    </div>
  );
};
