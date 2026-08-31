import math
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from backend.models import MiningSector, Worker, SensorTelemetry, SafetyAlert, SystemUser, AuditLog

def seed_database(db: Session):
    # Check if sectors exist
    if db.query(MiningSector).count() == 0:
        sectors = [
            MiningSector(id="sec-1", name="Socavón Principal", elevation_meters=-20.0, ventilation_status="optimo", risk_level="bajo"),
            MiningSector(id="sec-2", name="Nivel -50m", elevation_meters=-50.0, ventilation_status="optimo", risk_level="bajo"),
            MiningSector(id="sec-3", name="Nivel -120m", elevation_meters=-120.0, ventilation_status="precaucion", risk_level="critico"),
            MiningSector(id="sec-4", name="Galería Norte", elevation_meters=-85.0, ventilation_status="regular", risk_level="alto"),
            MiningSector(id="sec-5", name="Chimenea 3", elevation_meters=-40.0, ventilation_status="regular", risk_level="medio"),
            MiningSector(id="sec-6", name="Frente de Extracción", elevation_meters=-110.0, ventilation_status="optimo", risk_level="bajo"),
        ]
        db.add_all(sectors)
        db.commit()

    # Check if workers exist
    if db.query(Worker).count() == 0:
        now = datetime.now(timezone.utc)
        workers = [
            Worker(
                id="w-1",
                code="MIN-081",
                name="Santos Quispe Huamán",
                dni="45892134",
                age=38,
                role="Perforista de Veta Aurífera",
                sector="Nivel -120m",
                shift="Mañana",
                status="peligro",
                risk_level="critico",
                device_uuid="SMP-MINE-A819",
                device_battery=78,
                signal_strength=-88,
                emergency_contact={"name": "Elena Quispe", "phone": "+51 984 123 456", "relationship": "Esposa"},
                blood_type="O+",
                last_activity="posible_caida",
                last_telemetry_at=(now - timedelta(seconds=25)).isoformat(),
                current_acceleration={"x": 19.4, "y": 27.8, "z": 12.1, "svm": 36.0},
                current_gyroscope={"alpha": 320, "beta": 240, "gamma": 180},
                consecutive_alerts=2,
                avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            ),
            Worker(
                id="w-2",
                code="MIN-082",
                name="Wilfredo Mamani Cruz",
                dni="41238940",
                age=42,
                role="Acarreador de Mineral en Rampa",
                sector="Galería Norte",
                shift="Mañana",
                status="advertencia",
                risk_level="alto",
                device_uuid="SMP-MINE-B442",
                device_battery=45,
                signal_strength=-72,
                emergency_contact={"name": "María Mamani", "phone": "+51 951 884 901", "relationship": "Hermana"},
                blood_type="A+",
                last_activity="inmovilidad_prolongada",
                last_telemetry_at=(now - timedelta(seconds=50)).isoformat(),
                current_acceleration={"x": 0.1, "y": 9.8, "z": 0.05, "svm": 9.81},
                current_gyroscope={"alpha": 0.4, "beta": 0.2, "gamma": 0.1},
                consecutive_alerts=1,
                avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            ),
            Worker(
                id="w-3",
                code="MIN-083",
                name="Carlos Mendoza Pari",
                dni="72340912",
                age=29,
                role="Enmaderador / Sostenimiento",
                sector="Chimenea 3",
                shift="Mañana",
                status="advertencia",
                risk_level="medio",
                device_uuid="SMP-MINE-C902",
                device_battery=89,
                signal_strength=-65,
                emergency_contact={"name": "Rosa Pari", "phone": "+51 987 554 112", "relationship": "Madre"},
                blood_type="B+",
                last_activity="movimiento_inusual",
                last_telemetry_at=(now - timedelta(seconds=12)).isoformat(),
                current_acceleration={"x": 7.2, "y": 16.4, "z": 8.9, "svm": 19.9},
                current_gyroscope={"alpha": 180, "beta": 140, "gamma": 110},
                consecutive_alerts=0,
                avatar_url="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
            ),
            Worker(
                id="w-4",
                code="MIN-084",
                name="Ignacio Condori Flores",
                dni="48901234",
                age=34,
                role="Maestro Winchero",
                sector="Socavón Principal",
                shift="Mañana",
                status="normal",
                risk_level="bajo",
                device_uuid="SMP-MINE-D119",
                device_battery=92,
                signal_strength=-58,
                emergency_contact={"name": "Silvia Condori", "phone": "+51 954 332 109", "relationship": "Esposa"},
                blood_type="O+",
                last_activity="actividad_normal",
                last_telemetry_at=(now - timedelta(seconds=5)).isoformat(),
                current_acceleration={"x": 0.8, "y": 9.9, "z": 1.4, "svm": 10.02},
                current_gyroscope={"alpha": 14, "beta": 18, "gamma": 9},
                consecutive_alerts=0,
                avatar_url="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
            ),
            Worker(
                id="w-5",
                code="MIN-085",
                name="Esteban Ramos Ticona",
                dni="46781290",
                age=31,
                role="Disparador / Tronadura",
                sector="Nivel -50m",
                shift="Mañana",
                status="normal",
                risk_level="bajo",
                device_uuid="SMP-MINE-E550",
                device_battery=67,
                signal_strength=-78,
                emergency_contact={"name": "Lucía Ramos", "phone": "+51 958 771 223", "relationship": "Hermana"},
                blood_type="O-",
                last_activity="actividad_normal",
                last_telemetry_at=(now - timedelta(seconds=8)).isoformat(),
                current_acceleration={"x": 1.1, "y": 10.2, "z": 2.3, "svm": 10.51},
                current_gyroscope={"alpha": 22, "beta": 26, "gamma": 14},
                consecutive_alerts=0,
                avatar_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
            ),
            Worker(
                id="w-6",
                code="MIN-086",
                name="Víctor Cárdenas Lima",
                dni="70912384",
                age=26,
                role="Ayudante de Extracción",
                sector="Frente de Extracción",
                shift="Mañana",
                status="normal",
                risk_level="bajo",
                device_uuid="SMP-MINE-F884",
                device_battery=81,
                signal_strength=-80,
                emergency_contact={"name": "Carmen Lima", "phone": "+51 984 665 432", "relationship": "Madre"},
                blood_type="A-",
                last_activity="actividad_normal",
                last_telemetry_at=(now - timedelta(seconds=15)).isoformat(),
                current_acceleration={"x": 1.5, "y": 10.6, "z": 2.8, "svm": 11.06},
                current_gyroscope={"alpha": 30, "beta": 35, "gamma": 19},
                consecutive_alerts=0,
                avatar_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
            ),
        ]
        db.add_all(workers)
        db.commit()

        # Seed initial telemetry history for each worker
        telemetry_points = []
        for w in workers:
            count = 30
            for i in range(count, -1, -1):
                t = (now - timedelta(seconds=i * 3)).isoformat()
                ax = 0.5 + math.sin(i * 0.4) * 1.2
                ay = 9.81 + math.cos(i * 0.3) * 1.5
                az = 1.0 + math.sin(i * 0.2) * 0.8
                alpha = 15.0 + math.sin(i * 0.5) * 10.0
                beta = 20.0 + math.cos(i * 0.4) * 12.0
                gamma = 10.0 + math.sin(i * 0.3) * 8.0
                act = "actividad_normal"
                risk = "bajo"

                if w.id == "w-1" and i <= 3:
                    ax = 18.5 + (3 - i) * 2.0
                    ay = 28.2 - (3 - i) * 3.0
                    az = 14.1
                    alpha = 320.0
                    beta = 240.0
                    gamma = 180.0
                    act = "posible_caida"
                    risk = "critico"
                elif w.id == "w-2" and i <= 8:
                    ax = 0.02
                    ay = 9.81
                    az = 0.01
                    alpha = 0.1
                    beta = 0.1
                    gamma = 0.1
                    act = "inmovilidad_prolongada"
                    risk = "alto"

                svm = math.sqrt(ax * ax + ay * ay + az * az)
                gyro_norm = math.sqrt(alpha * alpha + beta * beta + gamma * gamma)

                telemetry_points.append(SensorTelemetry(
                    id=f"tel-{w.id}-{i}",
                    worker_id=w.id,
                    timestamp=t,
                    accel_x=round(ax, 2),
                    accel_y=round(ay, 2),
                    accel_z=round(az, 2),
                    svm=round(svm, 2),
                    gyro_alpha=round(alpha, 1),
                    gyro_beta=round(beta, 1),
                    gyro_gamma=round(gamma, 1),
                    gyro_norm=round(gyro_norm, 1),
                    jerk=round(50.0 if act == "posible_caida" else 2.5, 2),
                    activity_class=act,
                    confidence=0.94,
                    risk_level=risk,
                    battery_level=max(10, 80 - (i // 10)),
                    depth_meters=120.0
                ))
        db.add_all(telemetry_points)
        db.commit()

    # Check if alerts exist
    if db.query(SafetyAlert).count() == 0:
        now = datetime.now(timezone.utc)
        alerts = [
            SafetyAlert(
                id="alt-101",
                worker_id="w-1",
                worker_name="Santos Quispe Huamán",
                worker_code="MIN-081",
                sector="Nivel -120m",
                priority="critica",
                activity_type="posible_caida",
                status="activa",
                timestamp=(now - timedelta(minutes=3)).isoformat(),
                title="¡Impacto y Posible Caída de Altura Detectada!",
                description="El sensor registró una caída libre de 0.4s seguida de un impacto de 36.0 m/s² (3.67g) con rotación violenta en el Nivel -120m.",
                metrics={"svm": 36.0, "jerk": 68.4},
            ),
            SafetyAlert(
                id="alt-102",
                worker_id="w-2",
                worker_name="Wilfredo Mamani Cruz",
                worker_code="MIN-082",
                sector="Galería Norte",
                priority="alta",
                activity_type="inmovilidad_prolongada",
                status="en_atencion",
                timestamp=(now - timedelta(minutes=12)).isoformat(),
                title="Inmovilidad Prolongada (>60 segundos)",
                description="Ausencia total de microvibraciones en la rampa de acarreo. Sospecha de atrapamiento, caída de roca menor o descompensación.",
                metrics={"svm": 9.81, "jerk": 0.1, "immobilitySec": 68},
                attended_by="Ing. Rodrigo Valenzuela (Supervisor)",
                attended_at=(now - timedelta(minutes=8)).isoformat(),
                resolution_notes="Brigada enviada con camilla y oxígeno. Confirmando contacto radial.",
            ),
            SafetyAlert(
                id="alt-103",
                worker_id="w-3",
                worker_name="Carlos Mendoza Pari",
                worker_code="MIN-083",
                sector="Chimenea 3",
                priority="media",
                activity_type="movimiento_inusual",
                status="activa",
                timestamp=(now - timedelta(minutes=25)).isoformat(),
                title="Patrón de Movimiento Errático / Sacudida",
                description="Picos de aceleración angular y vibraciones intensas no periódicas en sostenimiento de madera.",
                metrics={"svm": 19.9, "jerk": 34.2},
            ),
            SafetyAlert(
                id="alt-100",
                worker_id="w-5",
                worker_name="Esteban Ramos Ticona",
                worker_code="MIN-085",
                sector="Nivel -50m",
                priority="media",
                activity_type="movimiento_inusual",
                status="resuelta",
                timestamp=(now - timedelta(minutes=140)).isoformat(),
                title="Vibración por Tronadura Adyacente",
                description="Disparador se desplazó a zona segura tras detonación programada.",
                metrics={"svm": 18.5, "jerk": 28.0},
                attended_by="Carlos Mendoza",
                attended_at=(now - timedelta(minutes=130)).isoformat(),
                resolved_at=(now - timedelta(minutes=115)).isoformat(),
                resolution_notes="Zona despejada tras ventilación de gases. Trabajador sin lesiones.",
            ),
        ]
        db.add_all(alerts)
        db.commit()

    # Check if system users exist
    if db.query(SystemUser).count() == 0 or db.query(SystemUser).filter(SystemUser.email == "mineria@minerio").count() == 0:
        existing_emails = {u.email for u in db.query(SystemUser).all()}
        users_to_add = []
        
        all_initial_users = [
            SystemUser(
                id="u-0",
                name="Supervisor General de Mina",
                email="mineria@minerio",
                password="mineria123",
                role="admin",
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                last_login="En línea",
                sector_assigned="Supervisión General Mina",
            ),
            SystemUser(
                id="u-1",
                name="Ing. Arturo Mendoza",
                email="admin.seguridad@minera-m10.pe",
                password="mineria123",
                role="admin",
                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                last_login="Hace 10 minutos",
                sector_assigned="Supervisión General Mina",
            ),
            SystemUser(
                id="u-2",
                name="Supervisor Rodrigo Valenzuela",
                email="rodrigo.valenzuela@minera-m10.pe",
                password="mineria123",
                role="supervisor",
                avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                last_login="Hace 2 minutos",
                sector_assigned="Nivel -120m y Galería Norte",
            ),
            SystemUser(
                id="u-3",
                name="Paramédica Karen Saldaña",
                email="karen.saldana@minera-m10.pe",
                password="mineria123",
                role="rescatista",
                avatar="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
                last_login="En línea",
                sector_assigned="Puesto de Rescate Subterráneo",
            ),
        ]
        
        for u in all_initial_users:
            if u.email not in existing_emails:
                users_to_add.append(u)
                
        if users_to_add:
            db.add_all(users_to_add)
            db.commit()

    # Check if audit logs exist
    if db.query(AuditLog).count() == 0:
        now = datetime.now(timezone.utc)
        logs = [
            AuditLog(
                id="log-1",
                timestamp=(now - timedelta(minutes=5)).isoformat(),
                user="Rodrigo Valenzuela",
                role="Supervisor",
                action="Atención de Alerta",
                details="Asignó brigadista a alerta alt-102 (Wilfredo Mamani en Galería Norte).",
                ip="192.168.10.45",
            ),
            AuditLog(
                id="log-2",
                timestamp=(now - timedelta(minutes=18)).isoformat(),
                user="Sistema IA M-10",
                role="AI Engine",
                action="Detección Automática de Caída",
                details="Generada alerta crítica para trabajador MIN-081 (Santos Quispe). SVM: 36.0 m/s².",
                ip="127.0.0.1 (FastAPI/ML)",
            ),
            AuditLog(
                id="log-3",
                timestamp=(now - timedelta(minutes=45)).isoformat(),
                user="Arturo Mendoza",
                role="Administrador",
                action="Actualización de Parámetros IA",
                details="Ajustado umbral de impacto de caída a 26 m/s² y ventana de inmovilidad a 30s.",
                ip="192.168.10.12",
            ),
            AuditLog(
                id="log-4",
                timestamp=(now - timedelta(minutes=120)).isoformat(),
                user="Arturo Mendoza",
                role="Administrador",
                action="Registro de Trabajador",
                details="Registrado nuevo trabajador Víctor Cárdenas (MIN-086) con UUID SMP-MINE-F884.",
                ip="192.168.10.12",
            ),
        ]
        db.add_all(logs)
        db.commit()
