import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  Key, 
  FileText, 
  ShieldAlert, 
  Check, 
  X, 
  Plus, 
  Users, 
  Radio, 
  Activity 
} from 'lucide-react';
import { SystemUser, AuditLog, UserRole } from '../types';

interface UsersSecurityViewProps {
  users: SystemUser[];
  auditLogs: AuditLog[];
  currentUser: SystemUser;
  onRoleChange: (role: UserRole) => void;
}

const PERMISSIONS = [
  { module: '1. Dashboard en Tiempo Real', admin: true, supervisor: true, rescatista: true },
  { module: '2. Registro y Edición de Mineros', admin: true, supervisor: true, rescatista: false },
  { module: '3. Recepción de Telemetría Smartphone', admin: true, supervisor: true, rescatista: true },
  { module: '4. Ajuste de Umbrales de IA / ML', admin: true, supervisor: false, rescatista: false },
  { module: '5. Atención y Resolución de Alertas', admin: true, supervisor: true, rescatista: true },
  { module: '6. Exportación de Informes y Auditorías', admin: true, supervisor: true, rescatista: false },
  { module: '7. Acceso a BD PostgreSQL & DDL', admin: true, supervisor: false, rescatista: false },
  { module: '8. Gestión de Usuarios & Permisos', admin: true, supervisor: false, rescatista: false },
];

export const UsersSecurityView: React.FC<UsersSecurityViewProps> = ({
  users,
  auditLogs,
  currentUser,
  onRoleChange,
}) => {
  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
              Control de Acceso, Usuarios & Auditoría de Seguridad (RBAC)
            </h1>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-mono font-bold">
              Autenticación Segura
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Gestión de roles jerárquicos (Administrador, Supervisor, Paramédico), matriz de permisos y trazabilidad de eventos.
          </p>
        </div>

        {/* Current Active User Session Badge */}
        <div className="flex items-center gap-3 bg-[#1A1C22] border border-[#D4AF37]/10 rounded-xl p-3 px-4 shrink-0 shadow-xl">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-10 h-10 rounded-xl object-cover border border-[#D4AF37]/40"
          />
          <div>
            <div className="text-xs font-bold text-white">{currentUser.name}</div>
            <div className="text-[10px] text-[#D4AF37] font-mono capitalize">
              Rol Activo: {currentUser.role === 'admin' ? 'Administrador Mina' : currentUser.role === 'supervisor' ? 'Supervisor Turno' : 'Paramédico Rescatista'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Users List & Permissions Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 1 Col: Registered Operators & Supervisors */}
        <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D4AF37]" />
              Cuentas de Acceso al Sistema
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1115] text-gray-300 border border-white/5">
              {users.length} Usuarios
            </span>
          </div>

          <div className="space-y-3">
            {users.map((u) => {
              const isSelected = u.role === currentUser.role;

              return (
                <div
                  key={u.id}
                  onClick={() => onRoleChange(u.role)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-md'
                      : 'bg-[#0F1115] border-white/5 hover:border-white/20 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-10 h-10 rounded-lg object-cover border border-white/10"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">{u.name}</div>
                      <div className="text-[10px] text-gray-400">{u.email}</div>
                      <div className="text-[10px] text-[#D4AF37] font-mono mt-0.5">
                        {u.sectorAssigned}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                      u.role === 'admin' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40' :
                      u.role === 'supervisor' ? 'bg-[#B87333]/20 text-[#FDBA74] border border-[#B87333]/40' :
                      'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {u.role}
                    </span>
                    <div className="text-[9px] text-gray-500 mt-1">{u.lastLogin}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-[#0F1115] border border-white/5 text-[11px] text-gray-400">
            💡 Haga clic en cualquier usuario de la lista para cambiar la sesión y probar las restricciones por rol.
          </div>
        </div>

        {/* Right 2 Cols: RBAC Permissions Matrix */}
        <div className="lg:col-span-2 bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-silver" />
              Matriz de Permisos por Rol (RBAC Policy)
            </h2>
            <span className="text-[10px] font-mono text-emerald-400">
              Políticas Aplicadas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase">
                  <th className="p-2.5">Módulo / Capacidad del Sistema</th>
                  <th className="p-2.5 text-center text-[#D4AF37]">Administrador</th>
                  <th className="p-2.5 text-center text-[#B87333]">Supervisor</th>
                  <th className="p-2.5 text-center text-emerald-400">Paramédico / Rescatista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {PERMISSIONS.map((perm, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="p-2.5 font-medium text-gray-200">{perm.module}</td>
                    <td className="p-2.5 text-center">
                      {perm.admin ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {perm.supervisor ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {perm.rescatista ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Immutable Security Audit Logs */}
      <div className="bg-[#1A1C22] rounded-2xl p-5 border border-[#D4AF37]/10 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            Registro Inmutable de Auditoría & Trazabilidad de Eventos (audit_logs)
          </h2>
          <span className="text-[10px] font-mono text-gray-400">
            {auditLogs.length} Eventos Registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono text-gray-400 uppercase">
                <th className="p-2.5">Fecha y Hora</th>
                <th className="p-2.5">Usuario / Agente</th>
                <th className="p-2.5">Rol</th>
                <th className="p-2.5">Acción Realizada</th>
                <th className="p-2.5">Detalles del Evento</th>
                <th className="p-2.5 font-mono">IP / Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300 font-sans text-xs">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5">
                  <td className="p-2.5 font-mono text-[11px] text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-2.5 font-bold text-white">{log.user}</td>
                  <td className="p-2.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1115] text-gray-300 border border-white/5">
                      {log.role}
                    </span>
                  </td>
                  <td className="p-2.5 font-semibold text-[#D4AF37]">{log.action}</td>
                  <td className="p-2.5 text-gray-300">{log.details}</td>
                  <td className="p-2.5 font-mono text-[11px] text-gray-500">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
