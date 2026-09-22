import React, { useState, useRef, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Flame, 
  LogOut, 
  Sun, 
  Moon, 
  Menu,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  Users,
  Activity,
  Boxes,
  BrainCircuit,
  AlertTriangle,
  BarChart3,
  History,
  ShieldCheck,
  Shield,
  Check,
  Wrench,
  Smartphone,
  QrCode,
  Database
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';
import { useTheme } from '../lib/ThemeContext';

interface HeaderProps {
  currentUser: SystemUser;
  onRoleChange: (role: UserRole) => void;
  audioAlertsEnabled: boolean;
  onToggleAudio: () => void;
  onOpenSimulator?: () => void;
  onOpenLiveMobile?: () => void;
  onOpenPostgresSchema?: () => void;
  criticalAlertsCount: number;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
  onNavigateAlerts?: () => void;
  currentModule?: string;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onNavigate?: (module: string) => void;
}

const MODULE_CONFIG: Record<string, { label: string; shortLabel: string; icon: any }> = {
  dashboard: { label: 'Dashboard General', shortLabel: 'Dashboard', icon: LayoutDashboard },
  workers: { label: 'Gestión de Mineros', shortLabel: 'Mineros', icon: Users },
  monitoring: { label: 'Monitoreo en Tiempo Real', shortLabel: 'Monitoreo', icon: Activity },
  socavones: { label: 'Socavones 3D', shortLabel: 'Socavones', icon: Boxes },
  ai_model: { label: 'Monitor de IA (ML)', shortLabel: 'Modelo IA', icon: BrainCircuit },
  alerts: { label: 'Alertas de Seguridad', shortLabel: 'Alertas', icon: AlertTriangle },
  reports: { label: 'Reportes y Estadísticas', shortLabel: 'Reportes', icon: BarChart3 },
  history: { label: 'Historial Cinemático', shortLabel: 'Historial', icon: History },
  users: { label: '9. Usuarios', shortLabel: 'Usuarios', icon: ShieldCheck },
  security: { label: '9. Usuarios', shortLabel: 'Usuarios', icon: ShieldCheck },
};

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onRoleChange,
  audioAlertsEnabled,
  onToggleAudio,
  onOpenSimulator,
  onOpenLiveMobile,
  onOpenPostgresSchema,
  criticalAlertsCount,
  onLogout,
  onToggleSidebar,
  onNavigateAlerts,
  currentModule = 'dashboard',
  canGoBack = false,
  onGoBack,
  onNavigate,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const moduleMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
      if (moduleMenuRef.current && !moduleMenuRef.current.contains(e.target as Node)) {
        setIsModuleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute initials (e.g. "Arturo Mendoza" -> "AM", or "Ing. Arturo" -> "AM")
  const initials = currentUser.name
    .replace(/^ing\.?\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

  const roleLabels: Record<UserRole, { title: string; badge: string }> = {
    admin: { title: 'Ing. de Seguridad (Admin)', badge: 'Admin Mina' },
    supervisor: { title: 'Supervisor de Turno', badge: 'Supervisor' },
    rescatista: { title: 'Paramédico Rescatista', badge: 'Paramédico' },
    trabajador: { title: 'Operador Minero', badge: 'Operador' },
  };

  const currentRoleInfo = roleLabels[currentUser.role] || { title: currentUser.role, badge: currentUser.role };
  const currentModInfo = MODULE_CONFIG[currentModule] || MODULE_CONFIG.dashboard;
  const CurrentModuleIcon = currentModInfo.icon;

  const isLight = theme === 'light';

  return (
    <header className={`h-16 border-b flex items-center justify-between px-3 sm:px-4 lg:px-8 shrink-0 z-30 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'bg-[#121418] border-[#D4AF37]/10 text-white'
    }`}>
      
      {/* Left: Hamburger, Back Button, Breadcrumb & Module Selector */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {onToggleSidebar && (
          <button
            id="btn-mobile-menu-toggle"
            onClick={onToggleSidebar}
            className={`p-2 rounded-lg border md:hidden cursor-pointer shrink-0 transition-colors ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900' : 'bg-[#1F2229] border-white/10 text-gray-300 hover:text-white'
            }`}
            title="Abrir menú lateral"
          >
            <Menu className="w-5 h-5 text-[#D4AF37]" />
          </button>
        )}

        {/* Back Button (Returns to previous module without closing app!) */}
        {canGoBack && onGoBack && (
          <button
            id="btn-header-back"
            onClick={onGoBack}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm group shrink-0 ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 hover:border-amber-400 text-slate-700 hover:text-amber-800' 
                : 'bg-[#1F2229] hover:bg-[#282C35] border-white/10 hover:border-[#D4AF37]/50 text-gray-200 hover:text-[#D4AF37]'
            }`}
            title="Volver al módulo anterior (Atajo: Alt + Flecha Izquierda)"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF37] group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Atrás</span>
          </button>
        )}

        {/* Breadcrumb Navigation & Fast Switcher */}
        <div className="relative flex items-center gap-1 text-xs min-w-0" ref={moduleMenuRef}>
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer shrink-0 ${
              currentModule === 'dashboard' 
                ? (isLight ? 'text-slate-900 font-bold' : 'text-white') 
                : (isLight ? 'text-slate-500 hover:text-amber-700' : 'text-gray-400 hover:text-[#D4AF37]')
            }`}
            title="Ir al Dashboard Principal"
          >
            <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="hidden xs:inline">Centro M-10</span>
          </button>

          {currentModule && currentModule !== 'dashboard' && (
            <>
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-600'}`} />
              <button
                type="button"
                onClick={() => setIsModuleMenuOpen(!isModuleMenuOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer truncate ${
                  isLight ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200' : 'bg-white/5 hover:bg-white/10 text-[#D4AF37]'
                }`}
                title="Clic para cambiar de módulo rápidamente"
              >
                <CurrentModuleIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{currentModInfo.shortLabel}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 ml-0.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
              </button>
            </>
          )}

          {/* Quick Module Switcher Dropdown */}
          {isModuleMenuOpen && onNavigate && (
            <div className={`absolute top-full left-0 mt-2 w-56 rounded-xl border shadow-2xl z-50 py-1 text-xs backdrop-blur-md ${
              isLight ? 'bg-white border-slate-200 shadow-slate-200/80 text-slate-800' : 'bg-[#1A1C23] border-[#D4AF37]/30 text-gray-200'
            }`}>
              <div className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold border-b ${
                isLight ? 'text-slate-500 border-slate-100' : 'text-gray-400 border-white/5'
              }`}>
                Cambio Rápido de Módulo
              </div>
              {Object.entries(MODULE_CONFIG).map(([modKey, mod]) => {
                const IconComponent = mod.icon;
                const isSelected = currentModule === modKey;
                return (
                  <button
                    key={modKey}
                    onClick={() => {
                      onNavigate(modKey);
                      setIsModuleMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? (isLight ? 'bg-amber-50 text-amber-800 font-bold' : 'bg-[#D4AF37]/15 text-[#D4AF37] font-bold')
                        : (isLight ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900' : 'text-gray-300 hover:bg-white/5 hover:text-white')
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isSelected ? (isLight ? 'text-amber-600' : 'text-[#D4AF37]') : (isLight ? 'text-slate-400' : 'text-gray-400')}`} />
                    <span className="truncate">{mod.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Operational Status Pill */}
        {criticalAlertsCount > 0 ? (
          <button
            id="btn-header-critical-alert"
            onClick={onNavigateAlerts}
            className="bg-red-500/15 hover:bg-red-500/25 text-red-500 dark:text-red-400 text-[11px] px-2.5 py-1 rounded-full border border-red-500/30 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-red-500/20 shrink-0"
            title="Ver alertas críticas activas en el sistema"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="hidden sm:inline">{criticalAlertsCount} {criticalAlertsCount === 1 ? 'ALERTA CRÍTICA' : 'ALERTAS CRÍTICAS'}</span>
            <span className="sm:hidden">{criticalAlertsCount} CRÍTICA</span>
          </button>
        ) : (
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold uppercase tracking-wider hidden lg:inline-flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SECTOR SEGURO
          </span>
        )}

        {/* Compact Emergency Siren Toggle Button */}
        <button
          id="btn-toggle-audio"
          onClick={onToggleAudio}
          title={audioAlertsEnabled ? 'Sirena sonora de emergencia: ACTIVADA (Clic para silenciar)' : 'Sirena sonora: SILENCIADA (Clic para activar)'}
          className={`p-1.5 sm:p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center border cursor-pointer shrink-0 ${
            audioAlertsEnabled 
              ? (isLight ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]')
              : (isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800' : 'bg-[#1F2229] border-white/10 text-gray-400 hover:text-gray-200')
          }`}
        >
          {audioAlertsEnabled ? (
            <Volume2 className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-[#D4AF37]'}`} />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Right: Quick Tools Dropdown, Compact Theme Toggle & Executive Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        
        {/* Quick Tools Dropdown for fast desktop access (Acceso Rápido) */}
        {(onOpenSimulator || onOpenLiveMobile || onOpenPostgresSchema) && (
          <div className="relative" ref={toolsRef}>
            <button
              id="btn-header-tools-dropdown"
              onClick={() => setIsToolsOpen((prev) => !prev)}
              className={`p-2 rounded-lg border transition-all cursor-pointer hidden md:flex items-center gap-1.5 text-xs font-medium ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-amber-800 hover:border-amber-300 shadow-sm' 
                  : 'bg-[#1F2229] border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30'
              }`}
              title="Herramientas de simulación y base de datos"
            >
              <Wrench className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-[#D4AF37]'}`} />
              <span className={isLight ? 'text-slate-700 font-medium' : 'text-gray-300'}>Herramientas</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isLight ? 'text-slate-400' : 'text-gray-400'} ${isToolsOpen ? (isLight ? 'rotate-180 text-amber-700' : 'rotate-180 text-[#D4AF37]') : ''}`} />
            </button>

            {isToolsOpen && (
              <div className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
                isLight 
                  ? 'bg-white border-slate-200 shadow-slate-300/70 text-slate-800' 
                  : 'bg-[#181A20] border-[#D4AF37]/30 shadow-black/80 text-gray-200'
              }`}>
                <div className={`px-3 py-1.5 border-b text-[10px] uppercase tracking-wider font-semibold ${
                  isLight ? 'border-slate-100 text-slate-500' : 'border-white/10 text-gray-400'
                }`}>
                  Acceso Rápido
                </div>

                {onOpenSimulator && (
                  <button
                    id="btn-open-simulator"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenSimulator();
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isLight 
                        ? 'text-slate-700 hover:bg-amber-50 hover:text-amber-800' 
                        : 'text-gray-200 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
                    }`}
                  >
                    <Smartphone className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-[#D4AF37]'}`} />
                    <span className="font-medium">Simulador Sensores</span>
                  </button>
                )}

                {onOpenLiveMobile && (
                  <button
                    id="btn-open-mobile-connect"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenLiveMobile();
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isLight 
                        ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900' 
                        : 'text-gray-200 hover:bg-white/10'
                    }`}
                  >
                    <QrCode className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-silver'}`} />
                    <span className="font-medium">Conectar Celular Real</span>
                  </button>
                )}

                {onOpenPostgresSchema && (
                  <button
                    id="btn-open-postgres-schema"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenPostgresSchema();
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isLight 
                        ? 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800' 
                        : 'text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300'
                    }`}
                  >
                    <Database className={`w-4 h-4 ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                    <span className="font-medium">PostgreSQL DDL</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Compact Theme Toggle Button */}
        <button
          id="btn-toggle-theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          className={`p-2 rounded-lg border transition-all cursor-pointer ${
            isLight 
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-amber-800 shadow-sm' 
              : 'bg-[#1F2229] border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30'
          }`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#FEDB72]" />
          ) : (
            <Moon className="w-4 h-4 text-[#B45309]" />
          )}
        </button>

        {/* Unified Executive User Profile Menu (Icono de mi perfil) */}
        <div className={`relative pl-1 sm:pl-2 border-l ${isLight ? 'border-slate-200' : 'border-[#D4AF37]/15'}`} ref={profileRef}>
          <button
            id="btn-user-profile-menu"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className={`flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl border transition-all cursor-pointer text-left group ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 hover:border-amber-400 text-slate-800 shadow-sm' 
                : 'bg-[#1F2229] hover:bg-[#282C35] border-[#D4AF37]/20 hover:border-[#D4AF37]/40 text-white'
            }`}
            title="Perfil de usuario y configuración de roles"
          >
            {/* Avatar Circle: AM */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs font-mono shrink-0 transition-colors ${
              isLight 
                ? 'bg-amber-100 border border-amber-300 text-amber-900 shadow-sm' 
                : 'bg-[#16181D] border border-[#D4AF37]/40 text-[#D4AF37] shadow-inner group-hover:border-[#D4AF37]'
            }`}>
              {initials}
            </div>
            
            {/* User Info: Ing. Arturo Mendoza & Admin Mina */}
            <div className="hidden sm:block leading-tight text-left">
              <p className={`text-xs font-semibold truncate max-w-[120px] ${
                isLight ? 'text-slate-900 font-bold' : 'text-white'
              }`}>
                {currentUser.name}
              </p>
              <p className={`text-[10px] font-medium tracking-wide ${
                isLight ? 'text-amber-700 font-semibold' : 'text-[#D4AF37]'
              }`}>
                {currentRoleInfo.badge}
              </p>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 hidden sm:block transition-transform duration-200 ${
              isLight ? 'text-slate-400 group-hover:text-slate-800' : 'text-gray-400 group-hover:text-white'
            } ${isProfileOpen ? (isLight ? 'rotate-180 text-amber-700' : 'rotate-180 text-[#D4AF37]') : ''}`} />
          </button>

          {/* Profile & RBAC Dropdown Menu */}
          {isProfileOpen && (
            <div className={`absolute right-0 mt-2 w-64 border rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
              isLight 
                ? 'bg-white border-slate-200 shadow-slate-300/70 text-slate-800' 
                : 'bg-[#181A20] border-[#D4AF37]/30 shadow-black/80 text-white'
            }`}>
              
              {/* User Identity Header */}
              <div className={`px-4 py-2.5 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {currentUser.name}
                </p>
                <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                  {currentUser.email || 'operaciones@mina.pe'}
                </p>
                <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  isLight 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
                }`}>
                  <Shield className="w-3 h-3" />
                  <span>{currentRoleInfo.title}</span>
                </div>
              </div>

              {/* RBAC Role Switcher */}
              <div className={`px-3 py-2 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                <p className={`px-1 text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${
                  isLight ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  Cambiar Rol de Operador
                </p>
                <div className="space-y-1">
                  {[
                    { role: 'admin' as UserRole, label: 'Admin Mina', desc: 'Ing. Seguridad con acceso total' },
                    { role: 'supervisor' as UserRole, label: 'Supervisor Turno', desc: 'Monitoreo de cuadrillas' },
                    { role: 'rescatista' as UserRole, label: 'Paramédico', desc: 'Atención de emergencias y salud' },
                  ].map((opt) => {
                    const isSelected = currentUser.role === opt.role;
                    return (
                      <button
                        key={opt.role}
                        onClick={() => {
                          onRoleChange(opt.role);
                          setIsProfileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-all cursor-pointer ${
                          isSelected 
                            ? (isLight 
                                ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-300' 
                                : 'bg-[#D4AF37]/15 text-[#D4AF37] font-semibold border border-[#D4AF37]/30')
                            : (isLight 
                                ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900' 
                                : 'text-gray-300 hover:bg-white/5 hover:text-white')
                        }`}
                      >
                        <div>
                          <p className="leading-tight font-medium">{opt.label}</p>
                          <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{opt.desc}</p>
                        </div>
                        {isSelected && <Check className={`w-4 h-4 shrink-0 ${isLight ? 'text-amber-700' : 'text-[#D4AF37]'}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logout Option */}
              {onLogout && (
                <div className="px-2 pt-1.5">
                  <button
                    id="btn-logout-header"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isLight 
                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
                        : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </header>
  );
};
