import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { Worker, MiningSector, RiskLevel, WorkerStatus } from '../types';

interface WorkersViewProps {
  workers: Worker[];
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

  const handleDelete = async (id: string) => {
    if (onDeleteWorker) {
      await onDeleteWorker(id);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    dni: '',
    age: 32,
    role: 'Perforista de Veta Aurífera',
    sector: 'Nivel -120m' as MiningSector,
    shift: 'Mañana' as 'Mañana' | 'Tarde' | 'Noche',
    deviceUuid: '',
    bloodType: 'O+',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRel: 'Familiar',
  });

  const filteredWorkers = workers.filter((w) => {
    const matchSearch =
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.dni.includes(searchTerm) ||
      w.role.toLowerCase().includes(searchTerm.toLowerCase());
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
      age: 32,
      role: 'Perforista de Veta Aurífera',
      sector: 'Nivel -120m',
      shift: 'Mañana',
      deviceUuid: `SMP-MINE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
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
      deviceUuid: worker.deviceUuid,
      bloodType: worker.bloodType,
      emergencyContactName: worker.emergencyContact.name,
      emergencyContactPhone: worker.emergencyContact.phone,
      emergencyContactRel: worker.emergencyContact.relationship,
    });
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Worker> = {
      name: formData.name,
      dni: formData.dni,
      age: Number(formData.age),
      role: formData.role,
      sector: formData.sector,
      shift: formData.shift,
      deviceUuid: formData.deviceUuid,
      bloodType: formData.bloodType,
      emergencyContact: {
        name: formData.emergencyContactName,
        phone: formData.emergencyContactPhone,
        relationship: formData.emergencyContactRel,
      },
    };

    if (editingWorker) {
      if (onUpdateWorker) {
        await onUpdateWorker(editingWorker.id, payload);
      } else if (onSaveWorker) {
        await onSaveWorker({ ...payload, id: editingWorker.id });
      }
    } else {
      if (onCreateWorker) {
        await onCreateWorker(payload);
      } else if (onSaveWorker) {
        await onSaveWorker(payload);
      }
    }
    setIsCreateModalOpen(false);
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
            <option value="Socavón Principal">Socavón Principal</option>
            <option value="Nivel -50m">Nivel -50m</option>
            <option value="Nivel -120m">Nivel -120m</option>
            <option value="Galería Norte">Galería Norte</option>
            <option value="Chimenea 3">Chimenea 3</option>
            <option value="Frente de Extracción">Frente de Extracción</option>
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
                      src={worker.avatarUrl}
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
                    <span className="font-mono text-[11px] text-[#D4AF37]">{worker.deviceUuid}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-300">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#B87333]" /> Cinemática Actual:
                    </span>
                    <span className="font-mono text-[#D4AF37] font-semibold">
                      SVM: {worker.currentAcceleration?.svm ? `${worker.currentAcceleration.svm} m/s²` : '10.0 m/s²'}
                    </span>
                  </div>

                  {/* Device Telemetry indicators */}
                  <div className="p-2 rounded-lg bg-[#0F1115] border border-white/5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-gray-300">
                      {worker.deviceBattery > 50 ? (
                        <Battery className="w-3.5 h-3.5 text-emerald-400" />
                      ) : worker.deviceBattery > 20 ? (
                        <BatteryMedium className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <BatteryLow className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      )}
                      <span>{worker.deviceBattery}% Batería</span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-300">
                      <Wifi className="w-3.5 h-3.5 text-silver" />
                      <span>{worker.signalStrength} dBm</span>
                    </div>

                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(worker.lastTelemetryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {/* Emergency Contact */}
                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-1">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <span>Emergencia: <strong className="text-gray-200">{worker.emergencyContact.name}</strong> ({worker.emergencyContact.phone})</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  id={`btn-monitor-worker-${worker.id}`}
                  onClick={() => handleSelectWorkerForLiveMonitoring(worker)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Monitorear en Vivo
                </button>

                <button
                  id={`btn-pair-worker-${worker.id}`}
                  onClick={() => handleOpenPairing(worker)}
                  title="Vincular Smartphone Móvil / Ver QR"
                  className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white hover:border-[#D4AF37] transition-all"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <button
                  id={`btn-edit-worker-${worker.id}`}
                  onClick={() => handleOpenEdit(worker)}
                  title="Editar Ficha"
                  className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-gray-300 hover:text-white hover:border-[#D4AF37] transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  id={`btn-delete-worker-${worker.id}`}
                  onClick={() => handleDelete(worker.id)}
                  title="Eliminar Minero"
                  className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all"
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
          <div className="bg-[#1A1C22] rounded-2xl p-6 border border-[#D4AF37]/20 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D4AF37]" />
                {editingWorker ? 'Editar Ficha de Minero' : 'Registrar Minero en Sistema M-10'}
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Nombres y Apellidos</label>
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
                  <label className="block text-gray-400 mb-1 font-semibold">DNI / Documento</label>
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
                  <label className="block text-gray-400 mb-1 font-semibold">Rol / Labor Minera</label>
                  <input
                    type="text"
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Ej. Perforista de Veta"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Socavón / Sector Asignado</label>
                  <select
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value as MiningSector })}
                    className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Socavón Principal">Socavón Principal</option>
                    <option value="Nivel -50m">Nivel -50m</option>
                    <option value="Nivel -120m">Nivel -120m</option>
                    <option value="Galería Norte">Galería Norte</option>
                    <option value="Chimenea 3">Chimenea 3</option>
                    <option value="Frente de Extracción">Frente de Extracción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Turno de Trabajo</label>
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

                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Grupo Sanguíneo</label>
                  <input
                    type="text"
                    value={formData.bloodType}
                    onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                    placeholder="Ej. O+, A+, B+"
                    className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Smartphone device UUID */}
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Identificador Smartphone (UUID IoT)</label>
                <input
                  type="text"
                  required
                  value={formData.deviceUuid}
                  onChange={(e) => setFormData({ ...formData, deviceUuid: e.target.value })}
                  placeholder="Ej. SMP-MINE-A819"
                  className="w-full bg-[#0F1115] border border-white/10 rounded-lg px-3 py-2 text-[#D4AF37] font-mono focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Emergency Contact Group */}
              <div className="p-3 rounded-xl bg-[#0F1115] border border-white/5 space-y-2">
                <div className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider">Contacto de Emergencia</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre familiar"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    className="bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono / Celular"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    className="bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200"
                  />
                  <input
                    type="text"
                    placeholder="Parentesco (Esposa, Madre)"
                    value={formData.emergencyContactRel}
                    onChange={(e) => setFormData({ ...formData, emergencyContactRel: e.target.value })}
                    className="bg-[#1A1C22] border border-white/10 rounded-lg px-2.5 py-1.5 text-gray-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0F1115] hover:bg-[#1F2229] text-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#AA7C11] text-black font-bold shadow-md uppercase tracking-wider text-[11px]"
                >
                  {editingWorker ? 'Guardar Cambios' : 'Registrar Minero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
