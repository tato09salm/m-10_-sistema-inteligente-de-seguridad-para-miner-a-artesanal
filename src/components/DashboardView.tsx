import React, { useState } from 'react';
import { 
  Users, 
  AlertTriangle, 
  Flame, 
  Activity, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  HardHat,
  Layers,
  Cable
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { Worker, Alert, MiningSector, DashboardStats, MineTunnel, TunnelConnection } from '../types';
import { MineMap3D } from './MineMap3D';

interface DashboardViewProps {
  workers: Worker[];
  alerts: Alert[];
  onNavigate?: (tab: string) => void;
  onNavigateToTab?: (tab: any) => void;
  onSelectWorker: (worker: Worker) => void;
  onAttendAlert?: (alert: Alert) => void;
  stats?: DashboardStats;
  tunnels?: MineTunnel[];
  connections?: TunnelConnection[];
}

const DEFAULT_SECTORS: { name: MiningSector; depth: string; hazardLevel: 'bajo' | 'medio' | 'alto' | 'critico'; coords: { x: number; y: number } }[] = [
  { name: 'Socavón Principal', depth: '0m (Bocamina)', hazardLevel: 'bajo', coords: { x: 18, y: 24 } },
  { name: 'Nivel -50m', depth: '-50m Subterráneo', hazardLevel: 'medio', coords: { x: 44, y: 38 } },
  { name: 'Galería Norte', depth: '-75m Subterráneo', hazardLevel: 'alto', coords: { x: 74, y: 30 } },
  { name: 'Chimenea 3', depth: '-90m Vertical', hazardLevel: 'medio', coords: { x: 26, y: 68 } },
  { name: 'Nivel -120m', depth: '-120m Fondo', hazardLevel: 'critico', coords: { x: 58, y: 74 } },
  { name: 'Frente de Extracción', depth: '-135m Veta Oro', hazardLevel: 'bajo', coords: { x: 84, y: 66 } },
];

function getOrthogonalPath2D(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y1 - y2) < 1.5) return `M ${x1}% ${y1}% L ${x2}% ${y2}%`;
  if (Math.abs(x1 - x2) < 1.5) return `M ${x1}% ${y1}% L ${x1}% ${y2}%`;
  const midX = (x1 + x2) / 2;
  return `M ${x1}% ${y1}% L ${midX}% ${y1}% L ${midX}% ${y2}% L ${x2}% ${y2}%`;
}

const ACTIVITY_DISTRIBUTION = [
  { name: 'Actividad Normal', value: 78, color: '#D4AF37' },
  { name: 'Movimiento Inusual', value: 14, color: '#B87333' },
  { name: 'Inmovilidad Prolongada', value: 5, color: '#F59E0B' },
  { name: 'Posible Caída', value: 3, color: '#EF4444' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  workers,
  alerts,
  onNavigate,
  onNavigateToTab,
  onSelectWorker,
  onAttendAlert,
  tunnels = [],
  connections = [],
}) => {
  const navigate = onNavigate || onNavigateToTab || (() => {});
  const activeAlerts = alerts.filter(a => a.status === 'activa');
  const criticalAlerts = activeAlerts.filter(a => a.priority === 'critica');
  const fallsToday = alerts.filter(a => a.type === 'caida_detectada').length;
  const immobilityToday = alerts.filter(a => a.type === 'inmovilidad_prolongada').length;
  const unusualToday = alerts.filter(a => a.type === 'movimiento_brusco').length;
  const [mapViewMode, setMapViewMode] = useState<'3d' | '2d'>('3d');

  // Dynamic 2D Sectors from registered tunnels or fallback
  const activeSectors2D = React.useMemo(() => {
    if (!tunnels || tunnels.length === 0) return DEFAULT_SECTORS;

    const defaultPositions2D: Record<string, { x: number; y: number }> = {
      'Socavón Principal': { x: 18, y: 24 },
      'Bocamina Principal': { x: 18, y: 24 },
      'Nivel -50m': { x: 44, y: 38 },
      'Galería Norte': { x: 74, y: 30 },
      'Chimenea 3': { x: 26, y: 68 },
      'Nivel -120m': { x: 58, y: 74 },
      'Frente de Extracción': { x: 84, y: 66 },
      'Galería Central By-pass': { x: 48, y: 54 },
    };

    return tunnels.map((t, idx) => {
      let coords = defaultPositions2D[t.name];
      if (!coords && t.description && t.description.includes('pos:')) {
        const match = t.description.match(/pos:([\d.]+),([\d.]+)/);
        if (match) coords = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
      }
      if (!coords) {
        const cols = Math.max(3, Math.ceil(Math.sqrt(tunnels.length)));
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        coords = {
          x: 18 + (col * 64) / Math.max(cols - 1, 1),
          y: 24 + (row * 52) / Math.max(Math.ceil(tunnels.length / cols) - 1, 1),
        };
      }

      return {
        id: t.id,
        name: t.name as MiningSector,
        depth: `${t.elevation}m Subterráneo`,
        hazardLevel: t.riskLevel,
        coords,
      };
    });
  }, [tunnels]);

  // Map sector ID and name to coordinates for 2D cable rendering
  const sectorCoordsMap = React.useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    activeSectors2D.forEach(s => {
      if ((s as any).id) map.set((s as any).id, s.coords);
      map.set(s.name, s.coords);
      map.set(s.name.toLowerCase().trim(), s.coords);
    });
    return map;
  }, [activeSectors2D]);

  // Dynamic 2D Active Connections
  const activeConnections2D = React.useMemo(() => {
    const CABLE_COLORS = ['#FBBF24', '#38BDF8', '#34D399', '#C084FC', '#FB7185', '#A3E635'];

    if (!connections || connections.length === 0) {
      if (tunnels && tunnels.length > 0) return [];
      // Default sample connections when no tunnels registered yet
      return [
        { p1: { x: 18, y: 24 }, p2: { x: 44, y: 38 }, color: '#FBBF24', dist: 45, id: 'd1' },
        { p1: { x: 44, y: 38 }, p2: { x: 74, y: 30 }, color: '#38BDF8', dist: 62, id: 'd2' },
        { p1: { x: 44, y: 38 }, p2: { x: 26, y: 68 }, color: '#34D399', dist: 55, id: 'd3' },
        { p1: { x: 26, y: 68 }, p2: { x: 58, y: 74 }, color: '#FB7185', dist: 78, id: 'd4' },
      ];
    }

    const res: { p1: { x: number; y: number }; p2: { x: number; y: number }; color: string; dist: number; id: string }[] = [];

    connections.forEach((c, idx) => {
      const p1 = sectorCoordsMap.get(c.sourceTunnelId) || 
                 (c.sourceName ? sectorCoordsMap.get(c.sourceName.toLowerCase().trim()) : undefined);
      const p2 = sectorCoordsMap.get(c.targetTunnelId) || 
                 (c.targetName ? sectorCoordsMap.get(c.targetName.toLowerCase().trim()) : undefined);

      if (p1 && p2) {
        res.push({
          p1,
          p2,
          color: c.status === 'bloqueado' ? '#EF4444' : CABLE_COLORS[idx % CABLE_COLORS.length],
          dist: c.distanceMeters || 35,
          id: c.id,
        });
      }
    });

    return res;
  }, [connections, sectorCoordsMap, tunnels]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Mining Operations Header */}
      <div className="bg-[#1A1C22] rounded-2xl border border-[#D4AF37]/10 p-5 lg:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <span className="text-[10px] text-[#D4AF37] font-mono tracking-wider">DATA_STREAM: ACTIVE</span>
        </div>

        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider">
              OPERACIÓN MINERA SUBTERRÁNEA
            </span>
            <span className="text-gray-400 text-xs flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-gray-500" /> Turno Mañana (06:00 - 14:00)
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
            Panel de Control & Monitoreo Cinemático
          </h1>
          <p className="text-xs text-gray-400 max-w-2xl">
            Vigilancia continua de acelerometría y giroscopía en smartphones para prevención de accidentes en galerías mineras.
          </p>
        </div>

        {/* Global Mine Risk Gauge */}
        <div className="flex items-center gap-4 bg-[#0F1115] border border-[#D4AF37]/20 rounded-xl p-3.5 px-5 shrink-0 z-10">
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Riesgo Global de Mina</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-2xl font-bold font-mono ${
                criticalAlerts.length > 0 ? 'text-red-500' : 'text-[#D4AF37]'
              }`}>
                {criticalAlerts.length > 0 ? '68%' : '14%'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                criticalAlerts.length > 0 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                  : 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
              }`}>
                {criticalAlerts.length > 0 ? 'Nivel Crítico' : 'Nivel Bajo'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-[#D4AF37]/30 flex items-center justify-center bg-[#1A1C22]">
            <HardHat className="w-5 h-5 text-[#D4AF37]" />
          </div>
        </div>
      </div>

      {/* 4 Sleek KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Trabajadores Activos */}
        <div 
          onClick={() => navigate('workers')}
          className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl cursor-pointer hover:border-[#D4AF37]/30 transition-all group"
        >
          <div className="text-gray-400 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Trabajadores Activos</span>
            <Users className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] transition-colors" />
          </div>
          <div className="flex items-end space-x-2">
            <span className="text-2xl font-bold text-white">{workers.length}</span>
            <span className="text-xs text-emerald-400 mb-1 font-medium font-mono">100% ONLINE</span>
          </div>
        </div>

        {/* Card 2: Incidentes Detectados */}
        <div 
          onClick={() => navigate('alerts')}
          className="bg-[#1A1C22] p-4 rounded-xl border border-red-500/20 shadow-xl cursor-pointer hover:border-red-500/40 transition-all group"
        >
          <div className="text-gray-400 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Incidentes Detectados</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-end space-x-2">
            <span className="text-2xl font-bold text-red-500 font-mono">
              {String(activeAlerts.length).padStart(2, '0')}
            </span>
            <span className="text-xs text-red-400/80 mb-1">
              {criticalAlerts.length} Críticos
            </span>
          </div>
        </div>

        {/* Card 3: Precisión IA */}
        <div 
          onClick={() => navigate('ai_model')}
          className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl cursor-pointer hover:border-[#D4AF37]/30 transition-all group"
        >
          <div className="text-gray-400 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Precisión IA (ML)</span>
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="flex items-end space-x-2">
            <span className="text-2xl font-bold text-[#D4AF37] font-mono">99.2%</span>
            <span className="text-xs text-gray-400 mb-1 font-mono">Model v4.2</span>
          </div>
        </div>

        {/* Card 4: Tiempo de Respuesta */}
        <div 
          onClick={() => navigate('monitoring')}
          className="bg-[#1A1C22] p-4 rounded-xl border border-[#D4AF37]/10 shadow-xl cursor-pointer hover:border-[#D4AF37]/30 transition-all group"
        >
          <div className="text-gray-400 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Tiempo de Respuesta</span>
            <Activity className="w-4 h-4 text-silver" />
          </div>
          <div className="flex items-end space-x-2">
            <span className="text-2xl font-bold text-silver font-mono">1.2s</span>
            <span className="text-xs text-gray-500 mb-1 font-mono">PROMEDIO</span>
          </div>
        </div>

      </div>

      {/* Middle Grid: Telemetry & Subterranean Map + AI Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Subterranean Interactive Mine Sector Map (3D / 2D) */}
        <div className="lg:col-span-8 bg-[#1A1C22] rounded-2xl border border-[#D4AF37]/10 p-5 lg:p-6 shadow-2xl flex flex-col justify-between relative">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#D4AF37] rounded-full animate-pulse"></span>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Mapa de Socavones & Mineros en Tiempo Real
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 uppercase">
                  {mapViewMode === '3d' ? '3D INTERACTIVO' : 'PLANO 2D'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Cable className="w-2.5 h-2.5" /> {(connections || []).length} CABLES ACTIVOS
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Topografía subterránea y ubicación de mineros en socavones, niveles de extracción y chimeneas.
              </p>
            </div>

            {/* Quick Actions & View Mode Switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('socavones')}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-[#D4AF37]/20 border border-white/10 hover:border-[#D4AF37]/40 text-gray-300 hover:text-[#D4AF37] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                title="Tender o gestionar cables entre socavones"
              >
                <Cable className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Conectar Socavones</span>
              </button>

              <div className="flex items-center gap-1 bg-[#0F1115] p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  id="btn-map-mode-3d"
                  onClick={() => setMapViewMode('3d')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mapViewMode === '3d'
                      ? 'bg-[#D4AF37] text-black shadow-md font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Ver Modelo 3D Subterráneo con rotación, profundidad y zoom"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Vista 3D</span>
                </button>

                <button
                  id="btn-map-mode-2d"
                  onClick={() => setMapViewMode('2d')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mapViewMode === '2d'
                      ? 'bg-[#D4AF37] text-black shadow-md font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Ver Esquema 2D Tradicional"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Plano 2D</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3D WebGL Mine Visualization */}
          {mapViewMode === '3d' ? (
            <div className="w-full">
              <MineMap3D
                workers={workers}
                alerts={alerts}
                tunnels={tunnels}
                connections={connections}
                onSelectWorker={onSelectWorker}
                onNavigateToMonitoring={(w) => navigate('monitoring')}
                onNavigateToSocavones={() => navigate('socavones')}
              />
            </div>
          ) : (
            /* 2D Subterranean Schematic with Dynamic Orthogonal Continuous Cables */
            <div className="w-full h-84 rounded-xl bg-[#0F1115] border border-white/5 relative overflow-hidden p-4">
              {/* Grid Background */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-15"
                style={{
                  backgroundImage: 'radial-gradient(circle at 50% 50%, #D4AF37 1px, transparent 1px)',
                  backgroundSize: '32px 32px'
                }}
              />

              {/* Dynamic SVG Continuous Orthogonal Cables */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <filter id="dash-cable-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D4AF37" floodOpacity="0.6" />
                  </filter>
                </defs>

                {activeConnections2D.map((conn, cIdx) => {
                  const p1 = conn.p1;
                  const p2 = conn.p2;
                  const path = getOrthogonalPath2D(p1.x, p1.y, p2.x, p2.y);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  const color = conn.color;

                  return (
                    <g key={conn.id || cIdx}>
                      {/* Outer Glow */}
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeOpacity="0.3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        filter="url(#dash-cable-glow)"
                      />
                      {/* Core Continuous Cable */}
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {/* Elbow markers */}
                      <circle cx={`${midX}%`} cy={`${p1.y}%`} r="2.5" fill={color} opacity="0.8" />
                      <circle cx={`${midX}%`} cy={`${p2.y}%`} r="2.5" fill={color} opacity="0.8" />

                      {/* Compact Distance Badge */}
                      <foreignObject
                        x={`calc(${midX}% - 24px)`}
                        y={`calc(${midY}% - 9px)`}
                        width="48"
                        height="18"
                        className="overflow-visible"
                      >
                        <div 
                          className="px-1 py-0.2 rounded-full text-[8px] font-mono text-center font-bold bg-[#121418]/90 text-gray-200 border shadow-md"
                          style={{ borderColor: color }}
                        >
                          {conn.dist}m
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* Dynamic Mine Socavón Nodes */}
              {activeSectors2D.map((sector) => {
                const sectorWorkers = workers.filter(w => w.sector === sector.name);
                const hasHazard = sectorWorkers.some(w => w.status === 'peligro');
                const hasWarning = sectorWorkers.some(w => w.status === 'advertencia');
                const connectedCount = (connections || []).filter(c => 
                  c.sourceTunnelId === (sector as any).id || c.targetTunnelId === (sector as any).id ||
                  c.sourceName === sector.name || c.targetName === sector.name
                ).length;

                return (
                  <div
                    key={sector.name}
                    style={{ left: `${sector.coords.x}%`, top: `${sector.coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
                    onClick={() => navigate('socavones')}
                    title={`Ver socavón ${sector.name} (${connectedCount} cables conectados)`}
                  >
                    <div className="relative">
                      {hasHazard && (
                        <span className="absolute -inset-2 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
                      )}

                      <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 ${
                        hasHazard 
                          ? 'bg-red-950 border-red-500 text-red-200 shadow-red-500/30' 
                          : hasWarning 
                          ? 'bg-[#B87333]/20 border-[#B87333] text-[#FDBA74]' 
                          : 'bg-[#1F2229] border-[#C0C0C0]/20 text-gray-200 hover:border-[#D4AF37] hover:shadow-lg'
                      }`}>
                        <MapPin className={`w-3.5 h-3.5 ${hasHazard ? 'text-red-400 animate-bounce' : hasWarning ? 'text-[#B87333]' : 'text-[#D4AF37]'}`} />
                        <span className="truncate max-w-[110px]">{sector.name}</span>
                        <span className="text-[10px] font-mono px-1 rounded bg-[#0F1115] text-gray-300">
                          {sectorWorkers.length}
                        </span>
                        {connectedCount > 0 && (
                          <span className="text-[9px] font-mono text-[#D4AF37] font-bold" title={`${connectedCount} cables conectados`}>
                            ·{connectedCount}⚡
                          </span>
                        )}
                      </div>

                      {/* Lateral Connection Pins ("de cuadrado a cuadrado") */}
                      <span className={`absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${
                        connectedCount > 0 ? 'bg-amber-400 border-amber-300' : 'bg-gray-700 border-gray-600'
                      }`} />
                      <span className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${
                        connectedCount > 0 ? 'bg-amber-400 border-amber-300' : 'bg-gray-700 border-gray-600'
                      }`} />

                      {/* Sector Tooltip */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1A1C22] border border-[#D4AF37]/20 rounded-lg p-2.5 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                        <div className="text-[11px] font-bold text-white flex items-center justify-between">
                          <span>{sector.name}</span>
                          <span className="text-[9px] text-[#D4AF37] font-mono">{connectedCount} cables</span>
                        </div>
                        <div className="text-[10px] text-gray-400">{sector.depth}</div>
                        <div className="mt-1 pt-1 border-t border-white/5 space-y-1">
                          {sectorWorkers.length === 0 ? (
                            <div className="text-[9px] text-gray-500 italic">Sin mineros asignados</div>
                          ) : (
                            sectorWorkers.map(w => (
                              <div key={w.id} className="text-[10px] flex items-center justify-between text-gray-300">
                                <span>{w.name.split(' ')[0]}</span>
                                <span className={`px-1 rounded text-[9px] ${
                                  w.status === 'peligro' ? 'bg-red-500/20 text-red-300' :
                                  w.status === 'advertencia' ? 'bg-[#B87333]/20 text-[#FDBA74]' :
                                  'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {w.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Gateway Socavón: Mesh LoRa/Wi-Fi Subterráneo Activo
            </span>
            <button
              onClick={() => navigate('monitoring')}
              className="text-[#D4AF37] hover:text-white flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              Ver osciloscopio en vivo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 4 Cols: AI Activity Classification Pie */}
        <div className="lg:col-span-4 bg-[#1A1C22] rounded-2xl border border-[#D4AF37]/10 p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                Distribución IA de Actividades
              </h2>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Clasificación automática por modelo ML sobre cinemática del turno.
            </p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ACTIVITY_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {ACTIVITY_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1C22', borderColor: 'rgba(212,175,55,0.2)', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                    formatter={(value) => [`${value}%`, 'Proporción']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 mt-2">
              {ACTIVITY_DISTRIBUTION.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 flex items-center justify-between font-mono">
            <span>Latencia Inferencia:</span>
            <span className="text-emerald-400 font-bold">14.2 ms</span>
          </div>
        </div>

      </div>

      {/* Sector Risk Classification Grid (Matching Design HTML) */}
      <div className="bg-[#1A1C22] rounded-2xl border border-[#D4AF37]/10 p-5 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-white">Clasificación de Riesgo por Sector</h3>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#D4AF37]"></span>
              <span className="text-[10px] text-gray-400">Nivel Bajo</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#B87333]"></span>
              <span className="text-[10px] text-gray-400">Nivel Medio</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span className="text-[10px] text-gray-400">Nivel Crítico</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-[#0F1115] border border-white/5 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Galería 01</p>
            <p className="text-sm font-bold text-[#D4AF37]">ESTABLE</p>
          </div>
          <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tajo Central</p>
            <p className="text-sm font-bold text-red-500">ALERTA</p>
          </div>
          <div className="bg-[#0F1115] border border-white/5 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Galería 02</p>
            <p className="text-sm font-bold text-[#D4AF37]">ESTABLE</p>
          </div>
          <div className="bg-[#0F1115] border border-white/5 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pozo Sur</p>
            <p className="text-sm font-bold text-silver font-mono">NORMAL</p>
          </div>
          <div className="bg-[#B87333]/10 border border-[#B87333]/30 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Nivel -100m</p>
            <p className="text-sm font-bold text-[#B87333]">RIESGO</p>
          </div>
          <div className="bg-[#0F1115] border border-white/5 p-3 rounded-lg text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Logística</p>
            <p className="text-sm font-bold text-[#D4AF37]">ESTABLE</p>
          </div>
        </div>
      </div>

      {/* Active Alerts Feed */}
      <div className="bg-[#1A1C22] rounded-2xl border border-[#D4AF37]/10 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
              Centro de Atención de Alertas en Tiempo Real
            </h2>
            <p className="text-[11px] text-gray-400">
              Notificaciones generadas por la IA al detectar caídas, choques o inmovilidad en los socavones.
            </p>
          </div>

          <button
            onClick={() => navigate('alerts')}
            className="text-xs text-[#D4AF37] hover:text-white font-semibold flex items-center gap-1 transition-colors"
          >
            Ver todas ({alerts.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2 bg-[#0F1115] rounded-xl border border-white/5">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <span className="font-semibold text-gray-200">No hay alertas activas pendientes</span>
            <span className="text-gray-400 text-[11px]">Todos los trabajadores se encuentran en estado de operación normal.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.slice(0, 3).map((alert) => {
              const isCrit = alert.priority === 'critica';
              const isHigh = alert.priority === 'alta';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isCrit 
                      ? 'bg-red-500/10 border-red-500/20 shadow-md' 
                      : isHigh 
                      ? 'bg-[#B87333]/15 border-[#B87333]/30' 
                      : 'bg-[#1F2229] border-[#D4AF37]/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isCrit ? 'bg-red-500 text-white animate-pulse' : isHigh ? 'bg-[#B87333] text-white' : 'bg-[#D4AF37] text-black font-bold'
                    }`}>
                      <Flame className="w-4 h-4" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{alert.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          isCrit ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                          isHigh ? 'bg-[#B87333]/20 text-[#FDBA74] border border-[#B87333]/40' :
                          'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                        }`}>
                          {alert.priority}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-300 leading-snug">
                        {alert.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1">
                        <span>Minero: <strong className="text-white">{alert.workerName}</strong> ({alert.workerCode})</span>
                        <span>•</span>
                        <span>Sector: <strong className="text-white">{alert.sector}</strong></span>
                        <span>•</span>
                        <span>SVM: <strong className="text-[#D4AF37] font-mono">{alert.metrics.svm} m/s²</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      id={`btn-attend-dash-${alert.id}`}
                      onClick={() => onAttendAlert ? onAttendAlert(alert) : navigate('alerts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow ${
                        isCrit 
                          ? 'bg-red-500 hover:bg-red-600 text-white uppercase font-bold text-[10px]' 
                          : 'bg-[#D4AF37] hover:bg-[#AA7C11] text-black font-bold text-[10px] uppercase'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Despachar Auxilio
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
