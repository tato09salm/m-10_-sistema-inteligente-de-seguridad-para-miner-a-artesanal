import { Worker, Alert, SensorTelemetry, DashboardStats, SystemUser, AuditLog } from '../types';

export const api = {
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  async getWorkers(filters?: { sector?: string; status?: string; riskLevel?: string; search?: string }): Promise<Worker[]> {
    const params = new URLSearchParams();
    if (filters?.sector) params.append('sector', filters.sector);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`/api/workers?${params.toString()}`);
    return res.json();
  },

  async getWorker(id: string): Promise<Worker> {
    const res = await fetch(`/api/workers/${id}`);
    return res.json();
  },

  async createWorker(data: Partial<Worker>): Promise<Worker> {
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateWorker(id: string, data: Partial<Worker>): Promise<Worker> {
    const res = await fetch(`/api/workers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteWorker(id: string) {
    const res = await fetch(`/api/workers/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async getWorkerTelemetry(id: string): Promise<SensorTelemetry[]> {
    const res = await fetch(`/api/workers/${id}/telemetry`);
    return res.json();
  },

  async streamTelemetry(payload: {
    workerId: string;
    accelX: number;
    accelY: number;
    accelZ: number;
    gyroAlpha?: number;
    gyroBeta?: number;
    gyroGamma?: number;
    immobilitySec?: number;
    batteryLevel?: number;
  }) {
    const res = await fetch('/api/telemetry/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getAlerts(filters?: { status?: string; priority?: string; workerId?: string }): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.workerId) params.append('workerId', filters.workerId);

    const res = await fetch(`/api/alerts?${params.toString()}`);
    return res.json();
  },

  async updateAlert(id: string, data: { status?: string; attendedBy?: string; resolutionNotes?: string }): Promise<Alert> {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getStats(): Promise<DashboardStats> {
    const res = await fetch('/api/stats');
    return res.json();
  },

  async getUsers(): Promise<SystemUser[]> {
    const res = await fetch('/api/users');
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs');
    return res.json();
  },

  async getPostgresSchema() {
    const res = await fetch('/api/db/schema');
    return res.json();
  },

  async consultAiAdvisor(prompt: string, workerId?: string, sector?: string) {
    const res = await fetch('/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, workerId, sector }),
    });
    return res.json();
  },
};
