import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Compass, 
  Layers, 
  Eye, 
  Users, 
  Flame, 
  Activity, 
  HardHat, 
  X,
  RefreshCcw,
  Wind,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hand,
  MousePointer,
  Crosshair,
  Info,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { Worker, Alert, MiningSector, MineTunnel, TunnelConnection } from '../types';

export interface Sector3DConfig {
  id: string;
  name: MiningSector | string;
  depthStr: string;
  depthMeters: number;
  position: [number, number, number]; // [x, y, z]
  hazardLevel: 'bajo' | 'medio' | 'alto' | 'critico';
  ventilation: string;
  coGasPpm: number;
}

const SECTOR_3D_DATA: Sector3DConfig[] = [
  {
    id: 's1',
    name: 'Socavón Principal',
    depthStr: '0m (Bocamina)',
    depthMeters: 0,
    position: [-16, 2, -12],
    hazardLevel: 'bajo',
    ventilation: 'Natural 98%',
    coGasPpm: 4,
  },
  {
    id: 's2',
    name: 'Nivel -50m',
    depthStr: '-50m Subterráneo',
    depthMeters: -50,
    position: [-4, -4, -4],
    hazardLevel: 'medio',
    ventilation: 'Auxiliar 85%',
    coGasPpm: 12,
  },
  {
    id: 's3',
    name: 'Galería Norte',
    depthStr: '-75m Subterráneo',
    depthMeters: -75,
    position: [14, -6.5, -8],
    hazardLevel: 'alto',
    ventilation: 'Presurizado 78%',
    coGasPpm: 24,
  },
  {
    id: 's4',
    name: 'Chimenea 3',
    depthStr: '-90m Vertical',
    depthMeters: -90,
    position: [-10, -8.5, 10],
    hazardLevel: 'medio',
    ventilation: 'Tiro Forzado 90%',
    coGasPpm: 15,
  },
  {
    id: 's5',
    name: 'Nivel -120m',
    depthStr: '-120m Fondo',
    depthMeters: -120,
    position: [6, -11.5, 12],
    hazardLevel: 'critico',
    ventilation: 'Manga Vent 62%',
    coGasPpm: 42,
  },
  {
    id: 's6',
    name: 'Frente de Extracción',
    depthStr: '-135m Veta Oro',
    depthMeters: -135,
    position: [20, -13, 8],
    hazardLevel: 'bajo',
    ventilation: 'Directa 88%',
    coGasPpm: 8,
  },
];

// Tunnel connections between sectors [fromIndex, toIndex, tunnelColor]
const TUNNEL_CONNECTIONS: [number, number, string][] = [
  [0, 1, '#D4AF37'], // Bocamina -> Nivel -50m
  [1, 2, '#B87333'], // Nivel -50m -> Galería Norte
  [1, 3, '#94A3B8'], // Nivel -50m -> Chimenea 3
  [3, 4, '#EF4444'], // Chimenea 3 -> Nivel -120m
  [4, 5, '#D4AF37'], // Nivel -120m -> Frente de Extracción
  [2, 5, '#60A5FA'], // Galería Norte -> By-pass Frente
];

// Canvas helper to create sharp 3D text billboards for sector names adapted to Light/Dark mode
function createTextSprite(title: string, depthText: string, colorHex: string, isLight: boolean = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Pill background
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 20, 24, 0.88)';
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 60, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Title
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, 26);

    // Subtitle / Depth
    ctx.fillStyle = isLight ? (colorHex === '#EF4444' ? '#dc2626' : colorHex === '#B87333' ? '#b45309' : '#b87333') : colorHex;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(depthText, 128, 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true, 
    depthTest: false,
    depthWrite: false 
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(5.2, 1.46, 1);
  return sprite;
}

interface MineMap3DProps {
  workers: Worker[];
  alerts: Alert[];
  onSelectWorker?: (worker: Worker) => void;
  onNavigateToMonitoring?: (worker?: Worker) => void;
  className?: string;
  isExpandedInitial?: boolean;
  tunnels?: MineTunnel[];
  connections?: TunnelConnection[];
  onNavigateToSocavones?: () => void;
}

export const MineMap3D: React.FC<MineMap3DProps> = ({
  workers,
  alerts,
  onSelectWorker,
  onNavigateToMonitoring,
  className = '',
  isExpandedInitial = false,
  tunnels = [],
  connections = [],
  onNavigateToSocavones,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(isExpandedInitial);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<'iso' | 'profile' | 'top' | 'front'>('iso');
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [showHelp, setShowHelp] = useState(false);
  
  // Active detail inspector
  const [selectedSector, setSelectedSector] = useState<Sector3DConfig | null>(null);

  // Dynamic 3D Sectors resolution from registered tunnels or fallback
  const activeSectors: Sector3DConfig[] = useMemo(() => {
    if (!tunnels || tunnels.length === 0) return SECTOR_3D_DATA;

    const defaultPositions: Record<string, [number, number, number]> = {
      'Socavón Principal': [-16, 2, -12],
      'Bocamina Principal': [-16, 2, -12],
      'Nivel -50m': [-4, -4, -4],
      'Galería Norte': [14, -6.5, -8],
      'Chimenea 3': [-10, -8.5, 10],
      'Nivel -120m': [6, -11.5, 12],
      'Frente de Extracción': [20, -13, 8],
      'Galería Central By-pass': [0, -5.5, 5],
    };

    return tunnels.map((t, idx) => {
      const known = SECTOR_3D_DATA.find(s => s.name === t.name || s.id === t.id);
      const pos: [number, number, number] = defaultPositions[t.name] || (known ? known.position : [
        (idx % 2 === 0 ? 1 : -1) * (10 + (idx * 4) % 14),
        Math.max(-15, Math.min(2, t.elevation * 0.1)),
        (idx % 3 === 0 ? 1 : -1) * (8 + (idx * 5) % 12),
      ]);

      return {
        id: t.id,
        name: t.name,
        depthStr: `${t.elevation}m Subterráneo`,
        depthMeters: t.elevation,
        position: pos,
        hazardLevel: t.riskLevel,
        ventilation: t.ventilationStatus === 'optimo' ? 'Óptima 95%' : t.ventilationStatus === 'regular' ? 'Auxiliar 75%' : 'Crítica 40%',
        coGasPpm: t.riskLevel === 'critico' ? 42 : t.riskLevel === 'alto' ? 24 : 8,
      };
    });
  }, [tunnels]);

  // Dynamic 3D Tunnel Connections resolution based on user wiring
  const activeConnections = useMemo(() => {
    const CABLE_COLORS = ['#FBBF24', '#38BDF8', '#34D399', '#C084FC', '#FB7185', '#A3E635'];

    if (!connections || connections.length === 0) {
      if (tunnels && tunnels.length > 0) {
        return [];
      }
      return TUNNEL_CONNECTIONS.map(([fromIdx, toIdx, color], idx) => ({
        fromPos: new THREE.Vector3(...(activeSectors[fromIdx % activeSectors.length]?.position || [0, 0, 0])),
        toPos: new THREE.Vector3(...(activeSectors[toIdx % activeSectors.length]?.position || [0, 0, 0])),
        color,
        id: `def-${idx}`,
      }));
    }

    const sectorPosMap = new Map<string, THREE.Vector3>();
    activeSectors.forEach(s => {
      sectorPosMap.set(s.id, new THREE.Vector3(...s.position));
      sectorPosMap.set(s.name.toLowerCase().trim(), new THREE.Vector3(...s.position));
    });

    const result: { fromPos: THREE.Vector3; toPos: THREE.Vector3; color: string; id: string }[] = [];

    connections.forEach((conn, idx) => {
      const p1 = sectorPosMap.get(conn.sourceTunnelId) || 
                 (conn.sourceName ? sectorPosMap.get(conn.sourceName.toLowerCase().trim()) : undefined);
      const p2 = sectorPosMap.get(conn.targetTunnelId) || 
                 (conn.targetName ? sectorPosMap.get(conn.targetName.toLowerCase().trim()) : undefined);

      if (p1 && p2) {
        const color = conn.status === 'bloqueado' ? '#EF4444' : CABLE_COLORS[idx % CABLE_COLORS.length];
        result.push({
          fromPos: p1,
          toPos: p2,
          color,
          id: conn.id,
        });
      }
    });

    return result;
  }, [connections, activeSectors, tunnels]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    if (!document.fullscreenElement && !isExpanded) {
      setIsExpanded(true);
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsExpanded(false);
    }
  }, [isExpanded]);

  // Listen to native fullscreen change and Escape key
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsExpanded(Boolean(document.fullscreenElement));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsExpanded(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // References for Three.js instance
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Animation references
  const pulseRingsRef = useRef<THREE.Mesh[]>([]);
  const tunnelParticlesRef = useRef<THREE.Points | null>(null);

  // Animated worker references: one group per worker with path progress
  type WorkerAnimData = {
    group: THREE.Group;
    body: THREE.Mesh;       // torso for bobbing
    beacon: THREE.Mesh;     // status ring
    namesprite: THREE.Sprite;
    curve: THREE.CatmullRomCurve3;
    t: number;              // path progress 0-1
    speed: number;          // path traversal speed
    dir: number;            // +1 or -1 direction
    trailPositions: THREE.Vector3[];
    trailMesh: THREE.Points;
    worker: Worker;
  };
  const workerAnimsRef = useRef<WorkerAnimData[]>([]);

  // Map workers to their sector config
  const sectorWorkersMap = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    activeSectors.forEach(s => {
      map[s.name] = workers.filter(w => w.sector === s.name);
    });
    return map;
  }, [workers, activeSectors]);

  // Check if sector has critical alerts
  const sectorAlertsMap = useMemo(() => {
    const map: Record<string, Alert[]> = {};
    activeSectors.forEach(s => {
      const sw = workers.filter(w => w.sector === s.name).map(w => w.id);
      map[s.name] = alerts.filter(a => a.status === 'activa' && sw.includes(a.workerId));
    });
    return map;
  }, [workers, alerts, activeSectors]);

  // 3D Navigation Controls Handlers
  const applyPreset = useCallback((preset: 'iso' | 'profile' | 'top' | 'front') => {
    if (!cameraRef.current || !controlsRef.current) return;
    setActivePreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const targetPos = new THREE.Vector3(2, -6, 0);
    controls.target.copy(targetPos);

    if (preset === 'iso') {
      camera.position.set(34, 26, 36);
    } else if (preset === 'profile') {
      camera.position.set(48, -6, 0);
    } else if (preset === 'top') {
      camera.position.set(2, 54, 0.01);
    } else if (preset === 'front') {
      camera.position.set(2, -6, 52);
    }

    camera.lookAt(targetPos);
    controls.update();
  }, []);

  const resetCamera = useCallback(() => {
    applyPreset('iso');
    setSelectedSector(null);
  }, [applyPreset]);

  // Focus camera on a specific sector smoothly
  const focusOnSector = useCallback((sector: Sector3DConfig) => {
    if (!cameraRef.current || !controlsRef.current) return;
    setSelectedSector(sector);
    const [sx, sy, sz] = sector.position;
    controlsRef.current.target.set(sx, sy, sz);
    cameraRef.current.position.set(sx + 15, sy + 11, sz + 17);
    cameraRef.current.lookAt(sx, sy, sz);
    controlsRef.current.update();
  }, []);

  // Programmatic Zoom
  const handleZoom = (direction: 'in' | 'out') => {
    if (!controlsRef.current || !cameraRef.current) return;
    const factor = direction === 'in' ? 0.8 : 1.25;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const newDist = offset.length() * factor;
    if (newDist >= 6 && newDist <= 150) {
      offset.multiplyScalar(factor);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    }
  };

  // Programmatic Orbit (Rotate)
  const handleOrbit = (deltaTheta: number, deltaPhi: number = 0) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += deltaTheta;
    spherical.phi = Math.max(0.12, Math.min(Math.PI / 2 + 0.35, spherical.phi + deltaPhi));
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
  };

  // Programmatic Pan
  const handlePan = (deltaX: number, deltaY: number) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    
    const right = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    right.crossVectors(dir, camera.up).normalize();
    
    controls.target.addScaledVector(right, deltaX);
    camera.position.addScaledVector(right, deltaX);
    
    controls.target.y += deltaY;
    camera.position.y += deltaY;
    controls.update();
  };

  // Synchronize Drag Mode (Rotate vs Pan) with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons.LEFT = dragMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    }
  }, [dragMode]);

  // Main Three.js Scene Lifecycle Effect (re-renders cleanly on theme change)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene setup with Light / Dark theme colors
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const bgColor = isLight ? 0xf8fafc : 0x0c0e12;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, isLight ? 0.008 : 0.012);

    // 2. Camera setup
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    cameraRef.current = camera;
    camera.position.set(34, 26, 36);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. OrbitControls — smooth, no polar angle snap-back
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;     // responsive but smooth
    controls.target.set(2, -6, 0);
    controls.maxDistance = 180;
    controls.minDistance = 5;
    // NO maxPolarAngle — allow full vertical rotation without snap-back
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.2;
    controls.mouseButtons.LEFT = dragMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches = {
      ONE: dragMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // 5. Lighting adapted to Light vs Dark theme
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 1.35 : 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(isLight ? 0xfff8ed : 0xfff1cf, isLight ? 1.5 : 1.3);
    dirLight.position.set(25, 45, 30);
    scene.add(dirLight);

    const subLight = new THREE.DirectionalLight(isLight ? 0x64748b : 0x38bdf8, isLight ? 0.6 : 0.5);
    subLight.position.set(-25, -30, -25);
    scene.add(subLight);

    const goldPointLight = new THREE.PointLight(isLight ? 0xb87333 : 0xd4af37, isLight ? 1.6 : 1.8, 50);
    goldPointLight.position.set(0, -5, 0);
    scene.add(goldPointLight);

    // 6. Stratum Reference Grids
    // Surface Grid (Bocamina 0m)
    const surfaceGrid = new THREE.GridHelper(
      56, 
      28, 
      isLight ? 0xb87333 : 0xd4af37, 
      isLight ? 0xcbd5e1 : 0x1f293d
    );
    surfaceGrid.position.y = 2;
    scene.add(surfaceGrid);

    // Depth level guide lines
    const depthLevels = [
      { y: -4, color: isLight ? 0x94a3b8 : 0x223044 },
      { y: -6.5, color: isLight ? 0x94a3b8 : 0x223044 },
      { y: -8.5, color: isLight ? 0x94a3b8 : 0x223044 },
      { y: -11.5, color: isLight ? 0x94a3b8 : 0x223044 },
      { y: -13, color: isLight ? 0x94a3b8 : 0x223044 },
    ];

    depthLevels.forEach(dl => {
      const grid = new THREE.GridHelper(
        48, 
        16, 
        dl.color, 
        isLight ? 0xe2e8f0 : 0x141824
      );
      grid.position.y = dl.y;
      scene.add(grid);
    });

    pulseRingsRef.current = [];

    // 7. Render 3D Tunnels between Sectors
    activeConnections.forEach((conn) => {
      const p1 = conn.fromPos;
      const p2 = conn.toPos;
      const hexColor = conn.color;

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y -= 0.5;
      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);

      // Outer Translucent Tube Geometry (Mine Gallery Wall)
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 1.15, 10, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        roughness: isLight ? 0.35 : 0.5,
        metalness: isLight ? 0.3 : 0.2,
        transparent: true,
        opacity: isLight ? 0.38 : 0.32,
        side: THREE.DoubleSide,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      // Wireframe Outline for Clean CAD Look
      const wireMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexColor),
        wireframe: true,
        transparent: true,
        opacity: isLight ? 0.28 : 0.18,
      });
      const wireMesh = new THREE.Mesh(tubeGeo, wireMat);
      scene.add(wireMesh);

      // Glowing Center Rail / Guide Cable
      const railGeo = new THREE.TubeGeometry(curve, 24, 0.09, 6, false);
      const railMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexColor),
        transparent: true,
        opacity: 0.85,
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      scene.add(railMesh);
    });

    // 8. Airflow / Gas Transport Particles
    const particleCount = activeConnections.length > 0 ? 100 : 0;
    if (particleCount > 0) {
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const conn = activeConnections[i % activeConnections.length];
        const p1 = conn.fromPos;
        const p2 = conn.toPos;
        const alpha = Math.random();
        const pos = new THREE.Vector3().lerpVectors(p1, p2, alpha);
        pos.x += (Math.random() - 0.5) * 0.6;
        pos.y += (Math.random() - 0.5) * 0.6;
        pos.z += (Math.random() - 0.5) * 0.6;

        particlePositions[i * 3] = pos.x;
        particlePositions[i * 3 + 1] = pos.y;
        particlePositions[i * 3 + 2] = pos.z;

        particleColors[i * 3] = isLight ? 0.72 : 0.83;
        particleColors[i * 3 + 1] = isLight ? 0.45 : 0.69;
        particleColors[i * 3 + 2] = isLight ? 0.15 : 0.22;
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

      const particleMat = new THREE.PointsMaterial({
        size: isLight ? 0.32 : 0.26,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const tunnelParticles = new THREE.Points(particleGeo, particleMat);
      scene.add(tunnelParticles);
      tunnelParticlesRef.current = tunnelParticles;
    } else {
      tunnelParticlesRef.current = null;
    }

    // 9. Create 3D Nodes for each Sector (static, no workers dep)
    activeSectors.forEach((sector) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...sector.position);

      const baseColor = sector.hazardLevel === 'critico' ? 0xef4444 : sector.hazardLevel === 'alto' ? 0xb87333 : (isLight ? 0x0284c7 : 0xd4af37);
      const baseHex = sector.hazardLevel === 'critico' ? '#EF4444' : sector.hazardLevel === 'alto' ? '#B87333' : (isLight ? '#0284C7' : '#D4AF37');

      // Base Station Pedestal
      const cylGeo = new THREE.CylinderGeometry(1.8, 2.1, 0.35, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0xe2e8f0 : 0x14161b,
        metalness: isLight ? 0.3 : 0.8,
        roughness: isLight ? 0.4 : 0.25,
        emissive: new THREE.Color(baseColor),
        emissiveIntensity: sector.hazardLevel === 'critico' ? 0.6 : (isLight ? 0.3 : 0.2),
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      nodeGroup.add(cylMesh);

      // Glowing Center Core Sphere
      const sphereGeo = new THREE.SphereGeometry(0.65, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: sector.hazardLevel === 'critico' ? 0.9 : 0.4,
        roughness: 0.15,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.y = 0.7;
      nodeGroup.add(sphereMesh);

      // Floating 3D Text Billboard Label
      const textSprite = createTextSprite(sector.name, sector.depthStr, baseHex, isLight);
      textSprite.position.set(0, 2.8, 0);
      nodeGroup.add(textSprite);

      // Warning Shockwave Ring if critical
      if (sector.hazardLevel === 'critico') {
        const ringGeo = new THREE.RingGeometry(2.3, 2.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 0.05;
        nodeGroup.add(ringMesh);
        pulseRingsRef.current.push(ringMesh);
      }

      nodeGroup.userData = { isSector: true, sector };
      scene.add(nodeGroup);
    });

    // 11. Raycasting & Interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);

      let found = false;
      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== scene) {
          if (curr.userData.isWorker || curr.userData.isSector) {
            found = true;
            break;
          }
          curr = curr.parent;
        }
        if (found) break;
      }
      renderer.domElement.style.cursor = found ? 'pointer' : (dragMode === 'pan' ? 'grab' : 'default');
    };

    const handleClick = () => {
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);

      let foundSector: Sector3DConfig | null = null;
      let foundWorker: Worker | null = null;

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== scene) {
          if (curr.userData.isWorker) {
            foundWorker = curr.userData.worker;
            foundSector = curr.userData.sector;
            break;
          }
          if (curr.userData.isSector) {
            foundSector = curr.userData.sector;
            break;
          }
          curr = curr.parent;
        }
        if (foundSector || foundWorker) break;
      }

      if (foundWorker) {
        onSelectWorker?.(foundWorker);
        setSelectedSector(foundSector);
      } else if (foundSector) {
        focusOnSector(foundSector);
      } else {
        // Clicked on empty space: close details panel to keep view completely clear
        setSelectedSector(null);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousemove', handleMouseMove);
    domElement.addEventListener('click', handleClick);

    // 11b. Workers spawned in a separate useEffect to avoid camera reset
    // (see workerSpawnEffect below the main effect)

    // 12. Animation Loop — drives sector pulses + worker animation
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta() + 0.016, 0.05); // ~60fps cap

      controls.update();

      // Animate emergency pulse rings
      pulseRingsRef.current.forEach(ring => {
        const scale = 1 + (Math.sin(elapsedTime * 3.5) + 1) * 0.12;
        ring.scale.set(scale, scale, 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(elapsedTime * 3.5) * 0.35;
      });

      // Animate airflow particles along conduits
      if (tunnelParticlesRef.current) {
        const posAttr = tunnelParticlesRef.current.geometry.attributes.position;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          arr[i * 3 + 1] += Math.sin(elapsedTime * 2 + i) * 0.008;
        }
        posAttr.needsUpdate = true;
      }

      // === Animate Workers Along Tunnel Paths ===
      workerAnimsRef.current.forEach((wa, idx) => {
        // Advance path parameter
        wa.t += wa.speed * wa.dir * delta;
        if (wa.t > 1) { wa.t = 1; wa.dir = -1; } // bounce at end
        if (wa.t < 0) { wa.t = 0; wa.dir = 1;  } // bounce at start

        // Get position on curve
        const pos = wa.curve.getPointAt(wa.t);
        const ahead = wa.curve.getPointAt(Math.min(wa.t + 0.01 * wa.dir, 1));

        // Position and orient group
        wa.group.position.copy(pos);
        if (!ahead.equals(pos)) {
          wa.group.lookAt(ahead);
        }

        // Walking bob: body oscillates vertically (simulate stride)
        const stride = Math.sin(elapsedTime * 6 + idx * 1.3);
        wa.body.position.y = 0.22 + stride * 0.035;

        // Leg alternating swing
        const legSwing = Math.sin(elapsedTime * 6 + idx * 1.3);
        const legs = wa.group.children.filter(
          c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry &&
          (c as THREE.Mesh).position.y < 0
        ) as THREE.Mesh[];
        if (legs.length >= 2) {
          legs[0].rotation.x = legSwing * 0.45;
          legs[1].rotation.x = -legSwing * 0.45;
        }

        // Beacon pulse
        const pulse = 1 + Math.sin(elapsedTime * 4 + idx) * 0.3;
        wa.beacon.scale.set(pulse, 1, pulse);
        (wa.beacon.material as THREE.MeshBasicMaterial).opacity =
          wa.worker.status === 'peligro'
            ? 0.5 + Math.sin(elapsedTime * 8) * 0.5  // rapid flash for danger
            : 0.4 + Math.sin(elapsedTime * 2.5) * 0.25;

        // Name sprite faces camera (already a sprite, auto billboard)
        // Shift trail positions (shift oldest off, add current at front)
        for (let i = wa.trailPositions.length - 1; i > 0; i--) {
          wa.trailPositions[i].copy(wa.trailPositions[i - 1]);
        }
        wa.trailPositions[0].copy(pos).add(new THREE.Vector3(0, 0.05, 0));

        // Update trail geometry buffer
        const tArr = wa.trailMesh.geometry.attributes.position.array as Float32Array;
        wa.trailPositions.forEach((tp, i) => {
          tArr[i * 3] = tp.x;
          tArr[i * 3 + 1] = tp.y;
          tArr[i * 3 + 2] = tp.z;
        });
        wa.trailMesh.geometry.attributes.position.needsUpdate = true;

        // Fade trail opacity based on worker status
        const trailOpacity = wa.worker.status === 'peligro' ? 0.7 : 0.4;
        (wa.trailMesh.material as THREE.PointsMaterial).opacity = trailOpacity;
      });

      renderer.render(scene, camera);
    };

    animate();

    // 13. ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });

    resizeObserver.observe(container);

    // 14. Cleanup
    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      domElement.removeEventListener('mousemove', handleMouseMove);
      domElement.removeEventListener('click', handleClick);

      // Cleanup animated worker trail meshes
      workerAnimsRef.current.forEach(wa => {
        scene.remove(wa.trailMesh);
        wa.trailMesh.geometry.dispose();
        (wa.trailMesh.material as THREE.Material).dispose();
      });
      workerAnimsRef.current = [];

      scene.traverse((obj) => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          if (Array.isArray((obj as any).material)) {
            (obj as any).material.forEach((m: any) => m.dispose());
          } else {
            (obj as any).material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  // IMPORTANT: workers/alerts NOT in deps — prevents camera reset on every worker update
  }, [isLight, activeSectors, activeConnections, autoRotate, dragMode]);

  // Sync autoRotate state with controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Sync drag mode changes without rebuilding scene
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons.LEFT = dragMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      controlsRef.current.touches = {
        ONE: dragMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }
  }, [dragMode]);

  // =====================================================================
  // SEPARATE EFFECT: Spawn/Respawn worker avatars in existing scene.
  // This runs when workers change WITHOUT rebuilding camera or controls.
  // =====================================================================
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Distinct vivid colors per worker index (helmet jacket color)
    const WORKER_JACKET_COLORS = [
      0xe74c3c, // red
      0x3498db, // blue
      0x2ecc71, // green
      0x9b59b6, // purple
      0xe67e22, // orange
      0x1abc9c, // teal
      0xf39c12, // amber
      0xe91e63, // pink
      0x00bcd4, // cyan
      0x8bc34a, // lime
    ];

    // Helper: build a canvas-based worker name sprite
    function buildWorkerSprite(name: string, status: string, jacketHex: string): THREE.Sprite {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 72;
      const ctx2 = c.getContext('2d')!;
      // pill background
      ctx2.fillStyle = 'rgba(8,10,14,0.95)';
      ctx2.beginPath();
      ctx2.roundRect(4, 4, 312, 64, 14);
      ctx2.fill();
      // colored left stripe
      ctx2.fillStyle = jacketHex;
      ctx2.beginPath();
      ctx2.roundRect(4, 4, 10, 64, [14, 0, 0, 14]);
      ctx2.fill();
      // border
      const statusColor = status === 'peligro' ? '#EF4444' : status === 'advertencia' ? '#F59E0B' : '#10B981';
      ctx2.strokeStyle = statusColor;
      ctx2.lineWidth = 2.5;
      ctx2.beginPath();
      ctx2.roundRect(4, 4, 312, 64, 14);
      ctx2.stroke();
      // name text
      ctx2.fillStyle = '#ffffff';
      ctx2.font = 'bold 22px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      const displayName = name.length > 18 ? name.substring(0, 16) + '…' : name;
      ctx2.fillText(displayName, 166, 36);
      // status dot
      ctx2.fillStyle = statusColor;
      ctx2.beginPath();
      ctx2.arc(285, 36, 7, 0, Math.PI * 2);
      ctx2.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(5.0, 1.1, 1);
      return sprite;
    }

    // Remove existing animated workers from scene
    workerAnimsRef.current.forEach(wa => {
      scene.remove(wa.group);
      scene.remove(wa.trailMesh);
      wa.trailMesh.geometry.dispose();
      (wa.trailMesh.material as THREE.Material).dispose();
      wa.group.traverse((obj) => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) (obj as any).material.dispose();
      });
    });
    workerAnimsRef.current = [];

    workers.forEach((worker, wIdx) => {
      const sectorIdx = activeSectors.findIndex(s => s.name === worker.sector);
      let curve: THREE.CatmullRomCurve3;

      const sectorPos = sectorIdx >= 0 ? new THREE.Vector3(...activeSectors[sectorIdx].position) : null;
      const connForWorker = activeConnections.find(conn => {
        const d1 = sectorPos ? conn.fromPos.distanceTo(sectorPos) : Infinity;
        const d2 = sectorPos ? conn.toPos.distanceTo(sectorPos) : Infinity;
        return d1 < 6 || d2 < 6;
      });

      if (connForWorker) {
        // Build a richer curve with an intermediate waypoint
        const p1 = connForWorker.fromPos.clone();
        const p2 = connForWorker.toPos.clone();
        const mid = p1.clone().lerp(p2, 0.5);
        mid.y -= 0.4 + (wIdx % 3) * 0.3; // slightly different Y per worker
        mid.x += (wIdx % 2 === 0 ? 0.5 : -0.5) * (wIdx % 3);
        curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      } else if (sectorPos) {
        // Orbit around sector node
        const r = 1.8 + (wIdx % 4) * 0.6;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          pts.push(new THREE.Vector3(
            sectorPos.x + Math.cos(angle) * r,
            sectorPos.y + 0.5,
            sectorPos.z + Math.sin(angle) * r,
          ));
        }
        curve = new THREE.CatmullRomCurve3(pts, true);
      } else {
        return;
      }

      const jacketColor = WORKER_JACKET_COLORS[wIdx % WORKER_JACKET_COLORS.length];
      const jacketHex = '#' + jacketColor.toString(16).padStart(6, '0');
      const wStatusColor = worker.status === 'peligro' ? 0xef4444 : worker.status === 'advertencia' ? 0xf59e0b : 0x10b981;
      const wStatusHex = worker.status === 'peligro' ? '#EF4444' : worker.status === 'advertencia' ? '#F59E0B' : '#10B981';

      const workerGroup = new THREE.Group();
      const S = 1.6; // scale factor — workers 1.6x larger for visibility

      // === BODY (jacket) ===
      const bodyGeo = new THREE.BoxGeometry(0.36 * S, 0.52 * S, 0.22 * S);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: jacketColor,
        metalness: 0.1,
        roughness: 0.6,
        emissive: jacketColor,
        emissiveIntensity: 0.12,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.26 * S;
      workerGroup.add(body);

      // === HIGH-VIS STRIPES on jacket ===
      const stripeGeo = new THREE.BoxGeometry(0.37 * S, 0.07 * S, 0.23 * S);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.26 * S;
      workerGroup.add(stripe);

      // === LEGS ===
      const legGeo = new THREE.BoxGeometry(0.14 * S, 0.42 * S, 0.16 * S);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.10 * S, -0.16 * S, 0);
      workerGroup.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.10 * S, -0.16 * S, 0);
      workerGroup.add(legR);

      // === HEAD ===
      const headGeo = new THREE.BoxGeometry(0.24 * S, 0.24 * S, 0.22 * S);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7, roughness: 0.8 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.66 * S;
      workerGroup.add(head);

      // === HELMET (bright yellow dome) ===
      const hatGeo = new THREE.SphereGeometry(0.20 * S, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const hatMat = new THREE.MeshStandardMaterial({
        color: 0xFFCC00,
        metalness: 0.5,
        roughness: 0.2,
        emissive: 0xD4A017,
        emissiveIntensity: 0.35,
      });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 0.72 * S;
      workerGroup.add(hat);

      // === HEADLAMP (bright white) ===
      const lampGeo = new THREE.BoxGeometry(0.08 * S, 0.06 * S, 0.1 * S);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0, 0.74 * S, 0.22 * S);
      workerGroup.add(lamp);

      // === HEADLAMP POINT LIGHT ===
      const headLight = new THREE.PointLight(0xffffff, 1.2, 6);
      headLight.position.set(0, 0.74 * S, 0.4 * S);
      workerGroup.add(headLight);

      // === STATUS BEACON (ground ring, pulsed in animation) ===
      const beaconGeo = new THREE.RingGeometry(0.38 * S, 0.52 * S, 28);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: wStatusColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.rotation.x = Math.PI / 2;
      beacon.position.y = -0.38 * S;
      workerGroup.add(beacon);

      // === WORKER NAME LABEL (sprite billboard) ===
      const nameSprite = buildWorkerSprite(worker.name, worker.status, jacketHex);
      nameSprite.position.set(0, 1.5 * S, 0);
      workerGroup.add(nameSprite);

      // === MOTION TRAIL ===
      const TRAIL_LEN = 24;
      const trailGeo = new THREE.BufferGeometry();
      const trailPos2 = new Float32Array(TRAIL_LEN * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos2, 3));
      const trailMat2 = new THREE.PointsMaterial({
        color: new THREE.Color(wStatusHex),
        size: isLight ? 0.22 : 0.28,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const trailMesh = new THREE.Points(trailGeo, trailMat2);
      scene.add(trailMesh);

      workerGroup.userData = { isWorker: true, worker };
      scene.add(workerGroup);

      const startT = (wIdx / Math.max(workers.length, 1));
      const speed = 0.022 + (wIdx % 5) * 0.005;

      workerAnimsRef.current.push({
        group: workerGroup,
        body,
        beacon,
        namesprite: nameSprite,
        curve,
        t: startT,
        speed,
        dir: wIdx % 2 === 0 ? 1 : -1,
        trailPositions: Array.from({ length: TRAIL_LEN }, () => new THREE.Vector3()),
        trailMesh,
        worker,
      });
    });

    // No cleanup return needed — cleanup is done at the top of this effect
  }, [workers, activeSectors, activeConnections, isLight]);

  return (
    <div 
      ref={rootRef}
      className={`transition-all duration-300 flex flex-col ${
        isExpanded 
          ? `fixed inset-0 z-[999999] w-screen h-screen rounded-none p-0 m-0 shadow-none border-none ${
              isLight ? 'bg-slate-100' : 'bg-[#090B0E]'
            }` 
          : `relative w-full rounded-2xl border shadow-2xl h-[470px] lg:h-[510px] overflow-hidden ${
              isLight 
                ? 'bg-slate-50 border-slate-200 shadow-slate-200/50' 
                : 'bg-[#0C0E12] border-[#D4AF37]/20'
            }`
      } ${className}`}
    >
      {/* If Fullscreen: Top Control Bar */}
      {isExpanded ? (
        <div className={`absolute top-0 inset-x-0 h-14 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shadow-xl border-b ${
          isLight 
            ? 'bg-white/95 border-slate-200 text-slate-800' 
            : 'bg-[#121418]/90 border-white/10 text-white'
        }`}>
          {/* Left info */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              PANTALLA COMPLETA 3D
            </span>
            <div className="hidden sm:block">
              <h3 className={`text-sm font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Topografía Subterránea & Cinemática de Mineros
              </h3>
              <p className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Mina M-10 · Bocamina (0m) a Frente de Extracción (-135m)
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Presets */}
            <div className={`flex items-center gap-1 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181A20] border-white/10'
            }`}>
              <button
                onClick={() => applyPreset('iso')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'iso'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white'
                }`}
                title="Vista Isométrica 3D"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>3D</span>
              </button>

              <button
                onClick={() => applyPreset('profile')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'profile'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white'
                }`}
                title="Perfil Z (Corte Geológico)"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Perfil Z</span>
              </button>

              <button
                onClick={() => applyPreset('top')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'top'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white'
                }`}
                title="Vista Planta Cenital"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Planta</span>
              </button>

              <button
                onClick={() => applyPreset('front')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'front'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white'
                }`}
                title="Vista Frontal de Niveles"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Frontal</span>
              </button>

              <div className={`w-[1px] h-4 mx-1 ${isLight ? 'bg-slate-300' : 'bg-white/10'}`} />

              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  autoRotate 
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold' 
                    : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-gray-400 hover:text-gray-200'
                }`}
                title={autoRotate ? 'Detener Giro Automático' : 'Iniciar Giro Automático 360°'}
              >
                <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={resetCamera}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'
                }`}
                title="Reiniciar Vista y Centrar"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent Exit Fullscreen Button */}
            <button
              id="btn-exit-fullscreen"
              onClick={toggleFullscreen}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-600 dark:text-red-300 hover:text-red-700 dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-500/20"
              title="Salir de Pantalla Completa (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Salir (Esc)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Regular Card Mode Floating Camera Toolbar */
        <>
          {/* Top-Left Status Pill */}
          <div className={`absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border backdrop-blur-md shadow-md transition-colors ${
            isLight ? 'bg-white/95 border-slate-200 text-slate-700' : 'bg-[#14161C]/90 border-white/10 text-gray-300'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold font-mono tracking-wide">SOCAVONES 3D</span>
          </div>

          {/* Top-Right Camera Controls + Prominent Agrandar (Fullscreen) Button */}
          <div className={`absolute top-3 right-3 z-30 flex items-center gap-1 p-1 rounded-xl shadow-xl border backdrop-blur-md transition-colors shrink-0 ${
            isLight 
              ? 'bg-white/95 border-slate-200 text-slate-700' 
              : 'bg-[#16181D]/90 border-white/10 text-gray-300'
          }`}>
            {/* Presets */}
            <button
              onClick={() => applyPreset('iso')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                activePreset === 'iso'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Vista Isométrica 3D"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>

            <button
              onClick={() => applyPreset('profile')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                activePreset === 'profile'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Corte Transversal de Profundidad"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Perfil Z</span>
            </button>

            <button
              onClick={() => applyPreset('top')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                activePreset === 'top'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Vista Cenital Superior"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Planta</span>
            </button>

            <button
              onClick={() => applyPreset('front')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                activePreset === 'front'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Vista Frontal de Niveles"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Frontal</span>
            </button>

            <div className={`w-[1px] h-4 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

            {/* Auto Rotate Toggle */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-1.5 rounded-lg text-[10px] transition-all cursor-pointer ${
                autoRotate 
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold' 
                  : isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
              title={autoRotate ? 'Detener Giro Automático' : 'Giro Automático Cinemático 360°'}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>

            {/* Reset Camera */}
            <button
              onClick={resetCamera}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Reiniciar Vista de Cámara"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>

            {/* Help Tooltip Toggle */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                showHelp 
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]' 
                  : isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Guía de Controles 3D"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Prominent Expand/Fullscreen Button */}
            <button
              id="btn-trigger-fullscreen"
              onClick={toggleFullscreen}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                isLight 
                  ? 'bg-[#D4AF37] hover:bg-[#c29e2e] text-black' 
                  : 'bg-[#D4AF37] hover:bg-[#c29e2e] text-black'
              }`}
              title="Agrandar mapa a Pantalla Completa"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Agrandar</span>
            </button>
          </div>
        </>
      )}

      {/* Quick Jump Sector Chips Bar (Placed on a Dedicated Row to NEVER Obstruct the Toolbar) */}
      <div className={`absolute ${
        isExpanded ? 'top-16 left-6 max-w-[calc(100%-48px)]' : 'top-13 left-3 ' + (selectedSector ? 'max-w-[calc(100%-310px)]' : 'max-w-[calc(100%-24px)]')
      } z-20 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 pointer-events-auto transition-all`}>
        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-lg backdrop-blur-md border shrink-0 inline-flex items-center gap-1 shadow-sm ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-700' : 'bg-[#121418]/90 border-white/10 text-gray-400'
        }`}>
          <Crosshair className="w-3 h-3 text-[#D4AF37]" /> Nivel:
        </span>
        {activeSectors.map((sector) => {
          const isSelected = selectedSector?.name === sector.name;
          const hasCrit = sector.hazardLevel === 'critico';
          return (
            <button
              key={sector.id}
              onClick={() => focusOnSector(sector)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md border shadow-sm shrink-0 max-w-[180px] sm:max-w-[220px] ${
                isSelected 
                  ? 'bg-[#D4AF37] text-black font-bold border-[#D4AF37] shadow-md ring-2 ring-[#D4AF37]/30' 
                  : isLight 
                  ? 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300' 
                  : 'bg-[#14161C]/90 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
              }`}
              title={`Enfocar cámara en ${sector.name} (${sector.depthStr})`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                hasCrit ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
              }`} />
              <span className="truncate">{sector.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main 3D Canvas Mount Point */}
      <div 
        ref={containerRef} 
        className={`w-full h-full ${
          dragMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-move'
        }`} 
      />

      {/* Floating 3D Navigation Control Pad (Bottom Right D-Pad + Zoom + Pan/Rotate Mode) */}
      <div className={`absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto`}>
        {/* Interaction Mode Toggle (Rotar vs Desplazar) */}
        <div className={`flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md shadow-xl ${
          isLight ? 'bg-white/95 border-slate-200 text-slate-700' : 'bg-[#14161C]/90 border-white/10 text-gray-300'
        }`}>
          <button
            onClick={() => setDragMode('rotate')}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              dragMode === 'rotate'
                ? 'bg-[#D4AF37] text-black shadow-sm font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'
            }`}
            title="Modo Rotar: Clic izquierdo arrastra para girar vista 3D"
          >
            <MousePointer className="w-3 h-3" />
            <span className="hidden sm:inline">Rotar</span>
          </button>
          <button
            onClick={() => setDragMode('pan')}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              dragMode === 'pan'
                ? 'bg-[#D4AF37] text-black shadow-sm font-bold'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'
            }`}
            title="Modo Desplazar: Clic izquierdo arrastra la mina por pantalla"
          >
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Desplazar</span>
          </button>
        </div>

        {/* Compact D-Pad & Zoom Controls */}
        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border backdrop-blur-md shadow-2xl ${
          isLight ? 'bg-white/95 border-slate-200 shadow-slate-200/60' : 'bg-[#14161C]/95 border-white/10'
        }`}>
          {/* Directional Pad */}
          <div className="grid grid-cols-3 gap-1 p-0.5">
            <div />
            <button
              onClick={() => handleOrbit(0, -0.15)}
              className={`p-1 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-300'
              }`}
              title="Inclinar Arriba"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <div />

            <button
              onClick={() => handleOrbit(-0.25, 0)}
              className={`p-1 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-300'
              }`}
              title="Girar Izquierda"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={resetCamera}
              className={`p-1 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900' : 'bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border-[#D4AF37]/30 text-[#D4AF37]'
              }`}
              title="Centrar Vista (Reset)"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleOrbit(0.25, 0)}
              className={`p-1 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-300'
              }`}
              title="Girar Derecha"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div />
            <button
              onClick={() => handleOrbit(0, 0.15)}
              className={`p-1 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-300'
              }`}
              title="Inclinar Abajo"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div />
          </div>

          <div className={`w-[1px] h-10 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

          {/* Zoom In / Out */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleZoom('in')}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-200'
              }`}
              title="Acercar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom('out')}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800' : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-200'
              }`}
              title="Alejar Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Control Help Modal / Card */}
      {showHelp && (
        <div className={`absolute top-14 right-3 z-40 w-72 rounded-xl p-3.5 border shadow-2xl backdrop-blur-md animate-in fade-in duration-150 ${
          isLight ? 'bg-white/95 border-slate-300 text-slate-800' : 'bg-[#14161C]/95 border-[#D4AF37]/30 text-gray-200'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-white/10 mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5 text-[#D4AF37]">
              <Info className="w-3.5 h-3.5" /> Controles 3D de Socavón
            </span>
            <button 
              onClick={() => setShowHelp(false)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <ul className="space-y-1.5 text-[11px] font-mono">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[#D4AF37] shrink-0">🖱️ Arrastre:</span>
              <span>Rotar cámara alrededor de la mina (u horizontal si modo Desplazar)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[#D4AF37] shrink-0">⚙️ Rueda:</span>
              <span>Acercar / alejar zoom dinámico</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[#D4AF37] shrink-0">✋ Clic Der:</span>
              <span>Desplazar la mina lateral o verticalmente (Pan)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[#D4AF37] shrink-0">🎯 Clic Nodo:</span>
              <span>Inspeccionar socavón y mineros asignados</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-[#D4AF37] shrink-0">🔄 Botón Giro:</span>
              <span>Activa rotación continua cinemática 360°</span>
            </li>
          </ul>
        </div>
      )}

      {/* Bottom Subterranean Depth & Legend Indicator */}
      <div className={`absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 text-[10px] font-mono backdrop-blur-md px-3 py-1.5 rounded-xl border shadow-md transition-colors ${
        isLight 
          ? 'bg-white/95 border-slate-200 text-slate-600' 
          : 'bg-[#0C0E12]/90 border-white/10 text-gray-300'
      }`}>
        <span className="text-[#D4AF37] font-bold">COTA:</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0m Bocamina</span>
        <span className="text-gray-400">→</span>
        <span className="text-amber-700 dark:text-[#B87333] font-semibold">-50m / -75m</span>
        <span className="text-gray-400">→</span>
        <span className="text-red-600 dark:text-red-400 font-semibold">-120m / -135m</span>
        <span className="text-gray-400">|</span>
        <span className="font-semibold text-slate-800 dark:text-white">{activeSectors.length} Socavones</span>
        <span className="text-gray-400">·</span>
        <span className="text-[#D4AF37] font-bold">{activeConnections.length} Galerías</span>
        <span className="text-gray-400">·</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{workers.length} Mineros en Movimiento</span>
        </span>
        {onNavigateToSocavones && (
          <button
            onClick={onNavigateToSocavones}
            className="ml-1 text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-amber-800 dark:text-[#D4AF37] border border-[#D4AF37]/30 font-sans font-semibold cursor-pointer transition-colors"
          >
            Tender cables
          </button>
        )}
      </div>

      {/* Live Workers Presence Panel - floating right side, compact */}
      {workers.length > 0 && !selectedSector && (
        <div className={`absolute z-20 flex flex-col gap-1 right-3 pointer-events-none ${
          isExpanded ? 'bottom-16' : 'bottom-24'
        }`}>
          <div className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-t-lg border-x border-t ${
            isLight ? 'bg-white/90 border-slate-200 text-slate-500' : 'bg-[#0C0E12]/90 border-white/10 text-gray-500'
          }`}>
            Presencia en Tiempo Real
          </div>
          <div className={`rounded-b-xl border shadow-xl backdrop-blur-md max-h-36 overflow-y-auto ${
            isLight ? 'bg-white/92 border-slate-200' : 'bg-[#0C0E12]/90 border-white/10'
          }`}>
            {workers.slice(0, 8).map((w) => (
              <div key={w.id} className={`flex items-center gap-1.5 px-2 py-1 border-b last:border-b-0 ${
                isLight ? 'border-slate-100' : 'border-white/5'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  w.status === 'peligro' ? 'bg-red-500 animate-ping' :
                  w.status === 'advertencia' ? 'bg-amber-400 animate-pulse' :
                  'bg-emerald-400'
                }`} />
                <span className={`text-[10px] font-medium truncate max-w-[100px] ${
                  isLight ? 'text-slate-800' : 'text-gray-200'
                }`}>{w.name.split(' ')[0]}</span>
                <span className={`text-[9px] font-mono truncate ml-auto ${
                  isLight ? 'text-slate-400' : 'text-gray-500'
                }`}>{w.sector?.replace('Socavón ', '').replace('Nivel ', 'Nv') || '—'}</span>
              </div>
            ))}
            {workers.length > 8 && (
              <div className={`text-[9px] text-center py-1 font-mono ${
                isLight ? 'text-slate-400' : 'text-gray-500'
              }`}>+{workers.length - 8} más</div>
            )}
          </div>
        </div>
      )}

      {/* Clean Detail Inspector Drawer (when a sector is focused or clicked) */}
      {selectedSector && (
        <div className={`absolute right-3 z-40 w-72 backdrop-blur-md border rounded-xl p-3.5 shadow-2xl text-left pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 ${
          isLight 
            ? 'bg-white/95 border-amber-500/30 text-slate-900 shadow-slate-300/50' 
            : 'bg-[#14161C]/95 border-[#D4AF37]/30 text-white'
        } ${isExpanded ? 'top-16' : 'top-14'}`}>
          {(() => {
            const sec = selectedSector;
            const secWorkers = sectorWorkersMap[sec.name] || [];
            const secAlerts = sectorAlertsMap[sec.name] || [];
            const hasCrit = secWorkers.some(w => w.status === 'peligro');

            return (
              <div className="space-y-2.5">
                {/* Header with Close Button (X) */}
                <div className={`flex items-start justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        hasCrit ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
                      }`} />
                      <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{sec.name}</h4>
                    </div>
                    <p className="text-[10px] text-[#D4AF37] font-mono mt-0.5">{sec.depthStr}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      sec.hazardLevel === 'critico' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40' :
                      sec.hazardLevel === 'alto' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-500/40' :
                      sec.hazardLevel === 'medio' ? 'bg-[#B87333]/20 text-[#B87333] dark:text-[#FDBA74] border-[#B87333]/40' :
                      'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}>
                      {sec.hazardLevel}
                    </span>

                    {/* Explicit Dismiss Button */}
                    <button
                      id="btn-close-3d-sector-inspector"
                      onClick={() => setSelectedSector(null)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title="Cerrar detalles del socavón"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Telemetry in Sector */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className={`p-1.5 rounded-lg border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0C0E12] border-white/5'
                  }`}>
                    <span className={`block text-[9px] flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                      <Wind className="w-2.5 h-2.5 text-cyan-500" /> VENTILACIÓN
                    </span>
                    <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-gray-200'}`}>{sec.ventilation}</span>
                  </div>
                  <div className={`p-1.5 rounded-lg border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0C0E12] border-white/5'
                  }`}>
                    <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>GAS CO</span>
                    <span className={`font-bold ${sec.coGasPpm > 30 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {sec.coGasPpm} PPM
                    </span>
                  </div>
                </div>

                {/* Assigned Workers List */}
                <div>
                  <div className={`flex items-center justify-between text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="w-3 h-3 text-[#D4AF37]" /> Mineros ({secWorkers.length})
                    </span>
                  </div>

                  {secWorkers.length === 0 ? (
                    <p className={`text-[10px] italic ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Sector deshabitado actualmente.</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {secWorkers.map((w) => (
                        <div
                          key={w.id}
                          onClick={() => {
                            onSelectWorker?.(w);
                            onNavigateToMonitoring?.(w);
                          }}
                          className={`flex items-center justify-between p-1.5 rounded-lg text-[10px] cursor-pointer border transition-all ${
                            isLight 
                              ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-amber-400' 
                              : 'bg-[#0C0E12] hover:bg-white/5 text-gray-200 border-transparent hover:border-[#D4AF37]/30'
                          }`}
                          title="Clic para ver monitoreo cinemático"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <HardHat className="w-3 h-3 text-[#D4AF37] shrink-0" />
                            <span className="font-medium truncate">{w.name}</span>
                          </div>
                          <span className={`text-[9px] px-1 rounded font-mono ${
                            w.status === 'peligro' ? 'bg-red-500/20 text-red-500 font-bold' :
                            w.status === 'advertencia' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' :
                            'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                          }`}>
                            {w.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {secAlerts.length > 0 && (
                  <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-600 dark:text-red-300 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-red-500 shrink-0 animate-bounce" />
                    <span>{secAlerts.length} incidente en este sector</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
