import { ActivityType, AIClassificationResult, RiskLevel } from '../types';

export interface RawSensorReading {
  accelX: number; // m/s^2
  accelY: number;
  accelZ: number;
  gyroAlpha?: number; // deg/s (z-axis or yaw)
  gyroBeta?: number;  // deg/s (x-axis or pitch)
  gyroGamma?: number; // deg/s (y-axis or roll)
  timestamp?: number; // ms
  immobilityTimerSec?: number;
}

/**
 * Calculates Signal Vector Magnitude (SVM) in m/s^2
 * Standard Earth gravity is ~9.81 m/s^2 (approx 1g)
 */
export function calculateSVM(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Calculates Angular Velocity Norm in deg/s
 */
export function calculateGyroNorm(alpha: number = 0, beta: number = 0, gamma: number = 0): number {
  return Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);
}

/**
 * Calculates Tilt Angle from vertical (assuming Z or Y alignment) in degrees
 */
export function calculateTiltAngle(x: number, y: number, z: number): number {
  const norm = calculateSVM(x, y, z);
  if (norm === 0) return 0;
  // Angle relative to gravity vector
  const cosTheta = Math.abs(z) / norm;
  return (Math.acos(Math.min(1, Math.max(-1, cosTheta))) * 180) / Math.PI;
}

/**
 * Core Machine Learning & Heuristic Risk Classifier for Artisanal Mining
 */
export function classifySensorStream(
  current: RawSensorReading,
  previous?: RawSensorReading,
  recentWindow: RawSensorReading[] = []
): AIClassificationResult {
  const x = current.accelX;
  const y = current.accelY;
  const z = current.accelZ;
  const alpha = current.gyroAlpha ?? 0;
  const beta = current.gyroBeta ?? 0;
  const gamma = current.gyroGamma ?? 0;

  const svm = calculateSVM(x, y, z);
  const gyroNorm = calculateGyroNorm(alpha, beta, gamma);
  const tiltAngle = calculateTiltAngle(x, y, z);

  // Compute Jerk (rate of change of acceleration)
  let jerk = 0;
  if (previous) {
    const prevSVM = calculateSVM(previous.accelX, previous.accelY, previous.accelZ);
    const dt = (current.timestamp && previous.timestamp) ? (current.timestamp - previous.timestamp) / 1000 : 0.2;
    jerk = Math.abs(svm - prevSVM) / Math.max(dt, 0.05);
  }

  // Windowed variance for immobility
  let variance = 0.5;
  if (recentWindow.length > 3) {
    const svms = recentWindow.map(r => calculateSVM(r.accelX, r.accelY, r.accelZ));
    const mean = svms.reduce((a, b) => a + b, 0) / svms.length;
    variance = svms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / svms.length;
  }

  const immobilitySec = current.immobilityTimerSec ?? (variance < 0.03 ? 35 : 0);

  // --- CLASSIFICATION LOGIC ---
  let activity: ActivityType = 'actividad_normal';
  let confidence = 0.92;
  let riskLevel: RiskLevel = 'bajo';
  let reasoning = 'Patrón de movimiento cinemático normal compatible con labores de minería subterránea.';
  let recommendedAction = 'Mantener monitoreo continuo de rutina.';

  // 1. FALL DETECTION (High SVM peak > 26 m/s^2 (~2.7g) or high jerk > 45 + high angular rate)
  const isFallImpact = svm > 26 || (svm > 22 && jerk > 40) || (svm > 20 && gyroNorm > 220);
  const hadFreeFall = recentWindow.some(r => calculateSVM(r.accelX, r.accelY, r.accelZ) < 5.0);

  if (isFallImpact || (hadFreeFall && svm > 18)) {
    activity = 'posible_caida';
    confidence = hadFreeFall ? 0.98 : 0.93;
    riskLevel = 'critico';
    reasoning = `Impacto severo detectado (SVM: ${svm.toFixed(1)} m/s², Jerk: ${jerk.toFixed(1)} m/s³). Posible caída de altura o resbalón en socavón.`;
    recommendedAction = '¡ALERTA CRÍTICA! Enviar brigadista de primeros auxilios y verificar signos vitales.';
  }
  // 2. PROLONGED IMMOBILITY (Trapped under rubble, unconsciousness, gassing)
  else if (immobilitySec >= 30 || (variance < 0.02 && svm > 8.5 && svm < 11.0 && (current.immobilityTimerSec ?? 0) >= 20)) {
    activity = 'inmovilidad_prolongada';
    confidence = Math.min(0.99, 0.85 + (immobilitySec / 200));
    riskLevel = immobilitySec > 60 ? 'critico' : 'alto';
    reasoning = `Inmovilidad absoluta sostenida por más de ${Math.round(immobilitySec)} segundos (Varianza: ${variance.toFixed(3)}). Posible desmayo, intoxicación por gases o atrapamiento.`;
    recommendedAction = 'Activar canal de radio de emergencia y despachar supervisor al cuadrante.';
  }
  // 3. UNUSUAL MOVEMENT (Chaotic vibration, blasting tremor, rock displacement, erratic struggle)
  else if (svm > 17 || gyroNorm > 190 || jerk > 30 || (variance > 8.0)) {
    activity = 'movimiento_inusual';
    confidence = 0.89;
    riskLevel = 'medio';
    reasoning = `Aceleración o rotación anómala fuera de umbrales típicos (SVM: ${svm.toFixed(1)} m/s², Giroscopio: ${gyroNorm.toFixed(1)}°/s).`;
    recommendedAction = 'Monitorear evolución y verificar estabilidad del frente de extracción.';
  }
  // 4. NORMAL MINING ACTIVITY
  else {
    activity = 'actividad_normal';
    confidence = 0.94;
    riskLevel = 'bajo';
    reasoning = `Cinemática estable (SVM: ${svm.toFixed(1)} m/s², Giroscopio: ${gyroNorm.toFixed(1)}°/s). Actividad minera estándar.`;
    recommendedAction = 'Operación normal.';
  }

  return {
    activity,
    confidence,
    riskLevel,
    features: {
      svm: parseFloat(svm.toFixed(2)),
      maxJerk: parseFloat(jerk.toFixed(2)),
      gyroMagnitude: parseFloat(gyroNorm.toFixed(2)),
      immobilityDurationSec: Math.round(immobilitySec),
      tiltAngleDeg: parseFloat(tiltAngle.toFixed(1)),
      vibrationEnergy: parseFloat(variance.toFixed(3)),
    },
    reasoning,
    detectedAt: new Date().toISOString(),
    recommendedAction,
  };
}

export const PRESET_ACTIVITIES = [
  {
    id: 'drilling',
    name: 'Picado & Perforación de Veta',
    category: 'Normal',
    description: 'Vibraciones rítmicas de barreno manual con aceleración moderada.',
    readings: { accelX: 1.2, accelY: 10.4, accelZ: 3.1, gyroAlpha: 25, gyroBeta: 30, gyroGamma: 18, immobilityTimerSec: 0 },
    expectedActivity: 'actividad_normal',
  },
  {
    id: 'walking_tunnel',
    name: 'Caminata en Galería',
    category: 'Normal',
    description: 'Paso cadencioso con oscilaciones normales de gravedad.',
    readings: { accelX: 0.6, accelY: 9.8, accelZ: 1.1, gyroAlpha: 12, gyroBeta: 15, gyroGamma: 8, immobilityTimerSec: 0 },
    expectedActivity: 'actividad_normal',
  },
  {
    id: 'heavy_haulage',
    name: 'Acarreo de Capacho / Mineral',
    category: 'Normal/Intenso',
    description: 'Esfuerzo físico continuo con variación de postura.',
    readings: { accelX: 2.1, accelY: 11.2, accelZ: 4.0, gyroAlpha: 38, gyroBeta: 45, gyroGamma: 22, immobilityTimerSec: 0 },
    expectedActivity: 'actividad_normal',
  },
  {
    id: 'severe_fall',
    name: 'Caída de Altura / Resbalón en Rampa',
    category: 'Peligro Crítico',
    description: 'Fase de caída libre seguida de impacto brutal (>32 m/s²) y giro abrupto.',
    readings: { accelX: 18.5, accelY: 28.2, accelZ: 14.1, gyroAlpha: 340, gyroBeta: 280, gyroGamma: 195, immobilityTimerSec: 0 },
    expectedActivity: 'posible_caida',
  },
  {
    id: 'prolonged_trapped',
    name: 'Inmovilidad / Atrapamiento en Derrumbe',
    category: 'Peligro Crítico',
    description: 'Sensor estático sin micro-movimientos por más de 45 segundos.',
    readings: { accelX: 0.05, accelY: 9.81, accelZ: 0.02, gyroAlpha: 0.2, gyroBeta: 0.1, gyroGamma: 0.1, immobilityTimerSec: 48 },
    expectedActivity: 'inmovilidad_prolongada',
  },
  {
    id: 'rockburst_shock',
    name: 'Movimiento Anómalo / Tronadura / Desliz',
    category: 'Advertencia',
    description: 'Vibraciones bruscas desordenadas por desprendimiento de roca.',
    readings: { accelX: 8.9, accelY: 17.4, accelZ: 9.2, gyroAlpha: 210, gyroBeta: 160, gyroGamma: 130, immobilityTimerSec: 0 },
    expectedActivity: 'movimiento_inusual',
  },
];
