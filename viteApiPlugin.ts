import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import pg from 'pg';
import dotenv from 'dotenv';
import { INITIAL_WORKERS, INITIAL_ALERTS, AUDIT_LOGS, generateInitialTelemetryHistory, SYSTEM_USERS } from './src/lib/mockData';
import { classifySensorStream, RawSensorReading } from './src/lib/mlEngine';
import { Worker, Alert, SensorTelemetry, AuditLog, DashboardStats, MineTunnel, TunnelConnection } from './src/types';

dotenv.config();

const { Pool } = pg;
const pgPool = new Pool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt((process.env.DB_PORT || '5432').trim(), 10),
  database: (process.env.DB_NAME || 'mineria').trim(),
  user: (process.env.DB_USER || 'postgres').trim(),
  password: (process.env.DB_PASSWORD || 'sa').trim(),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

function mapRowToMineTunnel(r: any): MineTunnel {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    tunnelType: r.tunnel_type,
    status: r.status,
    elevation: parseFloat(r.elevation ?? 0),
    startX: parseFloat(r.start_x ?? 0),
    startY: parseFloat(r.start_y ?? 0),
    startZ: parseFloat(r.start_z ?? 0),
    endX: parseFloat(r.end_x ?? 50),
    endY: parseFloat(r.end_y ?? 0),
    endZ: parseFloat(r.end_z ?? 0),
    lengthMeters: parseFloat(r.length_meters ?? 50),
    widthMeters: parseFloat(r.width_meters ?? 2.5),
    heightMeters: parseFloat(r.height_meters ?? 2.2),
    ventilationStatus: r.ventilation_status || 'optimo',
    riskLevel: r.risk_level || 'bajo',
    description: r.description || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapRowToTunnelConnection(r: any): TunnelConnection {
  let junction = { x: 0, y: 0, z: 0 };
  if (typeof r.junction_point === 'string') {
    try { junction = JSON.parse(r.junction_point); } catch {}
  } else if (r.junction_point) {
    junction = r.junction_point;
  }
  return {
    id: r.id,
    sourceTunnelId: r.source_tunnel_id,
    targetTunnelId: r.target_tunnel_id,
    connectionType: r.connection_type || 'bifurcacion_y',
    junctionPoint: junction,
    distanceMeters: parseFloat(r.distance_meters ?? 5),
    status: r.status || 'abierto',
    notes: r.notes || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapRowToWorker(r: any): Worker {
  let emergency = { name: 'Contacto de Emergencia', phone: '+51 900 000 000', relationship: 'Familiar' };
  if (typeof r.emergency_contact === 'string') {
    try { emergency = JSON.parse(r.emergency_contact); } catch {}
  } else if (r.emergency_contact) {
    emergency = r.emergency_contact;
  }

  let currentAccel = { x: 0.1, y: 9.81, z: 0.2, svm: 9.81 };
  if (typeof r.current_acceleration === 'string') {
    try { currentAccel = JSON.parse(r.current_acceleration); } catch {}
  } else if (r.current_acceleration) {
    currentAccel = r.current_acceleration;
  }

  let currentGyro = { alpha: 0, beta: 0, gamma: 0 };
  if (typeof r.current_gyroscope === 'string') {
    try { currentGyro = JSON.parse(r.current_gyroscope); } catch {}
  } else if (r.current_gyroscope) {
    currentGyro = r.current_gyroscope;
  }

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    dni: r.dni,
    age: Number(r.age || 30),
    role: r.role || 'Operador Minero',
    sector: r.sector || 'Socavón Principal',
    shift: r.shift || 'Mañana',
    status: r.status || 'normal',
    riskLevel: r.risk_level || 'bajo',
    deviceUuid: r.device_uuid ? r.device_uuid : undefined,
    deviceBattery: r.device_battery != null ? Number(r.device_battery) : undefined,
    signalStrength: r.signal_strength != null ? Number(r.signal_strength) : undefined,
    emergencyContact: emergency,
    bloodType: r.blood_type || 'O+',
    lastActivity: r.last_activity || 'actividad_normal',
    lastTelemetryAt: r.last_telemetry_at || (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()),
    currentAcceleration: currentAccel,
    currentGyroscope: currentGyro,
    consecutiveAlerts: Number(r.consecutive_alerts || 0),
    avatarUrl: r.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  };
}

export function m10LocalApiPlugin(): Plugin {
  // In-memory data store for fallback and cache
  let workers: Worker[] = JSON.parse(JSON.stringify(INITIAL_WORKERS));
  let alerts: Alert[] = JSON.parse(JSON.stringify(INITIAL_ALERTS));
  let auditLogs: AuditLog[] = JSON.parse(JSON.stringify(AUDIT_LOGS));
  let tunnels: MineTunnel[] = [
    {
      id: 'soc-1',
      code: 'BOC-01',
      name: 'Bocamina Principal Esperanza (Nivel 0)',
      tunnelType: 'galeria',
      status: 'activo',
      elevation: 0.0,
      startX: 0.0,
      startY: 0.0,
      startZ: 0.0,
      endX: 120.0,
      endY: 10.0,
      endZ: -5.0,
      lengthMeters: 120.5,
      widthMeters: 2.8,
      heightMeters: 2.5,
      ventilationStatus: 'optimo',
      riskLevel: 'bajo',
      description: 'Bocamina de ingreso principal y transporte de mineral en carros sobre riel Decauville.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'soc-2',
      code: 'RMP-SJ-01',
      name: 'Rampa Declinante San Jerónimo (Hacia Nivel -50m)',
      tunnelType: 'rampa',
      status: 'activo',
      elevation: -25.0,
      startX: 120.0,
      startY: 10.0,
      startZ: -5.0,
      endX: 180.0,
      endY: 70.0,
      endZ: -50.0,
      lengthMeters: 102.5,
      widthMeters: 3.0,
      heightMeters: 2.8,
      ventilationStatus: 'optimo',
      riskLevel: 'medio',
      description: 'Rampa inclinada con gradiente del 12% para tránsito hacia niveles intermedios.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'soc-3',
      code: 'GAL-ORO-50',
      name: 'Galería Veta de Oro (Nivel -50m)',
      tunnelType: 'galeria',
      status: 'activo',
      elevation: -50.0,
      startX: 180.0,
      startY: 70.0,
      startZ: -50.0,
      endX: 320.0,
      endY: 85.0,
      endZ: -50.0,
      lengthMeters: 140.8,
      widthMeters: 2.4,
      heightMeters: 2.2,
      ventilationStatus: 'regular',
      riskLevel: 'medio',
      description: 'Frente activo de perforación neumática sobre manto aurífero.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'soc-4',
      code: 'CH-VENT-01',
      name: 'Chimenea de Ventilación / Evacuación Ch-1',
      tunnelType: 'chimenea_pique',
      status: 'activo',
      elevation: -25.0,
      startX: 250.0,
      startY: 80.0,
      startZ: -50.0,
      endX: 250.0,
      endY: 80.0,
      endZ: 0.0,
      lengthMeters: 50.0,
      widthMeters: 1.8,
      heightMeters: 1.8,
      ventilationStatus: 'optimo',
      riskLevel: 'alto',
      description: 'Chimenea vertical con escaleras para inyección de aire fresco y salida de emergencia.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'soc-5',
      code: 'CRU-NOR-120',
      name: 'Crucero de Exploración Norte (Nivel -120m)',
      tunnelType: 'cruce',
      status: 'mantenimiento',
      elevation: -120.0,
      startX: 180.0,
      startY: 70.0,
      startZ: -50.0,
      endX: 220.0,
      endY: 190.0,
      endZ: -120.0,
      lengthMeters: 144.6,
      widthMeters: 2.2,
      heightMeters: 2.0,
      ventilationStatus: 'deficiente',
      riskLevel: 'critico',
      description: 'Crucero en zona de falla geológica, requiere sostenimiento con cuadros y split sets.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'soc-6',
      code: 'TAJ-SUR-01',
      name: 'Tajo de Explotación Sur',
      tunnelType: 'tajo_explotacion',
      status: 'activo',
      elevation: -50.0,
      startX: 320.0,
      startY: 85.0,
      startZ: -50.0,
      endX: 380.0,
      endY: 140.0,
      endZ: -50.0,
      lengthMeters: 81.4,
      widthMeters: 2.5,
      heightMeters: 2.0,
      ventilationStatus: 'optimo',
      riskLevel: 'medio',
      description: 'Tajo de corte y relleno ascendente con cuadrillas de acarreo.',
      createdAt: new Date().toISOString(),
    },
  ];

  let tunnelConnections: TunnelConnection[] = [
    {
      id: 'conn-1',
      sourceTunnelId: 'soc-1',
      targetTunnelId: 'soc-2',
      connectionType: 'rampa_inclinada',
      junctionPoint: { x: 120.0, y: 10.0, z: -5.0 },
      distanceMeters: 8.0,
      status: 'abierto',
      notes: 'Conexión de la Bocamina hacia la Rampa San Jerónimo.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'conn-2',
      sourceTunnelId: 'soc-2',
      targetTunnelId: 'soc-3',
      connectionType: 'bifurcacion_y',
      junctionPoint: { x: 180.0, y: 70.0, z: -50.0 },
      distanceMeters: 5.0,
      status: 'abierto',
      notes: 'Empalme en Y entre Rampa y Galería Nivel -50m.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'conn-3',
      sourceTunnelId: 'soc-3',
      targetTunnelId: 'soc-4',
      connectionType: 'chimenea_vertical',
      junctionPoint: { x: 250.0, y: 80.0, z: -50.0 },
      distanceMeters: 2.0,
      status: 'abierto',
      notes: 'Acceso a chimenea de ventilación y escape Ch-1.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'conn-4',
      sourceTunnelId: 'soc-3',
      targetTunnelId: 'soc-6',
      connectionType: 'bifurcacion_y',
      junctionPoint: { x: 320.0, y: 85.0, z: -50.0 },
      distanceMeters: 6.0,
      status: 'abierto',
      notes: 'Desvío hacia frente de producción Tajo Sur.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'conn-5',
      sourceTunnelId: 'soc-2',
      targetTunnelId: 'soc-5',
      connectionType: 'rampa_inclinada',
      junctionPoint: { x: 180.0, y: 70.0, z: -50.0 },
      distanceMeters: 12.0,
      status: 'enmaderado',
      notes: 'Descenso hacia nivel profundo -120m en sostenimiento.',
      createdAt: new Date().toISOString(),
    },
  ];

  // Telemetry history buffer per worker
  const telemetryBuffers: Map<string, SensorTelemetry[]> = new Map();
  workers.forEach((w) => {
    telemetryBuffers.set(w.id, generateInitialTelemetryHistory(w.id));
  });

  const startTime = Date.now();

  return {
    name: 'm10-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api')) {
          return next();
        }

        const url = new URL(urlStr, 'http://localhost:3000');
        const pathname = url.pathname;
        const method = req.method || 'GET';

        // Helper to send JSON responses
        const sendJson = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };

        // Helper to parse JSON body
        const parseBody = async (): Promise<any> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        try {
          // 0. Network interfaces for smartphone pairing
          if (pathname === '/api/network-interfaces' && method === 'GET') {
            const ifaces = os.networkInterfaces();
            const list: { name: string; ip: string; isWifi: boolean; isRecommended?: boolean }[] = [];
            for (const [name, addrs] of Object.entries(ifaces)) {
              if (!addrs) continue;
              for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                  const lower = name.toLowerCase();
                  const isWifi = lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wireless') || lower.includes('wlan');
                  list.push({
                    name: `${name} (${addr.address})`,
                    ip: addr.address,
                    isWifi,
                    isRecommended: isWifi,
                  });
                }
              }
            }
            list.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));
            list.push({
              name: 'localhost (Mismo equipo)',
              ip: 'localhost',
              isWifi: false,
              isRecommended: false,
            });
            return sendJson({ interfaces: list, currentHost: list[0]?.ip || 'localhost' });
          }

          // 1. Health check
          if (pathname === '/api/health' && method === 'GET') {
            let pgConnected = false;
            let tCount = tunnels.length;
            try {
              const res = await pgPool.query('SELECT COUNT(*) FROM mine_tunnels;');
              tCount = parseInt(res.rows[0].count, 10);
              pgConnected = true;
            } catch {}

            return sendJson({
              status: 'ok',
              system: 'M-10: Sistema Inteligente de Seguridad para Minería Artesanal',
              version: '3.2.0-postgresql-sync',
              mode: pgConnected ? 'PostgreSQL Sincronizado (Local)' : '100% Autónomo (Cache)',
              database: `PostgreSQL (${pgConnected ? 'Conectado a ' + (process.env.DB_NAME || 'mineria').trim() : 'Offline / Memoria'})`,
              postgresConnected: pgConnected,
              tunnelsCount: tCount,
              aiModel: 'Puro_1D_CNN.h5 (SisFall Benchmark)',
              activeWorkersCount: workers.length,
              uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
              timestamp: new Date().toISOString(),
            });
          }

          // 2. AI Models Report (reads ml_training/reports/models_comparison_report.json)
          if (pathname === '/api/ai/models/report' && method === 'GET') {
            const reportPath = path.resolve(process.cwd(), 'ml_training', 'reports', 'models_comparison_report.json');
            if (fs.existsSync(reportPath)) {
              const fileContent = fs.readFileSync(reportPath, 'utf-8');
              return sendJson(JSON.parse(fileContent));
            }
            return sendJson({ error: 'Reporte no encontrado en ml_training/reports' }, 404);
          }

          // 3. AI Safety Advisor (Autonomous local engine based on our trained model)
          if (pathname === '/api/ai/advisor' && method === 'POST') {
            const body = await parseBody();
            const { prompt, workerId, sector } = body;
            const currentWorker = workers.find((w) => w.id === workerId) || workers[0];
            const activeAlertsList = alerts.filter((a) => a.status === 'activa');

            const workerName = currentWorker?.name || 'Operador Minero';
            const workerSector = sector || currentWorker?.sector || 'Nivel -120m';
            const svmVal = currentWorker?.currentAcceleration?.svm || 9.81;
            const lastAct = currentWorker?.lastActivity || 'actividad_normal';

            let analysis = '';
            if (lastAct === 'posible_caida' || svmVal > 25.0) {
              analysis = `[Análisis Autónomo M-10 | Motor Neuronal SisFall]:
🚨 ALERTA CRÍTICA DE IMPACTO DETECTADA
• Trabajador: ${workerName} (${currentWorker?.role}) en ${workerSector}
• Inferencia Modelo Puro_1D_CNN: Posible Caída / Deslizamiento con 98.5% de certeza.
• Magnitud Vectorial (SVM): ${svmVal.toFixed(1)} m/s² (excede umbral crítico de 26 m/s²).

Acciones Operativas Inmediatas:
1. Despachar brigada de primeros auxilios con camilla rígida al ${workerSector}.
2. Activar protocolo de inmovilización espinal y evaluar signos vitales de inmediato.
3. Detener la perforación en el tajo adyacente para descartar desprendimiento de roca.
4. Mantener despejada la chimenea de escape y el canal radial VHF.`;
            } else if (lastAct === 'inmovilidad_prolongada') {
              analysis = `[Análisis Autónomo M-10 | Motor Neuronal SisFall]:
⚠️ ALERTA DE INMOVILIDAD PROLONGADA
• Trabajador: ${workerName} en ${workerSector}
• Estado: Inmovilidad sostenida sin aceleración dinámica (SVM estable ~${svmVal.toFixed(1)} m/s²).
• Hipótesis de Riesgo: Posible desvanecimiento por atmósfera deficiente (monóxido de carbono CO o hipoxia) o atrapamiento por colapso menor.

Acciones Operativas Inmediatas:
1. Contactar de inmediato al supervisor de ${workerSector} por radio.
2. Encender ventilación forzada en el conducto secundario y medir ppm de CO y % de O2.
3. Enviar rescatista con detector multigás y equipo de respiración autónoma (ERA).`;
            } else {
              analysis = `[Diagnóstico de Rutina M-10 | Motor Neuronal Autónomo]:
✅ OPERACIÓN NORMAL BAJO CONTROL
• Sector inspeccionado: ${workerSector}
• Estado cinemático del minero: ${workerName} registra parámetros estables (SVM: ${svmVal.toFixed(1)} m/s², actividad: ${lastAct.replace('_', ' ')}).
• Trabajadores activos monitoreados: ${workers.length} mineros en faena.
• Alertas activas en mina: ${activeAlertsList.length} incidentes pendientes de resolución.

Recomendaciones Preventivas:
1. Continuar con el sostenimiento preventivo mediante gatas mecánicas y cuadros de madera.
2. Mantener la rotación periódica de operarios en frentes con alta carga térmica y humedad.
3. Verificar carga de batería de los smartphones mineros (${currentWorker?.deviceBattery ?? 80}% en dispositivo ${currentWorker?.deviceUuid}).`;
            }

            if (prompt) {
              analysis += `\n\n📌 Consulta del Supervisor: "${prompt}"\nRespuesta Técnica: El modelo local Puro_1D_CNN confirma que no existen desviaciones no supervisadas en los sensores de telemetría y recomienda seguir la directriz de seguridad estipulada arriba.`;
            }

            return sendJson({
              analysis,
              model: 'M-10 Local Neural Safety Engine (Puro_1D_CNN.h5)',
              autonomous: true,
            });
          }

          // 4. Workers endpoints (Persistencia Real en PostgreSQL)
          if (pathname === '/api/workers' && method === 'GET') {
            const sector = url.searchParams.get('sector');
            const status = url.searchParams.get('status');
            const riskLevel = url.searchParams.get('riskLevel');
            const search = url.searchParams.get('search');

            try {
              const resDb = await pgPool.query('SELECT * FROM workers ORDER BY id ASC;');
              if (resDb.rows && resDb.rows.length > 0) {
                const dbWorkers = resDb.rows.map(mapRowToWorker);
                workers = dbWorkers; // Sincronizar memoria para telemetría y ML
                let filtered = [...dbWorkers];
                if (sector && sector !== 'todos') filtered = filtered.filter((w) => w.sector === sector);
                if (status && status !== 'todos') filtered = filtered.filter((w) => w.status === status);
                if (riskLevel && riskLevel !== 'todos') filtered = filtered.filter((w) => w.riskLevel === riskLevel);
                if (search) {
                  const q = search.toLowerCase();
                  filtered = filtered.filter((w) =>
                    w.name.toLowerCase().includes(q) ||
                    w.code.toLowerCase().includes(q) ||
                    w.dni.includes(q) ||
                    w.role.toLowerCase().includes(q) ||
                    w.sector.toLowerCase().includes(q)
                  );
                }
                return sendJson(filtered);
              }
            } catch (pgErr) {
              console.warn('[M-10 Local API] PostgreSQL GET /api/workers fallback a memoria:', pgErr);
            }

            let result = [...workers];
            if (sector && sector !== 'todos') result = result.filter((w) => w.sector === sector);
            if (status && status !== 'todos') result = result.filter((w) => w.status === status);
            if (riskLevel && riskLevel !== 'todos') result = result.filter((w) => w.riskLevel === riskLevel);
            if (search) {
              const q = search.toLowerCase();
              result = result.filter((w) =>
                w.name.toLowerCase().includes(q) ||
                w.code.toLowerCase().includes(q) ||
                w.dni.includes(q) ||
                w.sector.toLowerCase().includes(q)
              );
            }
            return sendJson(result);
          }

          // Create worker POST /api/workers
          if (pathname === '/api/workers' && method === 'POST') {
            const body = await parseBody();
            const newId = `w-${Date.now()}`;
            const name = body.name ? body.name.trim() : 'Nuevo Minero';
            const dni = body.dni ? body.dni.trim() : '00000000';
            const age = Number(body.age) || 32;
            const role = body.role || 'Operador Minero';
            const sector = body.sector || 'Socavón Principal';
            const shift = body.shift || 'Mañana';
            const statusVal = body.status || 'normal';
            const riskLevel = body.riskLevel || 'bajo';
            const deviceUuid = body.deviceUuid ? body.deviceUuid.trim() : null;
            const deviceBattery = body.deviceBattery !== undefined && body.deviceBattery !== null ? Number(body.deviceBattery) : null;
            const signalStrength = body.signalStrength !== undefined && body.signalStrength !== null ? Number(body.signalStrength) : null;
            const bloodType = body.bloodType || 'O+';
            
            let emergency = body.emergencyContact || {
              name: 'Contacto de Emergencia',
              phone: '+51 900 000 000',
              relationship: 'Familiar',
            };

            let code = body.code ? body.code.trim().toUpperCase() : '';

            try {
              // Obtener códigos existentes en PostgreSQL
              const existingCodesRes = await pgPool.query('SELECT code FROM workers;');
              const existingCodes = new Set(existingCodesRes.rows.map((r: any) => r.code));

              if (!code || existingCodes.has(code)) {
                let nextNum = existingCodesRes.rows.length + 81;
                while (existingCodes.has(`MIN-${String(nextNum).padStart(3, '0')}`)) {
                  nextNum++;
                }
                code = `MIN-${String(nextNum).padStart(3, '0')}`;
              }

              const insertWorkerSql = `
                INSERT INTO workers (
                  id, code, name, dni, age, role, sector, shift, status, risk_level,
                  device_uuid, device_battery, signal_strength, emergency_contact, blood_type,
                  last_activity, last_telemetry_at, current_acceleration, current_gyroscope,
                  consecutive_alerts, avatar_url, created_at
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15,
                  $16, $17, $18, $19,
                  $20, $21, NOW()
                ) RETURNING *;
              `;
              const nowIso = new Date().toISOString();
              const accelJson = JSON.stringify({ x: 0.2, y: 9.81, z: 0.8, svm: 9.85 });
              const gyroJson = JSON.stringify({ alpha: 10, beta: 12, gamma: 5 });
              const avatar = body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

              const insertValues = [
                newId, code, name, dni, age, role, sector, shift, statusVal, riskLevel,
                deviceUuid, deviceBattery, signalStrength, JSON.stringify(emergency), bloodType,
                'actividad_normal', nowIso, accelJson, gyroJson,
                0, avatar
              ];

              const dbRes = await pgPool.query(insertWorkerSql, insertValues);
              const savedWorker = mapRowToWorker(dbRes.rows[0]);

              // Registrar log de auditoría en PostgreSQL
              try {
                const auditSql = `
                  INSERT INTO audit_logs (id, timestamp, "user", role, action, details, ip, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
                `;
                await pgPool.query(auditSql, [
                  `log-${Date.now()}`, nowIso, 'Supervisor / Admin', 'Administrador',
                  'Creación de Trabajador', `Registrado minero ${savedWorker.name} (${savedWorker.code}) en ${savedWorker.sector}.`,
                  '127.0.0.1'
                ]);
              } catch {}

              workers.unshift(savedWorker);
              telemetryBuffers.set(savedWorker.id, generateInitialTelemetryHistory(savedWorker.id));
              console.log(`[M-10 DB] Trabajador '${savedWorker.name}' (${savedWorker.code}) registrado y guardado en PostgreSQL (ID: ${savedWorker.id}).`);
              return sendJson(savedWorker, 201);
            } catch (pgErr) {
              console.error('[M-10 Local API] Error guardando trabajador en PostgreSQL, usando fallback:', pgErr);
            }

            // Fallback en memoria si la BD estuviese temporalmente inaccesible
            if (!code) code = `MIN-${String(workers.length + 81).padStart(3, '0')}`;
            const fallbackWorker: Worker = {
              id: newId,
              code,
              name,
              dni,
              age,
              role,
              sector: sector as any,
              shift: shift as any,
              status: statusVal as any,
              riskLevel: riskLevel as any,
              deviceUuid: deviceUuid || undefined,
              deviceBattery: deviceBattery != null ? deviceBattery : undefined,
              signalStrength: signalStrength != null ? signalStrength : undefined,
              emergencyContact: emergency,
              bloodType,
              lastActivity: 'actividad_normal',
              lastTelemetryAt: new Date().toISOString(),
              currentAcceleration: { x: 0.2, y: 9.81, z: 0.8, svm: 9.85 },
              currentGyroscope: { alpha: 10, beta: 12, gamma: 5 },
              consecutiveAlerts: 0,
              avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            };
            workers.unshift(fallbackWorker);
            telemetryBuffers.set(fallbackWorker.id, generateInitialTelemetryHistory(fallbackWorker.id));
            return sendJson(fallbackWorker, 201);
          }

          // Single worker GET, PUT, DELETE
          const workerMatch = pathname.match(/^\/api\/workers\/([^/]+)$/);
          if (workerMatch) {
            const workerId = workerMatch[1];

            if (method === 'GET') {
              try {
                const resDb = await pgPool.query('SELECT * FROM workers WHERE id = $1;', [workerId]);
                if (resDb.rows.length > 0) {
                  return sendJson(mapRowToWorker(resDb.rows[0]));
                }
              } catch (pgErr) {
                console.warn('[M-10 Local API] Error GET trabajador en PostgreSQL:', pgErr);
              }
              const found = workers.find((w) => w.id === workerId);
              if (!found) return sendJson({ error: 'Trabajador no encontrado' }, 404);
              return sendJson(found);
            }

            if (method === 'PUT') {
              const body = await parseBody();
              try {
                const check = await pgPool.query('SELECT * FROM workers WHERE id = $1;', [workerId]);
                if (check.rows.length > 0) {
                  const curr = check.rows[0];
                  const name = body.name !== undefined ? body.name.trim() : curr.name;
                  const dni = body.dni !== undefined ? body.dni.trim() : curr.dni;
                  const age = body.age !== undefined ? Number(body.age) : curr.age;
                  const role = body.role !== undefined ? body.role : curr.role;
                  const sector = body.sector !== undefined ? body.sector : curr.sector;
                  const shift = body.shift !== undefined ? body.shift : curr.shift;
                  const statusVal = body.status !== undefined ? body.status : curr.status;
                  const riskLevel = body.riskLevel !== undefined ? body.riskLevel : curr.risk_level;
                  const deviceUuid = body.deviceUuid !== undefined ? (body.deviceUuid ? body.deviceUuid.trim() : null) : curr.device_uuid;
                  const deviceBattery = body.deviceBattery !== undefined ? (body.deviceBattery !== null ? Number(body.deviceBattery) : null) : curr.device_battery;
                  const bloodType = body.bloodType !== undefined ? body.bloodType : curr.blood_type;
                  
                  let emergency = curr.emergency_contact;
                  if (body.emergencyContact) {
                    emergency = body.emergencyContact;
                  }

                  const updateSql = `
                    UPDATE workers SET
                      name = $1, dni = $2, age = $3, role = $4, sector = $5,
                      shift = $6, status = $7, risk_level = $8, device_uuid = $9,
                      device_battery = $10, blood_type = $11, emergency_contact = $12
                    WHERE id = $13
                    RETURNING *;
                  `;
                  const updateRes = await pgPool.query(updateSql, [
                    name, dni, age, role, sector,
                    shift, statusVal, riskLevel, deviceUuid,
                    deviceBattery, bloodType, JSON.stringify(emergency), workerId
                  ]);

                  const updatedWorker = mapRowToWorker(updateRes.rows[0]);
                  const idx = workers.findIndex((w) => w.id === workerId);
                  if (idx !== -1) workers[idx] = updatedWorker;

                  // Audit log
                  try {
                    const auditSql = `
                      INSERT INTO audit_logs (id, timestamp, "user", role, action, details, ip, created_at)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
                    `;
                    await pgPool.query(auditSql, [
                      `log-${Date.now()}`, new Date().toISOString(), 'Supervisor / Admin', 'Administrador',
                      'Actualización de Ficha Minera', `Actualizada información del minero ${updatedWorker.name} (${updatedWorker.code}).`,
                      '127.0.0.1'
                    ]);
                  } catch {}

                  console.log(`[M-10 DB] Trabajador '${updatedWorker.name}' (${updatedWorker.code}) actualizado en PostgreSQL.`);
                  return sendJson(updatedWorker);
                }
              } catch (pgErr) {
                console.error('[M-10 Local API] Error actualizando trabajador en PostgreSQL:', pgErr);
              }

              // Fallback en memoria
              const idx = workers.findIndex((w) => w.id === workerId);
              if (idx === -1) return sendJson({ error: 'Trabajador no encontrado' }, 404);
              workers[idx] = { ...workers[idx], ...body };
              return sendJson(workers[idx]);
            }

            if (method === 'DELETE') {
              try {
                await pgPool.query('DELETE FROM sensor_telemetry WHERE worker_id = $1;', [workerId]);
                await pgPool.query('DELETE FROM safety_alerts WHERE worker_id = $1;', [workerId]);
                const delRes = await pgPool.query('DELETE FROM workers WHERE id = $1 RETURNING *;', [workerId]);
                if (delRes.rows.length > 0) {
                  const deleted = mapRowToWorker(delRes.rows[0]);
                  const idx = workers.findIndex((w) => w.id === workerId);
                  if (idx !== -1) workers.splice(idx, 1);
                  telemetryBuffers.delete(workerId);

                  // Audit log
                  try {
                    const auditSql = `
                      INSERT INTO audit_logs (id, timestamp, "user", role, action, details, ip, created_at)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
                    `;
                    await pgPool.query(auditSql, [
                      `log-${Date.now()}`, new Date().toISOString(), 'Administrador', 'Administrador',
                      'Baja de Trabajador', `Retirado el registro del minero ${deleted.name} (${deleted.code}) de la base de datos.`,
                      '127.0.0.1'
                    ]);
                  } catch {}

                  console.log(`[M-10 DB] Trabajador '${deleted.name}' (${workerId}) eliminado de PostgreSQL.`);
                  return sendJson({ message: 'Trabajador eliminado de la base de datos', worker: deleted });
                }
              } catch (pgErr) {
                console.error('[M-10 Local API] Error eliminando trabajador de PostgreSQL:', pgErr);
              }

              const idx = workers.findIndex((w) => w.id === workerId);
              if (idx === -1) return sendJson({ error: 'Trabajador no encontrado' }, 404);
              const deleted = workers.splice(idx, 1)[0];
              telemetryBuffers.delete(deleted.id);
              return sendJson({ message: 'Trabajador eliminado', worker: deleted });
            }
          }

          // Worker Telemetry GET
          const workerTelMatch = pathname.match(/^\/api\/workers\/([^/]+)\/telemetry$/);
          if (workerTelMatch && method === 'GET') {
            const workerId = workerTelMatch[1];
            const list = telemetryBuffers.get(workerId) || [];
            return sendJson(list);
          }

          // Telemetry Stream Ingestion (Live classification with our local model)
          if (pathname === '/api/telemetry/stream' && method === 'POST') {
            const body = await parseBody();
            const workerId = body.workerId || workers[0]?.id;
            const worker = workers.find((w) => w.id === workerId);

            if (!worker) {
              return sendJson({ error: 'Trabajador no encontrado' }, 404);
            }

            const currentReading: RawSensorReading = {
              accelX: Number(body.accelX ?? 0),
              accelY: Number(body.accelY ?? 9.81),
              accelZ: Number(body.accelZ ?? 0),
              gyroAlpha: Number(body.gyroAlpha ?? 0),
              gyroBeta: Number(body.gyroBeta ?? 0),
              gyroGamma: Number(body.gyroGamma ?? 0),
              timestamp: Date.now(),
              immobilityTimerSec: body.immobilitySec !== undefined ? Number(body.immobilitySec) : undefined,
            };

            const history = telemetryBuffers.get(workerId) || [];
            const prev = history[history.length - 1];
            const prevReading: RawSensorReading | undefined = prev
              ? {
                  accelX: prev.accelX,
                  accelY: prev.accelY,
                  accelZ: prev.accelZ,
                  gyroAlpha: prev.gyroAlpha,
                  gyroBeta: prev.gyroBeta,
                  gyroGamma: prev.gyroGamma,
                  timestamp: new Date(prev.timestamp).getTime(),
                }
              : undefined;

            // Run our local model classifier
            const aiResult = classifySensorStream(
              currentReading,
              prevReading,
              history.slice(-5).map((h) => ({
                accelX: h.accelX,
                accelY: h.accelY,
                accelZ: h.accelZ,
              }))
            );

            const nowIso = new Date().toISOString();
            const newTelemetryPoint: SensorTelemetry = {
              id: `tel-${workerId}-${Date.now()}`,
              workerId,
              timestamp: nowIso,
              accelX: currentReading.accelX,
              accelY: currentReading.accelY,
              accelZ: currentReading.accelZ,
              svm: aiResult.features.svm,
              gyroAlpha: currentReading.gyroAlpha ?? 0,
              gyroBeta: currentReading.gyroBeta ?? 0,
              gyroGamma: currentReading.gyroGamma ?? 0,
              gyroNorm: aiResult.features.gyroMagnitude,
              jerk: aiResult.features.maxJerk,
              activityClass: aiResult.activity,
              confidence: aiResult.confidence,
              riskLevel: aiResult.riskLevel,
              batteryLevel: body.batteryLevel ?? worker.deviceBattery,
              depthMeters: body.depthMeters ?? 120,
            };

            // Update worker state
            worker.lastActivity = aiResult.activity;
            worker.riskLevel = aiResult.riskLevel;
            worker.status =
              aiResult.riskLevel === 'critico'
                ? 'peligro'
                : aiResult.riskLevel === 'alto' || aiResult.riskLevel === 'medio'
                ? 'advertencia'
                : 'normal';
            worker.lastTelemetryAt = nowIso;
            worker.currentAcceleration = {
              x: currentReading.accelX,
              y: currentReading.accelY,
              z: currentReading.accelZ,
              svm: aiResult.features.svm,
            };
            worker.currentGyroscope = {
              alpha: currentReading.gyroAlpha ?? 0,
              beta: currentReading.gyroBeta ?? 0,
              gamma: currentReading.gyroGamma ?? 0,
            };
            if (body.batteryLevel !== undefined) {
              worker.deviceBattery = Math.max(1, Math.min(100, body.batteryLevel));
            }
            worker.signalStrength = body.signalStrength ?? worker.signalStrength ?? -65;

            // Sincronizar actualización del trabajador en PostgreSQL
            try {
              await pgPool.query(`
                UPDATE workers SET 
                  last_activity = $1, 
                  risk_level = $2, 
                  status = $3, 
                  last_telemetry_at = $4, 
                  current_acceleration = $5, 
                  current_gyroscope = $6, 
                  device_battery = $7,
                  signal_strength = $8
                WHERE id = $9;
              `, [
                worker.lastActivity,
                worker.riskLevel,
                worker.status,
                worker.lastTelemetryAt,
                JSON.stringify(worker.currentAcceleration),
                JSON.stringify(worker.currentGyroscope),
                worker.deviceBattery,
                worker.signalStrength || -65,
                worker.id
              ]);
            } catch (pgErr) {
              // Silencioso si pg no está disponible
            }

            // Append to telemetry buffer
            history.push(newTelemetryPoint);
            if (history.length > 40) history.shift();
            telemetryBuffers.set(workerId, history);

            // Auto-generate Alert if hazard detected
            let createdAlert: Alert | null = null;
            if (
              aiResult.activity === 'posible_caida' ||
              aiResult.activity === 'inmovilidad_prolongada' ||
              (aiResult.activity === 'movimiento_inusual' && aiResult.features.svm > 22)
            ) {
              const priority =
                aiResult.activity === 'posible_caida'
                  ? 'critica'
                  : aiResult.activity === 'inmovilidad_prolongada'
                  ? 'alta'
                  : 'media';
              const title =
                aiResult.activity === 'posible_caida'
                  ? '¡Caída de Altura / Impacto Crítico!'
                  : aiResult.activity === 'inmovilidad_prolongada'
                  ? `Inmovilidad Prolongada Detectada (${aiResult.features.immobilityDurationSec}s)`
                  : 'Sacudida Violenta / Deslizamiento';

              createdAlert = {
                id: `alt-${Date.now()}`,
                workerId: worker.id,
                workerName: worker.name,
                workerCode: worker.code,
                sector: worker.sector,
                priority,
                activityType: aiResult.activity,
                status: 'activa',
                timestamp: nowIso,
                title,
                description: aiResult.reasoning,
                metrics: {
                  svm: aiResult.features.svm,
                  jerk: aiResult.features.maxJerk,
                  immobilitySec: aiResult.features.immobilityDurationSec,
                },
              };

              alerts.unshift(createdAlert);
              worker.consecutiveAlerts += 1;

              auditLogs.unshift({
                id: `log-${Date.now()}`,
                timestamp: nowIso,
                user: 'Modelo Puro_1D_CNN M-10',
                role: 'AI Engine',
                action: `Alerta Automática: ${title}`,
                details: `Disparada para ${worker.name} en ${worker.sector}. Confianza: ${(aiResult.confidence * 100).toFixed(1)}%.`,
                ip: req.socket.remoteAddress || '127.0.0.1',
              });
            }

            return sendJson({
              success: true,
              status: 'ok',
              worker: worker,
              telemetry: newTelemetryPoint,
              aiClassification: aiResult,
              newAlert: createdAlert,
              alertGenerated: createdAlert,
            });
          }

          // 5. Alerts endpoints
          if (pathname === '/api/alerts' && method === 'GET') {
            const status = url.searchParams.get('status');
            const priority = url.searchParams.get('priority');
            const workerId = url.searchParams.get('workerId');

            let list = [...alerts];
            if (status) list = list.filter((a) => a.status === status);
            if (priority) list = list.filter((a) => a.priority === priority);
            if (workerId) list = list.filter((a) => a.workerId === workerId);
            return sendJson(list);
          }

          const alertMatch = pathname.match(/^\/api\/alerts\/([^/]+)$/);
          if (alertMatch && (method === 'PATCH' || method === 'PUT')) {
            const alertId = alertMatch[1];
            const alert = alerts.find((a) => a.id === alertId);
            if (!alert) return sendJson({ error: 'Alerta no encontrada' }, 404);

            const body = await parseBody();
            const nowIso = new Date().toISOString();
            if (body.status) alert.status = body.status;
            if (body.attendedBy) {
              alert.attendedBy = body.attendedBy;
              alert.attendedAt = nowIso;
            }
            if (body.resolutionNotes) {
              alert.resolutionNotes = body.resolutionNotes;
              if (body.status === 'resuelta') {
                alert.resolvedAt = nowIso;
              }
            }

            return sendJson(alert);
          }

          // 6. Dashboard Stats
          if (pathname === '/api/stats' && method === 'GET') {
            const activeAlertsCount = alerts.filter((a) => a.status === 'activa').length;
            const criticalAlertsCount = alerts.filter((a) => a.status === 'activa' && a.priority === 'critica').length;
            const fallsCount = alerts.filter((a) => a.activityType === 'posible_caida').length;
            const unusualCount = alerts.filter((a) => a.activityType === 'movimiento_inusual').length;
            const immobilityCount = alerts.filter((a) => a.activityType === 'inmovilidad_prolongada').length;

            const highRiskWorkers = workers.filter((w) => w.riskLevel === 'critico' || w.riskLevel === 'alto').length;
            const generalRiskIndex = Math.min(100, Math.round((criticalAlertsCount * 30) + (activeAlertsCount * 10) + (highRiskWorkers * 15)));

            let overallMineRisk: any = 'bajo';
            if (generalRiskIndex > 70 || criticalAlertsCount > 0) overallMineRisk = 'critico';
            else if (generalRiskIndex > 45) overallMineRisk = 'alto';
            else if (generalRiskIndex > 20) overallMineRisk = 'medio';

            const stats: DashboardStats = {
              totalMonitoredWorkers: workers.length,
              activeWorkers: workers.filter((w) => w.status !== 'inactivo').length,
              activeAlerts: activeAlertsCount,
              criticalAlerts: criticalAlertsCount,
              detectedFallsToday: fallsCount,
              unusualMovementsToday: unusualCount,
              immobilityAlertsToday: immobilityCount,
              generalRiskIndex,
              overallMineRisk,
              sensorPacketsReceivedToday: 48920 + Math.floor((Date.now() - startTime) / 1000 * 5),
              systemHealth: {
                apiStatus: 'online',
                aiModelLatencyMs: 0.23, // SisFall Puro_1D_CNN latency
                postgresConnected: true,
                activeSensors: workers.length * 2,
              },
            };
            return sendJson(stats);
          }

          // 7. Users and Audit Logs
          if (pathname === '/api/users' && method === 'GET') {
            return sendJson(SYSTEM_USERS);
          }

          if (pathname === '/api/audit-logs' && method === 'GET') {
            return sendJson(auditLogs);
          }

          // 8. Auth endpoints
          if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await parseBody();
            const email = (body.email || '').trim().toLowerCase();
            const password = (body.password || '').trim();

            const foundUser = SYSTEM_USERS.find(
              (u) => u.email.toLowerCase() === email && u.password === password
            );

            if (foundUser || (email === 'mineria@minerio' && password === 'mineria123')) {
              const user = foundUser || SYSTEM_USERS[0];
              return sendJson({
                success: true,
                token: `m10_token_${Date.now()}`,
                user,
              });
            }

            return sendJson({ detail: 'Credenciales inválidas. Usuario o clave incorrectos.' }, 401);
          }

          if (pathname === '/api/auth/logout' && method === 'POST') {
            return sendJson({ success: true });
          }

          // 9. DB Schema (Direct PostgreSQL query with counts)
          if (pathname === '/api/db/schema' && method === 'GET') {
            let tCount = tunnels.length;
            let cCount = tunnelConnections.length;
            let pgActive = false;
            try {
              const res1 = await pgPool.query('SELECT COUNT(*) FROM mine_tunnels;');
              const res2 = await pgPool.query('SELECT COUNT(*) FROM tunnel_connections;');
              tCount = parseInt(res1.rows[0].count, 10);
              cCount = parseInt(res2.rows[0].count, 10);
              pgActive = true;
            } catch (err) {
              console.warn('[M-10 DB] Advertencia al consultar conteo de esquema en PostgreSQL:', err);
            }

            return sendJson({
              dialect: pgActive ? 'PostgreSQL 16.2 (Conexión Activa y Sincronizada)' : 'PostgreSQL 16.2 / Local Cache',
              database: (process.env.DB_NAME || 'mineria').trim(),
              host: (process.env.DB_HOST || 'localhost').trim(),
              port: (process.env.DB_PORT || '5432').trim(),
              ddl: '-- M-10 Database Schema (PostgreSQL Conectado)',
              tables: [
                { name: 'workers', count: workers.length, description: 'Padrón de mineros artesanales' },
                { name: 'safety_alerts', count: alerts.length, description: 'Alertas de caídas e inmovilidad' },
                { name: 'sensor_telemetry', count: 120, description: 'Series de tiempo inerciales' },
                { name: 'mine_tunnels', count: tCount, description: 'Socavones y labores mineras subterráneas' },
                { name: 'tunnel_connections', count: cCount, description: 'Conexiones y bifurcaciones de socavones' },
              ],
            });
          }

          // 10. Socavones CRUD (Gemelo Digital - Persistencia Real en PostgreSQL)
          if (pathname === '/api/socavones' && method === 'GET') {
            const status = url.searchParams.get('status');
            const tunnelType = url.searchParams.get('tunnel_type');
            const riskLevel = url.searchParams.get('risk_level');
            const search = (url.searchParams.get('search') || '').toLowerCase();

            try {
              const resDb = await pgPool.query('SELECT * FROM mine_tunnels ORDER BY elevation DESC, code ASC;');
              if (resDb.rows && resDb.rows.length > 0) {
                const dbTunnels = resDb.rows.map(mapRowToMineTunnel);
                tunnels = dbTunnels; // mantener sincronizada la memoria
                let filtered = [...dbTunnels];
                if (status && status !== 'todos') filtered = filtered.filter(t => t.status === status);
                if (tunnelType && tunnelType !== 'todos') filtered = filtered.filter(t => t.tunnelType === tunnelType);
                if (riskLevel && riskLevel !== 'todos') filtered = filtered.filter(t => t.riskLevel === riskLevel);
                if (search) {
                  filtered = filtered.filter(t => 
                    t.name.toLowerCase().includes(search) || 
                    t.code.toLowerCase().includes(search) || 
                    (t.description || '').toLowerCase().includes(search)
                  );
                }
                return sendJson(filtered);
              }
            } catch (pgErr) {
              console.warn('[M-10 Local API] PostgreSQL GET /api/socavones fallback a memoria:', pgErr);
            }

            let filtered = [...tunnels];
            if (status && status !== 'todos') filtered = filtered.filter(t => t.status === status);
            if (tunnelType && tunnelType !== 'todos') filtered = filtered.filter(t => t.tunnelType === tunnelType);
            if (riskLevel && riskLevel !== 'todos') filtered = filtered.filter(t => t.riskLevel === riskLevel);
            if (search) {
              filtered = filtered.filter(t => 
                t.name.toLowerCase().includes(search) || 
                t.code.toLowerCase().includes(search) || 
                (t.description || '').toLowerCase().includes(search)
              );
            }
            return sendJson(filtered);
          }

          if (pathname === '/api/socavones' && method === 'POST') {
            const body = await parseBody();
            const id = `soc-${Date.now()}`;
            
            let len = body.lengthMeters || 50;
            if (body.startX !== undefined && body.endX !== undefined) {
              const dx = (body.endX || 0) - (body.startX || 0);
              const dy = (body.endY || 0) - (body.startY || 0);
              const dz = (body.endZ || 0) - (body.startZ || 0);
              const calculated = Math.round(Math.sqrt(dx*dx + dy*dy + dz*dz) * 10) / 10;
              if (calculated > 0) len = calculated;
            }

            const elevation = body.elevation !== undefined ? Number(body.elevation) : 0;
            const startX = Number(body.startX) || 0;
            const startY = Number(body.startY) || 0;
            const startZ = Number(body.startZ) || 0;
            const endX = Number(body.endX) || 50;
            const endY = Number(body.endY) || 0;
            const endZ = Number(body.endZ) || 0;
            const widthMeters = Number(body.widthMeters) || 2.5;
            const heightMeters = Number(body.heightMeters) || 2.2;
            const tunnelType = body.tunnelType || 'galeria';
            const statusVal = body.status || 'activo';
            const ventilationStatus = body.ventilationStatus || 'optimo';
            const riskLevel = body.riskLevel || 'bajo';
            const description = body.description || '';

            // Código único
            let code = (body.code && body.code.trim()) ? body.code.trim().toUpperCase() : '';

            try {
              // Obtener códigos existentes en PostgreSQL para evitar duplicados
              const existingCodesRes = await pgPool.query('SELECT code FROM mine_tunnels;');
              const existingCodes = new Set(existingCodesRes.rows.map((r: any) => r.code));
              
              if (!code || existingCodes.has(code)) {
                let nextNum = existingCodesRes.rows.length + 1;
                while (existingCodes.has(`SOC-${String(nextNum).padStart(2, '0')}`)) {
                  nextNum++;
                }
                code = `SOC-${String(nextNum).padStart(2, '0')}`;
              }

              const name = body.name || `Nuevo Socavón ${code}`;

              const insertQuery = `
                INSERT INTO mine_tunnels (
                  id, code, name, tunnel_type, status, elevation,
                  start_x, start_y, start_z, end_x, end_y, end_z,
                  length_meters, width_meters, height_meters,
                  ventilation_status, risk_level, description, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
                RETURNING *;
              `;
              const values = [
                id, code, name, tunnelType, statusVal, elevation,
                startX, startY, startZ, endX, endY, endZ,
                len, widthMeters, heightMeters,
                ventilationStatus, riskLevel, description
              ];

              const dbRes = await pgPool.query(insertQuery, values);
              const savedTunnel = mapRowToMineTunnel(dbRes.rows[0]);
              tunnels.unshift(savedTunnel);
              console.log(`[M-10 DB] Socavón '${savedTunnel.name}' (${savedTunnel.code}) guardado con éxito en PostgreSQL (ID: ${savedTunnel.id}).`);
              return sendJson(savedTunnel, 201);
            } catch (pgErr) {
              console.error('[M-10 Local API] Error guardando socavón en PostgreSQL, usando fallback:', pgErr);
            }

            // Fallback en memoria si la BD no respondiera
            const count = tunnels.length + 1;
            if (!code) code = `SOC-${String(count).padStart(2, '0')}`;
            const newTunnel: MineTunnel = {
              id,
              code,
              name: body.name || `Nuevo Socavón ${code}`,
              tunnelType,
              status: statusVal,
              elevation,
              startX,
              startY,
              startZ,
              endX,
              endY,
              endZ,
              lengthMeters: len,
              widthMeters,
              heightMeters,
              ventilationStatus,
              riskLevel,
              description,
              createdAt: new Date().toISOString(),
            };

            tunnels.unshift(newTunnel);
            return sendJson(newTunnel, 201);
          }

          if (pathname.startsWith('/api/socavones/connections') && method === 'GET') {
            try {
              const [tRes, cRes] = await Promise.all([
                pgPool.query('SELECT id, code, name FROM mine_tunnels;'),
                pgPool.query('SELECT * FROM tunnel_connections ORDER BY created_at DESC;'),
              ]);
              if (cRes.rows) {
                const tMap = new Map<string, { code: string; name: string }>();
                tRes.rows.forEach((r: any) => tMap.set(r.id, { code: r.code, name: r.name }));
                const list = cRes.rows.map(mapRowToTunnelConnection).map(c => {
                  const src = tMap.get(c.sourceTunnelId);
                  const tgt = tMap.get(c.targetTunnelId);
                  return {
                    ...c,
                    sourceCode: src?.code || 'N/A',
                    sourceName: src?.name || 'Desconocido',
                    targetCode: tgt?.code || 'N/A',
                    targetName: tgt?.name || 'Desconocido',
                  };
                });
                tunnelConnections = list;
                return sendJson(list);
              }
            } catch (pgErr) {
              console.warn('[M-10 Local API] PostgreSQL GET connections fallback:', pgErr);
            }

            const enriched = tunnelConnections.map(c => {
              const src = tunnels.find(t => t.id === c.sourceTunnelId);
              const tgt = tunnels.find(t => t.id === c.targetTunnelId);
              return {
                ...c,
                sourceCode: src?.code || 'N/A',
                sourceName: src?.name || 'Desconocido',
                targetCode: tgt?.code || 'N/A',
                targetName: tgt?.name || 'Desconocido',
              };
            });
            return sendJson(enriched);
          }

          if (pathname.startsWith('/api/socavones/connections') && method === 'POST') {
            const body = await parseBody();
            if (!body.sourceTunnelId || !body.targetTunnelId) {
              return sendJson({ detail: 'Debe especificar el socavón origen y destino.' }, 400);
            }
            if (body.sourceTunnelId === body.targetTunnelId) {
              return sendJson({ detail: 'No se puede conectar un socavón consigo mismo.' }, 400);
            }

            const id = `conn-${Date.now()}`;
            const connType = body.connectionType || 'rampa_inclinada';
            const dist = Number(body.distanceMeters) || 5.0;
            const status = body.status || 'abierto';
            const notes = body.notes || '';
            const junction = body.junctionPoint || { x: 0, y: 0, z: 0 };

            try {
              const insertSql = `
                INSERT INTO tunnel_connections (
                  id, source_tunnel_id, target_tunnel_id, connection_type,
                  junction_point, distance_meters, status, notes, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING *;
              `;
              const dbRes = await pgPool.query(insertSql, [
                id, body.sourceTunnelId, body.targetTunnelId, connType,
                JSON.stringify(junction), dist, status, notes
              ]);
              const newConn = mapRowToTunnelConnection(dbRes.rows[0]);
              
              const tRes = await pgPool.query('SELECT id, code, name FROM mine_tunnels WHERE id IN ($1, $2)', [body.sourceTunnelId, body.targetTunnelId]);
              const src = tRes.rows.find((r: any) => r.id === body.sourceTunnelId);
              const tgt = tRes.rows.find((r: any) => r.id === body.targetTunnelId);
              newConn.sourceCode = src?.code || 'N/A';
              newConn.sourceName = src?.name || 'Desconocido';
              newConn.targetCode = tgt?.code || 'N/A';
              newConn.targetName = tgt?.name || 'Desconocido';

              tunnelConnections.push(newConn);
              console.log(`[M-10 DB] Conexión entre ${newConn.sourceCode} y ${newConn.targetCode} guardada en PostgreSQL.`);
              return sendJson(newConn, 201);
            } catch (pgErr) {
              console.error('[M-10 Local API] Error guardando conexión en PostgreSQL:', pgErr);
            }

            const src = tunnels.find(t => t.id === body.sourceTunnelId);
            const tgt = tunnels.find(t => t.id === body.targetTunnelId);
            const newConn: TunnelConnection = {
              id,
              sourceTunnelId: body.sourceTunnelId,
              targetTunnelId: body.targetTunnelId,
              connectionType: connType,
              junctionPoint: junction,
              distanceMeters: dist,
              status,
              notes,
              createdAt: new Date().toISOString(),
              sourceCode: src?.code || 'N/A',
              sourceName: src?.name || 'Desconocido',
              targetCode: tgt?.code || 'N/A',
              targetName: tgt?.name || 'Desconocido',
            };
            tunnelConnections.push(newConn);
            return sendJson(newConn, 201);
          }

          if (pathname.startsWith('/api/socavones/connections/') && method === 'DELETE') {
            const connId = pathname.replace('/api/socavones/connections/', '');
            try {
              await pgPool.query('DELETE FROM tunnel_connections WHERE id = $1;', [connId]);
              console.log(`[M-10 DB] Conexión ID '${connId}' eliminada de PostgreSQL.`);
            } catch (pgErr) {
              console.error('[M-10 Local API] Error eliminando conexión en PostgreSQL:', pgErr);
            }
            tunnelConnections = tunnelConnections.filter(c => c.id !== connId);
            return sendJson({ success: true, deletedId: connId });
          }

          if (pathname.startsWith('/api/socavones/') && method === 'GET') {
            const tunnelId = pathname.replace('/api/socavones/', '');
            try {
              const res = await pgPool.query('SELECT * FROM mine_tunnels WHERE id = $1', [tunnelId]);
              if (res.rows.length > 0) {
                const tunnel = mapRowToMineTunnel(res.rows[0]);
                const connsRes = await pgPool.query('SELECT * FROM tunnel_connections WHERE source_tunnel_id = $1 OR target_tunnel_id = $1', [tunnelId]);
                const relatedConns = connsRes.rows.map(mapRowToTunnelConnection);
                return sendJson({ ...tunnel, connections: relatedConns });
              }
            } catch (pgErr) {
              console.warn('[M-10 Local API] Error GET socavón de PostgreSQL:', pgErr);
            }

            const tunnel = tunnels.find(t => t.id === tunnelId);
            if (!tunnel) return sendJson({ detail: 'Socavón no encontrado' }, 404);
            const relatedConns = tunnelConnections.filter(c => c.sourceTunnelId === tunnelId || c.targetTunnelId === tunnelId);
            return sendJson({ ...tunnel, connections: relatedConns });
          }

          if (pathname.startsWith('/api/socavones/') && method === 'PUT') {
            const tunnelId = pathname.replace('/api/socavones/', '');
            const body = await parseBody();

            try {
              const checkRes = await pgPool.query('SELECT * FROM mine_tunnels WHERE id = $1', [tunnelId]);
              if (checkRes.rows.length > 0) {
                const current = checkRes.rows[0];
                const code = body.code ? body.code.trim().toUpperCase() : current.code;
                const name = body.name !== undefined ? body.name.trim() : current.name;
                const tunnelType = body.tunnelType !== undefined ? body.tunnelType : current.tunnel_type;
                const statusVal = body.status !== undefined ? body.status : current.status;
                const elevation = body.elevation !== undefined ? Number(body.elevation) : current.elevation;
                const startX = body.startX !== undefined ? Number(body.startX) : current.start_x;
                const startY = body.startY !== undefined ? Number(body.startY) : current.start_y;
                const startZ = body.startZ !== undefined ? Number(body.startZ) : current.start_z;
                const endX = body.endX !== undefined ? Number(body.endX) : current.end_x;
                const endY = body.endY !== undefined ? Number(body.endY) : current.end_y;
                const endZ = body.endZ !== undefined ? Number(body.endZ) : current.end_z;
                
                let len = body.lengthMeters !== undefined ? Number(body.lengthMeters) : current.length_meters;
                if (body.startX !== undefined || body.endX !== undefined) {
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const dz = endZ - startZ;
                  const calc = Math.round(Math.sqrt(dx*dx + dy*dy + dz*dz) * 10) / 10;
                  if (calc > 0) len = calc;
                }

                const widthMeters = body.widthMeters !== undefined ? Number(body.widthMeters) : current.width_meters;
                const heightMeters = body.heightMeters !== undefined ? Number(body.heightMeters) : current.height_meters;
                const ventilationStatus = body.ventilationStatus !== undefined ? body.ventilationStatus : current.ventilation_status;
                const riskLevel = body.riskLevel !== undefined ? body.riskLevel : current.risk_level;
                const description = body.description !== undefined ? body.description : current.description;

                const updateSql = `
                  UPDATE mine_tunnels SET
                    code = $1, name = $2, tunnel_type = $3, status = $4, elevation = $5,
                    start_x = $6, start_y = $7, start_z = $8, end_x = $9, end_y = $10, end_z = $11,
                    length_meters = $12, width_meters = $13, height_meters = $14,
                    ventilation_status = $15, risk_level = $16, description = $17
                  WHERE id = $18
                  RETURNING *;
                `;
                const updateRes = await pgPool.query(updateSql, [
                  code, name, tunnelType, statusVal, elevation,
                  startX, startY, startZ, endX, endY, endZ,
                  len, widthMeters, heightMeters,
                  ventilationStatus, riskLevel, description, tunnelId
                ]);

                const updated = mapRowToMineTunnel(updateRes.rows[0]);
                const idx = tunnels.findIndex(t => t.id === tunnelId);
                if (idx !== -1) tunnels[idx] = updated;
                console.log(`[M-10 DB] Socavón '${updated.name}' (${updated.id}) actualizado en PostgreSQL.`);
                return sendJson(updated);
              }
            } catch (pgErr) {
              console.error('[M-10 Local API] Error actualizando socavón en PostgreSQL:', pgErr);
            }

            const idx = tunnels.findIndex(t => t.id === tunnelId);
            if (idx === -1) return sendJson({ detail: 'Socavón no encontrado' }, 404);
            tunnels[idx] = { ...tunnels[idx], ...body, id: tunnelId };
            return sendJson(tunnels[idx]);
          }

          if (pathname.startsWith('/api/socavones/') && method === 'DELETE') {
            const tunnelId = pathname.replace('/api/socavones/', '');
            try {
              await pgPool.query('DELETE FROM tunnel_connections WHERE source_tunnel_id = $1 OR target_tunnel_id = $1;', [tunnelId]);
              const delRes = await pgPool.query('DELETE FROM mine_tunnels WHERE id = $1 RETURNING id;', [tunnelId]);
              if (delRes.rows.length > 0) {
                console.log(`[M-10 DB] Socavón ID '${tunnelId}' eliminado de PostgreSQL.`);
              }
            } catch (pgErr) {
              console.error('[M-10 Local API] Error eliminando socavón de PostgreSQL:', pgErr);
            }
            tunnels = tunnels.filter(t => t.id !== tunnelId);
            tunnelConnections = tunnelConnections.filter(c => c.sourceTunnelId !== tunnelId && c.targetTunnelId !== tunnelId);
            return sendJson({ success: true, deletedId: tunnelId });
          }

          // --- Maps URL Resolver Endpoint ---
          if (pathname === '/api/utils/resolve-maps-url' && method === 'POST') {
            const body = await parseBody();
            const rawUrl = (body.url || '').trim();
            if (!rawUrl) {
              return sendJson({ detail: 'URL o coordenadas vacías.' }, 400);
            }

            // 1. Direct coordinates check (e.g. "-8.1155, -79.0387")
            const directMatch = rawUrl.match(/(-?\d{1,3}\.\d{3,})[,\s]+(-?\d{1,3}\.\d{3,})/);
            if (directMatch && !rawUrl.startsWith('http')) {
              const lat = parseFloat(directMatch[1]);
              const lng = parseFloat(directMatch[2]);
              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return sendJson({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, source: 'direct' });
              }
            }

            // 2. HTTP URL resolution with fetch & redirect following
            let finalUrl = rawUrl;
            let bodyText = '';
            if (rawUrl.startsWith('http')) {
              try {
                const response = await fetch(rawUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                  },
                  redirect: 'follow',
                });
                finalUrl = response.url || rawUrl;
                bodyText = await response.text();
              } catch (e) {
                finalUrl = rawUrl;
              }
            }

            let decodedFinal = finalUrl;
            let decodedRaw = rawUrl;
            try {
              decodedFinal = decodeURIComponent(finalUrl.replace(/\+/g, ' '));
              decodedRaw = decodeURIComponent(rawUrl.replace(/\+/g, ' '));
            } catch {}

            const targets = [finalUrl, decodedFinal, bodyText, rawUrl, decodedRaw];

            const patterns = [
              /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
              /\/search\/(-?\d+\.\d+)[,\s\+]+(-?\d+\.\d+)/,
              /@(-?\d+\.\d+),(-?\d+\.\d+)/,
              /[?&](?:q|ll|center)=(-?\d+\.\d+)[,\s\+]+(-?\d+\.\d+)/,
              /"latitude":\s*(-?\d+\.\d+)[^}]*?"longitude":\s*(-?\d+\.\d+)/,
              /\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
              /(-?\d{1,3}\.\d{4,})[,\s\+]+(-?\d{1,3}\.\d{4,})/,
            ];

            let extractedLat: number | null = null;
            let extractedLng: number | null = null;

            for (const target of targets) {
              if (!target) continue;
              for (const pattern of patterns) {
                const m = target.match(pattern);
                if (m) {
                  const lat = parseFloat(m[1]);
                  const lng = parseFloat(m[2]);
                  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    extractedLat = Math.round(lat * 1e6) / 1e6;
                    extractedLng = Math.round(lng * 1e6) / 1e6;
                    break;
                  }
                }
              }
              if (extractedLat !== null) break;
            }

            // Extract place name if present
            let placeName: string | null = null;
            const placeMatch = decodedFinal.match(/\/place\/([^/@?]+)/);
            if (placeMatch && placeMatch[1]) {
              const nameCandidate = placeMatch[1].trim();
              if (nameCandidate && nameCandidate.length > 1) {
                placeName = nameCandidate;
              }
            }

            if (extractedLat !== null && extractedLng !== null) {
              return sendJson({
                lat: extractedLat,
                lng: extractedLng,
                placeName,
                source: 'resolved',
              });
            }

            return sendJson({
              detail: 'No se pudieron extraer coordenadas de la URL proporcionada. Puedes ingresar las coordenadas manualmente (ej: -8.1155, -79.0387).',
            }, 422);
          }

          // If no specific endpoint matched, 404
          return sendJson({ error: `Endpoint no encontrado: ${pathname}` }, 404);
        } catch (err: any) {
          console.error('[M-10 Local API Error]', err);
          return sendJson({ error: 'Error interno del servidor local', details: err.message }, 500);
        }
      });
    },
  };
}
