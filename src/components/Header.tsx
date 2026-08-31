import React from 'react';
import { 
  Smartphone, 
  Database, 
  Volume2, 
  VolumeX, 
  QrCode, 
  Flame, 
  AlertOctagon,
  LogOut
} from 'lucide-react';
import { SystemUser, UserRole } from '../types';

interface HeaderProps {
  currentUser: SystemUser;
  onRoleChange: (role: UserRole) => void;
  audioAlertsEnabled: boolean;
  onToggleAudio: () => void;
  onOpenSimulator: () => void;
  onOpenLiveMobile: () => void;
  onOpenPostgresSchema: () => void;
  criticalAlertsCount: number;
  onLogout?: () => void;
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
}) => {
  // Get initials
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 border-b border-[#D4AF37]/10 flex items-center justify-between px-4 lg:px-8 bg-[#121418] shrink-0 z-30">
      
      {/* Left: Operation Center & Status */}
      <div className="flex items-center space-x-3 lg:space-x-4">
        <h2 className="text-base lg:text-lg font-semibold text-white tracking-wide flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#D4AF37]" />
          <span>Centro de Operaciones</span>
        </h2>

        {criticalAlertsCount > 0 ? (
          <span className="bg-red-500/10 text-red-400 text-[10px] px-2.5 py-1 rounded border border-red-500/20 font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            {criticalAlertsCount} {criticalAlertsCount === 1 ? 'ALERTA CRÍTICA' : 'ALERTAS CRÍTICAS'}
          </span>
        ) : (
          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-1 rounded border border-emerald-500/20 font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SECTOR SEGURO
          </span>
        )}
      </div>

      {/* Right: Actions, Tools & Supervisor Info */}
      <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
        
        {/* Sirena */}
        <button
          id="btn-toggle-audio"
          onClick={onToggleAudio}
          title={audioAlertsEnabled ? 'Sirena sonora activada para emergencias' : 'Sirena silenciada'}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
            audioAlertsEnabled 
              ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 shadow-sm' 
              : 'bg-[#1F2229] border-white/10 text-gray-400 hover:text-gray-200'
          }`}
        >
          {audioAlertsEnabled ? <Volume2 className="w-4 h-4 text-[#D4AF37]" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden md:inline">Sirena</span>
        </button>

        {/* Smartphone Simulator */}
        <button
          id="btn-open-simulator"
          onClick={onOpenSimulator}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2229] border border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Smartphone className="w-4 h-4 text-[#D4AF37]" />
          <span className="hidden sm:inline">Simulador Sensores</span>
        </button>

        {/* Live Mobile Connect QR */}
        <button
          id="btn-open-mobile-connect"
          onClick={onOpenLiveMobile}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F2229] border border-[#C0C0C0]/20 text-silver hover:bg-white/5 transition-all flex items-center gap-1.5"
        >
          <QrCode className="w-4 h-4 text-silver" />
          <span className="hidden md:inline">Conectar Celular Real</span>
        </button>

        {/* PostgreSQL DDL Schema Inspector */}
        <button
          id="btn-open-postgres-schema"
          onClick={onOpenPostgresSchema}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F2229] border border-[#C0C0C0]/20 text-silver hover:bg-white/5 transition-all flex items-center gap-1.5"
          title="Ver Esquema Relacional PostgreSQL"
        >
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="hidden lg:inline">PostgreSQL DDL</span>
        </button>

        {/* Role Selector & Profile */}
        <div className="flex items-center space-x-3 pl-2 sm:pl-4 border-l border-[#D4AF37]/10">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white leading-tight truncate max-w-[140px]">{currentUser.name}</p>
            <p className="text-[10px] text-[#D4AF37] font-medium uppercase tracking-wider">
              {currentUser.role === 'admin' ? 'Ing. Seguridad' : currentUser.role === 'supervisor' ? 'Supervisor Turno' : 'Paramédico Mina'}
            </p>
          </div>

          <div className="w-9 h-9 rounded-full border border-[#D4AF37]/40 p-0.5 shrink-0">
            <div className="w-full h-full bg-[#1F2229] text-[#D4AF37] rounded-full flex items-center justify-center text-xs font-bold font-mono">
              {initials}
            </div>
          </div>

          <select
            id="select-user-role"
            value={currentUser.role}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="bg-[#1F2229] border border-[#D4AF37]/20 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            title="Cambiar rol de usuario"
          >
            <option value="admin">Admin Mina</option>
            <option value="supervisor">Supervisor</option>
            <option value="rescatista">Paramédico</option>
          </select>

          {onLogout && (
            <button
              id="btn-logout-header"
              onClick={onLogout}
              title="Cerrar Sesión"
              className="p-1.5 rounded-lg bg-[#1F2229] border border-red-500/20 text-gray-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
