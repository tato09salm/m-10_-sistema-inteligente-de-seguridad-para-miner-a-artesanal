export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico';
export type WorkerStatus = 'normal' | 'advertencia' | 'peligro' | 'inactivo';
export type ActivityType = 'actividad_normal' | 'movimiento_inusual' | 'posible_caida' | 'inmovilidad_prolongada';
export type AlertPriority = 'critica' | 'alta' | 'media' | 'baja';
export type AlertStatus = 'activa' | 'en_atencion' | 'resuelta';
export type UserRole = 'admin' | 'supervisor' | 'rescatista';
export type MiningSector = 'Socavón Principal' | 'Nivel -50m' | 'Nivel -120m' | 'Galería Norte' | 'Chimenea 3' | 'Frente de Extracción';

export interface Worker {
  id: string;
  code: string;
  name: string;
  dni: string;
  age: number;
  role: string;
  sector: MiningSector;
  shift: 'Mañana' | 'Tarde' | 'Noche';
  status: WorkerStatus;
  riskLevel: RiskLevel;
  deviceUuid: string;
  deviceBattery: number; // 0 - 100
  signalStrength: number; // dBm e.g. -65
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  bloodType: string;
  lastActivity: ActivityType;
  lastTelemetryAt: string;
  currentAcceleration?: { x: number; y: number; z: number; svm: number };
  currentGyroscope?: { alpha: number; beta: number; gamma: number };
  consecutiveAlerts: number;
  avatarUrl?: string;
}

export interface SensorTelemetry {
  id: string;
  workerId: string;
  timestamp: string;
  accelX: number; // m/s^2
  accelY: number;
  accelZ: number;
  svm: number; // Signal Vector Magnitude = sqrt(x^2 + y^2 + z^2)
  gyroAlpha: number; // deg/s
  gyroBeta: number;
  gyroGamma: number;
  gyroNorm: number;
  jerk: number;
  activityClass: ActivityType;
  confidence: number; // 0 - 1
  riskLevel: RiskLevel;
  batteryLevel?: number;
  temperature?: number;
  depthMeters?: number;
}

export interface AIClassificationResult {
  activity: ActivityType;
  confidence: number;
  riskLevel: RiskLevel;
  features: {
    svm: number;
    maxJerk: number;
    gyroMagnitude: number;
    immobilityDurationSec: number;
    tiltAngleDeg: number;
    vibrationEnergy: number;
  };
  reasoning: string;
  detectedAt: string;
  recommendedAction: string;
}

export interface Alert {
  id: string;
  workerId: string;
  workerName: string;
  workerCode: string;
  sector: MiningSector;
  priority: AlertPriority;
  activityType: ActivityType;
  status: AlertStatus;
  timestamp: string;
  title: string;
  description: string;
  metrics: {
    svm: number;
    jerk: number;
    immobilitySec?: number;
  };
  attendedBy?: string;
  attendedAt?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  lastLogin: string;
  sectorAssigned?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  ip: string;
}

export interface DashboardStats {
  totalMonitoredWorkers: number;
  activeWorkers: number;
  activeAlerts: number;
  criticalAlerts: number;
  detectedFallsToday: number;
  unusualMovementsToday: number;
  immobilityAlertsToday: number;
  generalRiskIndex: number; // 0 - 100
  overallMineRisk: RiskLevel;
  sensorPacketsReceivedToday: number;
  systemHealth: {
    apiStatus: 'online' | 'degraded' | 'offline';
    aiModelLatencyMs: number;
    postgresConnected: boolean;
    activeSensors: number;
  };
}
