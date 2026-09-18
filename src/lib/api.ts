import { Worker, Alert, SensorTelemetry, DashboardStats, SystemUser, AuditLog, MineTunnel, TunnelConnection } from '../types';

export const api = {
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  async getNetworkInterfaces(): Promise<{ interfaces: { name: string; ip: string; isWifi: boolean; isRecommended?: boolean }[]; currentHost: string }> {
    try {
      const res = await fetch('/api/network-interfaces');
      if (!res.ok) throw new Error('Endpoint not available');
      return await res.json();
    } catch {
      return {
        interfaces: [
          { name: 'Red Local (Automática)', ip: window.location.hostname || 'localhost', isWifi: true, isRecommended: true },
          { name: 'localhost (Mismo equipo)', ip: 'localhost', isWifi: false, isRecommended: false }
        ],
        currentHost: window.location.hostname || 'localhost'
      };
    }
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
    signalStrength?: number;
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

  async login(credentials: { email: string; password: string }): Promise<{ success: boolean; token: string; user: SystemUser; message?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al iniciar sesión' }));
      throw new Error(err.detail || 'Credenciales inválidas');
    }
    return res.json();
  },

  async getAiModelsReport() {
    const res = await fetch('/api/ai/models/report');
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      return res.json();
    } catch {
      return { success: true };
    }
  },

  async getSocavones(filters?: { status?: string; tunnelType?: string; riskLevel?: string; search?: string }): Promise<MineTunnel[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tunnelType) params.append('tunnel_type', filters.tunnelType);
    if (filters?.riskLevel) params.append('risk_level', filters.riskLevel);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`/api/socavones?${params.toString()}`);
    return res.json();
  },

  async getSocavon(id: string): Promise<MineTunnel> {
    const res = await fetch(`/api/socavones/${id}`);
    return res.json();
  },

  async createSocavon(data: Partial<MineTunnel>): Promise<MineTunnel> {
    const res = await fetch('/api/socavones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al crear socavón' }));
      throw new Error(err.detail || 'Error al crear socavón');
    }
    return res.json();
  },

  async updateSocavon(id: string, data: Partial<MineTunnel>): Promise<MineTunnel> {
    const res = await fetch(`/api/socavones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al actualizar socavón' }));
      throw new Error(err.detail || 'Error al actualizar socavón');
    }
    return res.json();
  },

  async deleteSocavon(id: string) {
    const res = await fetch(`/api/socavones/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async getTunnelConnections(): Promise<TunnelConnection[]> {
    const res = await fetch('/api/socavones/connections');
    return res.json();
  },

  async createTunnelConnection(data: Partial<TunnelConnection>): Promise<TunnelConnection> {
    const res = await fetch('/api/socavones/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al conectar socavones' }));
      throw new Error(err.detail || 'Error al conectar socavones');
    }
    return res.json();
  },

  async deleteTunnelConnection(id: string) {
    const res = await fetch(`/api/socavones/connections/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async resolveMapsUrl(url: string): Promise<{ lat: number; lng: number; source: string; placeName?: string | null }> {
    const res = await fetch('/api/utils/resolve-maps-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'No se pudieron extraer coordenadas' }));
      throw new Error(err.detail || 'Error al resolver la URL de Maps');
    }
    return res.json();
  },
};
