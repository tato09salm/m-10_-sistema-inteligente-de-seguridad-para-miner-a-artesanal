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
  Wind
} from 'lucide-react';
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

// Canvas helper to create sharp 3D text billboards for sector names
function createTextSprite(title: string, depthText: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Dark background pill
    ctx.fillStyle = 'rgba(18, 20, 24, 0.88)';
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 60, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, 26);

    // Subtitle / Depth
    ctx.fillStyle = colorHex;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(isExpandedInitial);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<'iso' | 'profile' | 'top'>('iso');
  
  // Active detail inspector (closed by default so it doesn't obstruct the map)
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

  // Fullscreen toggle (native Fullscreen API like YouTube + CSS modal fallback)
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

  // Camera presets
  const applyPreset = useCallback((preset: 'iso' | 'profile' | 'top') => {
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
      camera.position.set(0, 52, 0);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c0e12);
    scene.fog = new THREE.FogExp2(0x0c0e12, 0.012);

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

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(2, -6, 0);
    controls.maxDistance = 140;
    controls.minDistance = 6;
    controls.maxPolarAngle = Math.PI / 2 + 0.35;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff1cf, 1.3);
    dirLight.position.set(25, 45, 30);
    scene.add(dirLight);

    const blueSubLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    blueSubLight.position.set(-25, -30, -25);
    scene.add(blueSubLight);

    const goldPointLight = new THREE.PointLight(0xd4af37, 1.8, 50);
    goldPointLight.position.set(0, -5, 0);
    scene.add(goldPointLight);

    // 6. Subtle Stratum Reference Grids
    // Surface Grid (Bocamina 0m)
    const surfaceGrid = new THREE.GridHelper(56, 28, 0xd4af37, 0x1f293d);
    surfaceGrid.position.y = 2;
    scene.add(surfaceGrid);

    // Subtle depth level guide lines
    const depthLevels = [
      { y: -4, color: 0x223044 },
      { y: -6.5, color: 0x223044 },
      { y: -8.5, color: 0x223044 },
      { y: -11.5, color: 0x223044 },
      { y: -13, color: 0x223044 },
    ];

    depthLevels.forEach(dl => {
      const grid = new THREE.GridHelper(48, 16, dl.color, 0x141824);
      grid.position.y = dl.y;
      scene.add(grid);
    });

    pulseRingsRef.current = [];

    // 7. Render 3D Tunnels between Sectors (Dynamic Real-Time Connections)
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
        roughness: 0.5,
        metalness: 0.2,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      // Wireframe Outline for Clean CAD Look
      const wireMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexColor),
        wireframe: true,
        transparent: true,
        opacity: 0.18,
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

        particleColors[i * 3] = 0.83;
        particleColors[i * 3 + 1] = 0.69;
        particleColors[i * 3 + 2] = 0.22;
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

      const particleMat = new THREE.PointsMaterial({
        size: 0.26,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const tunnelParticles = new THREE.Points(particleGeo, particleMat);
      scene.add(tunnelParticles);
      tunnelParticlesRef.current = tunnelParticles;
    } else {
      tunnelParticlesRef.current = null;
    }

    // 9. Create 3D Nodes for each Sector
    activeSectors.forEach((sector) => {
      const sectorWorkers = workers.filter(w => w.sector === sector.name);
      const hasCritical = sectorWorkers.some(w => w.status === 'peligro');
      const hasWarning = sectorWorkers.some(w => w.status === 'advertencia');

      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...sector.position);

      const baseColor = hasCritical ? 0xef4444 : hasWarning ? 0xb87333 : 0xd4af37;
      const baseHex = hasCritical ? '#EF4444' : hasWarning ? '#B87333' : '#D4AF37';

      // Base Station Pedestal
      const cylGeo = new THREE.CylinderGeometry(1.8, 2.1, 0.35, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x14161b,
        metalness: 0.8,
        roughness: 0.25,
        emissive: new THREE.Color(baseColor),
        emissiveIntensity: hasCritical ? 0.5 : 0.2,
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      nodeGroup.add(cylMesh);

      // Glowing Center Core Sphere
      const sphereGeo = new THREE.SphereGeometry(0.65, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: hasCritical ? 0.8 : 0.35,
        roughness: 0.15,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.y = 0.7;
      nodeGroup.add(sphereMesh);

      // Floating 3D Text Billboard Label directly in scene
      const textSprite = createTextSprite(sector.name, sector.depthStr, baseHex);
      textSprite.position.set(0, 2.8, 0);
      nodeGroup.add(textSprite);

      // Warning Shockwave Ring if critical
      if (hasCritical || sector.hazardLevel === 'critico') {
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

      // Tag for Raycasting
      nodeGroup.userData = { isSector: true, sector };
      scene.add(nodeGroup);

      // 10. Miners in this Sector (3D Avatars / Helmets)
      sectorWorkers.forEach((worker, wIdx) => {
        const workerGroup = new THREE.Group();
        const angle = (wIdx / Math.max(sectorWorkers.length, 1)) * Math.PI * 2;
        const radius = 1.25;
        const wx = Math.cos(angle) * radius;
        const wz = Math.sin(angle) * radius;
        workerGroup.position.set(wx, 0.4, wz);

        const wColor = worker.status === 'peligro' ? 0xef4444 : worker.status === 'advertencia' ? 0xf59e0b : 0x10b981;

        // HardHat Helmet Model
        const hatGeo = new THREE.SphereGeometry(0.32, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const hatMat = new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.3,
          roughness: 0.3,
        });
        const hatMesh = new THREE.Mesh(hatGeo, hatMat);
        hatMesh.position.y = 0.5;
        workerGroup.add(hatMesh);

        // Headlamp Lamp
        const lampGeo = new THREE.BoxGeometry(0.1, 0.08, 0.12);
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lampMesh = new THREE.Mesh(lampGeo, lampMat);
        lampMesh.position.set(0, 0.54, 0.28);
        workerGroup.add(lampMesh);

        // Status Ring
        const auraGeo = new THREE.RingGeometry(0.35, 0.46, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: wColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
        auraMesh.rotation.x = Math.PI / 2;
        auraMesh.position.y = 0.05;
        workerGroup.add(auraMesh);

        workerGroup.userData = { isWorker: true, worker, sector };
        nodeGroup.add(workerGroup);
      });
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
      renderer.domElement.style.cursor = found ? 'pointer' : 'default';
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
        // Clicked on empty space: close details panel to keep view completely clear!
        setSelectedSector(null);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousemove', handleMouseMove);
    domElement.addEventListener('click', handleClick);

    // 12. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

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
  }, [workers, alerts, onSelectWorker, focusOnSector, autoRotate, activeSectors, activeConnections]);

  // Sync autoRotate state with controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  return (
    <div 
      ref={rootRef}
      className={`transition-all duration-300 flex flex-col ${
        isExpanded 
          ? 'fixed inset-0 z-[999999] w-screen h-screen rounded-none bg-[#090B0E] p-0 m-0 shadow-none border-none' 
          : 'relative w-full rounded-2xl bg-[#0C0E12] border border-[#D4AF37]/20 shadow-2xl h-[440px] lg:h-[480px] overflow-hidden'
      } ${className}`}
    >
      {/* If Fullscreen: Top Control Bar (YouTube/Modal Cinema Header) */}
      {isExpanded ? (
        <div className="absolute top-0 inset-x-0 h-14 bg-[#121418]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-30 shadow-2xl">
          {/* Left info */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              PANTALLA COMPLETA 3D
            </span>
            <div className="hidden sm:block">
              <h3 className="text-sm font-bold text-white leading-tight">
                Topografía Subterránea & Cinemática de Mineros
              </h3>
              <p className="text-[10px] text-gray-400 font-mono">
                Mina M-10 · Bocamina (0m) a Frente de Extracción (-135m)
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Presets */}
            <div className="flex items-center gap-1 bg-[#181A20] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => applyPreset('iso')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'iso'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>3D</span>
              </button>

              <button
                onClick={() => applyPreset('profile')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'profile'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Perfil Z</span>
              </button>

              <button
                onClick={() => applyPreset('top')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activePreset === 'top'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Planta</span>
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  autoRotate 
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title={autoRotate ? 'Detener Giro' : 'Iniciar Giro Auto'}
              >
                <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={resetCamera}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer"
                title="Reiniciar Vista"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent Exit Fullscreen Button */}
            <button
              id="btn-exit-fullscreen"
              onClick={toggleFullscreen}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-500/20"
              title="Salir de Pantalla Completa (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Salir (Esc)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Regular Card Mode Floating Camera Toolbar */
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#16181D]/90 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-xl">
          <button
            onClick={() => applyPreset('iso')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
              activePreset === 'iso'
                ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
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
                : 'text-gray-300 hover:text-white hover:bg-white/5'
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
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
            title="Vista Cenital Superior"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Planta</span>
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-[10px] transition-all cursor-pointer ${
              autoRotate 
                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
            title={autoRotate ? 'Detener Giro Automático' : 'Giro Automático Cinemático'}
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          {/* Reset Camera */}
          <button
            onClick={resetCamera}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            title="Reiniciar Vista de Cámara"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>

          {/* Expand to Fullscreen (Modal/YouTube style) */}
          <button
            id="btn-trigger-fullscreen"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5 transition-all cursor-pointer"
            title="Pantalla Completa (Tipo Modal / YouTube)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 3D Canvas Mount Point */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Minimalist Depth Reference Indicator */}
      <div className={`absolute bottom-3 left-3 z-20 pointer-events-none flex items-center gap-2 text-[10px] font-mono text-gray-400 bg-[#0C0E12]/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/5`}>
        <span className="text-[#D4AF37] font-semibold">COTA:</span>
        <span className="text-emerald-400">0m Bocamina</span>
        <span className="text-gray-600">→</span>
        <span className="text-[#B87333]">-50m / -75m</span>
        <span className="text-gray-600">→</span>
        <span className="text-red-400">-120m / -135m</span>
      </div>

      {/* Clean, Non-Obstructive Detail Inspector Drawer (Dismissible with X) */}
      {selectedSector && (
        <div className={`absolute right-3 z-40 w-72 bg-[#14161C]/95 backdrop-blur-md border border-[#D4AF37]/30 rounded-xl p-3.5 shadow-2xl text-left pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 ${
          isExpanded ? 'top-16' : 'top-14'
        }`}>
          {(() => {
            const sec = selectedSector;
            const secWorkers = sectorWorkersMap[sec.name] || [];
            const secAlerts = sectorAlertsMap[sec.name] || [];
            const hasCrit = secWorkers.some(w => w.status === 'peligro');

            return (
              <div className="space-y-2.5">
                {/* Header with Close Button (X) */}
                <div className="flex items-start justify-between border-b border-white/10 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        hasCrit ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
                      }`} />
                      <h4 className="text-xs font-bold text-white">{sec.name}</h4>
                    </div>
                    <p className="text-[10px] text-[#D4AF37] font-mono mt-0.5">{sec.depthStr}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      sec.hazardLevel === 'critico' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                      sec.hazardLevel === 'alto' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                      sec.hazardLevel === 'medio' ? 'bg-[#B87333]/20 text-[#FDBA74] border-[#B87333]/40' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {sec.hazardLevel}
                    </span>

                    {/* Explicit Dismiss Button */}
                    <button
                      id="btn-close-3d-sector-inspector"
                      onClick={() => setSelectedSector(null)}
                      className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Cerrar detalles del socavón"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Telemetry in Sector */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-[#0C0E12] p-1.5 rounded-lg border border-white/5">
                    <span className="text-gray-400 block text-[9px] flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-cyan-400" /> VENTILACIÓN
                    </span>
                    <span className="text-gray-200 font-bold">{sec.ventilation}</span>
                  </div>
                  <div className="bg-[#0C0E12] p-1.5 rounded-lg border border-white/5">
                    <span className="text-gray-400 block text-[9px]">GAS CO</span>
                    <span className={`font-bold ${sec.coGasPpm > 30 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {sec.coGasPpm} PPM
                    </span>
                  </div>
                </div>

                {/* Assigned Workers List */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="w-3 h-3 text-[#D4AF37]" /> Mineros ({secWorkers.length})
                    </span>
                  </div>

                  {secWorkers.length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic">Sector deshabitado actualmente.</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {secWorkers.map((w) => (
                        <div
                          key={w.id}
                          onClick={() => {
                            onSelectWorker?.(w);
                            onNavigateToMonitoring?.(w);
                          }}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-[#0C0E12] hover:bg-white/5 text-[10px] text-gray-200 cursor-pointer border border-transparent hover:border-[#D4AF37]/30 transition-all"
                          title="Clic para ver monitoreo cinemático"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <HardHat className="w-3 h-3 text-[#D4AF37] shrink-0" />
                            <span className="font-medium truncate">{w.name}</span>
                          </div>
                          <span className={`text-[9px] px-1 rounded font-mono ${
                            w.status === 'peligro' ? 'bg-red-500/20 text-red-400 font-bold' :
                            w.status === 'advertencia' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {w.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {secAlerts.length > 0 && (
                  <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-300 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-red-400 shrink-0 animate-bounce" />
                    <span>{secAlerts.length} incidente en este sector</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Real-time Subterranean Network HUD Indicator */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#121418]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-mono shadow-xl text-gray-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold text-white">{activeSectors.length} Socavones</span>
        <span className="text-gray-500">·</span>
        <span className="text-[#D4AF37] font-bold">{activeConnections.length} Galerías Conectadas</span>
        {onNavigateToSocavones && (
          <button
            onClick={onNavigateToSocavones}
            className="ml-1 text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/30 font-sans font-semibold cursor-pointer transition-colors"
          >
            Tender cables
          </button>
        )}
      </div>

    </div>
  );
};
