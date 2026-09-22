import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { WorkersView } from './components/WorkersView';
import { MonitoringView } from './components/MonitoringView';
import { AIModelView } from './components/AIModelView';
import { AlertsView } from './components/AlertsView';
import { ReportsView } from './components/ReportsView';
import { HistoryView } from './components/HistoryView';
import { UsersSecurityView } from './components/UsersSecurityView';
import { SocavonesView } from './components/SocavonesView';
import { SmartphoneSimulatorModal } from './components/SmartphoneSimulatorModal';
import { LivePhoneConnectModal } from './components/LivePhoneConnectModal';
import { PostgresSchemaModal } from './components/PostgresSchemaModal';
import { MobileTransmitterView } from './components/MobileTransmitterView';
import { LoginView } from './components/LoginView';
import { api } from './lib/api';
import { playEmergencySiren } from './lib/soundEffects';
import { 
  Worker, 
  Alert, 
  SensorTelemetry, 
  SystemUser, 
  AuditLog, 
  UserRole,
  AlertStatus,
  MineTunnel,
  TunnelConnection
} from './types';
import { INITIAL_WORKERS, INITIAL_ALERTS, SYSTEM_USERS, AUDIT_LOGS, generateInitialTelemetryHistory } from './lib/mockData';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('m10_auth_token'));
  });

  // Persistent Module Navigation with Browser History Integration
  const [currentModule, setCurrentModule] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab') || params.get('mod');
    if (tabFromUrl) return tabFromUrl;
    return localStorage.getItem('m10_last_module') || 'dashboard';
  });

  const [navigationHistory, setNavigationHistory] = useState<string[]>([currentModule]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Core Data States
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [selectedWorker, setSelectedWorker] = useState<Worker>(INITIAL_WORKERS[0]);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [telemetryHistory, setTelemetryHistory] = useState<SensorTelemetry[]>(() => generateInitialTelemetryHistory(INITIAL_WORKERS[0].id));
  const [users, setUsers] = useState<SystemUser[]>(SYSTEM_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(AUDIT_LOGS);
  const [tunnels, setTunnels] = useState<MineTunnel[]>([]);
  const [connections, setConnections] = useState<TunnelConnection[]>([]);
  const [currentUser, setCurrentUser] = useState<SystemUser>(() => {
    try {
      const stored = localStorage.getItem('m10_auth_user');
      return stored ? JSON.parse(stored) : SYSTEM_USERS[0];
    } catch {
      return SYSTEM_USERS[0];
    }
  });

  // Modals and Audio
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isPhoneConnectModalOpen, setIsPhoneConnectModalOpen] = useState(false);
  const [isPostgresModalOpen, setIsPostgresModalOpen] = useState(false);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);

  // Load initial state from backend
  const loadData = useCallback(async () => {
    try {
      const [fetchedWorkers, fetchedAlerts, fetchedStats, fetchedTunnels, fetchedConns, fetchedUsers, fetchedLogs] = await Promise.all([
        api.getWorkers(),
        api.getAlerts(),
        api.getStats(),
        api.getSocavones().catch(() => []),
        api.getTunnelConnections().catch(() => []),
        api.getUsers().catch(() => []),
        api.getAuditLogs().catch(() => []),
      ]);

      if (fetchedWorkers && fetchedWorkers.length > 0) {
        setWorkers(fetchedWorkers);
        // keep selected worker up to date
        setSelectedWorker((prev) => fetchedWorkers.find((w: Worker) => w.id === prev.id) || fetchedWorkers[0]);
      }
      if (fetchedAlerts) {
        setAlerts(fetchedAlerts);
      }
      if (fetchedTunnels && fetchedTunnels.length > 0) {
        setTunnels(fetchedTunnels);
      }
      if (fetchedConns) {
        setConnections(fetchedConns);
      }
      if (fetchedUsers && fetchedUsers.length > 0) {
        // Asegurar que todos los trabajadores registrados tengan cuenta visible en 9. Usuarios
        const existingIds = new Set(fetchedUsers.map((u: SystemUser) => u.workerId || u.dni).filter(Boolean));
        const additionalWorkerUsers: SystemUser[] = (fetchedWorkers || [])
          .filter((w: Worker) => !existingIds.has(w.id) && !existingIds.has(w.dni))
          .map((w: Worker) => ({
            id: `u-worker-${w.id}`,
            name: w.name,
            email: w.email || `${w.dni}@mina.pe`,
            dni: w.dni,
            password: w.dni,
            role: 'trabajador',
            avatar: w.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            lastLogin: 'En línea',
            sectorAssigned: w.sector,
            workerId: w.id,
            status: 'activo',
          }));
        setUsers([...fetchedUsers, ...additionalWorkerUsers]);
      }
      if (fetchedLogs && fetchedLogs.length > 0) {
        setAuditLogs(fetchedLogs);
      }
    } catch (err) {
      console.warn('Using client-side fallback data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Fast periodic refresh (2s normal, 1s if modal is open)
    const refreshMs = (isSimModalOpen || isPhoneConnectModalOpen) ? 1200 : 2000;
    const interval = setInterval(loadData, refreshMs);
    return () => clearInterval(interval);
  }, [loadData, isSimModalOpen, isPhoneConnectModalOpen]);

  // Navigation that syncs with real browser history
  const navigateTo = useCallback((module: string, replace = false) => {
    if (module === currentModule) return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', module);

    if (replace) {
      window.history.replaceState({ module }, '', url.toString());
    } else {
      window.history.pushState({ module }, '', url.toString());
    }

    setNavigationHistory((prev) => [...prev, module]);
    setCurrentModule(module);
    localStorage.setItem('m10_last_module', module);
  }, [currentModule]);

  // Handle going back cleanly without closing the application
  const handleGoBack = useCallback(() => {
    // If any modal is open, close it first
    if (isSimModalOpen) {
      setIsSimModalOpen(false);
      return;
    }
    if (isPhoneConnectModalOpen) {
      setIsPhoneConnectModalOpen(false);
      return;
    }
    if (isPostgresModalOpen) {
      setIsPostgresModalOpen(false);
      return;
    }

    // If there is history within the session
    if (navigationHistory.length > 1) {
      window.history.back();
    } else if (currentModule !== 'dashboard') {
      navigateTo('dashboard');
    }
  }, [isSimModalOpen, isPhoneConnectModalOpen, isPostgresModalOpen, navigationHistory.length, currentModule, navigateTo]);

  // Browser History (popstate) & Modal dismissal on Back
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('tab') && !url.searchParams.has('mobile')) {
      url.searchParams.set('tab', currentModule);
      window.history.replaceState({ module: currentModule }, '', url.toString());
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. If any modal is open, close modal and stay on module
      if (isSimModalOpen) {
        setIsSimModalOpen(false);
        return;
      }
      if (isPhoneConnectModalOpen) {
        setIsPhoneConnectModalOpen(false);
        return;
      }
      if (isPostgresModalOpen) {
        setIsPostgresModalOpen(false);
        return;
      }

      // 2. Read module from history state or URL parameter
      const params = new URLSearchParams(window.location.search);
      const modFromParam = params.get('tab') || params.get('mod');
      const targetModule = event.state?.module || modFromParam || 'dashboard';

      setCurrentModule(targetModule);
      setNavigationHistory((prev) => {
        if (prev.length > 1) {
          return prev.slice(0, -1);
        }
        return [targetModule];
      });
      localStorage.setItem('m10_last_module', targetModule);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentModule, isSimModalOpen, isPhoneConnectModalOpen, isPostgresModalOpen]);

  // Keyboard Navigation Shortcuts (Alt + ArrowLeft to Go Back, Alt + 1-9 to Switch Modules)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Alt + LeftArrow: Go Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
        return;
      }

      // Alt + 1 to 9: Direct Module Jump
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const map: Record<string, string> = {
          '1': 'dashboard',
          '2': 'workers',
          '3': 'monitoring',
          '4': 'socavones',
          '5': 'ai_model',
          '6': 'alerts',
          '7': 'reports',
          '8': 'history',
          '9': 'users',
        };
        const target = map[e.key];
        if (target) navigateTo(target);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGoBack, navigateTo]);

  // Handle worker selection
  const handleSelectWorker = (worker: Worker) => {
    setSelectedWorker(worker);
  };

  // Handle create / update worker
  const handleSaveWorker = async (workerData: Partial<Worker>) => {
    if (workerData.id) {
      const updated = await api.updateWorker(workerData.id, workerData);
      setWorkers(prev => prev.map(w => w.id === updated.id ? updated : w));
      if (selectedWorker.id === updated.id) setSelectedWorker(updated);

      // Sincronizar en lista de usuarios
      const workerEmail = updated.email || `${updated.dni}@mina.pe`;
      setUsers(prev => {
        const idx = prev.findIndex(u => u.workerId === updated.id || u.dni === updated.dni);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            name: updated.name,
            email: workerEmail,
            dni: updated.dni,
            password: updated.dni,
            sectorAssigned: updated.sector,
          };
          return copy;
        }
        return [...prev, {
          id: `u-worker-${updated.id}`,
          name: updated.name,
          email: workerEmail,
          dni: updated.dni,
          password: updated.dni,
          role: 'trabajador',
          avatar: updated.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          lastLogin: 'En línea',
          sectorAssigned: updated.sector,
          workerId: updated.id,
          status: 'activo',
        }];
      });
    } else {
      const created = await api.createWorker(workerData);
      setWorkers(prev => [created, ...prev]);
      setSelectedWorker(created);

      // Crear cuenta en users
      const workerEmail = created.email || `${created.dni}@mina.pe`;
      const newWorkerUser: SystemUser = {
        id: `u-worker-${created.id}`,
        name: created.name,
        email: workerEmail,
        dni: created.dni,
        password: created.dni,
        role: 'trabajador',
        avatar: created.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        lastLogin: 'En línea',
        sectorAssigned: created.sector,
        workerId: created.id,
        status: 'activo',
      };
      setUsers(prev => [...prev, newWorkerUser]);
    }
  };

  const handleDeleteWorker = async (id: string) => {
    await api.deleteWorker(id);
    setWorkers(prev => prev.filter(w => w.id !== id));
    if (selectedWorker.id === id) {
      const remaining = workers.filter(w => w.id !== id);
      if (remaining.length > 0) setSelectedWorker(remaining[0]);
    }
  };

  // Handle stream custom telemetry (from Simulator, Real Phone, or Auto)
  const handleStreamTelemetry = async (payload: any) => {
    try {
      const res = await api.streamTelemetry(payload);
      
      // Update worker in state
      if (res.worker) {
        setWorkers(prev => prev.map(w => w.id === res.worker.id ? res.worker : w));
        if (selectedWorker.id === res.worker.id) setSelectedWorker(res.worker);
      }

      // Add to telemetry series
      if (res.telemetry) {
        setTelemetryHistory(prev => [...prev.slice(-49), res.telemetry]);
      }

      // If new alert triggered
      if (res.newAlert) {
        setAlerts(prev => [res.newAlert, ...prev]);
        if (res.newAlert.priority === 'critica' || res.newAlert.priority === 'alta') {
          playEmergencySiren(res.newAlert.priority === 'critica' ? 'critica' : 'alta');
        }
      }

      return res;
    } catch (err) {
      console.error('Error streaming telemetry:', err);
      throw err;
    }
  };

  // Handle alert update (Attend / Resolve)
  const handleUpdateAlert = async (id: string, data: { status?: AlertStatus; attendedBy?: string; resolutionNotes?: string }) => {
    const updated = await api.updateAlert(id, data);
    setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  // Handle Role switch for RBAC testing
  const handleRoleChange = (role: UserRole) => {
    const userMatch = users.find(u => u.role === role) || users[0];
    setCurrentUser(userMatch);
    localStorage.setItem('m10_auth_user', JSON.stringify(userMatch));
  };

  const handleSelectUserSession = (user: SystemUser) => {
    setCurrentUser(user);
    localStorage.setItem('m10_auth_user', JSON.stringify(user));
  };

  // User CRUD handlers (Users & Security module)
  const handleCreateUser = async (data: any) => {
    const newUser = await api.createUser(data);
    setUsers((prev) => [...prev, newUser]);
    api.getAuditLogs().then((logs) => setAuditLogs(logs)).catch(() => {});
  };

  const handleUpdateUser = async (id: string, data: any) => {
    try {
      const updated = await api.updateUser(id, data);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated, ...data } : u)));
      if (currentUser.id === id) {
        const merged = { ...currentUser, ...updated, ...data };
        setCurrentUser(merged);
        localStorage.setItem('m10_auth_user', JSON.stringify(merged));
      }
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
      if (currentUser.id === id) {
        const merged = { ...currentUser, ...data };
        setCurrentUser(merged);
        localStorage.setItem('m10_auth_user', JSON.stringify(merged));
      }
    }
    api.getAuditLogs().then((logs) => setAuditLogs(logs)).catch(() => {});
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.deleteUser(id);
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== id));
    api.getAuditLogs().then((logs) => setAuditLogs(logs)).catch(() => {});
  };

  // Handle Login & Logout
  const handleLoginSuccess = (user: SystemUser) => {
    if (user.status === 'inhabilitado') {
      alert('Acceso denegado: Tu cuenta de usuario se encuentra inhabilitada.');
      return;
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('m10_auth_token', 'true');
    localStorage.setItem('m10_auth_user', JSON.stringify(user));
  };

  const handleLogout = async () => {
    await api.logout();
    localStorage.removeItem('m10_auth_token');
    localStorage.removeItem('m10_auth_user');
    setIsAuthenticated(false);
  };

  // Detect Mobile Sensor Hub mode (via QR code or direct mobile URL)
  const urlParams = new URLSearchParams(window.location.search);
  const isMobileMode = urlParams.get('mobile') === '1' || urlParams.get('mode') === 'phone';
  const targetWorkerId = urlParams.get('workerId') || urlParams.get('worker');

  if (isMobileMode) {
    const mobileWorker = 
      (targetWorkerId ? workers.find(w => w.id === targetWorkerId) : null) || 
      workers.find(w => w.code === 'MIN-087') ||
      selectedWorker || 
      workers[0];

    return (
      <MobileTransmitterView
        worker={mobileWorker}
        onBackToApp={() => {
          window.location.href = window.location.pathname;
        }}
        onWorkerUpdated={(upd) => {
          setWorkers(prev => prev.map(w => w.id === upd.id ? upd : w));
          if (selectedWorker.id === upd.id) setSelectedWorker(upd);
        }}
      />
    );
  }

  // If not authenticated, display LoginView
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const activeAlertsCount = alerts.filter(a => a.status === 'activa').length;
  const criticalAlertsCount = alerts.filter(a => a.status === 'activa' && a.priority === 'critica').length;
  const highRiskWorkersCount = workers.filter(w => w.riskLevel === 'alto').length;

  return (
    <div className="min-h-screen bg-[#0F1115] text-gray-200 flex flex-col md:flex-row antialiased selection:bg-[#D4AF37] selection:text-black">
      
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={currentModule as any}
        onSelectTab={(mod) => {
          navigateTo(mod);
          setIsSidebarOpen(false);
        }}
        activeAlertsCount={activeAlertsCount}
        criticalAlertsCount={criticalAlertsCount}
        highRiskWorkersCount={highRiskWorkersCount}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSimulator={() => setIsSimModalOpen(true)}
        onOpenLiveMobile={() => setIsPhoneConnectModalOpen(true)}
        onOpenPostgresSchema={() => setIsPostgresModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Top Header with Back Button and Breadcrumbs */}
        <Header
          currentUser={currentUser}
          onRoleChange={handleRoleChange}
          audioAlertsEnabled={audioAlertsEnabled}
          onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
          onOpenSimulator={() => setIsSimModalOpen(true)}
          onOpenLiveMobile={() => setIsPhoneConnectModalOpen(true)}
          onOpenPostgresSchema={() => setIsPostgresModalOpen(true)}
          criticalAlertsCount={criticalAlertsCount}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onNavigateAlerts={() => navigateTo('alerts')}
          currentModule={currentModule}
          canGoBack={navigationHistory.length > 1 || currentModule !== 'dashboard'}
          onGoBack={handleGoBack}
          onNavigate={navigateTo}
        />

        {/* Dynamic View Router */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">
          {currentModule === 'dashboard' && (
            <DashboardView
              workers={workers}
              alerts={alerts}
              tunnels={tunnels}
              connections={connections}
              onNavigate={navigateTo}
              onNavigateToTab={navigateTo}
              onSelectWorker={(w) => {
                handleSelectWorker(w);
                navigateTo('monitoring');
              }}
            />
          )}

          {currentModule === 'workers' && (
            <WorkersView
              workers={workers}
              tunnels={tunnels}
              onSaveWorker={handleSaveWorker}
              onCreateWorker={handleSaveWorker}
              onUpdateWorker={(id, data) => handleSaveWorker({ ...data, id })}
              onDeleteWorker={handleDeleteWorker}
              onSelectWorker={handleSelectWorker}
              onSelectWorkerForMonitoring={(w) => {
                setSelectedWorker(w);
                navigateTo('monitoring');
              }}
              onNavigateToMonitoring={(w) => {
                setSelectedWorker(w);
                navigateTo('monitoring');
              }}
              onOpenPairingModal={(w) => {
                setSelectedWorker(w);
                setIsPhoneConnectModalOpen(true);
              }}
            />
          )}

          {currentModule === 'monitoring' && (
            <MonitoringView
              workers={workers}
              selectedWorker={selectedWorker}
              onSelectWorker={handleSelectWorker}
              telemetryHistory={telemetryHistory}
              onStreamCustomTelemetry={handleStreamTelemetry}
            />
          )}

          {currentModule === 'socavones' && (
            <SocavonesView
              tunnels={tunnels}
              connections={connections}
              onTunnelsChange={setTunnels}
              onConnectionsChange={setConnections}
              onNavigateToMonitoring={() => navigateTo('monitoring')}
            />
          )}

          {currentModule === 'ai_model' && (
            <AIModelView
              workers={workers}
              selectedWorker={selectedWorker}
            />
          )}

          {currentModule === 'alerts' && (
            <AlertsView
              alerts={alerts}
              workers={workers}
              onUpdateAlert={handleUpdateAlert}
              onPlaySiren={(p) => playEmergencySiren(p)}
            />
          )}

          {currentModule === 'reports' && (
            <ReportsView
              workers={workers}
              alerts={alerts}
            />
          )}

          {currentModule === 'history' && (
            <HistoryView
              workers={workers}
              selectedWorker={selectedWorker}
              onSelectWorker={handleSelectWorker}
              telemetryHistory={telemetryHistory}
            />
          )}

          {(currentModule === 'users' || currentModule === 'security') && (
            <UsersSecurityView
              users={users}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onRoleChange={handleRoleChange}
              onSelectUserSession={handleSelectUserSession}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onReloadUsers={loadData}
            />
          )}
        </main>
      </div>

      {/* Interactive Smartphone Sensor Simulator Modal */}
      <SmartphoneSimulatorModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        workers={workers}
        selectedWorkerId={selectedWorker?.id}
        onStreamTelemetry={handleStreamTelemetry}
      />

      {/* Real Phone Connect & REST API Modal */}
      <LivePhoneConnectModal
        isOpen={isPhoneConnectModalOpen}
        onClose={() => setIsPhoneConnectModalOpen(false)}
        workers={workers}
        selectedWorker={selectedWorker}
        onStreamTelemetry={handleStreamTelemetry}
        onOpenSimulatorForWorker={(w) => {
          setSelectedWorker(w);
          setIsPhoneConnectModalOpen(false);
          setIsSimModalOpen(true);
        }}
      />

      {/* PostgreSQL Relational Schema DDL Modal */}
      <PostgresSchemaModal
        isOpen={isPostgresModalOpen}
        onClose={() => setIsPostgresModalOpen(false)}
      />

    </div>
  );
}
