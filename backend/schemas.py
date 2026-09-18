from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class EmergencyContact(BaseModel):
    name: Optional[str] = "Contacto de Emergencia"
    phone: Optional[str] = "+51 900 000 000"
    relationship: Optional[str] = "Familiar"

class AccelerationSchema(BaseModel):
    x: float = 0.2
    y: float = 9.81
    z: float = 0.8
    svm: float = 9.85

class GyroscopeSchema(BaseModel):
    alpha: float = 10.0
    beta: float = 12.0
    gamma: float = 5.0

class WorkerBase(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = "Nuevo Minero"
    dni: Optional[str] = "00000000"
    age: Optional[int] = 30
    role: Optional[str] = "Operador Minero"
    sector: Optional[str] = "Socavón Principal"
    shift: Optional[str] = "Mañana"
    status: Optional[str] = "normal"
    riskLevel: Optional[str] = "bajo"
    deviceUuid: Optional[str] = None
    deviceBattery: Optional[int] = 95
    signalStrength: Optional[int] = -65
    emergencyContact: Optional[EmergencyContact] = None
    bloodType: Optional[str] = "O+"
    avatarUrl: Optional[str] = None

class WorkerCreate(WorkerBase):
    pass

class WorkerUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    dni: Optional[str] = None
    age: Optional[int] = None
    role: Optional[str] = None
    sector: Optional[str] = None
    shift: Optional[str] = None
    status: Optional[str] = None
    riskLevel: Optional[str] = None
    deviceUuid: Optional[str] = None
    deviceBattery: Optional[int] = None
    signalStrength: Optional[int] = None
    emergencyContact: Optional[Dict[str, Any]] = None
    bloodType: Optional[str] = None
    lastActivity: Optional[str] = None
    lastTelemetryAt: Optional[str] = None
    currentAcceleration: Optional[Dict[str, Any]] = None
    currentGyroscope: Optional[Dict[str, Any]] = None
    consecutiveAlerts: Optional[int] = None
    avatarUrl: Optional[str] = None

class TelemetryStreamInput(BaseModel):
    workerId: Optional[str] = None
    accelX: Optional[float] = 0.0
    accelY: Optional[float] = 9.81
    accelZ: Optional[float] = 0.0
    gyroAlpha: Optional[float] = 0.0
    gyroBeta: Optional[float] = 0.0
    gyroGamma: Optional[float] = 0.0
    immobilitySec: Optional[float] = None
    batteryLevel: Optional[int] = None
    signalStrength: Optional[int] = -65
    depthMeters: Optional[float] = 120.0

class AlertUpdate(BaseModel):
    status: Optional[str] = None
    attendedBy: Optional[str] = None
    resolutionNotes: Optional[str] = None

class AiAdvisorInput(BaseModel):
    prompt: Optional[str] = None
    workerId: Optional[str] = None
    sector: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class MineTunnelCreate(BaseModel):
    code: Optional[str] = None
    name: str
    tunnelType: Optional[str] = "galeria"
    status: Optional[str] = "activo"
    elevation: Optional[float] = 0.0
    startX: Optional[float] = 0.0
    startY: Optional[float] = 0.0
    startZ: Optional[float] = 0.0
    endX: Optional[float] = 50.0
    endY: Optional[float] = 0.0
    endZ: Optional[float] = 0.0
    lengthMeters: Optional[float] = 50.0
    widthMeters: Optional[float] = 2.5
    heightMeters: Optional[float] = 2.2
    ventilationStatus: Optional[str] = "optimo"
    riskLevel: Optional[str] = "bajo"
    description: Optional[str] = ""

class MineTunnelUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    tunnelType: Optional[str] = None
    status: Optional[str] = None
    elevation: Optional[float] = None
    startX: Optional[float] = None
    startY: Optional[float] = None
    startZ: Optional[float] = None
    endX: Optional[float] = None
    endY: Optional[float] = None
    endZ: Optional[float] = None
    lengthMeters: Optional[float] = None
    widthMeters: Optional[float] = None
    heightMeters: Optional[float] = None
    ventilationStatus: Optional[str] = None
    riskLevel: Optional[str] = None
    description: Optional[str] = None

class TunnelConnectionCreate(BaseModel):
    sourceTunnelId: str
    targetTunnelId: str
    connectionType: Optional[str] = "bifurcacion_y"
    junctionPoint: Optional[Dict[str, float]] = None
    distanceMeters: Optional[float] = 5.0
    status: Optional[str] = "abierto"
    notes: Optional[str] = ""


