import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  Key, 
  FileText, 
  ShieldAlert, 
  Check, 
  X, 
  Plus, 
  Users, 
  Radio, 
  Activity,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Sparkles,
  MapPin,
  Mail,
  ExternalLink,
  Filter,
  UserX,
  HardHat,
  BadgeCheck
} from 'lucide-react';
import { SystemUser, AuditLog, UserRole, MiningSector } from '../types';

interface UsersSecurityViewProps {
  users: SystemUser[];
  auditLogs: AuditLog[];
  currentUser: SystemUser;
  onRoleChange: (role: UserRole) => void;
  onSelectUserSession?: (user: SystemUser) => void;
  onCreateUser?: (userData: { 
    name: string; 
    email: string; 
    password?: string; 
    role: UserRole; 
    avatar?: string; 
    sectorAssigned?: string;
    dni?: string;
    status?: 'activo' | 'inhabilitado';
  }) => Promise<void> | void;
  onUpdateUser?: (id: string, userData: { 
    name?: string; 
    email?: string; 
    password?: string; 
    role?: UserRole; 
    avatar?: string; 
    sectorAssigned?: string;
    dni?: string;
    status?: 'activo' | 'inhabilitado';
  }) => Promise<void> | void;
  onDeleteUser?: (id: string) => Promise<void> | void;
  onReloadUsers?: () => void;
}

const MINING_SECTORS: MiningSector[] = [
  'Socavón Principal',
  'Nivel -50m',
  'Nivel -120m',
  'Galería Norte',
  'Chimenea 3',
  'Frente de Extracción'
];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
];

const PERMISSIONS = [
  { module: '1. Dashboard en Tiempo Real', admin: true, supervisor: true, rescatista: true, trabajador: true },
  { module: '2. Registro y Edición de Mineros', admin: true, supervisor: true, rescatista: false, trabajador: false },
  { module: '3. Recepción de Telemetría Smartphone', admin: true, supervisor: true, rescatista: true, trabajador: true },
  { module: '4. Ajuste de Umbrales de IA / ML', admin: true, supervisor: false, rescatista: false, trabajador: false },
  { module: '5. Atención y Resolución de Alertas', admin: true, supervisor: true, rescatista: true, trabajador: false },
  { module: '6. Exportación de Informes y Auditorías', admin: true, supervisor: true, rescatista: false, trabajador: false },
  { module: '7. Acceso a BD PostgreSQL & DDL', admin: true, supervisor: false, rescatista: false, trabajador: false },
  { module: '8. Gestión de Usuarios & Permisos', admin: true, supervisor: false, rescatista: false, trabajador: false },
];

export const UsersSecurityView: React.FC<UsersSecurityViewProps> = ({
  users,
  auditLogs,
  currentUser,
  onRoleChange,
  onSelectUserSession,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onReloadUsers,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'users' | 'rbac' | 'audit'>('users');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | UserRole>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'activo' | 'inhabilitado'>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDni, setFormDni] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('trabajador');
  const [formStatus, setFormStatus] = useState<'activo' | 'inhabilitado'>('activo');
  const [formSector, setFormSector] = useState<string>('Socavón Principal');
  const [formAvatar, setFormAvatar] = useState<string>(PRESET_AVATARS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Dialog State
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.dni && u.dni.includes(searchQuery)) ||
        (u.sectorAssigned && u.sectorAssigned.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      const userStatus = u.status || 'activo';
      const matchStatus = selectedStatusFilter === 'all' || userStatus === selectedStatusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, selectedRoleFilter, selectedStatusFilter]);

  // Counts by Role
  const counts = useMemo(() => {
    return {
      total: users.length,
      admin: users.filter((u) => u.role === 'admin').length,
      trabajador: users.filter((u) => u.role === 'trabajador').length,
      supervisor: users.filter((u) => u.role === 'supervisor').length,
      rescatista: users.filter((u) => u.role === 'rescatista').length,
      activos: users.filter((u) => (u.status || 'activo') === 'activo').length,
      inhabilitados: users.filter((u) => u.status === 'inhabilitado').length,
    };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingUserId(null);
    setFormName('');
    setFormEmail('');
    setFormDni('');
    setFormPassword('');
    setFormRole('trabajador');
    setFormStatus('activo');
    setFormSector('Socavón Principal');
    setFormAvatar(PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (u: SystemUser) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormDni(u.dni || '');
    setFormPassword(u.password || '');
    setFormRole(u.role);
    setFormStatus(u.status || 'activo');
    setFormSector(u.sectorAssigned || 'Socavón Principal');
    setFormAvatar(u.avatar || PRESET_AVATARS[0]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Toggle user status (Habilitar / Inhabilitar)
  const handleToggleStatus = async (user: SystemUser) => {
    const newStatus: 'activo' | 'inhabilitado' = user.status === 'inhabilitado' ? 'activo' : 'inhabilitado';
    try {
      if (onUpdateUser) {
        await onUpdateUser(user.id, { status: newStatus });
      }
      if (newStatus === 'activo') {
        showFeedback('success', `Usuario '${user.name}' HABILITADO. Ahora tiene permiso para entrar a la página.`);
      } else {
        showFeedback('error', `Usuario '${user.name}' INHABILITADO. Se ha bloqueado su acceso a la página.`);
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Error al actualizar estado del usuario.');
    }
  };

  // Handle Form Submit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('El nombre completo es requerido.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('Ingrese un correo electrónico válido con formato @.');
      return;
    }
    if (formRole === 'trabajador' && !formDni.trim()) {
      setFormError('El DNI es obligatorio para los trabajadores (su contraseña de acceso es su DNI).');
      return;
    }

    try {
      setIsSubmitting(true);
      // Para trabajador, si no puso password personalizada, su password es su DNI
      const effectivePassword = formPassword.trim() || (formRole === 'trabajador' ? formDni.trim() : 'mineria123');

      if (modalMode === 'create') {
        if (onCreateUser) {
          await onCreateUser({
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            dni: formDni.trim(),
            password: effectivePassword,
            role: formRole,
            status: formStatus,
            avatar: formAvatar,
            sectorAssigned: formSector,
          });
        }
        showFeedback('success', `Usuario '${formName.trim()}' registrado exitosamente.`);
      } else if (editingUserId) {
        if (onUpdateUser) {
          await onUpdateUser(editingUserId, {
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            dni: formDni.trim(),
            ...(formPassword.trim() ? { password: formPassword.trim() } : (formDni.trim() ? { password: formDni.trim() } : {})),
            role: formRole,
            status: formStatus,
            avatar: formAvatar,
            sectorAssigned: formSector,
          });
        }
        showFeedback('success', `Usuario '${formName.trim()}' actualizado exitosamente.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar usuario en el sistema.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setIsDeleting(true);
      if (onDeleteUser) {
        await onDeleteUser(userToDelete.id);
      }
      showFeedback('success', `Usuario '${userToDelete.name}' eliminado del sistema.`);
      setUserToDelete(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Error al eliminar usuario.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get Role Color Styling
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          bg: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
          label: 'Administrador',
          indicator: 'bg-[#D4AF37]',
        };
      case 'trabajador':
        return {
          bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          label: 'Trabajador',
          indicator: 'bg-blue-400',
        };
      case 'supervisor':
        return {
          bg: 'bg-[#B87333]/25 text-[#FDBA74] border-[#B87333]/40',
          label: 'Supervisor',
          indicator: 'bg-[#FDBA74]',
        };
      case 'rescatista':
        return {
          bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          label: 'Paramédico / Rescate',
          indicator: 'bg-emerald-400',
        };
      default:
        return {
          bg: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          label: 'Usuario',
          indicator: 'bg-gray-400',
        };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-2xl animate-fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
            : feedbackMsg.type === 'error'
            ? 'bg-red-950/90 border-red-500/60 text-red-200'
            : 'bg-blue-950/90 border-blue-500/60 text-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {feedbackMsg.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
            {feedbackMsg.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-gray-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1A1C22] p-5 lg:p-6 rounded-2xl border border-[#D4AF37]/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-bold text-white">
                  9. Usuarios
                </h1>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-mono font-bold">
                  Control de Acceso
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Gestión de cuentas y roles (Administrador, Trabajador y Supervisión). Edita datos y habilita o inhabilita el acceso para entrar a la página.
              </p>
            </div>
          </div>
        </div>

        {/* Current Active User Session Badge */}
        <div className="flex items-center gap-3 bg-[#0F1115] border border-[#D4AF37]/30 rounded-xl p-3 px-4 shrink-0 shadow-xl">
          <div className="relative">
            <img
              src={currentUser.avatar || PRESET_AVATARS[0]}
              alt={currentUser.name}
              className="w-11 h-11 rounded-xl object-cover border-2 border-[#D4AF37]/60 shadow"
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0F1115]" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              {currentUser.name}
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Tú
              </span>
            </div>
            <div className="text-[10px] text-[#D4AF37] font-mono font-semibold capitalize">
              {getRoleBadge(currentUser.role).label}
            </div>
            <div className="text-[9px] text-gray-400">
              {currentUser.email}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div 
          onClick={() => { setSelectedRoleFilter('all'); setSelectedStatusFilter('all'); }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedRoleFilter === 'all' && selectedStatusFilter === 'all'
              ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/5'
              : 'bg-[#1A1C22] border-white/5 hover:border-[#D4AF37]/30'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Total Usuarios</span>
            <Users className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5 font-mono">{counts.total}</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            {counts.activos} habilitados • {counts.inhabilitados} inhabilitados
          </div>
        </div>

        <div 
          onClick={() => setSelectedRoleFilter('admin')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedRoleFilter === 'admin'
              ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-lg'
              : 'bg-[#1A1C22] border-white/5 hover:border-[#D4AF37]/30'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Administradores</span>
            <Shield className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold text-[#D4AF37] mt-1.5 font-mono">{counts.admin}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Control total del sistema</div>
        </div>

        <div 
          onClick={() => setSelectedRoleFilter('trabajador')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedRoleFilter === 'trabajador'
              ? 'bg-blue-500/20 border-blue-500 shadow-lg'
              : 'bg-[#1A1C22] border-white/5 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Trabajadores</span>
            <HardHat className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1.5 font-mono">{counts.trabajador}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Clave de acceso: Su DNI</div>
        </div>

        <div 
          onClick={() => setSelectedRoleFilter('supervisor')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedRoleFilter === 'supervisor'
              ? 'bg-[#B87333]/25 border-[#B87333] shadow-lg'
              : 'bg-[#1A1C22] border-white/5 hover:border-[#B87333]/40'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Supervisores & Rescate</span>
            <UserCheck className="w-4 h-4 text-[#FDBA74]" />
          </div>
          <div className="text-2xl font-bold text-[#FDBA74] mt-1.5 font-mono">{counts.supervisor + counts.rescatista}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Supervisión y paramédicos</div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold'
                : 'bg-[#1A1C22] text-gray-400 hover:text-white border border-white/5 hover:border-white/15'
            }`}
          >
            <Users className="w-4 h-4" />
            Gestión de Usuarios (Administrador & Trabajador)
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'users' ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-300'
            }`}>
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rbac')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'rbac'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold'
                : 'bg-[#1A1C22] text-gray-400 hover:text-white border border-white/5 hover:border-white/15'
            }`}
          >
            <Lock className="w-4 h-4" />
            Matriz de Permisos por Rol
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-bold'
                : 'bg-[#1A1C22] text-gray-400 hover:text-white border border-white/5 hover:border-white/15'
            }`}
          >
            <FileText className="w-4 h-4" />
            Auditoría de Accesos
          </button>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs flex items-center gap-2 hover:bg-[#FFE885] transition-all shadow-lg shadow-[#D4AF37]/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Usuario</span>
          </button>
        )}
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          
          {/* Controls Bar: Search, Filters, Refresh */}
          <div className="bg-[#1A1C22] p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto items-center flex-1">
              
              {/* Search input */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, correo, DNI..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value as any)}
                  className="bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] w-full sm:w-auto"
                >
                  <option value="all">Todos los Roles</option>
                  <option value="admin">Administradores</option>
                  <option value="trabajador">Trabajadores</option>
                  <option value="supervisor">Supervisores</option>
                  <option value="rescatista">Paramédicos</option>
                </select>
              </div>

              {/* Status filter (Habilitado / Inhabilitado) */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                className="bg-[#0F1115] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] w-full sm:w-auto"
              >
                <option value="all">Todos los Estados</option>
                <option value="activo">Habilitados (Acceso permitido)</option>
                <option value="inhabilitado">Inhabilitados (Bloqueados)</option>
              </select>
            </div>

            {/* Reload button */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => {
                  if (onReloadUsers) onReloadUsers();
                  showFeedback('info', 'Lista de usuarios actualizada.');
                }}
                className="p-2 rounded-xl bg-[#0F1115] border border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all text-xs flex items-center gap-1.5"
                title="Recargar usuarios"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refrescar</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#1A1C22] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Listado de Cuentas de Acceso al Sistema
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Los usuarios habilitados pueden iniciar sesión. Para los trabajadores, su contraseña predeterminada es su DNI.
                </p>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                Mostrando {filteredUsers.length} de {users.length} usuarios
              </span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="w-10 h-10 text-gray-600 mx-auto" />
                <div className="text-sm font-bold text-white">No se encontraron usuarios</div>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  No hay cuentas que coincidan con la búsqueda o filtros seleccionados.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRoleFilter('all');
                    setSelectedStatusFilter('all');
                  }}
                  className="text-xs text-[#D4AF37] hover:underline font-semibold"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0F1115]/60 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Usuario / Nombre</th>
                      <th className="py-3 px-4">Correo Electrónico</th>
                      <th className="py-3 px-4">Rol en Mina</th>
                      <th className="py-3 px-4">DNI / Clave</th>
                      <th className="py-3 px-4">Sector Asignado</th>
                      <th className="py-3 px-4">Estado (Entrada a la página)</th>
                      <th className="py-3 px-4 text-right">Acciones de Gestión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredUsers.map((u) => {
                      const badge = getRoleBadge(u.role);
                      const isCurrentSession = u.email.toLowerCase() === currentUser.email.toLowerCase() || (u.id === currentUser.id);
                      const isEnabled = (u.status || 'activo') !== 'inhabilitado';

                      return (
                        <tr 
                          key={u.id} 
                          className={`hover:bg-white/[0.03] transition-colors ${
                            !isEnabled ? 'opacity-65 bg-red-950/10' : ''
                          } ${isCurrentSession ? 'bg-[#D4AF37]/5' : ''}`}
                        >
                          {/* User Avatar + Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img
                                  src={u.avatar || PRESET_AVATARS[0]}
                                  alt={u.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow"
                                />
                                <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#1A1C22] ${
                                  isEnabled ? 'bg-emerald-500' : 'bg-red-500'
                                }`} />
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  {u.name}
                                  {isCurrentSession && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 font-mono">
                                      Sesión Actual
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                  <span>ID: {u.id}</span>
                                  {u.workerId && <span className="text-blue-400">• Minero vinculado</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 font-mono text-gray-300">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              <span className="font-medium text-white">{u.email}</span>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full uppercase font-bold border inline-flex items-center gap-1.5 ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.indicator}`} />
                              {badge.label}
                            </span>
                          </td>

                          {/* DNI / Password Note */}
                          <td className="py-3.5 px-4 font-mono text-gray-400">
                            {u.role === 'trabajador' ? (
                              <div className="text-[11px]">
                                <span className="text-white font-bold">{u.dni || 'DNI Registrado'}</span>
                                <span className="text-[9px] text-[#D4AF37] block font-sans">🔑 Su contraseña es su DNI</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-500">
                                <span>••••••••</span>
                                <span className="text-[9px] text-gray-500 block font-sans">Contraseña privada</span>
                              </div>
                            )}
                          </td>

                          {/* Sector Assigned */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-gray-300">
                              <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                              <span className="font-medium">{u.sectorAssigned || 'Socavón Principal'}</span>
                            </div>
                          </td>

                          {/* Estado de Acceso (Habilitado / Inhabilitado) */}
                          <td className="py-3.5 px-4">
                            {isEnabled ? (
                              <div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center gap-1">
                                  <BadgeCheck className="w-3 h-3" />
                                  Habilitado
                                </span>
                                <span className="text-[9px] text-emerald-400/80 block mt-0.5">
                                  Permite entrar a la página
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold inline-flex items-center gap-1">
                                  <UserX className="w-3 h-3" />
                                  Inhabilitado
                                </span>
                                <span className="text-[9px] text-red-400/80 block mt-0.5">
                                  Acceso bloqueado
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {/* Botón Habilitar / Inhabilitar */}
                              <button
                                onClick={() => handleToggleStatus(u)}
                                title={isEnabled ? "Inhabilitar acceso a la página" : "Habilitar acceso a la página"}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                                  isEnabled
                                    ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                }`}
                              >
                                {isEnabled ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Inhabilitar</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Habilitar</span>
                                  </>
                                )}
                              </button>

                              {/* Edit User */}
                              <button
                                onClick={() => handleOpenEdit(u)}
                                title="Editar datos del usuario"
                                className="p-1.5 rounded-lg bg-[#0F1115] border border-white/10 text-gray-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete User */}
                              <button
                                onClick={() => setUserToDelete(u)}
                                title="Eliminar usuario del sistema"
                                disabled={u.role === 'admin' && counts.admin <= 1}
                                className={`p-1.5 rounded-lg bg-[#0F1115] border transition-all cursor-pointer ${
                                  u.role === 'admin' && counts.admin <= 1
                                    ? 'border-white/5 text-gray-600 cursor-not-allowed'
                                    : 'border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/40'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/15 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#D4AF37]" />
                Matriz de Permisos por Rol en Mina
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Definición granular de accesos entre Administradores, Supervisores, Rescatistas y Trabajadores Mineros.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase tracking-wider bg-[#0F1115]/50">
                  <th className="p-3">Módulo Funcional</th>
                  <th className="p-3 text-center text-[#D4AF37]">Administrador</th>
                  <th className="p-3 text-center text-blue-400">Trabajador Minero</th>
                  <th className="p-3 text-center text-[#FDBA74]">Supervisor Turno</th>
                  <th className="p-3 text-center text-emerald-400">Paramédico / Rescate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {PERMISSIONS.map((p, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-medium text-white">{p.module}</td>
                    
                    {/* Admin */}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#D4AF37]/15 text-[#D4AF37]">
                        <Check className="w-4 h-4" />
                      </span>
                    </td>

                    {/* Trabajador */}
                    <td className="p-3 text-center">
                      {p.trabajador ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/15 text-blue-400">
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>

                    {/* Supervisor */}
                    <td className="p-3 text-center">
                      {p.supervisor ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#B87333]/20 text-[#FDBA74]">
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>

                    {/* Rescatista */}
                    <td className="p-3 text-center">
                      {p.rescatista ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400">
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/15 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D4AF37]" />
                Registro Inmutable de Auditoría & Accesos
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Historial de ingresos a la plataforma, cambios de estado y acciones operativas con timestamp inmutable.
              </p>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              {auditLogs.length} eventos registrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase tracking-wider bg-[#0F1115]/50">
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Acción Registrada</th>
                  <th className="p-3">Detalle Operativo</th>
                  <th className="p-3">Dirección IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('es-PE', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="p-3 font-bold text-white">{log.user}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1115] text-gray-300 border border-white/5">
                        {log.role}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-[#D4AF37] whitespace-nowrap">{log.action}</td>
                    <td className="p-3 text-gray-300 max-w-md truncate">{log.details}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1C22] border border-[#D4AF37]/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#D4AF37]/10 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
                  {modalMode === 'create' ? <UserPlus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {modalMode === 'create' ? 'Registrar Nuevo Usuario' : 'Editar Datos de Usuario'}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    {modalMode === 'create' 
                      ? 'Crea una cuenta de acceso para Administrador, Trabajador o Supervisión.'
                      : 'Modifica datos de acceso, rol y estado de habilitación en el sistema.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Rol y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Rol en el Sistema *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="admin">Administrador (Control Total)</option>
                    <option value="trabajador">Trabajador Minero</option>
                    <option value="supervisor">Supervisor de Turno</option>
                    <option value="rescatista">Paramédico / Rescate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Estado de Acceso a la Página *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className={`w-full px-3.5 py-2.5 bg-[#0F1115] border rounded-xl text-xs font-bold focus:outline-none ${
                      formStatus === 'activo'
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-red-500/40 text-red-400'
                    }`}
                  >
                    <option value="activo">✅ Habilitado (Puede entrar)</option>
                    <option value="inhabilitado">🚫 Inhabilitado (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Nombre Completo / Titular *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Santos Quispe Huamán"
                  className="w-full px-3.5 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Correo Electrónico (Para entrar a la página) *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Ej: santos.quispe@mina.pe"
                  className="w-full px-3.5 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              {/* DNI (Especialmente relevante para trabajadores) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  DNI {formRole === 'trabajador' ? '(Su contraseña de acceso) *' : '(Opcional)'}
                </label>
                <input
                  type="text"
                  value={formDni}
                  onChange={(e) => setFormDni(e.target.value)}
                  placeholder="Ej: 45892134"
                  className="w-full px-3.5 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  required={formRole === 'trabajador'}
                />
                {formRole === 'trabajador' && (
                  <span className="text-[10px] text-[#D4AF37] mt-1 block">
                    🔑 Para el rol Trabajador, su contraseña para entrar al sistema es su número de DNI.
                  </span>
                )}
              </div>

              {/* Password (Opcional si es trabajador, ya que es su DNI) */}
              {formRole !== 'trabajador' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {modalMode === 'create' ? 'Contraseña Personalizada *' : 'Nueva Contraseña (dejar en blanco para mantener la actual)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={modalMode === 'create' ? 'Mínimo 6 caracteres' : '••••••••'}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                      required={modalMode === 'create' && formRole !== 'trabajador'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Sector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Sector Asignado *
                </label>
                <select
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0F1115] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  {MINING_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:bg-[#FFE885] transition-all shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{modalMode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION DIALOG */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1C22] border border-red-500/30 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Eliminar Cuenta de Usuario</h3>
                <p className="text-xs text-gray-400">Esta acción revocará de forma permanente el acceso al sistema.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F1115] border border-white/10 space-y-1 text-xs">
              <div className="text-white font-bold">{userToDelete.name}</div>
              <div className="text-gray-400 font-mono">{userToDelete.email}</div>
              <div className="text-[#D4AF37] font-semibold capitalize">Rol: {userToDelete.role}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <span>Eliminando...</span> : <span>Confirmar Eliminación</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
