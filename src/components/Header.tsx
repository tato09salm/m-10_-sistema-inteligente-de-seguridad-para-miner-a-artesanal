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
}

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
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
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
  };

  const currentRoleInfo = roleLabels[currentUser.role] || { title: currentUser.role, badge: currentUser.role };

  return (
    <header className="h-16 border-b border-[#D4AF37]/10 flex items-center justify-between px-4 lg:px-8 bg-[#121418] shrink-0 z-30 transition-colors">
      
      {/* Left: Hamburger (mobile), Operation Center & Alert / Siren status */}
      <div className="flex items-center space-x-2.5 sm:space-x-3.5">
        {onToggleSidebar && (
          <button
            id="btn-mobile-menu-toggle"
            onClick={onToggleSidebar}
            className="p-2 rounded-lg bg-[#1F2229] border border-white/10 text-gray-300 hover:text-white md:hidden cursor-pointer"
            title="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5 text-[#D4AF37]" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#D4AF37] shrink-0" />
          <h2 className="text-sm sm:text-base font-semibold text-white tracking-wide">
            Centro de Operaciones
          </h2>
        </div>

        {/* Operational Status Pill */}
        {criticalAlertsCount > 0 ? (
          <button
            id="btn-header-critical-alert"
            onClick={onNavigateAlerts}
            className="bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[11px] px-2.5 py-1 rounded-full border border-red-500/30 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-red-500/20"
            title="Ver alertas críticas activas en el sistema"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span>{criticalAlertsCount} {criticalAlertsCount === 1 ? 'ALERTA CRÍTICA' : 'ALERTAS CRÍTICAS'}</span>
          </button>
        ) : (
          <span className="bg-emerald-500/10 text-emerald-400 text-[11px] px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold uppercase tracking-wider hidden sm:inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SECTOR SEGURO
          </span>
        )}

        {/* Compact Emergency Siren Toggle Button */}
        <button
          id="btn-toggle-audio"
          onClick={onToggleAudio}
          title={audioAlertsEnabled ? 'Sirena sonora de emergencia: ACTIVADA (Clic para silenciar)' : 'Sirena sonora: SILENCIADA (Clic para activar)'}
          className={`p-1.5 sm:p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center border cursor-pointer ${
            audioAlertsEnabled 
              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25 shadow-sm shadow-[#D4AF37]/10' 
              : 'bg-[#1F2229] border-white/10 text-gray-400 hover:text-gray-200'
          }`}
        >
          {audioAlertsEnabled ? (
            <Volume2 className="w-4 h-4 text-[#D4AF37]" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Right: Quick Tools Dropdown (optional), Compact Theme Toggle & Executive Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        
        {/* Optional Quick Tools Dropdown for fast desktop access */}
        {(onOpenSimulator || onOpenLiveMobile || onOpenPostgresSchema) && (
          <div className="relative" ref={toolsRef}>
            <button
              id="btn-header-tools-dropdown"
              onClick={() => setIsToolsOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-[#1F2229] border border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all cursor-pointer hidden md:flex items-center gap-1.5 text-xs font-medium"
              title="Herramientas de simulación y base de datos"
            >
              <Wrench className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-gray-300">Herramientas</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isToolsOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
            </button>

            {isToolsOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#181A20] border border-[#D4AF37]/30 rounded-xl shadow-2xl shadow-black/80 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  Acceso Rápido
                </div>

                {onOpenSimulator && (
                  <button
                    id="btn-open-simulator"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenSimulator();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <span>Simulador Sensores</span>
                  </button>
                )}

                {onOpenLiveMobile && (
                  <button
                    id="btn-open-mobile-connect"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenLiveMobile();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-silver" />
                    <span>Conectar Celular Real</span>
                  </button>
                )}

                {onOpenPostgresSchema && (
                  <button
                    id="btn-open-postgres-schema"
                    onClick={() => {
                      setIsToolsOpen(false);
                      onOpenPostgresSchema();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>PostgreSQL DDL</span>
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
          className="p-2 rounded-lg bg-[#1F2229] border border-white/10 text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#FEDB72]" />
          ) : (
            <Moon className="w-4 h-4 text-[#B45309]" />
          )}
        </button>

        {/* Unified Executive User Profile Menu */}
        <div className="relative pl-1 sm:pl-2 border-l border-[#D4AF37]/15" ref={profileRef}>
          <button
            id="btn-user-profile-menu"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-[#1F2229] hover:bg-[#282C35] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all cursor-pointer text-left group"
            title="Perfil de usuario y configuración de roles"
          >
            <div className="w-8 h-8 rounded-full bg-[#16181D] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xs font-mono shrink-0 shadow-inner group-hover:border-[#D4AF37]">
              {initials}
            </div>
            
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-xs font-semibold text-white truncate max-w-[120px]">{currentUser.name}</p>
              <p className="text-[10px] text-[#D4AF37] font-medium tracking-wide">{currentRoleInfo.badge}</p>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 hidden sm:block transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-[#D4AF37]' : 'group-hover:text-white'}`} />
          </button>

          {/* Profile & RBAC Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#181A20] border border-[#D4AF37]/30 rounded-xl shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* User Identity Header */}
              <div className="px-4 py-2.5 border-b border-white/10">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{currentUser.email || 'operaciones@mina.pe'}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                  <Shield className="w-3 h-3" />
                  <span>{currentRoleInfo.title}</span>
                </div>
              </div>

              {/* RBAC Role Switcher */}
              <div className="px-3 py-2 border-b border-white/10">
                <p className="px-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
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
                            ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-semibold border border-[#D4AF37]/30' 
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div>
                          <p className="leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-gray-500">{opt.desc}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
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
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
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
