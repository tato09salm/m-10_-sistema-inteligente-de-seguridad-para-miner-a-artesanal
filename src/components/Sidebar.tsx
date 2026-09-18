import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  BrainCircuit,
  AlertTriangle,
  BarChart3,
  History,
  ShieldCheck,
  Radio,
  LogOut,
  Boxes,
  Sun,
  Moon,
  HardHat,
  X,
  Smartphone,
  QrCode,
  Database
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export type NavTab =
  | 'dashboard'
  | 'workers'
  | 'monitoring'
  | 'socavones'
  | 'ai_model'
  | 'alerts'
  | 'reports'
  | 'history'
  | 'security';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeAlertsCount: number;
  criticalAlertsCount: number;
  highRiskWorkersCount: number;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSimulator?: () => void;
  onOpenLiveMobile?: () => void;
  onOpenPostgresSchema?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeAlertsCount,
  criticalAlertsCount,
  highRiskWorkersCount,
  onLogout,
  isOpen = false,
  onClose,
  onOpenSimulator,
  onOpenLiveMobile,
  onOpenPostgresSchema,
}) => {
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: '1. Dashboard',
      shortLabel: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'workers' as NavTab,
      label: '2. Gestión de Mineros',
      shortLabel: 'Mineros',
      icon: Users,
      badge: highRiskWorkersCount > 0 ? `${highRiskWorkersCount} riesgo` : null,
      badgeColor: 'bg-[#B87333]/20 text-[#FDBA74] border-[#B87333]/40',
    },
    {
      id: 'monitoring' as NavTab,
      label: '3. Monitoreo en Tiempo Real',
      shortLabel: 'Monitoreo',
      icon: Activity,
      badge: 'En Vivo',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'socavones' as NavTab,
      label: '4. Socavones',
      shortLabel: 'Socavones',
      icon: Boxes,
      badge: null,
    },
    {
      id: 'ai_model' as NavTab,
      label: '5. Monitor de IA (ML)',
      shortLabel: 'Monitor IA',
      icon: BrainCircuit,
      badge: '98.4%',
      badgeColor: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
    },
    {
      id: 'alerts' as NavTab,
      label: '6. Alertas de Seguridad',
      shortLabel: 'Alertas',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? String(activeAlertsCount) : null,
      badgeColor: criticalAlertsCount > 0
        ? 'bg-red-500 text-white font-bold animate-pulse shadow-sm shadow-red-500/50'
        : 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
    },
    {
      id: 'reports' as NavTab,
      label: '7. Reportes Avanzados',
      shortLabel: 'Reportes',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'history' as NavTab,
      label: '8. Historial Forense',
      shortLabel: 'Historial',
      icon: History,
      badge: null,
    },
    {
      id: 'security' as NavTab,
      label: '9. Usuarios y Seguridad',
      shortLabel: 'Seguridad',
      icon: ShieldCheck,
      badge: 'RBAC',
      badgeColor: 'bg-[#1F2229] text-gray-400 border-white/10',
    },
  ];

  return (
    <>
      {/* Backdrop overlay for mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Lateral Responsive Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-72 md:w-64 lg:w-72 bg-[#16181D] border-r border-[#D4AF37]/20 shrink-0 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full md:translate-x-0'
          }`}
      >
        <div>
          {/* Brand Header with HardHat Icon & Spanish Subtitle */}
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#D4AF37]/10">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B38B21] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 border border-[#FFE885]/40 shrink-0">
                <HardHat className="w-6 h-6 text-black" />
              </div>
              <div className="truncate">
                <h1 className="text-[#D4AF37] font-bold tracking-wider text-base lg:text-lg leading-tight truncate">
                  SISTEMA
                </h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.18em] font-medium">
                  Inteligencia Minera
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onClose && (
              <button
                id="btn-close-sidebar-mobile"
                onClick={onClose}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Cerrar menú lateral"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Module Navigation List */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold flex items-center justify-between">
              <span>Módulos de Control</span>
              <span className="text-[#D4AF37] font-mono">SOCAVÓN</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => {
                      onSelectTab(item.id);
                      if (onClose) onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative cursor-pointer ${isActive
                      ? 'bg-gradient-to-r from-[#D4AF37]/15 to-transparent border-l-2 border-[#D4AF37] text-[#D4AF37] shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2229]/60 border-l-2 border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 transition-colors shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-gray-400 group-hover:text-[#D4AF37]'
                        }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${item.badgeColor || 'bg-[#1F2229] text-gray-300 border-white/10'
                          }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Simulation and Tech Tools */}
            {(onOpenSimulator || onOpenLiveMobile || onOpenPostgresSchema) && (
              <div className="pt-3 mt-3 border-t border-[#D4AF37]/10 space-y-1">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold flex items-center justify-between">
                  <span>Herramientas</span>
                  <span className="text-[#D4AF37] font-mono text-[9px]">DEV/TEST</span>
                </div>

                {onOpenSimulator && (
                  <button
                    id="btn-sidebar-simulator"
                    onClick={() => {
                      onOpenSimulator();
                      if (onClose) onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-[#D4AF37] hover:bg-[#1F2229]/60 transition-all group cursor-pointer"
                    title="Abrir Simulador de Sensores Móviles"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-gray-400 group-hover:text-[#D4AF37] transition-colors shrink-0" />
                      <span>Simulador Sensores</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                      TEST
                    </span>
                  </button>
                )}

                {onOpenLiveMobile && (
                  <button
                    id="btn-sidebar-mobile-connect"
                    onClick={() => {
                      onOpenLiveMobile();
                      if (onClose) onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#1F2229]/60 transition-all group cursor-pointer"
                    title="Vincular Celular Físico mediante QR"
                  >
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors shrink-0" />
                      <span>Conectar Celular Real</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                      QR
                    </span>
                  </button>
                )}

                {onOpenPostgresSchema && (
                  <button
                    id="btn-sidebar-postgres-schema"
                    onClick={() => {
                      onOpenPostgresSchema();
                      if (onClose) onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-cyan-400 hover:bg-[#1F2229]/60 transition-all group cursor-pointer"
                    title="Ver Esquema Relacional DDL de PostgreSQL"
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors shrink-0" />
                      <span>PostgreSQL DDL</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      SQL
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Live System Telemetry Status Badge & Controls */}
        <div className="p-4 border-t border-[#D4AF37]/10 space-y-2.5">
          {/* Quick Theme Switcher */}
          <button
            id="btn-sidebar-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="w-full py-2 px-3 rounded-xl bg-[#1F2229] hover:bg-[#282C35] border border-[#D4AF37]/20 text-xs font-medium flex items-center justify-between transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FEDB72] group-hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-[#B45309] group-hover:-rotate-12 transition-transform" />
              )}
              <span className="text-gray-300 font-medium">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#0F1115] text-[#D4AF37] border border-[#D4AF37]/20">
              {theme === 'dark' ? 'Oscuro' : 'Claro'}
            </span>
          </button>

          <div className="bg-[#1F2229] rounded-xl p-3.5 border border-[#C0C0C0]/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#D4AF37]" />
                Red Mesh Subterránea
              </span>
              <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-silver">v3.2.0-FASTAPI</span>
              <span className="text-emerald-400 font-bold">99.8% ONLINE</span>
            </div>
          </div>

          {onLogout && (
            <button
              id="btn-logout-sidebar"
              onClick={onLogout}
              className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
