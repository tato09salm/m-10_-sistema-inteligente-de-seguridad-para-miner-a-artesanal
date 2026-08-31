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
import { SmartphoneSimulatorModal } from './components/SmartphoneSimulatorModal';
import { LivePhoneConnectModal } from './components/LivePhoneConnectModal';
import { PostgresSchemaModal } from './components/PostgresSchemaModal';
import { api } from './lib/api';
import { playEmergencySiren } from './lib/soundEffects';
import { 
  Worker, 
  Alert, 
  SensorTelemetry, 
  SystemUser, 
  AuditLog, 
  UserRole,
  AlertStatus 
} from './types';
import { INITIAL_WORKERS, INITIAL_ALERTS, SYSTEM_USERS, AUDIT_LOGS, generateInitialTelemetryHistory } from './lib/mockData';

export default function App() {
  const [currentModule, setCurrentModule] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Core Data States
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [selectedWorker, setSelectedWorker] = useState<Worker>(INITIAL_WORKERS[0]);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [telemetryHistory, setTelemetryHistory] = useState<SensorTelemetry[]>(() => generateInitialTelemetryHistory(INITIAL_WORKERS[0].id));
  const [users, setUsers] = useState<SystemUser[]>(SYSTEM_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(AUDIT_LOGS);
  const [currentUser, setCurrentUser] = useState<SystemUser>(SYSTEM_USERS[0]);

  // Modals and Audio
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isPhoneConnectModalOpen, setIsPhoneConnectModalOpen] = useState(false);
  const [isPostgresModalOpen, setIsPostgresModalOpen] = useState(false);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);

  // Load initial state from backend
  const loadData = useCallback(async () => {
    try {
      const [fetchedWorkers, fetchedAlerts, fetchedStats] = await Promise.all([
        api.getWorkers(),
        api.getAlerts(),
        api.getStats(),
      ]);

      if (fetchedWorkers && fetchedWorkers.length > 0) {
        setWorkers(fetchedWorkers);
        // keep selected worker up to date
        setSelectedWorker((prev) => fetchedWorkers.find((w: Worker) => w.id === prev.id) || fetchedWorkers[0]);
      }
      if (fetchedAlerts) {
        setAlerts(fetchedAlerts);
      }
    } catch (err) {
      console.warn('Using client-side fallback data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Periodic refresh
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

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
    } else {
      const created = await api.createWorker(workerData);
      setWorkers(prev => [created, ...prev]);
      setSelectedWorker(created);
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
  };

  const activeAlertsCount = alerts.filter(a => a.status === 'activa').length;

  const criticalAlertsCount = alerts.filter(a => a.status === 'activa' && a.priority === 'critica').length;
  const highRiskWorkersCount = workers.filter(w => w.riskLevel === 'alto').length;

  return (
    <div className="min-h-screen bg-[#0F1115] text-gray-200 flex flex-col md:flex-row antialiased selection:bg-[#D4AF37] selection:text-black">
      
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={currentModule as any}
        onSelectTab={(mod) => {
          setCurrentModule(mod);
          setIsSidebarOpen(false);
        }}
        activeAlertsCount={activeAlertsCount}
        criticalAlertsCount={criticalAlertsCount}
        highRiskWorkersCount={highRiskWorkersCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          onRoleChange={handleRoleChange}
          audioAlertsEnabled={audioAlertsEnabled}
          onToggleAudio={() => setAudioAlertsEnabled(!audioAlertsEnabled)}
          onOpenSimulator={() => setIsSimModalOpen(true)}
          onOpenLiveMobile={() => setIsPhoneConnectModalOpen(true)}
          onOpenPostgresSchema={() => setIsPostgresModalOpen(true)}
          criticalAlertsCount={criticalAlertsCount}
        />

        {/* Dynamic View Router */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">
          {currentModule === 'dashboard' && (
            <DashboardView
              workers={workers}
              alerts={alerts}
              onNavigate={setCurrentModule}
              onSelectWorker={handleSelectWorker}
            />
          )}

          {currentModule === 'workers' && (
            <WorkersView
              workers={workers}
              onSaveWorker={handleSaveWorker}
              onCreateWorker={handleSaveWorker}
              onUpdateWorker={(id, data) => handleSaveWorker({ ...data, id })}
              onDeleteWorker={handleDeleteWorker}
              onSelectWorker={handleSelectWorker}
              onSelectWorkerForMonitoring={(w) => {
                setSelectedWorker(w);
                setCurrentModule('monitoring');
              }}
              onNavigateToMonitoring={(w) => {
                setSelectedWorker(w);
                setCurrentModule('monitoring');
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

          {currentModule === 'users' && (
            <UsersSecurityView
              users={users}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onRoleChange={handleRoleChange}
            />
          )}
        </main>
      </div>

      {/* Interactive Smartphone Sensor Simulator Modal */}
      <SmartphoneSimulatorModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        workers={workers}
        onStreamTelemetry={handleStreamTelemetry}
      />

      {/* Real Phone Connect & REST API Modal */}
      <LivePhoneConnectModal
        isOpen={isPhoneConnectModalOpen}
        onClose={() => setIsPhoneConnectModalOpen(false)}
        workers={workers}
        selectedWorker={selectedWorker}
        onStreamTelemetry={handleStreamTelemetry}
      />

      {/* PostgreSQL Relational Schema DDL Modal */}
      <PostgresSchemaModal
        isOpen={isPostgresModalOpen}
        onClose={() => setIsPostgresModalOpen(false)}
      />

    </div>
  );
}
