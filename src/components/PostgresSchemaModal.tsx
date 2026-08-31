import React, { useState } from 'react';
import { 
  Database, 
  Table, 
  Code2, 
  Copy, 
  Check, 
  Layers, 
  Server, 
  ShieldCheck, 
  Key, 
  FileCode 
} from 'lucide-react';

interface PostgresSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POSTGRESQL_DDL = `-- ==========================================================
-- M-10: SISTEMA INTELIGENTE DE SEGURIDAD PARA MINERÍA ARTESANAL
-- ESQUEMA RELACIONAL POSTGRESQL (DDL + TRIGGERS + ÍNDICES)
-- ==========================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Sectores / Socavones de la Mina
CREATE TABLE mining_sectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sublevel VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) DEFAULT 'medio',
    max_capacity INT DEFAULT 15,
    gas_methane_ppm NUMERIC(5,2) DEFAULT 0.0,
    temperature_c NUMERIC(4,1) DEFAULT 22.5,
    ventilation_status VARCHAR(30) DEFAULT 'operativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Trabajadores / Mineros
CREATE TABLE workers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(80) NOT NULL,
    blood_type VARCHAR(10) NOT NULL,
    emergency_contact VARCHAR(150) NOT NULL,
    sector_id VARCHAR(50) REFERENCES mining_sectors(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'advertencia', 'peligro', 'inactivo')),
    last_activity VARCHAR(40) DEFAULT 'actividad_normal',
    risk_level VARCHAR(20) DEFAULT 'bajo' CHECK (risk_level IN ('bajo', 'medio', 'alto', 'critico')),
    device_uuid VARCHAR(80) NOT NULL,
    device_battery INT DEFAULT 100,
    device_signal_dbm INT DEFAULT -75,
    shift VARCHAR(30) DEFAULT 'Mañana',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Series de Tiempo de Telemetría (Acelerómetro + Giroscopio)
CREATE TABLE sensor_telemetry (
    id BIGSERIAL PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    accel_x NUMERIC(6,3) NOT NULL,
    accel_y NUMERIC(6,3) NOT NULL,
    accel_z NUMERIC(6,3) NOT NULL,
    svm_magnitude NUMERIC(6,3) NOT NULL,
    gyro_alpha NUMERIC(6,2) DEFAULT 0.0,
    gyro_beta NUMERIC(6,2) DEFAULT 0.0,
    gyro_gamma NUMERIC(6,2) DEFAULT 0.0,
    gyro_norm NUMERIC(6,2) DEFAULT 0.0,
    jerk_index NUMERIC(6,2) DEFAULT 0.0,
    immobility_sec INT DEFAULT 0,
    activity_class VARCHAR(40) NOT NULL,
    confidence_score NUMERIC(4,3) DEFAULT 0.95,
    risk_level VARCHAR(20) DEFAULT 'bajo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Velocidad para Consultas en Tiempo Real
CREATE INDEX idx_telemetry_worker_time ON sensor_telemetry(worker_id, created_at DESC);
CREATE INDEX idx_telemetry_activity ON sensor_telemetry(activity_class);

-- 4. Tabla de Alertas de Seguridad e Incidentes
CREATE TABLE safety_alerts (
    id VARCHAR(50) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    worker_name VARCHAR(120) NOT NULL,
    worker_code VARCHAR(20) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
    activity_type VARCHAR(40) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'activa' CHECK (status IN ('activa', 'en_atencion', 'resuelta')),
    svm_reading NUMERIC(6,2),
    jerk_reading NUMERIC(6,2),
    immobility_seconds INT,
    attended_by VARCHAR(120),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_status ON safety_alerts(status, priority);

-- 5. Tabla de Usuarios y Roles (RBAC)
CREATE TABLE system_users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'supervisor', 'rescatista')),
    sector_assigned VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla de Auditoría Inmutable
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(120) NOT NULL,
    user_role VARCHAR(30) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

export const PostgresSchemaModal: React.FC<PostgresSchemaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(POSTGRESQL_DDL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="metal-card-dark rounded-2xl p-6 border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/40">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Esquema de Base de Datos Relacional (PostgreSQL DDL)
              </h2>
              <p className="text-[11px] text-slate-400">
                Estructura normalizada para almacenamiento de mineros, series de telemetría de sensores, alertas y RBAC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar DDL'}
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-lg font-bold ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Database Tables Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-amber-400 font-bold">1. mining_sectors</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Sectores, niveles, metano y ventilación.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-cyan-400 font-bold">2. workers</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Datos personales, turno, DNI, UUID smartphone.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-emerald-400 font-bold">3. sensor_telemetry</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Series de tiempo $A_x, A_y, A_z$, SVM, Giroscopio.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-red-400 font-bold">4. safety_alerts</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Alertas automáticas, rescates y notas.</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-purple-400 font-bold">5. system_users</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Roles RBAC (Admin, Supervisor, Brigadista).</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-mono text-orange-400 font-bold">6. audit_logs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Trazabilidad inmutable de acciones.</div>
          </div>
        </div>

        {/* Code Viewer */}
        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto max-h-96 leading-relaxed">
          {POSTGRESQL_DDL}
        </pre>

      </div>
    </div>
  );
};
