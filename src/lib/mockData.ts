import { Worker, Alert, SystemUser, AuditLog, DashboardStats, SensorTelemetry } from '../types';

export const INITIAL_WORKERS: Worker[] = [
  {
    id: 'w-1',
    code: 'MIN-081',
    name: 'Santos Quispe Huamán',
    dni: '45892134',
    age: 38,
    role: 'Perforista de Veta Aurífera',
    sector: 'Nivel -120m',
    shift: 'Mañana',
    status: 'peligro',
    riskLevel: 'critico',
    deviceUuid: 'SMP-MINE-A819',
    deviceBattery: 78,
    signalStrength: -88,
    emergencyContact: {
      name: 'Elena Quispe',
      phone: '+51 984 123 456',
      relationship: 'Esposa',
    },
    bloodType: 'O+',
    lastActivity: 'posible_caida',
    lastTelemetryAt: new Date(Date.now() - 1000 * 25).toISOString(),
    currentAcceleration: { x: 19.4, y: 27.8, z: 12.1, svm: 36.0 },
    currentGyroscope: { alpha: 320, beta: 240, gamma: 180 },
    consecutiveAlerts: 2,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'w-2',
    code: 'MIN-082',
    name: 'Wilfredo Mamani Cruz',
    dni: '41238940',
    age: 42,
    role: 'Acarreador de Mineral en Rampa',
    sector: 'Galería Norte',
    shift: 'Mañana',
    status: 'advertencia',
    riskLevel: 'alto',
    deviceUuid: 'SMP-MINE-B442',
    deviceBattery: 45,
    signalStrength: -72,
    emergencyContact: {
      name: 'María Mamani',
      phone: '+51 951 884 901',
      relationship: 'Hermana',
    },
    bloodType: 'A+',
    lastActivity: 'inmovilidad_prolongada',
    lastTelemetryAt: new Date(Date.now() - 1000 * 50).toISOString(),
    currentAcceleration: { x: 0.1, y: 9.8, z: 0.05, svm: 9.81 },
    currentGyroscope: { alpha: 0.4, beta: 0.2, gamma: 0.1 },
    consecutiveAlerts: 1,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'w-3',
    code: 'MIN-083',
    name: 'Carlos Mendoza Pari',
    dni: '72340912',
    age: 29,
    role: 'Enmaderador / Sostenimiento',
    sector: 'Chimenea 3',
    shift: 'Mañana',
    status: 'advertencia',
    riskLevel: 'medio',
    deviceUuid: 'SMP-MINE-C902',
    deviceBattery: 89,
    signalStrength: -65,
    emergencyContact: {
      name: 'Rosa Pari',
      phone: '+51 987 554 112',
      relationship: 'Madre',
    },
    bloodType: 'B+',
    lastActivity: 'movimiento_inusual',
    lastTelemetryAt: new Date(Date.now() - 1000 * 12).toISOString(),
    currentAcceleration: { x: 7.2, y: 16.4, z: 8.9, svm: 19.9 },
    currentGyroscope: { alpha: 180, beta: 140, gamma: 110 },
    consecutiveAlerts: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'w-4',
    code: 'MIN-084',
    name: 'Ignacio Condori Flores',
    dni: '48901234',
    age: 34,
    role: 'Maestro Winchero',
    sector: 'Socavón Principal',
    shift: 'Mañana',
    status: 'normal',
    riskLevel: 'bajo',
    deviceUuid: 'SMP-MINE-D119',
    deviceBattery: 92,
    signalStrength: -58,
    emergencyContact: {
      name: 'Silvia Condori',
      phone: '+51 954 332 109',
      relationship: 'Esposa',
    },
    bloodType: 'O+',
    lastActivity: 'actividad_normal',
    lastTelemetryAt: new Date(Date.now() - 1000 * 5).toISOString(),
    currentAcceleration: { x: 0.8, y: 9.9, z: 1.4, svm: 10.02 },
    currentGyroscope: { alpha: 14, beta: 18, gamma: 9 },
    consecutiveAlerts: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'w-5',
    code: 'MIN-085',
    name: 'Esteban Ramos Ticona',
    dni: '46781290',
    age: 31,
    role: 'Disparador / Tronadura',
    sector: 'Nivel -50m',
    shift: 'Mañana',
    status: 'normal',
    riskLevel: 'bajo',
    deviceUuid: 'SMP-MINE-E550',
    deviceBattery: 67,
    signalStrength: -78,
    emergencyContact: {
      name: 'Lucía Ramos',
      phone: '+51 958 771 223',
      relationship: 'Hermana',
    },
    bloodType: 'O-',
    lastActivity: 'actividad_normal',
    lastTelemetryAt: new Date(Date.now() - 1000 * 8).toISOString(),
    currentAcceleration: { x: 1.1, y: 10.2, z: 2.3, svm: 10.51 },
    currentGyroscope: { alpha: 22, beta: 26, gamma: 14 },
    consecutiveAlerts: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'w-6',
    code: 'MIN-086',
    name: 'Víctor Cárdenas Lima',
    dni: '70912384',
    age: 26,
    role: 'Ayudante de Extracción',
    sector: 'Frente de Extracción',
    shift: 'Mañana',
    status: 'normal',
    riskLevel: 'bajo',
    deviceUuid: 'SMP-MINE-F884',
    deviceBattery: 81,
    signalStrength: -80,
    emergencyContact: {
      name: 'Carmen Lima',
      phone: '+51 984 665 432',
      relationship: 'Madre',
    },
    bloodType: 'A-',
    lastActivity: 'actividad_normal',
    lastTelemetryAt: new Date(Date.now() - 1000 * 15).toISOString(),
    currentAcceleration: { x: 1.5, y: 10.6, z: 2.8, svm: 11.06 },
    currentGyroscope: { alpha: 30, beta: 35, gamma: 19 },
    consecutiveAlerts: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  },
];

export const INITIAL_ALERTS: Alert[] = [
  {
    id: 'alt-101',
    workerId: 'w-1',
    workerName: 'Santos Quispe Huamán',
    workerCode: 'MIN-081',
    sector: 'Nivel -120m',
    priority: 'critica',
    activityType: 'posible_caida',
    status: 'activa',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    title: '¡Impacto y Posible Caída de Altura Detectada!',
    description: 'El sensor registró una caída libre de 0.4s seguida de un impacto de 36.0 m/s² (3.67g) con rotación violenta en el Nivel -120m.',
    metrics: { svm: 36.0, jerk: 68.4 },
  },
  {
    id: 'alt-102',
    workerId: 'w-2',
    workerName: 'Wilfredo Mamani Cruz',
    workerCode: 'MIN-082',
    sector: 'Galería Norte',
    priority: 'alta',
    activityType: 'inmovilidad_prolongada',
    status: 'en_atencion',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    title: 'Inmovilidad Prolongada (>60 segundos)',
    description: 'Ausencia total de microvibraciones en la rampa de acarreo. Sospecha de atrapamiento, caída de roca menor o descompensación.',
    metrics: { svm: 9.81, jerk: 0.1, immobilitySec: 68 },
    attendedBy: 'Ing. Rodrigo Valenzuela (Supervisor)',
    attendedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    resolutionNotes: 'Brigada enviada con camilla y oxígeno. Confirmando contacto radial.',
  },
  {
    id: 'alt-103',
    workerId: 'w-3',
    workerName: 'Carlos Mendoza Pari',
    workerCode: 'MIN-083',
    sector: 'Chimenea 3',
    priority: 'media',
    activityType: 'movimiento_inusual',
    status: 'activa',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    title: 'Patrón de Movimiento Errático / Sacudida',
    description: 'Picos de aceleración angular y vibraciones intensas no periódicas en sostenimiento de madera.',
    metrics: { svm: 19.9, jerk: 34.2 },
  },
  {
    id: 'alt-100',
    workerId: 'w-5',
    workerName: 'Esteban Ramos Ticona',
    workerCode: 'MIN-085',
    sector: 'Nivel -50m',
    priority: 'media',
    activityType: 'movimiento_inusual',
    status: 'resuelta',
    timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    title: 'Vibración por Tronadura Adyacente',
    description: 'Disparador se desplazó a zona segura tras detonación programada.',
    metrics: { svm: 18.5, jerk: 28.0 },
    attendedBy: 'Carlos Mendoza',
    attendedAt: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
    resolutionNotes: 'Zona despejada tras ventilación de gases. Trabajador sin lesiones.',
  },
];

export const SYSTEM_USERS: SystemUser[] = [
  {
    id: 'u-1',
    name: 'Ing. Arturo Mendoza',
    email: 'admin.seguridad@minera-m10.pe',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    lastLogin: 'Hace 10 minutos',
    sectorAssigned: 'Supervisión General Mina',
  },
  {
    id: 'u-2',
    name: 'Supervisor Rodrigo Valenzuela',
    email: 'rodrigo.valenzuela@minera-m10.pe',
    role: 'supervisor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    lastLogin: 'Hace 2 minutos',
    sectorAssigned: 'Nivel -120m y Galería Norte',
  },
  {
    id: 'u-3',
    name: 'Paramédica Karen Saldaña',
    email: 'karen.saldana@minera-m10.pe',
    role: 'rescatista',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    lastLogin: 'En línea',
    sectorAssigned: 'Puesto de Rescate Subterráneo',
  },
];

export const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    user: 'Rodrigo Valenzuela',
    role: 'Supervisor',
    action: 'Atención de Alerta',
    details: 'Asignó brigadista a alerta alt-102 (Wilfredo Mamani en Galería Norte).',
    ip: '192.168.10.45',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    user: 'Sistema IA M-10',
    role: 'AI Engine',
    action: 'Detección Automática de Caída',
    details: 'Generada alerta crítica para trabajador MIN-081 (Santos Quispe). SVM: 36.0 m/s².',
    ip: '127.0.0.1 (FastAPI/ML)',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    user: 'Arturo Mendoza',
    role: 'Administrador',
    action: 'Actualización de Parámetros IA',
    details: 'Ajustado umbral de impacto de caída a 26 m/s² y ventana de inmovilidad a 30s.',
    ip: '192.168.10.12',
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    user: 'Arturo Mendoza',
    role: 'Administrador',
    action: 'Registro de Trabajador',
    details: 'Registrado nuevo trabajador Víctor Cárdenas (MIN-086) con UUID SMP-MINE-F884.',
    ip: '192.168.10.12',
  },
];

export function generateInitialTelemetryHistory(workerId: string): SensorTelemetry[] {
  const points: SensorTelemetry[] = [];
  const now = Date.now();
  const count = 30;

  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * 1000 * 3).toISOString();
    let ax = 0.5 + Math.sin(i * 0.4) * 1.2;
    let ay = 9.81 + Math.cos(i * 0.3) * 1.5;
    let az = 1.0 + Math.sin(i * 0.2) * 0.8;
    let alpha = 15 + Math.sin(i * 0.5) * 10;
    let beta = 20 + Math.cos(i * 0.4) * 12;
    let gamma = 10 + Math.sin(i * 0.3) * 8;
    let act: any = 'actividad_normal';
    let risk: any = 'bajo';

    // Inject realistic events for worker 1 (fall at end) and worker 2 (immobility)
    if (workerId === 'w-1' && i <= 3) {
      ax = 18.5 + (3 - i) * 2;
      ay = 28.2 - (3 - i) * 3;
      az = 14.1;
      alpha = 320;
      beta = 240;
      gamma = 180;
      act = 'posible_caida';
      risk = 'critico';
    } else if (workerId === 'w-2' && i <= 8) {
      ax = 0.02;
      ay = 9.81;
      az = 0.01;
      alpha = 0.1;
      beta = 0.1;
      gamma = 0.1;
      act = 'inmovilidad_prolongada';
      risk = 'alto';
    }

    const svm = Math.sqrt(ax * ax + ay * ay + az * az);
    const gyroNorm = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

    points.push({
      id: `tel-${workerId}-${i}`,
      workerId,
      timestamp: t,
      accelX: parseFloat(ax.toFixed(2)),
      accelY: parseFloat(ay.toFixed(2)),
      accelZ: parseFloat(az.toFixed(2)),
      svm: parseFloat(svm.toFixed(2)),
      gyroAlpha: parseFloat(alpha.toFixed(1)),
      gyroBeta: parseFloat(beta.toFixed(1)),
      gyroGamma: parseFloat(gamma.toFixed(1)),
      gyroNorm: parseFloat(gyroNorm.toFixed(1)),
      jerk: parseFloat((Math.random() * 5 + (act === 'posible_caida' ? 50 : 2)).toFixed(2)),
      activityClass: act,
      confidence: 0.94,
      riskLevel: risk,
      batteryLevel: 80 - Math.floor(i / 10),
      depthMeters: 120,
    });
  }

  return points;
}
