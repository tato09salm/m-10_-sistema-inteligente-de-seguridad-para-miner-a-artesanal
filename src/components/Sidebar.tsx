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
  Radio
} from 'lucide-react';

export type NavTab = 
  | 'dashboard'
  | 'workers'
  | 'monitoring'
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeAlertsCount,
  criticalAlertsCount,
  highRiskWorkersCount,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: '1. Dashboard Principal',
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
      id: 'ai_model' as NavTab,
      label: '4. Monitor de IA (ML)',
      shortLabel: 'Monitor IA',
      icon: BrainCircuit,
      badge: '98.4%',
      badgeColor: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
    },
    {
      id: 'alerts' as NavTab,
      label: '5. Alertas de Seguridad',
      shortLabel: 'Alertas',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? String(activeAlertsCount) : null,
      badgeColor: criticalAlertsCount > 0 
        ? 'bg-red-500 text-white font-bold animate-pulse shadow-sm shadow-red-500/50' 
        : 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
    },
    {
      id: 'reports' as NavTab,
      label: '6. Reportes Avanzados',
      shortLabel: 'Reportes',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'history' as NavTab,
      label: '7. Historial Forense',
      shortLabel: 'Historial',
      icon: History,
      badge: null,
    },
    {
      id: 'security' as NavTab,
      label: '8. Usuarios y Seguridad',
      shortLabel: 'Seguridad',
      icon: ShieldCheck,
      badge: 'RBAC',
      badgeColor: 'bg-[#1F2229] text-gray-400 border-white/10',
    },
  ];

  return (
    <aside className="w-full md:w-64 lg:w-72 bg-[#16181D] border-r border-[#D4AF37]/20 shrink-0 flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center space-x-3 border-b border-[#D4AF37]/10">
          <div className="w-10 h-10 bg-gradient-to-br from-[#D4AF37] to-[#B87333] rounded-lg flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 shrink-0">
            <span className="text-black font-bold text-xl">M</span>
          </div>
          <div className="truncate">
            <h1 className="text-[#D4AF37] font-bold tracking-wider text-base lg:text-lg leading-tight truncate">M-10 SYSTEM</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-medium">Mining Intelligence</p>
          </div>
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
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-[#D4AF37]/15 to-transparent border-l-2 border-[#D4AF37] text-[#D4AF37] shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2229]/60 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 transition-colors shrink-0 ${
                      isActive ? 'text-[#D4AF37]' : 'text-gray-400 group-hover:text-[#D4AF37]'
                    }`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                        item.badgeColor || 'bg-[#1F2229] text-gray-300 border-white/10'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Live System Telemetry Status Badge */}
      <div className="p-4 border-t border-[#D4AF37]/10">
        <div className="bg-[#1F2229] rounded-xl p-3.5 border border-[#C0C0C0]/10 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#D4AF37]" />
              Red Mesh Subterránea
            </span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
          </div>
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-silver">v2.4.0-STABLE</span>
            <span className="text-emerald-400 font-bold">99.8% ONLINE</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
