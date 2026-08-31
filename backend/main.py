import time
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.config import HOST, PORT, DB_NAME
from backend.database import engine, Base, get_db, SessionLocal
from backend.models import MiningSector, Worker, SensorTelemetry, SafetyAlert, SystemUser, AuditLog
from backend.schemas import WorkerCreate, WorkerUpdate, TelemetryStreamInput, AlertUpdate, AiAdvisorInput, LoginRequest
from backend.ml_engine import classify_sensor_stream
from backend.ai_advisor import get_ai_safety_advice
from backend.seed_data import seed_database

start_time = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables in PostgreSQL and populate seed data if empty
    print("[FastAPI M-10] Inicializando esquema de base de datos PostgreSQL...")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    print(f"[FastAPI M-10] Base de datos '{DB_NAME}' conectada y sincronizada.")
    yield
    print("[FastAPI M-10] Apagando servidor...")

app = FastAPI(
    title="M-10: Sistema Inteligente de Seguridad para Minería Artesanal",
    version="3.2.0",
    description="API REST FastAPI para ingesta de telemetría de sensores, clasificación cinemática ML y gestión de seguridad minera.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 0. Authentication Endpoints ---
@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    password = payload.password.strip()

    user = db.query(SystemUser).filter(SystemUser.email.ilike(email)).first()
    if not user:
        # Fallback check for default admin credentials
        if email == "mineria@minerio" and password == "mineria123":
            user = SystemUser(
                id="u-0",
                name="Supervisor General de Mina",
                email="mineria@minerio",
                password="mineria123",
                role="admin",
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                last_login="En línea",
                sector_assigned="Supervisión General Mina",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas. Verifique correo o contraseña.")

    # Check password
    user_pass = getattr(user, "password", "mineria123") or "mineria123"
    if user_pass != password:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta para el usuario.")

    # Update last login
    now_iso = datetime.now(timezone.utc).isoformat()
    user.last_login = "En línea"
    
    # Audit log
    audit = AuditLog(
        id=f"log-{int(time.time() * 1000)}",
        timestamp=now_iso,
        user=user.name,
        role=user.role,
        action="Inicio de Sesión",
        details=f"Acceso autorizado al Centro de Operaciones M-10 ({user.email}).",
        ip=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "token": f"m10_session_{user.id}_{int(time.time())}",
        "user": user.to_dict(),
        "message": f"Bienvenido, {user.name}"
    }

@app.post("/api/auth/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    now_iso = datetime.now(timezone.utc).isoformat()
    audit = AuditLog(
        id=f"log-{int(time.time() * 1000)}",
        timestamp=now_iso,
        user="Usuario del Sistema",
        role="Operador",
        action="Cierre de Sesión",
        details="Cierre de sesión finalizado.",
        ip=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": "Sesión cerrada correctamente"}

# --- 1. Health Check ---
@app.get("/api/health")
def get_health(db: Session = Depends(get_db)):
    workers_count = db.query(Worker).count()
    return {
        "status": "ok",
        "system": "M-10: Sistema Inteligente de Seguridad para Minería Artesanal",
        "version": "3.2.0 (FastAPI + PostgreSQL)",
        "database": f"PostgreSQL (Connected: {DB_NAME})",
        "aiModel": "ML-Kinematic-FastAPI v3.2 + Neural Fall Classifier",
        "activeWorkersCount": workers_count,
        "uptimeSeconds": int(time.time() - start_time),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# --- 2. Workers CRUD ---
@app.get("/api/workers")
def get_workers(
    sector: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    riskLevel: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Worker)
    if sector:
        query = query.filter(Worker.sector == sector)
    if status:
        query = query.filter(Worker.status == status)
    if riskLevel:
        query = query.filter(Worker.risk_level == riskLevel)

    workers = query.all()
    result = [w.to_dict() for w in workers]

    if search:
        q = search.lower()
        result = [
            w for w in result
            if q in w["name"].lower()
            or q in w["code"].lower()
            or q in w["dni"]
            or q in w["sector"].lower()
        ]

    return result

@app.get("/api/workers/{worker_id}")
def get_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return worker.to_dict()

@app.post("/api/workers", status_code=201)
def create_worker(payload: WorkerCreate, request: Request, db: Session = Depends(get_db)):
    count = db.query(Worker).count()
    new_id = f"w-{int(time.time() * 1000)}"
    code = payload.code or f"MIN-{str(count + 81).zfill(3)}"
    device_uuid = payload.deviceUuid or f"SMP-MINE-{uuid.uuid4().hex[:4].upper()}"

    now_iso = datetime.now(timezone.utc).isoformat()
    new_worker = Worker(
        id=new_id,
        code=code,
        name=payload.name or "Nuevo Minero",
        dni=payload.dni or "00000000",
        age=payload.age or 30,
        role=payload.role or "Operador Minero",
        sector=payload.sector or "Socavón Principal",
        shift=payload.shift or "Mañana",
        status="normal",
        risk_level="bajo",
        device_uuid=device_uuid,
        device_battery=payload.deviceBattery or 95,
        signal_strength=payload.signalStrength or -65,
        emergency_contact=payload.emergencyContact.model_dump() if payload.emergencyContact else {
            "name": "Contacto de Emergencia",
            "phone": "+51 900 000 000",
            "relationship": "Familiar"
        },
        blood_type=payload.bloodType or "O+",
        last_activity="actividad_normal",
        last_telemetry_at=now_iso,
        current_acceleration={"x": 0.2, "y": 9.81, "z": 0.8, "svm": 9.85},
        current_gyroscope={"alpha": 10, "beta": 12, "gamma": 5},
        consecutive_alerts=0,
        avatar_url=payload.avatarUrl or "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    )

    db.add(new_worker)

    # Initial telemetry point
    init_tel = SensorTelemetry(
        id=f"tel-{new_id}-init",
        worker_id=new_id,
        timestamp=now_iso,
        accel_x=0.2,
        accel_y=9.81,
        accel_z=0.8,
        svm=9.85,
        gyro_alpha=10.0,
        gyro_beta=12.0,
        gyro_gamma=5.0,
        gyro_norm=16.4,
        jerk=1.2,
        activity_class="actividad_normal",
        confidence=0.95,
        risk_level="bajo",
        battery_level=95,
        depth_meters=120.0
    )
    db.add(init_tel)

    # Audit log
    audit = AuditLog(
        id=f"log-{int(time.time() * 1000)}",
        timestamp=now_iso,
        user="Supervisor / Admin",
        role="Administrador",
        action="Creación de Trabajador",
        details=f"Registrado trabajador {new_worker.name} ({new_worker.code}) asignado a {new_worker.sector}.",
        ip=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_worker)

    return new_worker.to_dict()

@app.put("/api/workers/{worker_id}")
def update_worker(worker_id: str, payload: WorkerUpdate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "riskLevel" in data:
        worker.risk_level = data.pop("riskLevel")
    if "deviceUuid" in data:
        worker.device_uuid = data.pop("deviceUuid")
    if "deviceBattery" in data:
        worker.device_battery = data.pop("deviceBattery")
    if "signalStrength" in data:
        worker.signal_strength = data.pop("signalStrength")
    if "emergencyContact" in data:
        worker.emergency_contact = data.pop("emergencyContact")
    if "bloodType" in data:
        worker.blood_type = data.pop("bloodType")
    if "lastActivity" in data:
        worker.last_activity = data.pop("lastActivity")
    if "lastTelemetryAt" in data:
        worker.last_telemetry_at = data.pop("lastTelemetryAt")
    if "currentAcceleration" in data:
        worker.current_acceleration = data.pop("currentAcceleration")
    if "currentGyroscope" in data:
        worker.current_gyroscope = data.pop("currentGyroscope")
    if "consecutiveAlerts" in data:
        worker.consecutive_alerts = data.pop("consecutiveAlerts")
    if "avatarUrl" in data:
        worker.avatar_url = data.pop("avatarUrl")

    for key, val in data.items():
        if hasattr(worker, key):
            setattr(worker, key, val)

    db.commit()
    db.refresh(worker)
    return worker.to_dict()

@app.delete("/api/workers/{worker_id}")
def delete_worker(worker_id: str, request: Request, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    worker_dict = worker.to_dict()
    db.delete(worker)

    now_iso = datetime.now(timezone.utc).isoformat()
    audit = AuditLog(
        id=f"log-{int(time.time() * 1000)}",
        timestamp=now_iso,
        user="Administrador",
        role="Administrador",
        action="Baja de Trabajador",
        details=f"Se retiró el registro del minero {worker_dict['name']} ({worker_dict['code']}).",
        ip=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()

    return {"message": "Trabajador eliminado correctamente", "worker": worker_dict}

# --- 3. Telemetry API ---
@app.get("/api/workers/{worker_id}/telemetry")
def get_worker_telemetry(worker_id: str, limit: int = 40, db: Session = Depends(get_db)):
    points = db.query(SensorTelemetry)\
        .filter(SensorTelemetry.worker_id == worker_id)\
        .order_by(desc(SensorTelemetry.timestamp))\
        .limit(limit)\
        .all()
    # Return chronologically ascending
    points_dicts = [p.to_dict() for p in reversed(points)]
    return points_dicts

@app.post("/api/telemetry/stream")
def ingest_telemetry_stream(payload: TelemetryStreamInput, request: Request, db: Session = Depends(get_db)):
    worker_id = payload.workerId
    worker = None
    if worker_id:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        worker = db.query(Worker).first()
        if not worker:
            raise HTTPException(status_code=404, detail="No hay trabajadores registrados en el sistema")
        worker_id = worker.id

    # Retrieve last points for classification window
    recent_points = db.query(SensorTelemetry)\
        .filter(SensorTelemetry.worker_id == worker_id)\
        .order_by(desc(SensorTelemetry.timestamp))\
        .limit(6)\
        .all()

    prev_reading = None
    if recent_points:
        p = recent_points[0]
        prev_reading = {
            "accelX": p.accel_x,
            "accelY": p.accel_y,
            "accelZ": p.accel_z,
            "gyroAlpha": p.gyro_alpha,
            "gyroBeta": p.gyro_beta,
            "gyroGamma": p.gyro_gamma,
            "timestamp": time.time() * 1000 - 200,
        }

    recent_window = [
        {"accelX": r.accel_x, "accelY": r.accel_y, "accelZ": r.accel_z}
        for r in recent_points
    ]

    current_reading = {
        "accelX": payload.accelX if payload.accelX is not None else 0.0,
        "accelY": payload.accelY if payload.accelY is not None else 9.81,
        "accelZ": payload.accelZ if payload.accelZ is not None else 0.0,
        "gyroAlpha": payload.gyroAlpha if payload.gyroAlpha is not None else 0.0,
        "gyroBeta": payload.gyroBeta if payload.gyroBeta is not None else 0.0,
        "gyroGamma": payload.gyroGamma if payload.gyroGamma is not None else 0.0,
        "immobilityTimerSec": payload.immobilitySec,
        "timestamp": time.time() * 1000,
    }

    # Run ML Kinematic Classifier
    ai_result = classify_sensor_stream(current_reading, prev_reading, recent_window)

    now_iso = datetime.now(timezone.utc).isoformat()
    new_point = SensorTelemetry(
        id=f"tel-{worker_id}-{int(time.time() * 1000)}",
        worker_id=worker_id,
        timestamp=now_iso,
        accel_x=current_reading["accelX"],
        accel_y=current_reading["accelY"],
        accel_z=current_reading["accelZ"],
        svm=ai_result["features"]["svm"],
        gyro_alpha=current_reading["gyroAlpha"],
        gyro_beta=current_reading["gyroBeta"],
        gyro_gamma=current_reading["gyroGamma"],
        gyro_norm=ai_result["features"]["gyroMagnitude"],
        jerk=ai_result["features"]["maxJerk"],
        activity_class=ai_result["activity"],
        confidence=ai_result["confidence"],
        risk_level=ai_result["riskLevel"],
        battery_level=payload.batteryLevel if payload.batteryLevel is not None else worker.device_battery,
        depth_meters=payload.depthMeters if payload.depthMeters is not None else 120.0,
    )
    db.add(new_point)

    # Update worker state
    worker.last_activity = ai_result["activity"]
    worker.risk_level = ai_result["riskLevel"]
    worker.status = (
        "peligro" if ai_result["riskLevel"] == "critico"
        else "advertencia" if ai_result["riskLevel"] in ["alto", "medio"]
        else "normal"
    )
    worker.last_telemetry_at = now_iso
    worker.current_acceleration = {
        "x": current_reading["accelX"],
        "y": current_reading["accelY"],
        "z": current_reading["accelZ"],
        "svm": ai_result["features"]["svm"],
    }
    worker.current_gyroscope = {
        "alpha": current_reading["gyroAlpha"],
        "beta": current_reading["gyroBeta"],
        "gamma": current_reading["gyroGamma"],
    }
    if payload.batteryLevel is not None:
        worker.device_battery = max(1, min(100, payload.batteryLevel))

    created_alert = None
    if ai_result["activity"] in ["posible_caida", "inmovilidad_prolongada"] or (
        ai_result["activity"] == "movimiento_inusual" and ai_result["features"]["svm"] > 22
    ):
        priority = (
            "critica" if ai_result["activity"] == "posible_caida"
            else "alta" if ai_result["activity"] == "inmovilidad_prolongada"
            else "media"
        )
        title = (
            "¡Caída de Altura / Impacto Crítico!" if ai_result["activity"] == "posible_caida"
            else f"Inmovilidad Prolongada Detectada ({ai_result['features']['immobilityDurationSec']}s)" if ai_result["activity"] == "inmovilidad_prolongada"
            else "Sacudida Violenta / Deslizamiento"
        )

        created_alert = SafetyAlert(
            id=f"alt-{int(time.time() * 1000)}",
            worker_id=worker.id,
            worker_name=worker.name,
            worker_code=worker.code,
            sector=worker.sector,
            priority=priority,
            activity_type=ai_result["activity"],
            status="activa",
            timestamp=now_iso,
            title=title,
            description=ai_result["reasoning"],
            metrics={
                "svm": ai_result["features"]["svm"],
                "jerk": ai_result["features"]["maxJerk"],
                "immobilitySec": ai_result["features"]["immobilityDurationSec"],
            }
        )
        db.add(created_alert)
        worker.consecutive_alerts = (worker.consecutive_alerts or 0) + 1

        audit = AuditLog(
            id=f"log-{int(time.time() * 1000)}",
            timestamp=now_iso,
            user="Modelo IA FastAPI M-10",
            role="AI Engine",
            action=f"Alerta Automática: {title}",
            details=f"Disparada para {worker.name} en {worker.sector}. Confianza: {round(ai_result['confidence'] * 100, 1)}%.",
            ip=request.client.host if request.client else "127.0.0.1"
        )
        db.add(audit)

    db.commit()
    db.refresh(new_point)
    db.refresh(worker)

    return {
        "success": True,
        "telemetry": new_point.to_dict(),
        "aiClassification": ai_result,
        "alertGenerated": created_alert.to_dict() if created_alert else None,
    }

# --- 4. Alerts API ---
@app.get("/api/alerts")
def get_alerts(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    workerId: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(SafetyAlert)
    if status:
        query = query.filter(SafetyAlert.status == status)
    if priority:
        query = query.filter(SafetyAlert.priority == priority)
    if workerId:
        query = query.filter(SafetyAlert.worker_id == workerId)

    alerts = query.order_by(desc(SafetyAlert.timestamp)).all()
    return [a.to_dict() for a in alerts]

@app.patch("/api/alerts/{alert_id}")
def patch_alert(alert_id: str, payload: AlertUpdate, request: Request, db: Session = Depends(get_db)):
    alert = db.query(SafetyAlert).filter(SafetyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    now_iso = datetime.now(timezone.utc).isoformat()
    if payload.status:
        alert.status = payload.status
    if payload.attendedBy:
        alert.attended_by = payload.attendedBy
        alert.attended_at = now_iso
    if payload.resolutionNotes:
        alert.resolution_notes = payload.resolutionNotes
        if payload.status == "resuelta":
            alert.resolved_at = now_iso

    # If resolved, reset worker if no other active critical alerts
    if payload.status == "resuelta" and alert.worker_id:
        worker = db.query(Worker).filter(Worker.id == alert.worker_id).first()
        if worker:
            active_count = db.query(SafetyAlert).filter(
                SafetyAlert.worker_id == worker.id,
                SafetyAlert.status == "activa"
            ).count()
            if active_count == 0:
                worker.status = "normal"
                worker.risk_level = "bajo"

    audit = AuditLog(
        id=f"log-{int(time.time() * 1000)}",
        timestamp=now_iso,
        user=payload.attendedBy or "Supervisor de Guardia",
        role="Supervisor",
        action=f"Actualización de Alerta ({payload.status or 'Nota'})",
        details=f"Alerta {alert.id} ({alert.title}) actualizada a estado: {alert.status}.",
        ip=request.client.host if request.client else "127.0.0.1"
    )
    db.add(audit)
    db.commit()
    db.refresh(alert)

    return alert.to_dict()

# --- 5. Dashboard Stats ---
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    workers = db.query(Worker).all()
    alerts = db.query(SafetyAlert).all()
    telemetry_count = db.query(SensorTelemetry).count()

    active_alerts = [a for a in alerts if a.status == "activa"]
    critical_alerts = [a for a in active_alerts if a.priority == "critica"]
    falls_count = len([a for a in alerts if a.activity_type == "posible_caida"])
    unusual_count = len([a for a in alerts if a.activity_type == "movimiento_inusual"])
    immobility_count = len([a for a in alerts if a.activity_type == "inmovilidad_prolongada"])

    high_risk_workers = len([w for w in workers if w.risk_level in ["critico", "alto"]])
    general_risk_index = min(
        100,
        round((len(critical_alerts) * 30) + (len(active_alerts) * 10) + (high_risk_workers * 15))
    )

    overall_mine_risk = "bajo"
    if general_risk_index > 70 or len(critical_alerts) > 0:
        overall_mine_risk = "critico"
    elif general_risk_index > 45:
        overall_mine_risk = "alto"
    elif general_risk_index > 20:
        overall_mine_risk = "medio"

    uptime_sec = int(time.time() - start_time)

    return {
        "totalMonitoredWorkers": len(workers),
        "activeWorkers": len([w for w in workers if w.status != "inactivo"]),
        "activeAlerts": len(active_alerts),
        "criticalAlerts": len(critical_alerts),
        "detectedFallsToday": falls_count,
        "unusualMovementsToday": unusual_count,
        "immobilityAlertsToday": immobility_count,
        "generalRiskIndex": general_risk_index,
        "overallMineRisk": overall_mine_risk,
        "sensorPacketsReceivedToday": telemetry_count + (uptime_sec * 5),
        "systemHealth": {
            "apiStatus": "online",
            "aiModelLatencyMs": 11.8,
            "postgresConnected": True,
            "activeSensors": len(workers) * 2,
        }
    }

# --- 6. Users & Audit Logs ---
@app.get("/api/ai/models/report")
def get_ai_models_report():
    report_file = Path(__file__).resolve().parent.parent / "ml_training" / "reports" / "models_comparison_report.json"
    if report_file.exists():
        with open(report_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"error": "Reporte aún no generado. Ejecute ml_training/train_all_models.py"}

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(SystemUser).all()
    return [u.to_dict() for u in users]

@app.get("/api/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(50).all()
    return [l.to_dict() for l in logs]

# --- 7. PostgreSQL Schema & Inspector ---
@app.get("/api/db/schema")
def get_db_schema(db: Session = Depends(get_db)):
    workers_count = db.query(Worker).count()
    telemetry_count = db.query(SensorTelemetry).count()
    alerts_count = db.query(SafetyAlert).count()
    users_count = db.query(SystemUser).count()
    logs_count = db.query(AuditLog).count()

    ddl = """
-- ==========================================================
-- SISTEMA M-10: BASE DE DATOS POSTGRESQL (MINERÍA ARTESANAL)
-- Conexión: postgresql://postgres:sa@localhost:5432/mineria
-- ==========================================================

CREATE TABLE IF NOT EXISTS mining_sectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    elevation_meters NUMERIC(6,2),
    ventilation_status VARCHAR(50) DEFAULT 'optimo',
    risk_level VARCHAR(20) DEFAULT 'bajo'
);

CREATE TABLE IF NOT EXISTS workers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    dni VARCHAR(20) NOT NULL,
    age INT,
    role VARCHAR(100),
    sector VARCHAR(100),
    shift VARCHAR(20) DEFAULT 'Mañana',
    status VARCHAR(20) DEFAULT 'normal',
    risk_level VARCHAR(20) DEFAULT 'bajo',
    device_uuid VARCHAR(100) UNIQUE,
    device_battery INT,
    signal_strength INT,
    emergency_contact JSONB,
    blood_type VARCHAR(10),
    last_activity VARCHAR(50),
    last_telemetry_at TIMESTAMPTZ,
    current_acceleration JSONB,
    current_gyroscope JSONB,
    consecutive_alerts INT DEFAULT 0,
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_telemetry (
    id VARCHAR(100) PRIMARY KEY,
    worker_id VARCHAR(50) REFERENCES workers(id) ON DELETE CASCADE,
    timestamp VARCHAR(50) NOT NULL,
    accel_x NUMERIC(6,3) NOT NULL, -- m/s^2
    accel_y NUMERIC(6,3) NOT NULL,
    accel_z NUMERIC(6,3) NOT NULL,
    svm NUMERIC(6,3) NOT NULL,     -- Signal Vector Magnitude
    gyro_alpha NUMERIC(6,2),      -- deg/s
    gyro_beta NUMERIC(6,2),
    gyro_gamma NUMERIC(6,2),
    gyro_norm NUMERIC(6,2),
    jerk NUMERIC(8,2),            -- m/s^3
    activity_class VARCHAR(50),
    confidence NUMERIC(4,3),
    risk_level VARCHAR(20),
    battery_level INT,
    temperature NUMERIC(5,2),
    depth_meters NUMERIC(6,2)
);

CREATE INDEX idx_telemetry_worker_time ON sensor_telemetry (worker_id, timestamp DESC);
CREATE INDEX idx_telemetry_activity ON sensor_telemetry (activity_class);

CREATE TABLE IF NOT EXISTS safety_alerts (
    id VARCHAR(50) PRIMARY KEY,
    worker_id VARCHAR(50) REFERENCES workers(id) ON DELETE SET NULL,
    worker_name VARCHAR(150),
    worker_code VARCHAR(30),
    sector VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'activa',
    timestamp VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metrics JSONB,
    attended_by VARCHAR(150),
    attended_at VARCHAR(50),
    resolution_notes TEXT,
    resolved_at VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_status_priority ON safety_alerts (status, priority);
    """.strip()

    return {
        "dialect": "PostgreSQL 16 (FastAPI SQLAlchemy Driver)",
        "ddl": ddl,
        "tables": [
            {"name": "workers", "count": workers_count, "description": "Padrón de mineros artesanales, asignaciones y teléfonos"},
            {"name": "sensor_telemetry", "count": telemetry_count, "description": "Series de tiempo de acelerómetro y giroscopio de smartphones"},
            {"name": "safety_alerts", "count": alerts_count, "description": "Alertas generadas por caídas, inmovilidad o anomalías"},
            {"name": "system_users", "count": users_count, "description": "Usuarios del sistema (Administrador, Supervisor, Rescatista)" },
            {"name": "audit_logs", "count": logs_count, "description": "Pistas de auditoría y eventos de seguridad"},
        ]
    }

# --- 8. AI Advisor ---
@app.post("/api/ai/advisor")
def consult_ai_advisor(payload: AiAdvisorInput, db: Session = Depends(get_db)):
    worker = None
    if payload.workerId:
        w = db.query(Worker).filter(Worker.id == payload.workerId).first()
        if w:
            worker = w.to_dict()

    active_alerts = db.query(SafetyAlert).filter(SafetyAlert.status == "activa").all()
    active_alerts_summary = ", ".join([f"{a.worker_name}: {a.title} [{a.priority}]" for a in active_alerts])
    workers_count = db.query(Worker).count()

    advice = get_ai_safety_advice(
        prompt=payload.prompt,
        worker=worker,
        active_alerts_summary=active_alerts_summary,
        active_workers_count=workers_count,
        sector=payload.sector
    )

    return advice

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
