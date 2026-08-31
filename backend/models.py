from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    JSON,
    ForeignKey,
)
from backend.database import Base

def get_utc_now_iso():
    return datetime.now(timezone.utc).isoformat()

class MiningSector(Base):
    __tablename__ = "mining_sectors"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    elevation_meters = Column(Float, default=0.0)
    ventilation_status = Column(String(50), default="optimo")
    risk_level = Column(String(20), default="bajo")

class Worker(Base):
    __tablename__ = "workers"

    id = Column(String(50), primary_key=True)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    dni = Column(String(20), nullable=False)
    age = Column(Integer, default=30)
    role = Column(String(100), default="Operador Minero")
    sector = Column(String(100), default="Socavón Principal")
    shift = Column(String(20), default="Mañana")
    status = Column(String(20), default="normal") # normal, advertencia, peligro, inactivo
    risk_level = Column(String(20), default="bajo") # bajo, medio, alto, critico
    device_uuid = Column(String(100), unique=True, nullable=True)
    device_battery = Column(Integer, default=95)
    signal_strength = Column(Integer, default=-65)
    emergency_contact = Column(JSON, default=dict)
    blood_type = Column(String(10), default="O+")
    last_activity = Column(String(50), default="actividad_normal")
    last_telemetry_at = Column(String(50), default=get_utc_now_iso)
    current_acceleration = Column(JSON, default=lambda: {"x": 0.2, "y": 9.81, "z": 0.8, "svm": 9.85})
    current_gyroscope = Column(JSON, default=lambda: {"alpha": 10, "beta": 12, "gamma": 5})
    consecutive_alerts = Column(Integer, default=0)
    avatar_url = Column(String(500), default="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "dni": self.dni,
            "age": self.age,
            "role": self.role,
            "sector": self.sector,
            "shift": self.shift,
            "status": self.status,
            "riskLevel": self.risk_level,
            "deviceUuid": self.device_uuid,
            "deviceBattery": self.device_battery,
            "signalStrength": self.signal_strength,
            "emergencyContact": self.emergency_contact or {},
            "bloodType": self.blood_type,
            "lastActivity": self.last_activity,
            "lastTelemetryAt": self.last_telemetry_at or get_utc_now_iso(),
            "currentAcceleration": self.current_acceleration,
            "currentGyroscope": self.current_gyroscope,
            "consecutiveAlerts": self.consecutive_alerts or 0,
            "avatarUrl": self.avatar_url,
        }

class SensorTelemetry(Base):
    __tablename__ = "sensor_telemetry"

    id = Column(String(100), primary_key=True)
    worker_id = Column(String(50), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(String(50), nullable=False, default=get_utc_now_iso, index=True)
    accel_x = Column(Float, nullable=False)
    accel_y = Column(Float, nullable=False)
    accel_z = Column(Float, nullable=False)
    svm = Column(Float, nullable=False)
    gyro_alpha = Column(Float, default=0.0)
    gyro_beta = Column(Float, default=0.0)
    gyro_gamma = Column(Float, default=0.0)
    gyro_norm = Column(Float, default=0.0)
    jerk = Column(Float, default=0.0)
    activity_class = Column(String(50), default="actividad_normal", index=True)
    confidence = Column(Float, default=0.95)
    risk_level = Column(String(20), default="bajo")
    battery_level = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)
    depth_meters = Column(Float, default=120.0)

    def to_dict(self):
        return {
            "id": self.id,
            "workerId": self.worker_id,
            "timestamp": self.timestamp,
            "accelX": self.accel_x,
            "accelY": self.accel_y,
            "accelZ": self.accel_z,
            "svm": self.svm,
            "gyroAlpha": self.gyro_alpha,
            "gyroBeta": self.gyro_beta,
            "gyroGamma": self.gyro_gamma,
            "gyroNorm": self.gyro_norm,
            "jerk": self.jerk,
            "activityClass": self.activity_class,
            "confidence": self.confidence,
            "riskLevel": self.risk_level,
            "batteryLevel": self.battery_level,
            "temperature": self.temperature,
            "depthMeters": self.depth_meters,
        }

class SafetyAlert(Base):
    __tablename__ = "safety_alerts"

    id = Column(String(50), primary_key=True)
    worker_id = Column(String(50), ForeignKey("workers.id", ondelete="SET NULL"), nullable=True)
    worker_name = Column(String(150), default="")
    worker_code = Column(String(30), default="")
    sector = Column(String(100), nullable=False)
    priority = Column(String(20), nullable=False) # critica, alta, media, baja
    activity_type = Column(String(50), nullable=False) # posible_caida, inmovilidad_prolongada, movimiento_inusual, etc.
    status = Column(String(20), default="activa") # activa, en_atencion, resuelta
    timestamp = Column(String(50), default=get_utc_now_iso)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    metrics = Column(JSON, default=dict)
    attended_by = Column(String(150), nullable=True)
    attended_at = Column(String(50), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "workerId": self.worker_id,
            "workerName": self.worker_name,
            "workerCode": self.worker_code,
            "sector": self.sector,
            "priority": self.priority,
            "activityType": self.activity_type,
            "status": self.status,
            "timestamp": self.timestamp,
            "title": self.title,
            "description": self.description,
            "metrics": self.metrics or {},
            "attendedBy": self.attended_by,
            "attendedAt": self.attended_at,
            "resolutionNotes": self.resolution_notes,
            "resolvedAt": self.resolved_at,
        }

class SystemUser(Base):
    __tablename__ = "system_users"

    id = Column(String(50), primary_key=True)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password = Column(String(150), default="mineria123")
    role = Column(String(50), default="supervisor")
    avatar = Column(String(500), default="")
    last_login = Column(String(100), default="En línea")
    sector_assigned = Column(String(150), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "avatar": self.avatar,
            "lastLogin": self.last_login,
            "sectorAssigned": self.sector_assigned,
        }

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(50), primary_key=True)
    timestamp = Column(String(50), default=get_utc_now_iso)
    user = Column(String(150), nullable=False)
    role = Column(String(100), default="Administrador")
    action = Column(String(150), nullable=False)
    details = Column(Text, default="")
    ip = Column(String(50), default="127.0.0.1")

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "user": self.user,
            "role": self.role,
            "action": self.action,
            "details": self.details,
            "ip": self.ip,
        }
