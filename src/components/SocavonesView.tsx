import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Plus,
  Cable,
  MapPin,
  Mountain,
  Boxes,
  ArrowUpCircle,
  Pickaxe,
  Check,
  X,
  Trash2,
  Edit3,
  ExternalLink,
  Layers,
  Zap,
  Info,
  ShieldCheck,
  AlertTriangle,
  Flame,
  HardHat,
  RefreshCw,
  Navigation,
  Sparkles,
  Loader2,
  Link2
} from 'lucide-react';
import { MineTunnel, TunnelConnection, TunnelType, RiskLevel } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';

interface SocavonesViewProps {
  onNavigateToMonitoring?: () => void;
  tunnels?: MineTunnel[];
  connections?: TunnelConnection[];
  onTunnelsChange?: React.Dispatch<React.SetStateAction<MineTunnel[]>>;
  onConnectionsChange?: React.Dispatch<React.SetStateAction<TunnelConnection[]>>;
}

// Luminous Cable Color Palette adapted for Dark and Light Modes
interface CableStyle {
  name: string;
  darkCore: string;
  darkGlow: string;
  darkPulse: string;
  lightCore: string;
  lightGlow: string;
  lightPulse: string;
}

const CABLE_COLOR_PALETTE: CableStyle[] = [
  {
    name: 'Oro Solar (Tensión Principal)',
    darkCore: '#FBBF24',      // Bright Golden Amber
    darkGlow: '#F59E0B',
    darkPulse: '#FEF08A',
    lightCore: '#D97706',     // Deep Vibrant Amber
    lightGlow: 'rgba(217, 119, 6, 0.45)',
    lightPulse: '#B45309',
  },
  {
    name: 'Cian Eléctrico (Fibra Óptica)',
    darkCore: '#38BDF8',      // Electric Sky Cyan
    darkGlow: '#06B6D4',
    darkPulse: '#BAE6FD',
    lightCore: '#0284C7',     // Royal Cyan Blue
    lightGlow: 'rgba(2, 132, 199, 0.45)',
    lightPulse: '#0369A1',
  },
  {
    name: 'Esmeralda Láser (Telemetría)',
    darkCore: '#34D399',      // Luminous Emerald
    darkGlow: '#10B981',
    darkPulse: '#A7F3D0',
    lightCore: '#059669',     // Rich Emerald Green
    lightGlow: 'rgba(5, 150, 105, 0.45)',
    lightPulse: '#047857',
  },
  {
    name: 'Violeta Neón (Malla Mesh)',
    darkCore: '#C084FC',      // Neon Purple
    darkGlow: '#A855F7',
    darkPulse: '#E9D5FF',
    lightCore: '#7C3AED',     // Deep Royal Violet
    lightGlow: 'rgba(124, 58, 237, 0.45)',
    lightPulse: '#6D28D9',
  },
  {
    name: 'Coral / Carmesí (Seguridad)',
    darkCore: '#FB7185',      // Bright Coral Rose
    darkGlow: '#F43F5E',
    darkPulse: '#FECDD3',
    lightCore: '#DC2626',     // Intense Crimson Red
    lightGlow: 'rgba(220, 38, 38, 0.45)',
    lightPulse: '#B91C1C',
  },
  {
    name: 'Lima Radiante (Ventilación)',
    darkCore: '#A3E635',      // Lime Glow
    darkGlow: '#84CC16',
    darkPulse: '#D9F99D',
    lightCore: '#65A30D',     // Deep Lime Green
    lightGlow: 'rgba(101, 163, 13, 0.45)',
    lightPulse: '#4D7C0F',
  },
];

// Helper to extract Lat/Lng from Google Maps inputs (coordinates or links)
function parseGoogleMapsCoords(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(/(-?\d+\.\d+)[,\s/]+(-?\d+\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

// Compute clean coordinates on the 2D canvas for each tunnel
function getTunnelCanvasCoords(tunnel: MineTunnel, index: number, total: number): { x: number; y: number } {
  if (tunnel.description && tunnel.description.includes('pos:')) {
    const match = tunnel.description.match(/pos:([\d.]+),([\d.]+)/);
    if (match) {
      return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }
  }

  const defaultPositions = [
    { x: 18, y: 26 }, // Bocamina Principal (Noroeste)
    { x: 44, y: 38 }, // Nivel -50m (Centro-Norte)
    { x: 74, y: 28 }, // Galería Norte (Noreste)
    { x: 28, y: 68 }, // Chimenea 3 (Suroeste)
    { x: 58, y: 72 }, // Nivel -120m (Sur)
    { x: 84, y: 64 }, // Frente de Extracción (Sureste)
    { x: 50, y: 54 }, // Galería Central By-pass
  ];

  if (index < defaultPositions.length) {
    return defaultPositions[index];
  }

  const cols = Math.max(3, Math.ceil(Math.sqrt(total)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 16 + (col * 68) / Math.max(cols - 1, 1),
    y: 22 + (row * 56) / Math.max(Math.ceil(total / cols) - 1, 1),
  };
}

// Helper: Compute clean continuous cable paths (direct or orthogonal) in raw pixel coordinates (NO % in path)
function getCableGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mode: 'direct' | 'orthogonal' = 'direct'
): { path: string; midX: number; midY: number; elbows: { x: number; y: number }[] } {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  if (mode === 'direct') {
    return {
      path: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      midX,
      midY,
      elbows: [],
    };
  }

  // Orthogonal stepped Manhattan routing
  const hasElbows = Math.abs(x1 - x2) >= 12 && Math.abs(y1 - y2) >= 12;
  if (!hasElbows) {
    return {
      path: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      midX,
      midY,
      elbows: [],
    };
  }

  return {
    path: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${midX.toFixed(1)} ${y1.toFixed(1)} L ${midX.toFixed(1)} ${y2.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    midX,
    midY,
    elbows: [
      { x: midX, y: y1 },
      { x: midX, y: y2 },
    ],
  };
}

export const SocavonesView: React.FC<SocavonesViewProps> = ({
  onNavigateToMonitoring,
  tunnels: propTunnels,
  connections: propConnections,
  onTunnelsChange,
  onConnectionsChange,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tunnels, setTunnels] = useState<MineTunnel[]>(propTunnels || []);
  const [connections, setConnections] = useState<TunnelConnection[]>(propConnections || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync when parent props change
  useEffect(() => {
    if (propTunnels && propTunnels.length > 0) {
      setTunnels(propTunnels);
    }
  }, [propTunnels]);

  useEffect(() => {
    if (propConnections) {
      setConnections(propConnections);
    }
  }, [propConnections]);

  // Selected Socavón for detail inspector drawer
  const [selectedTunnel, setSelectedTunnel] = useState<MineTunnel | null>(null);

  // Interactive Cable Wiring Simulator State
  const [cableSourceTunnel, setCableSourceTunnel] = useState<MineTunnel | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCableModeActive, setIsCableModeActive] = useState<boolean>(false);
  const [hoveredTargetTunnel, setHoveredTargetTunnel] = useState<MineTunnel | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal State for Simple Registration
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTunnel, setEditingTunnel] = useState<MineTunnel | null>(null);

  // Simple Form State
  const [formName, setFormName] = useState('');
  const [formCoords, setFormCoords] = useState('');
  const [formType, setFormType] = useState<TunnelType>('galeria');
  const [formElevation, setFormElevation] = useState<number>(-50);
  const [formRisk, setFormRisk] = useState<RiskLevel>('bajo');
  const [placedPos, setPlacedPos] = useState<{ x: number; y: number } | null>(null);

  // Maps URL resolution state
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [coordInputMode, setCoordInputMode] = useState<'url' | 'manual'>('url');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 1000, height: 600 });
  const [cableRoutingStyle, setCableRoutingStyle] = useState<'direct' | 'orthogonal'>('direct');

  // Keep canvas pixel dimensions synchronized for 100% accurate SVG continuous lines
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Toast Helper
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackToast({ msg, type });
    setTimeout(() => setFeedbackToast(null), 3800);
  };

  // Load Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tunnelsData, connsData] = await Promise.all([
        api.getSocavones(),
        api.getTunnelConnections(),
      ]);
      setTunnels(tunnelsData || []);
      setConnections(connsData || []);
    } catch (err) {
      console.error('Error cargando socavones:', err);
      showToast('Error sincronizando socavones con el servidor.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Tunnels by search query
  const filteredTunnels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return tunnels;
    return tunnels.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        `${t.elevation}m`.includes(q)
    );
  }, [tunnels, searchQuery]);

  // Map of tunnel ID -> canvas (x, y) coordinates
  const tunnelPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    tunnels.forEach((t, i) => {
      map.set(t.id, getTunnelCanvasCoords(t, i, tunnels.length));
    });
    return map;
  }, [tunnels]);

  // Helper to convert percentage coords to exact canvas pixel coords
  const getTunnelPixelPos = (tunnelId: string): { x: number; y: number } | null => {
    const pct = tunnelPositions.get(tunnelId);
    if (!pct) return null;
    return {
      x: (pct.x / 100) * canvasSize.width,
      y: (pct.y / 100) * canvasSize.height,
    };
  };

  // Track mouse coordinates on canvas for interactive cable simulation
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  // Cancel cable wiring on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cableSourceTunnel) {
          setCableSourceTunnel(null);
          showToast('Tendido de cable cancelado.', 'info');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cableSourceTunnel]);

  // Handle click on a socavón node
  const handleSocavonNodeClick = async (tunnel: MineTunnel, e: React.MouseEvent) => {
    e.stopPropagation();

    // If currently wiring a cable from another socavón
    if (cableSourceTunnel) {
      if (cableSourceTunnel.id === tunnel.id) {
        showToast('No puedes conectar un socavón consigo mismo.', 'info');
        return;
      }

      // Check if connection already exists
      const exists = connections.some(
        c =>
          (c.sourceTunnelId === cableSourceTunnel.id && c.targetTunnelId === tunnel.id) ||
          (c.sourceTunnelId === tunnel.id && c.targetTunnelId === cableSourceTunnel.id)
      );

      if (exists) {
        showToast(`Ya existe un cable tendido entre ${cableSourceTunnel.name} y ${tunnel.name}.`, 'info');
        setCableSourceTunnel(null);
        return;
      }

      // Calculate approximate distance
      const pA = tunnelPositions.get(cableSourceTunnel.id) || { x: 0, y: 0 };
      const pB = tunnelPositions.get(tunnel.id) || { x: 0, y: 0 };
      const dx = pA.x - pB.x;
      const dy = pA.y - pB.y;
      const estimatedMeters = Math.max(15, Math.round(Math.sqrt(dx * dx + dy * dy) * 1.8));

      try {
        const newConn = await api.createTunnelConnection({
          sourceTunnelId: cableSourceTunnel.id,
          targetTunnelId: tunnel.id,
          connectionType: 'rampa_inclinada',
          distanceMeters: estimatedMeters,
          status: 'abierto',
          notes: `Cable de enlace directo tendido entre ${cableSourceTunnel.name} y ${tunnel.name}`,
        });

        setConnections(prev => {
          const next = [...prev, newConn];
          onConnectionsChange?.(next);
          return next;
        });
        showToast(`¡Cable de ${estimatedMeters}m conectado exitosamente!`, 'success');
      } catch (err: any) {
        showToast(err.message || 'Error conectando socavones', 'error');
      } finally {
        setCableSourceTunnel(null);
      }
      return;
    }

    // If cable mode is active, start wiring
    if (isCableModeActive) {
      setCableSourceTunnel(tunnel);
      showToast(`Cable fijado en "${tunnel.name}". Haz clic en el socavón de destino.`, 'info');
      return;
    }

    // Default: Open Inspector Drawer
    setSelectedTunnel(tunnel);
  };

  // Delete a cable connection
  const handleDeleteConnection = async (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteTunnelConnection(connId);
      setConnections(prev => {
        const next = prev.filter(c => c.id !== connId);
        onConnectionsChange?.(next);
        return next;
      });
      showToast('Cable desconectado.', 'info');
    } catch {
      showToast('Error al desconectar cable.', 'error');
    }
  };

  // Reset all coordinate-related form state
  const resetCoordState = () => {
    setFormCoords('');
    setResolvedCoords(null);
    setResolveError(null);
    setManualLat('');
    setManualLng('');
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingTunnel(null);
    setFormName('');
    resetCoordState();
    setCoordInputMode('url');
    setFormType('galeria');
    setFormElevation(-50);
    setFormRisk('bajo');
    setPlacedPos(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (tunnel: MineTunnel) => {
    setEditingTunnel(tunnel);
    setFormName(tunnel.name);
    const match = tunnel.description?.match(/maps:([-\d.,\s]+)/);
    const coordStr = match ? match[1].trim() : '';
    resetCoordState();
    setCoordInputMode('url');
    if (coordStr) {
      const parts = coordStr.split(',').map((p: string) => p.trim());
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        setResolvedCoords({ lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) });
      }
    }
    setFormType(tunnel.tunnelType);
    setFormElevation(tunnel.elevation);
    setFormRisk(tunnel.riskLevel);
    setPlacedPos(null);
    setIsCreateModalOpen(true);
  };

  // Resolve Google Maps URL via backend
  const handleResolveUrl = async () => {
    const input = formCoords.trim();
    if (!input) return;
    setIsResolvingUrl(true);
    setResolveError(null);
    setResolvedCoords(null);
    try {
      const result = await api.resolveMapsUrl(input);
      setResolvedCoords({ lat: result.lat, lng: result.lng });
      // If placeName was extracted and formName is empty, auto-fill it!
      if (result.placeName && !formName.trim()) {
        setFormName(result.placeName);
      }
      showToast('¡Coordenadas extraídas exitosamente desde Google Maps!', 'success');
    } catch (err: any) {
      setResolveError(err.message || 'No se pudo resolver la URL. Prueba con el modo manual.');
    } finally {
      setIsResolvingUrl(false);
    }
  };

  // Save Socavón (Create or Update)
  const handleSaveSocavon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Por favor ingresa un nombre para el socavón.', 'error');
      return;
    }

    // Auto generate unique code if creating
    let autoCode = editingTunnel ? editingTunnel.code : '';
    if (!autoCode) {
      const existingCodes = new Set(tunnels.map(t => t.code.toUpperCase()));
      let nextNum = tunnels.length + 1;
      while (existingCodes.has(`SOC-${String(nextNum).padStart(2, '0')}`)) {
        nextNum++;
      }
      autoCode = `SOC-${String(nextNum).padStart(2, '0')}`;
    }

    // Determine final coordinates
    let finalLat: number | null = null;
    let finalLng: number | null = null;

    if (coordInputMode === 'manual') {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        finalLat = lat;
        finalLng = lng;
      }
    } else if (resolvedCoords) {
      finalLat = resolvedCoords.lat;
      finalLng = resolvedCoords.lng;
    } else {
      // Fallback: try inline parse of formCoords
      const parsed = parseGoogleMapsCoords(formCoords);
      if (parsed) {
        finalLat = parsed.lat;
        finalLng = parsed.lng;
      }
    }

    const coordsStr = (finalLat !== null && finalLng !== null)
      ? `maps:${finalLat.toFixed(6)},${finalLng.toFixed(6)}`
      : '';
    const posStr = placedPos ? ` pos:${placedPos.x.toFixed(1)},${placedPos.y.toFixed(1)}` : '';
    const mapsRef = formCoords.trim().startsWith('http') ? ` url:${formCoords.trim()}` : '';

    const payload: Partial<MineTunnel> = {
      name: formName.trim(),
      code: autoCode,
      tunnelType: formType,
      elevation: formElevation,
      riskLevel: formRisk,
      status: 'activo',
      startX: placedPos ? placedPos.x : 40,
      startY: placedPos ? placedPos.y : 40,
      startZ: formElevation,
      endX: placedPos ? placedPos.x + 10 : 50,
      endY: placedPos ? placedPos.y : 40,
      endZ: formElevation,
      lengthMeters: 45,
      widthMeters: 2.5,
      heightMeters: 2.2,
      ventilationStatus: 'optimo',
      description: `${coordsStr}${mapsRef}${posStr}`.trim() || 'Registrado manualmente',
    };

    try {
      if (editingTunnel) {
        const updated = await api.updateSocavon(editingTunnel.id, payload);
        setTunnels(prev => {
          const next = prev.map(t => (t.id === updated.id ? updated : t));
          onTunnelsChange?.(next);
          return next;
        });
        if (selectedTunnel?.id === updated.id) setSelectedTunnel(updated);
        showToast(`Socavón "${updated.name}" actualizado.`, 'success');
      } else {
        const created = await api.createSocavon(payload);
        setTunnels(prev => {
          const next = [created, ...prev];
          onTunnelsChange?.(next);
          return next;
        });
        setSelectedTunnel(created);
        showToast(`Socavón "${created.name}" registrado y guardado en base de datos.`, 'success');
      }
      setIsCreateModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error guardando socavón', 'error');
    }
  };

  // Delete Socavón
  const handleDeleteSocavon = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el socavón "${name}" y todos sus cables conectados?`)) {
      return;
    }
    try {
      await api.deleteSocavon(id);
      setTunnels(prev => {
        const next = prev.filter(t => t.id !== id);
        onTunnelsChange?.(next);
        return next;
      });
      setConnections(prev => {
        const next = prev.filter(c => c.sourceTunnelId !== id && c.targetTunnelId !== id);
        onConnectionsChange?.(next);
        return next;
      });
      if (selectedTunnel?.id === id) setSelectedTunnel(null);
      showToast(`Socavón "${name}" eliminado.`, 'info');
    } catch {
      showToast('Error al eliminar socavón.', 'error');
    }
  };

  // Get Labor Icon
  const getLaborIcon = (type: TunnelType) => {
    switch (type) {
      case 'rampa':
        return Mountain;
      case 'chimenea_pique':
        return ArrowUpCircle;
      case 'tajo_explotacion':
        return Pickaxe;
      default:
        return Boxes;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3 ${
          feedbackToast.type === 'success' 
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' 
            : feedbackToast.type === 'error'
            ? 'bg-red-950/95 border-red-500/50 text-red-200'
            : isDark ? 'bg-[#1A1C22]/95 border-[#D4AF37]/50 text-gray-200' : 'bg-white/95 border-amber-500/50 text-slate-800'
        }`}>
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 animate-spin" />
          <span>{feedbackToast.msg}</span>
        </div>
      )}

      {/* Top Controls: Prominent Search & Action Buttons */}
      <div className={`border rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 transition-colors ${
        isDark 
          ? 'bg-[#16181D] border-[#D4AF37]/20 text-white' 
          : 'bg-white border-slate-200 shadow-slate-200/50 text-slate-800'
      }`}>
        
        {/* [ Buscador ] */}
        <div className="relative w-full md:w-96">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            isDark ? 'text-[#D4AF37]' : 'text-amber-600'
          }`} />
          <input
            id="input-search-socavones"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar socavón por nombre, cota o código..."
            className={`w-full text-xs rounded-xl pl-9 pr-8 py-2.5 outline-none transition-all ${
              isDark 
                ? 'bg-[#0F1115] border border-white/10 focus:border-[#D4AF37] text-white placeholder:text-gray-500' 
                : 'bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons: Line Style Toggle, Cable Mode & New Socavón */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Continuous Line Routing Style Toggle */}
          <div className={`flex items-center p-0.5 rounded-xl border text-xs shadow-sm ${
            isDark ? 'bg-[#0F1115] border-white/10' : 'bg-slate-100 border-slate-300'
          }`}>
            <button
              type="button"
              onClick={() => setCableRoutingStyle('direct')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                cableRoutingStyle === 'direct'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B38B21] text-black font-bold shadow'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Líneas continuas directas entre socavones"
            >
              ── Directa
            </button>
            <button
              type="button"
              onClick={() => setCableRoutingStyle('orthogonal')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                cableRoutingStyle === 'orthogonal'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B38B21] text-black font-bold shadow'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Líneas continuas ortogonales (ángulo recto)"
            >
              ┐ Ortogonal
            </button>
          </div>

          {/* Cable Mode Toggle */}
          <button
            id="btn-toggle-cable-mode"
            onClick={() => {
              const next = !isCableModeActive;
              setIsCableModeActive(next);
              if (!next) setCableSourceTunnel(null);
              showToast(
                next 
                  ? 'Modo Cable ACTIVADO: Haz clic en un socavón para tender el cable.' 
                  : 'Modo Cable desactivado.',
                'info'
              );
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              isCableModeActive || cableSourceTunnel
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] text-black border-[#FFE27D] shadow-lg shadow-[#D4AF37]/30 font-bold animate-pulse'
                : isDark
                ? 'bg-[#1F2229] border-white/10 text-gray-300 hover:border-[#D4AF37]/50 hover:text-white'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:border-amber-500 hover:text-slate-900'
            }`}
            title="Conectar socavones con cables luminosos"
          >
            <Cable className="w-4 h-4" />
            <span>{cableSourceTunnel ? 'Tendido en Curso...' : isCableModeActive ? 'Modo Cable Activo' : 'Tender Cable'}</span>
          </button>

          {/* New Socavón Button */}
          <button
            id="btn-open-create-socavon"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38B21] text-black text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Socavón</span>
          </button>

        </div>
      </div>

      {/* Main Interactive Map & Cable Wiring Canvas */}
      <div 
        ref={canvasContainerRef}
        onMouseMove={handleCanvasMouseMove}
        onClick={() => {
          if (cableSourceTunnel) {
            setCableSourceTunnel(null);
            showToast('Tendido cancelado.', 'info');
          }
          if (selectedTunnel) {
            setSelectedTunnel(null);
          }
        }}
        className={`relative w-full h-[540px] lg:h-[600px] rounded-2xl border shadow-2xl overflow-hidden select-none transition-all ${
          isDark 
            ? 'bg-[#0A0C10] border-[#D4AF37]/25' 
            : 'bg-[#F8FAFC] border-slate-300 shadow-slate-300/40'
        } ${cableSourceTunnel ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        {/* Topographic Background Texture (Adapts to Dark / Light) */}
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, ${isDark ? '#D4AF37' : '#64748B'} 1.2px, transparent 1.2px)`,
            backgroundSize: '36px 36px',
            opacity: isDark ? 0.14 : 0.22,
          }}
        />

        {/* Live Wiring Prompt Banner (Shown when user is pulling a cable) */}
        {cableSourceTunnel && (
          <div className={`absolute top-3 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 border px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce ${
            isDark ? 'bg-[#16181D]/95 border-[#D4AF37] text-white' : 'bg-white/95 border-amber-500 text-slate-900 shadow-amber-500/20'
          }`}>
            <div className="w-3 h-3 rounded-full bg-[#D4AF37] animate-ping" />
            <div className="text-xs">
              <span className="font-bold">Tendido de cable desde: </span>
              <span className="text-[#D4AF37] font-semibold">{cableSourceTunnel.name}</span>
              <span className={`block text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Haz clic en el socavón destino para conectarlo (Esc para cancelar).
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCableSourceTunnel(null);
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SVG Wiring Layer: Multi-Colored Glowing Cables + Live Cable Simulation */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            {/* Multi-Colored Glowing Drop-Shadow Filters */}
            {CABLE_COLOR_PALETTE.map((c, i) => (
              <filter key={i} id={`cable-glow-${i}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow 
                  dx="0" 
                  dy="0" 
                  stdDeviation={isDark ? "4" : "2"} 
                  floodColor={isDark ? c.darkGlow : c.lightGlow} 
                  floodOpacity={isDark ? "0.85" : "0.55"} 
                />
              </filter>
            ))}

            {/* Live Pulled Cable Glow */}
            <filter id="live-cable-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow 
                dx="0" 
                dy="0" 
                stdDeviation="5" 
                floodColor={isDark ? "#FBBF24" : "#D97706"} 
                floodOpacity="0.9" 
              />
            </filter>
          </defs>

          {/* 1. Existing Connected Cables with Continuous Solid Lines */}
          {connections.map((conn, connIdx) => {
            const p1 = getTunnelPixelPos(conn.sourceTunnelId);
            const p2 = getTunnelPixelPos(conn.targetTunnelId);
            if (!p1 || !p2) return null;

            // Pick distinct luminous color configuration from palette
            const colorConfig = CABLE_COLOR_PALETTE[connIdx % CABLE_COLOR_PALETTE.length];
            const coreColor = isDark ? colorConfig.darkCore : colorConfig.lightCore;
            const glowColor = isDark ? colorConfig.darkGlow : colorConfig.lightGlow;
            const pulseColor = isDark ? colorConfig.darkPulse : colorConfig.lightPulse;

            // Precise pixel geometry without % in path
            const { path: cablePath, midX, midY, elbows } = getCableGeometry(
              p1.x,
              p1.y,
              p2.x,
              p2.y,
              cableRoutingStyle
            );

            return (
              <g key={conn.id} className="group pointer-events-auto">
                {/* 1.1 Outer Radiant Glow Stroke (Always visible, extra glow with filter) */}
                <path
                  d={cablePath}
                  fill="none"
                  stroke={glowColor}
                  strokeWidth={isDark ? 8 : 6}
                  strokeOpacity={isDark ? 0.45 : 0.3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={`url(#cable-glow-${connIdx % CABLE_COLOR_PALETTE.length})`}
                />

                {/* 1.2 Core Solid Luminous Cable Line (Continuous Solid Line) */}
                <path
                  d={cablePath}
                  fill="none"
                  stroke={conn.status === 'bloqueado' ? '#EF4444' : coreColor}
                  strokeWidth={isDark ? 3.5 : 3.0}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* 1.3 Inner Continuous Highlight Line (Solid luminous core) */}
                <path
                  d={cablePath}
                  fill="none"
                  stroke={pulseColor}
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={isDark ? 0.9 : 0.75}
                />

                {/* 1.4 Corner Elbow Joints (only in orthogonal mode when bends exist) */}
                {elbows.map((e, eIdx) => (
                  <circle
                    key={eIdx}
                    cx={e.x}
                    cy={e.y}
                    r={isDark ? 3 : 2.5}
                    fill={coreColor}
                    opacity={0.9}
                  />
                ))}

                {/* 1.5 Glowing Terminal Rings at Connected Ends */}
                <circle cx={p1.x} cy={p1.y} r={isDark ? 4 : 3.5} fill={coreColor} />
                <circle cx={p2.x} cy={p2.y} r={isDark ? 4 : 3.5} fill={coreColor} />

                {/* 1.6 Compact Distance Badge on Cable Center with Disconnect (X) button */}
                <foreignObject
                  x={midX - 36}
                  y={midY - 11}
                  width="72"
                  height="22"
                  className="overflow-visible"
                >
                  <div 
                    className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono shadow-md backdrop-blur-sm transition-all group-hover:scale-105 border ${
                      isDark 
                        ? 'bg-[#121418]/90 text-gray-200 border-white/20' 
                        : 'bg-white/95 text-slate-800 border-slate-300 shadow-slate-300/40'
                    }`}
                    style={{ borderColor: coreColor }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: coreColor }} />
                    <span className="font-bold">{conn.distanceMeters}m</span>
                    <button
                      onClick={(e) => handleDeleteConnection(conn.id, e)}
                      className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer ml-0.5"
                      title="Desconectar este cable"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* 2. Live Cable Simulation Following Cursor (Continuous Solid Line) */}
          {cableSourceTunnel && (() => {
            const pSource = getTunnelPixelPos(cableSourceTunnel.id);
            if (!pSource) return null;

            const targetPixel = hoveredTargetTunnel 
              ? (getTunnelPixelPos(hoveredTargetTunnel.id) || {
                  x: (mousePos.x / 100) * canvasSize.width,
                  y: (mousePos.y / 100) * canvasSize.height,
                })
              : {
                  x: (mousePos.x / 100) * canvasSize.width,
                  y: (mousePos.y / 100) * canvasSize.height,
                };

            const liveColor = isDark ? '#FDE047' : '#D97706';
            const { path: livePath, elbows: liveElbows } = getCableGeometry(
              pSource.x,
              pSource.y,
              targetPixel.x,
              targetPixel.y,
              cableRoutingStyle
            );

            return (
              <g>
                {/* Outer Glow */}
                <path
                  d={livePath}
                  fill="none"
                  stroke={liveColor}
                  strokeWidth="8"
                  strokeOpacity="0.45"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter="url(#live-cable-glow)"
                />

                {/* Core Live Cable Line (Continuous Solid Line) */}
                <path
                  d={livePath}
                  fill="none"
                  stroke={liveColor}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Live Elbow Bends */}
                {liveElbows.map((e, idx) => (
                  <circle key={idx} cx={e.x} cy={e.y} r="3" fill={liveColor} opacity="0.9" />
                ))}

                {/* Cursor Terminal Plug Icon with Pulsing Beacon */}
                <circle
                  cx={targetPixel.x}
                  cy={targetPixel.y}
                  r="7"
                  fill={liveColor}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  className="animate-pulse"
                />
              </g>
            );
          })()}
        </svg>

        {/* Socavón Nodes (The "0"s on the Map) */}
        {filteredTunnels.map((tunnel) => {
          const pos = tunnelPositions.get(tunnel.id) || { x: 50, y: 50 };
          const Icon = getLaborIcon(tunnel.tunnelType);
          const isSource = cableSourceTunnel?.id === tunnel.id;
          const isHoveredTarget = hoveredTargetTunnel?.id === tunnel.id;
          const isSelected = selectedTunnel?.id === tunnel.id;

          const connectedCount = connections.filter(
            c => c.sourceTunnelId === tunnel.id || c.targetTunnelId === tunnel.id
          ).length;

          return (
            <div
              key={tunnel.id}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={(e) => handleSocavonNodeClick(tunnel, e)}
              onMouseEnter={() => {
                if (cableSourceTunnel && cableSourceTunnel.id !== tunnel.id) {
                  setHoveredTargetTunnel(tunnel);
                }
              }}
              onMouseLeave={() => setHoveredTargetTunnel(null)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer transition-transform duration-200 ${
                isSource ? 'scale-125 z-40' : isHoveredTarget ? 'scale-125 z-40' : 'hover:scale-110'
              }`}
            >
              {/* Outer Pulsing Aura when source or target */}
              {(isSource || isHoveredTarget) && (
                <div className="absolute -inset-3 rounded-2xl bg-[#D4AF37]/30 animate-ping pointer-events-none" />
              )}

              {/* Socavón Node Card / Pill */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all shadow-xl ${
                isSource
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] border-white text-black font-bold shadow-[#D4AF37]/60'
                  : isHoveredTarget
                  ? isDark 
                    ? 'bg-emerald-950 border-emerald-400 text-white shadow-emerald-500/40' 
                    : 'bg-emerald-100 border-emerald-500 text-emerald-950 shadow-emerald-500/30'
                  : isSelected
                  ? isDark 
                    ? 'bg-[#1F2229] border-[#D4AF37] text-white shadow-lg' 
                    : 'bg-white border-amber-500 text-slate-900 shadow-lg'
                  : isDark 
                  ? 'bg-[#14161C]/95 border-white/10 hover:border-[#D4AF37]/60 text-gray-200' 
                  : 'bg-white/95 border-slate-200 hover:border-amber-500 text-slate-800 hover:shadow-md'
              }`}>
                {/* Labor Icon */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isSource ? 'bg-black text-[#D4AF37]' : isDark ? 'bg-[#1F2229] text-[#D4AF37]' : 'bg-slate-100 text-amber-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Name & Depth */}
                <div className="text-left leading-tight pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-tight truncate max-w-[130px]">
                      {tunnel.name}
                    </span>
                    {tunnel.riskLevel === 'critico' && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono mt-0.5 ${
                    isDark ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    <span>{tunnel.elevation}m</span>
                    <span>·</span>
                    <span className={isDark ? 'text-[#D4AF37] font-semibold' : 'text-amber-600 font-semibold'}>
                      {connectedCount} cables
                    </span>
                  </div>
                </div>

                {/* Lateral Terminal Connection Ports ("de cuadrado a cuadrado") */}
                <span 
                  className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border transition-all ${
                    connectedCount > 0 
                      ? isDark 
                        ? 'bg-[#FBBF24] border-[#F59E0B] shadow-[0_0_8px_rgba(251,191,36,0.8)]' 
                        : 'bg-amber-500 border-amber-600 shadow-[0_0_6px_rgba(217,119,6,0.5)]'
                      : isDark ? 'bg-gray-700 border-gray-600' : 'bg-slate-300 border-slate-400'
                  }`} 
                  title="Puerto de cable oeste"
                />
                <span 
                  className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border transition-all ${
                    connectedCount > 0 
                      ? isDark 
                        ? 'bg-[#FBBF24] border-[#F59E0B] shadow-[0_0_8px_rgba(251,191,36,0.8)]' 
                        : 'bg-amber-500 border-amber-600 shadow-[0_0_6px_rgba(217,119,6,0.5)]'
                      : isDark ? 'bg-gray-700 border-gray-600' : 'bg-slate-300 border-slate-400'
                  }`} 
                  title="Puerto de cable este"
                />
              </div>

            </div>
          );
        })}

        {/* Bottom Legend Guide */}
        <div className={`absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 backdrop-blur-md px-3 py-2 rounded-xl border text-[10px] font-mono ${
          isDark 
            ? 'bg-[#121418]/90 border-white/10 text-gray-400' 
            : 'bg-white/90 border-slate-200 text-slate-600 shadow-sm'
        }`}>
          <span className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
            <Cable className="w-3.5 h-3.5 text-[#D4AF37]" /> Red: {connections.length} cables conectados
          </span>
          <span>·</span>
          <span>Cables con código de color luminiscente según circuito</span>
        </div>

        {/* Side Inspector Drawer (Opens when clicking any socavón) */}
        {selectedTunnel && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-3 right-3 z-40 w-80 backdrop-blur-md border rounded-2xl p-4 shadow-2xl text-left animate-in fade-in slide-in-from-right-3 duration-200 ${
              isDark 
                ? 'bg-[#16181D]/98 border-[#D4AF37]/40 text-white' 
                : 'bg-white/98 border-slate-300 shadow-xl text-slate-900'
            }`}
          >
            {/* Header with Close */}
            <div className={`flex items-start justify-between border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                  {selectedTunnel.code}
                </span>
                <h3 className="text-sm font-bold leading-snug">{selectedTunnel.name}</h3>
                <p className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Cota de Labor: {selectedTunnel.elevation}m
                </p>
              </div>
              <button
                onClick={() => setSelectedTunnel(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 my-3 text-[11px] font-mono">
              <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0F1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] block ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>TIPO LABOR</span>
                <span className="font-bold capitalize">{selectedTunnel.tunnelType.replace('_', ' ')}</span>
              </div>
              <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0F1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] block ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>RIESGO</span>
                <span className={`font-bold uppercase ${
                  selectedTunnel.riskLevel === 'critico' ? 'text-red-400' :
                  selectedTunnel.riskLevel === 'alto' ? 'text-orange-400' : 'text-emerald-500'
                }`}>
                  {selectedTunnel.riskLevel}
                </span>
              </div>
            </div>

            {/* Google Maps Coordinates Preview */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 mb-3 ${isDark ? 'bg-[#0F1115] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between text-[11px]">
                <span className={`flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" /> Coordenadas Maps
                </span>
                {(() => {
                  const match = selectedTunnel.description?.match(/maps:([-\d.,\s]+)/);
                  const coords = match ? match[1] : '-14.2831, -69.4521';
                  return (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#D4AF37] hover:underline flex items-center gap-1 text-[10px] font-mono font-semibold"
                    >
                      Abrir Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  );
                })()}
              </div>
              <p className={`text-[11px] font-mono truncate ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                {selectedTunnel.description || 'Coordenadas registradas con Google Maps'}
              </p>
            </div>

            {/* Connected Cables List */}
            <div className="mb-4">
              <span className={`text-[10px] uppercase font-semibold block mb-1.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Cables Conectados ({
                  connections.filter(c => c.sourceTunnelId === selectedTunnel.id || c.targetTunnelId === selectedTunnel.id).length
                })
              </span>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {connections
                  .filter(c => c.sourceTunnelId === selectedTunnel.id || c.targetTunnelId === selectedTunnel.id)
                  .map((c, cIdx) => {
                    const otherId = c.sourceTunnelId === selectedTunnel.id ? c.targetTunnelId : c.sourceTunnelId;
                    const otherTunnel = tunnels.find(t => t.id === otherId);
                    const colorCfg = CABLE_COLOR_PALETTE[cIdx % CABLE_COLOR_PALETTE.length];
                    const coreClr = isDark ? colorCfg.darkCore : colorCfg.lightCore;

                    return (
                      <div key={c.id} className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                        isDark ? 'bg-[#0F1115] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: coreClr }} />
                          <span className="truncate font-medium">{otherTunnel?.name || 'Socavón Enlazado'}</span>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>({c.distanceMeters}m)</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteConnection(c.id, e)}
                          className="text-gray-400 hover:text-red-500 p-1 rounded cursor-pointer"
                          title="Desconectar cable"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Actions for this socavón */}
            <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                onClick={() => {
                  setCableSourceTunnel(selectedTunnel);
                  setSelectedTunnel(null);
                  showToast(`Cable listo en ${selectedTunnel.name}. Clic en el destino.`, 'info');
                }}
                className="w-full py-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 hover:bg-[#D4AF37]/25 text-[#D4AF37] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Cable className="w-4 h-4" />
                <span>Tender Cable desde aquí</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(selectedTunnel)}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => handleDeleteSocavon(selectedTunnel.id, selectedTunnel.name)}
                  className="py-1.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                  title="Eliminar socavón"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Simple Register / Edit Socavón Modal (Adapts to Dark / Light) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
            isDark 
              ? 'bg-[#16181D] border-[#D4AF37]/30 text-white' 
              : 'bg-white border-slate-300 text-slate-900 shadow-slate-400/50'
          }`}>
            
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]' : 'bg-amber-100 border border-amber-300 text-amber-700'
                }`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {editingTunnel ? 'Editar Socavón' : 'Registrar Nuevo Socavón'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Ingresa el nombre y pega las coordenadas de Google Maps
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveSocavon} className="space-y-4 text-left">
              
              {/* 1. Nombre */}
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  Nombre del Socavón / Labor *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Socavón Esperanza, Bocamina Nivel 2, etc."
                  className={`w-full text-xs rounded-xl px-3.5 py-2.5 outline-none transition-all ${
                    isDark 
                      ? 'bg-[#0F1115] border border-white/10 focus:border-[#D4AF37] text-white' 
                      : 'bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900'
                  }`}
                />
              </div>

              {/* 2. Coordenadas de Google Maps — Modo URL o Manual */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    Ubicación en Google Maps
                  </label>
                  {/* Toggle Modo */}
                  <div className={`flex items-center gap-1 rounded-lg p-0.5 text-[10px] font-semibold ${
                    isDark ? 'bg-[#0F1115] border border-white/10' : 'bg-slate-100 border border-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => { setCoordInputMode('url'); setResolveError(null); }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        coordInputMode === 'url'
                          ? isDark ? 'bg-[#D4AF37] text-black font-bold' : 'bg-amber-500 text-white font-bold'
                          : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🔗 URL / Coords
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCoordInputMode('manual'); setResolveError(null); }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        coordInputMode === 'manual'
                          ? isDark ? 'bg-[#D4AF37] text-black font-bold' : 'bg-amber-500 text-white font-bold'
                          : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ✏️ Manual
                    </button>
                  </div>
                </div>

                {coordInputMode === 'url' ? (
                  <div className="space-y-2">
                    {/* Campo URL / Coordenadas */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#D4AF37]' : 'text-amber-600'}`} />
                        <input
                          type="text"
                          value={formCoords}
                          onChange={(e) => {
                            setFormCoords(e.target.value);
                            setResolvedCoords(null);
                            setResolveError(null);
                          }}
                          placeholder="Pegar URL de Maps o coordenadas: -14.28, -69.45"
                          className={`w-full text-xs rounded-xl pl-8 pr-3 py-2.5 outline-none transition-all font-mono ${
                            resolvedCoords
                              ? isDark ? 'border border-emerald-500/60 bg-emerald-950/20 text-white' : 'border border-emerald-500 bg-emerald-50 text-slate-900'
                              : isDark 
                                ? 'bg-[#0F1115] border border-white/10 focus:border-[#D4AF37] text-white placeholder:text-gray-500' 
                                : 'bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                      {/* Botón Resolver */}
                      {formCoords.trim() && !resolvedCoords && (
                        <button
                          type="button"
                          onClick={handleResolveUrl}
                          disabled={isResolvingUrl}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                            isResolvingUrl
                              ? isDark ? 'bg-[#D4AF37]/30 text-[#D4AF37] cursor-wait' : 'bg-amber-200 text-amber-700 cursor-wait'
                              : isDark ? 'bg-[#D4AF37] text-black hover:brightness-110' : 'bg-amber-500 text-white hover:bg-amber-600'
                          }`}
                        >
                          {isResolvingUrl
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolviendo...</>
                            : <><MapPin className="w-3.5 h-3.5" /> Extraer</>}
                        </button>
                      )}
                    </div>

                    {/* Resultado de resolución */}
                    {resolvedCoords && (
                      <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isDark ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300'
                      }`}>
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className={`font-bold block text-emerald-500`}>Coordenadas extraídas ✓</span>
                            <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>
                              {resolvedCoords.lat.toFixed(6)}°, {resolvedCoords.lng.toFixed(6)}°
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${resolvedCoords.lat},${resolvedCoords.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#D4AF37] hover:underline flex items-center gap-1 text-[10px] font-mono"
                          >
                            Ver <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => { setResolvedCoords(null); setFormCoords(''); }}
                            className="text-gray-400 hover:text-red-400 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error de resolución */}
                    {resolveError && (
                      <div className={`flex items-start gap-2 p-2.5 rounded-xl border text-[11px] ${
                        isDark ? 'bg-red-950/30 border-red-500/40 text-red-300' : 'bg-red-50 border-red-300 text-red-700'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{resolveError}</span>
                      </div>
                    )}

                    {/* Tip si está vacío */}
                    {!formCoords.trim() && !resolvedCoords && (
                      <p className={`text-[10px] ${ isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                        💡 Pega la URL de Google Maps (ej: <code className="font-mono">maps.app.goo.gl/...</code>) o coordenadas directas y presiona <strong>Extraer</strong>.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Modo Manual: Lat / Lng separados */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Latitud
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="-90"
                          max="90"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          placeholder="ej. -14.283145"
                          className={`w-full text-xs rounded-xl px-3 py-2.5 outline-none transition-all font-mono ${
                            isDark 
                              ? 'bg-[#0F1115] border border-white/10 focus:border-[#D4AF37] text-white placeholder:text-gray-500' 
                              : 'bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-semibold block mb-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Longitud
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="-180"
                          max="180"
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          placeholder="ej. -69.452182"
                          className={`w-full text-xs rounded-xl px-3 py-2.5 outline-none transition-all font-mono ${
                            isDark 
                              ? 'bg-[#0F1115] border border-white/10 focus:border-[#D4AF37] text-white placeholder:text-gray-500' 
                              : 'bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                    {manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng)) ? (
                      <p className="text-[11px] text-emerald-500 flex items-center gap-1.5 font-mono font-medium">
                        <Check className="w-3.5 h-3.5" /> {parseFloat(manualLat).toFixed(6)}°, {parseFloat(manualLng).toFixed(6)}°
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${manualLat},${manualLng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#D4AF37] hover:underline flex items-center gap-0.5 ml-1"
                        >
                          Ver en Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    ) : (
                      <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
                        💡 En Google Maps: clic derecho sobre el punto → copia las coordenadas numéricas.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Tipo de Labor */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  Tipo de Labor Minera
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'galeria' as TunnelType, label: 'Galería', desc: 'Horizontal', icon: Boxes },
                    { type: 'rampa' as TunnelType, label: 'Bocamina', desc: 'Acceso Entrada', icon: Mountain },
                    { type: 'chimenea_pique' as TunnelType, label: 'Chimenea', desc: 'Pique Vertical', icon: ArrowUpCircle },
                    { type: 'tajo_explotacion' as TunnelType, label: 'Tajo', desc: 'Frente Extracción', icon: Pickaxe },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSel = formType === opt.type;
                    return (
                      <button
                        type="button"
                        key={opt.type}
                        onClick={() => setFormType(opt.type)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSel
                            ? isDark
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white font-bold shadow-md'
                              : 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-sm'
                            : isDark
                            ? 'bg-[#0F1115] border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mx-auto mb-1 ${isSel ? (isDark ? 'text-[#D4AF37]' : 'text-amber-600') : 'text-gray-400'}`} />
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[9px] text-gray-500">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Profundidad / Nivel (Cota) */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  Profundidad Subterránea (Cota)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[0, -50, -75, -100, -120, -150].map((depth) => (
                    <button
                      type="button"
                      key={depth}
                      onClick={() => setFormElevation(depth)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                        formElevation === depth
                          ? isDark 
                            ? 'bg-[#D4AF37] text-black font-bold shadow-md' 
                            : 'bg-amber-500 text-white font-bold shadow-md'
                          : isDark
                          ? 'bg-[#0F1115] border border-white/10 text-gray-400 hover:text-white'
                          : 'bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {depth === 0 ? '0m (Bocamina)' : `${depth}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Nivel de Riesgo Operativo */}
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  Nivel de Riesgo Operativo
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { val: 'bajo' as RiskLevel, label: 'Bajo', color: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500' },
                    { val: 'medio' as RiskLevel, label: 'Medio', color: 'border-amber-500/50 bg-amber-500/15 text-amber-500' },
                    { val: 'alto' as RiskLevel, label: 'Crítico', color: 'border-red-500/50 bg-red-500/15 text-red-500' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.val}
                      onClick={() => setFormRisk(r.val)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        formRisk === r.val ? `${r.color} font-bold shadow-sm` : isDark ? 'bg-[#0F1115] border-white/10 text-gray-400' : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className={`flex items-center justify-end gap-2.5 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38B21] text-black text-xs font-bold shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  {editingTunnel ? 'Guardar Cambios' : 'Registrar Socavón'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
