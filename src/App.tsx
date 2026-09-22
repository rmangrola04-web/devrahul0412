import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, 
  Warehouse,
  Lock,
  LayoutDashboard,
  ClipboardList,
  Clock,
  ArrowLeftRight,
  Layers,
  ShieldCheck,
  Navigation,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  HelpCircle,
  History,
  LogOut,
  Sun,
  Moon,
  Truck,
  CloudCheck,
  RefreshCw,
  UserCheck,
  Timer
} from 'lucide-react';
import {
  UserAccount,
  UserRole,
  PlanEntry,
  LoadUnloadEntry,
  SecurityGateEntry,
  TrackingRecord
} from './types';
import {
  DEFAULT_SESSION,
  AuthSession
} from './utils/storage';
import {
  DEFAULT_CREDENTIALS,
  DEFAULT_TRANSPORTERS,
  DEFAULT_VEHICLE_TYPES,
  DEFAULT_SUPERVISORS,
  DEFAULT_LOAD_LOCATIONS,
  DEFAULT_UNLOAD_LOCATIONS
} from './data/defaultData';
import {
  subscribeToOperations,
  subscribeToSecurityLogs,
  subscribeToPlanEntries,
  subscribeToArchivedPlanEntries,
  archivePlanEntriesToFirestore,
  subscribeToTrackingRecords,
  subscribeToUsers,
  subscribeToMasterList,
  saveOperationToFirestore,
  deleteOperationFromFirestore,
  saveSecurityEntryToFirestore,
  deleteSecurityEntryFromFirestore,
  savePlanEntriesToFirestore,
  deletePlanEntryFromFirestore,
  saveTrackingRecordsToFirestore,
  deleteTrackingRecordFromFirestore,
  saveUserToFirestore,
  syncMasterListToFirestore,
  COLLECTIONS
} from './services/firestoreService';

// Modals
import { APP_VERSION, getAppVersion, incrementAppVersion } from './config';
import { VersionModal } from './components/VersionModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { RegisterModal } from './components/RegisterModal';
import { EditOperationModal } from './components/EditOperationModal';
import { EditSecurityModal } from './components/EditSecurityModal';
import { FinishLoadModal } from './components/FinishLoadModal';
import { TransportMasterModal } from './components/TransportMasterModal';
import { LocationMasterModal } from './components/LocationMasterModal';

// Views
import { DashboardView } from './views/DashboardView';
import { useWMSData } from './hooks/useWMSData';
import { PlanView } from './views/PlanView';
import { LoadUnloadView } from './views/LoadUnloadView';
import { LiveDocksView } from './views/LiveDocksView';
import { GateSecurityView } from './views/GateSecurityView';
import { TrackingView } from './views/TrackingView';
import { ReportsView } from './views/ReportsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DailyMisAnalyticsView } from './views/DailyMisAnalyticsView';
import { WaitingQueueView } from './views/WaitingQueueView';
import { PerformanceSummaryView } from './views/PerformanceSummaryView';
import { MasterLogsView } from './views/MasterLogsView';

export default function App() {
  // Theme state (robust persistence)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('wms_theme') || localStorage.getItem('themePrefs') as any;
      if (['dark', 'light'].includes(saved)) return saved;
    } catch(e) {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('wms_theme', theme);
      localStorage.setItem('themePrefs', theme);
    } catch(e) {}
  }, [theme]);

  // Auth & Session State (Default Active Admin Session with 1-click Role Selector)
  const [currentUser, setCurrentUser] = useState<AuthSession>(DEFAULT_SESSION);
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_CREDENTIALS);
  const [loginRole, setLoginRole] = useState<UserRole>('ADMIN');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Active view
  const [activeView, setActiveView] = useState<string>('dashboardView');

  // Live Clock
  const [clock, setClock] = useState('');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);

  // Master Data State (Synchronized with Firestore)
  const [loadLocations, setLoadLocations] = useState<string[]>(DEFAULT_LOAD_LOCATIONS);
  const [unloadLocations, setUnloadLocations] = useState<string[]>(DEFAULT_UNLOAD_LOCATIONS);
  const [supervisors, setSupervisors] = useState<string[]>(DEFAULT_SUPERVISORS);
  const [transporters, setTransporters] = useState<string[]>(DEFAULT_TRANSPORTERS);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(DEFAULT_VEHICLE_TYPES);

  // Operational Data State (CLEAN Firestore live streams - No dummy static items)
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [archivedPlanEntries, setArchivedPlanEntries] = useState<PlanEntry[]>([]);
  const [loadEntries, setLoadEntries] = useState<LoadUnloadEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityGateEntry[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);

  // Dynamic Version State
  const [appVersion, setAppVersion] = useState(() => getAppVersion());
  const triggerVersionIncrement = () => {
    const next = incrementAppVersion();
    setAppVersion(next);
  };



  // Modal States
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const [editingOperation, setEditingOperation] = useState<LoadUnloadEntry | null>(null);
  const [editingSecurity, setEditingSecurity] = useState<SecurityGateEntry | null>(null);
  const [finishingLoadEntry, setFinishingLoadEntry] = useState<LoadUnloadEntry | null>(null);
  const [isRoleBoxSelected, setIsRoleBoxSelected] = useState(false);
  const [initialGateId, setInitialGateId] = useState<string | null>(null);
  const [initialDest, setInitialDest] = useState<{location: string, unit?: string} | null>(null);

  // Apply Theme effect
  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    // Clear old inline styles that might override the CSS variables
    bodyEl.style.backgroundColor = '';
    bodyEl.style.color = '';
    bodyEl.classList.remove('bg-slate-900', 'text-slate-100', 'bg-slate-50', 'text-slate-900');

    // Clean all themes
    htmlEl.classList.remove('dark', 'light');
    bodyEl.classList.remove('dark', 'light');
    htmlEl.removeAttribute('data-theme');

    if (theme === 'dark') {
      htmlEl.classList.add('dark');
      bodyEl.classList.add('dark');
    }
    if (theme === 'light') {
      htmlEl.classList.add('light');
      bodyEl.classList.add('light');
    } else if (theme === 'amoled') {
      htmlEl.setAttribute('data-theme', 'amoled');
      htmlEl.classList.add('dark');
      bodyEl.classList.add('dark');
    } else if (theme === 'cream') {
      htmlEl.setAttribute('data-theme', 'cream');
      htmlEl.classList.add('light');
      bodyEl.classList.add('light');
    } else if (theme === 'material') {
      htmlEl.setAttribute('data-theme', 'material');
    } else if (theme === 'light-brown' || theme === 'glass') {
      // Custom themes using data-theme attribute
      htmlEl.setAttribute('data-theme', theme);
      if (theme === 'glass' || theme === 'light-brown') {
        htmlEl.classList.add('dark');
        bodyEl.classList.add('dark');
      } else {
        bodyEl.classList.add('light');
      }
    }
  }, [theme]);

  // Live Clock effect
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  // ----------------------------------------------------
  // GLOBAL DATE FILTER & AUTO-REFRESH STATE
  // ----------------------------------------------------
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const [filterType, setFilterType] = useState<'DATE' | 'MONTH' | 'RANGE' | 'ALL'>('DATE');
  const [filterValue, setFilterValue] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [filterEndDate, setFilterEndDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const { startIso, endIso } = useMemo(() => {
    if (filterType === 'ALL') return { startIso: undefined, endIso: undefined };
    try {
      if (filterType === 'DATE') {
        const [y, m, d] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'MONTH') {
        const [y, m] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'RANGE') {
        const [sy, sm, sd] = filterValue.split('-').map(Number);
        const [ey, em, ed] = filterEndDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      }
    } catch(err) {
      console.warn("Date parse error", err);
    }
    return { startIso: undefined, endIso: undefined };
  }, [filterType, filterValue, filterEndDate]);

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTIONS (onSnapshot)
  // ----------------------------------------------------

  useEffect(() => {
    // 1. Real-time Operations Listener
    const unsubOps = subscribeToOperations((data) => {
      setLoadEntries(data);
      setIsFirestoreConnected(true);
    }, (err) => {
      console.warn('Firestore ops sync warning:', err);
      setIsFirestoreConnected(false);
    });

    // 2. Real-time Security Logs Listener
    const unsubSec = subscribeToSecurityLogs((data) => {
      setSecurityLogs(data);
    });

    // 3. Real-time Plan Entries Listener
    const unsubPlan = subscribeToPlanEntries((data) => {
      setPlanEntries(data);
    }, undefined, startIso, endIso);
    // 3.5 Real-time Archived Plan Entries
    const unsubArchived = subscribeToArchivedPlanEntries((data) => {
      setArchivedPlanEntries(data);
    }, startIso, endIso);

    // 4. Real-time Vehicle Tracking Listener
    const unsubTrk = subscribeToTrackingRecords((data) => {
      setTrackingRecords(data);
    }, undefined, startIso, endIso);

    // Static master data subscriptions (no date filter needed)
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubTrans = subscribeToMasterList(COLLECTIONS.MASTER_TRANSPORTERS, setTransporters);
    const unsubVeh = subscribeToMasterList(COLLECTIONS.MASTER_VEHICLE_TYPES, setVehicleTypes);
    const unsubLoads = subscribeToMasterList(COLLECTIONS.MASTER_LOAD_LOCATIONS, setLoadLocations);
    const unsubUnloads = subscribeToMasterList(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, setUnloadLocations);
    const unsubSups = subscribeToMasterList(COLLECTIONS.MASTER_SUPERVISORS, setSupervisors);

    return () => {
      unsubOps();
      unsubSec();
      unsubPlan();
      unsubArchived();
      unsubTrk();
      unsubUsers();
      unsubTrans();
      unsubVeh();
      unsubLoads();
      unsubUnloads();
      unsubSups();
    };
  }, [startIso, endIso, refreshTrigger]);

  // Handle Quick Role Change (Instant switch between ADMIN, SUPERVISOR, SECURITY, OPERATOR)
  const handleQuickRoleChange = (newRole: UserRole) => {
    let name = 'Admin Officer';
    if (newRole === 'SUPERVISOR') name = 'Supervisor';
    if (newRole === 'SECURITY') name = 'Security Guard';
    if (newRole === 'OPERATOR') name = 'Dock Operator';

    setCurrentUser({
      user: newRole.toLowerCase(),
      role: newRole,
      name
    });

    if (newRole === 'SECURITY') {
      setActiveView('gateSecView');
    } else if (newRole === 'SUPERVISOR') {
      setActiveView('loadUnloadView');
    } else {
      setActiveView('dashboardView');
    }
  };

  // Unified WMS Engine Data memoized centrally based on global date filter
  const wmsData = useWMSData({
    planEntries,
    archivedPlanEntries,
    loadEntries,
    securityLogs,
    filterType,
    filterValue,
    filterEndDate
  });

  // Pending gate arrivals that haven't been assigned or started (Waiting for Loading / Unloading Queue) dynamically filtered by date
  const waitingQueueCount = wmsData.waitingQueueCount;

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const inputU = loginUser.trim().toLowerCase();
    const inputP = loginPass.trim();

    const matched = users.find((u) => u.user.toLowerCase() === inputU && u.pass === inputP);

    if (matched) {
      setLoginError(false);
      const role = inputU === 'admin' ? 'ADMIN' : matched.role || loginRole;
      const name = matched.name || inputU;
      const session: AuthSession = { user: inputU, role, name };

      setCurrentUser(session);

      if (role === 'SECURITY') {
        setActiveView('gateSecView');
      } else if (role === 'SUPERVISOR') {
        setActiveView('loadUnloadView');
      } else {
        setActiveView('dashboardView');
      }
    } else {
      setLoginError(true);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(DEFAULT_SESSION);
    setLoginUser('');
    setLoginPass('');
    setLoginError(false);
  };

  const handleSwitchView = (view: string) => {
    if (currentUser.role === 'SECURITY' && view !== 'gateSecView') {
      return;
    }
    if (currentUser.role === 'SUPERVISOR' && view !== 'loadUnloadView') {
      return;
    }
    setActiveView(view);
  };

  const toggleTheme = () => {
    const themes: ('light' | 'dark' | 'light-brown' | 'sky-blue')[] = ['light', 'dark', 'light-brown', 'sky-blue'];
    setTheme((prev) => themes[(themes.indexOf(prev) + 1) % themes.length]);
  };

  // User Registration (Saved to Firestore)
  const handleRegisterUser = async (newUser: UserAccount) => {
    try {
      await saveUserToFirestore(newUser);
    } catch (e) {
      console.error('Error saving user to Firestore:', e);
      setUsers((prev) => [...prev, newUser]);
    }
  };

  // Operation Handlers (Saved to Firestore)
  const handleAddOperation = async (newOp: LoadUnloadEntry) => {
    // Instant optimistic UI update
    setLoadEntries((prev) => [newOp, ...prev.filter(op => op.id !== newOp.id)]);
    triggerVersionIncrement();
    try {
      await saveOperationToFirestore(newOp);
    } catch (e) {
      console.error('Error saving operation to Firestore:', e);
    }
  };

  const handleAddOperations = async (newOps: LoadUnloadEntry[]) => {
    if (!newOps || newOps.length === 0) return;
    const newIds = new Set(newOps.map((op) => op.id));
    // Instant optimistic UI update for all operations
    setLoadEntries((prev) => [...newOps, ...prev.filter((op) => !newIds.has(op.id))]);
    triggerVersionIncrement();
    try {
      await Promise.all(newOps.map((op) => saveOperationToFirestore(op)));
      for (const op of newOps) {
        if (op.status === 'LOADED') {
          await syncPlanEntriesOnOperationComplete(op);
        }
      }
    } catch (e) {
      console.error('Error saving bulk operations to Firestore:', e);
    }
  };

  const handleSaveEditOperation = async (updated: LoadUnloadEntry) => {
    // Instant optimistic UI update
    setLoadEntries((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
    triggerVersionIncrement();
    try {
      await saveOperationToFirestore(updated);
      if (updated.status === 'LOADED') {
        await syncPlanEntriesOnOperationComplete(updated);
      }
    } catch (e) {
      console.error('Error updating operation in Firestore:', e);
    }
  };

  const syncPlanEntriesOnOperationComplete = async (completedOp: LoadUnloadEntry) => {
    if (completedOp.opType !== 'LOADING' || completedOp.status !== 'LOADED') return;

    const destinationsToCheck = new Set<string>();
    if (completedOp.toLoc) {
      completedOp.toLoc.split('/').forEach(d => destinationsToCheck.add(d.trim().toUpperCase()));
    }
    if (completedOp.milkRouteDestinations) {
      completedOp.milkRouteDestinations.forEach(m => destinationsToCheck.add(m.location.trim().toUpperCase()));
    }
    if (completedOp.shuttleSteps) {
      completedOp.shuttleSteps.forEach(s => {
        if (s.destination) destinationsToCheck.add(s.destination.trim().toUpperCase());
      });
    }

    const matchingPlans = planEntries.filter(p => {
      const pDest = (p.destination || '').trim().toUpperCase();
      return destinationsToCheck.has(pDest) && (!p.status || p.status !== 'Confirmed Plan');
    });

    if (matchingPlans.length > 0) {
      const updatedPlans = matchingPlans.map(p => ({
        ...p,
        status: 'Confirmed Plan'
      }));
      await handleAddPlanEntries(updatedPlans);
    }
  };

  const handleDeleteOperation = async (id: string) => {
    if (confirm('Are you sure you want to delete this operation record from Firestore?')) {
      // Instant optimistic UI update
      setLoadEntries((prev) => prev.filter((op) => op.id !== id));
      triggerVersionIncrement();
      try {
        await deleteOperationFromFirestore(id);
      } catch (e) {
        console.error('Error deleting operation from Firestore:', e);
      }
    }
  };

  // 2-Step Finish Loading Handlers (Saved to Firestore)
  const handleConfirmFinishLoad = async (entryId: string, totalCases: number, sealNo: string) => {
    const target = loadEntries.find((op) => op.id === entryId);
    if (!target) return;

    const now = new Date().toTimeString().substring(0, 5);
    let duration = target.duration;
    if (target.startTime) {
      const sParts = target.startTime.split(':');
      const eParts = now.split(':');
      let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
      if (diff < 0) diff += 1440;
      duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }

    let updated: LoadUnloadEntry = {
      ...target,
      totalCases,
      sealNo,
      endTime: now,
      duration,
      status: 'LOADED'
    };

    if (target.shuttleSteps && target.currentStepIndex !== undefined) {
      const updatedSteps = [...target.shuttleSteps];
      updatedSteps[target.currentStepIndex] = {
        ...updatedSteps[target.currentStepIndex],
        cases: totalCases,
        endTime: now,
        status: 'COMPLETED'
      };
      
      if (target.currentStepIndex < target.shuttleSteps.length - 1) {
        // Advance to next step
        const nextIndex = target.currentStepIndex + 1;
        const nextStep = updatedSteps[nextIndex];
        updated = {
          ...target,
          shuttleSteps: updatedSteps,
          currentStepIndex: nextIndex,
          status: 'SHUTTLE TRANSIT',
          bayNo: nextStep.bayNo,
          unit: nextStep.unit,
          toLoc: nextStep.destination,
          endTime: '', // clear for next step
          startTime: '', // clear for next step
          operator: nextStep.operator || '',
          totalCases: 0
        };
      } else {
        // Last step finished
        updated = {
          ...updated,
          shuttleSteps: updatedSteps
        };
      }
    }


    try {
      await saveOperationToFirestore(updated);
      triggerVersionIncrement();
      if (updated.status === 'LOADED') {
        await syncPlanEntriesOnOperationComplete(updated);
      }
    } catch (e) {
      console.error('Error finishing load in Firestore:', e);
      setLoadEntries((prev) => prev.map((op) => (op.id === entryId ? updated : op)));
      triggerVersionIncrement();
    }
  };

  const handleFinishUnloadDirect = async (id: string) => {
    const target = loadEntries.find((op) => op.id === id);
    if (!target) return;

    const now = new Date().toTimeString().substring(0, 5);
    let duration = target.duration;
    if (target.startTime) {
      const sParts = target.startTime.split(':');
      const eParts = now.split(':');
      let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
      if (diff < 0) diff += 1440;
      duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }

    const updated: LoadUnloadEntry = {
      ...target,
      endTime: now,
      duration,
      status: 'UNLOADED'
    };

    try {
      await saveOperationToFirestore(updated);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error finishing unload in Firestore:', e);
      setLoadEntries((prev) => prev.map((op) => (op.id === id ? updated : op)));
      triggerVersionIncrement();
    }
  };

  // Security Gate Handlers (Saved to Firestore)
  const handleAddGateEntry = async (newGate: SecurityGateEntry) => {
    if (newGate.loadingExitTime && planEntries.length > 0) {
      const matchingPlans = planEntries.filter(p => {
        const destMatch = p.destination.toUpperCase() === (newGate.toLoc || '').toUpperCase() || (newGate.toLoc || '').toUpperCase().includes(p.destination.toUpperCase());
        const transMatch = !p.transporter || !newGate.transporter || p.transporter.toUpperCase() === newGate.transporter.toUpperCase() || newGate.transporter.toUpperCase().includes(p.transporter.toUpperCase());
        return destMatch && transMatch;
      });
      if (matchingPlans.length > 0) {
        handleArchivePlanEntries(matchingPlans);
      }
    }

    // Always update React state optimistically so UI reflects immediately
    setSecurityLogs((prev) => [newGate, ...prev.filter(g => g.id !== newGate.id)]);
    triggerVersionIncrement();

    try {
      await saveSecurityEntryToFirestore(newGate);
    } catch (e) {
      console.error('Error saving gate entry to Firestore:', e);
    }
  };

  const handleSaveEditSecurity = async (updated: SecurityGateEntry) => {
    if (updated.loadingExitTime && planEntries.length > 0) {
      const matchingPlans = planEntries.filter(p => {
        const destMatch = p.destination.toUpperCase() === (updated.toLoc || '').toUpperCase() || (updated.toLoc || '').toUpperCase().includes(p.destination.toUpperCase());
        const transMatch = !p.transporter || !updated.transporter || p.transporter.toUpperCase() === updated.transporter.toUpperCase() || updated.transporter.toUpperCase().includes(p.transporter.toUpperCase());
        return destMatch && transMatch;
      });
      if (matchingPlans.length > 0) {
        handleArchivePlanEntries(matchingPlans);
      }
    }

    // Always update React state optimistically so UI reflects immediately
    setSecurityLogs((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    triggerVersionIncrement();

    try {
      await saveSecurityEntryToFirestore(updated);
    } catch (e) {
      console.error('Error updating security entry in Firestore:', e);
    }
  };

  const handleDeleteGateEntry = async (
    id: string,
    skipConfirm = false,
    destToRemove?: { location: string; unit?: string }
  ) => {
    if (skipConfirm || confirm('Are you sure you want to delete this vehicle from the waiting queue?')) {
      const existing = securityLogs.find((g) => g.id === id);

      if (
        destToRemove &&
        existing &&
        existing.milkRouteDestinations &&
        existing.milkRouteDestinations.length > 1
      ) {
        // Remove only this specific destination stop from the multi-location entry
        const updatedDests = existing.milkRouteDestinations.filter(
          (d) =>
            !(
              d.location.trim().toLowerCase() === destToRemove.location.trim().toLowerCase() &&
              (!destToRemove.unit || d.unit === destToRemove.unit)
            )
        );
        const updatedEntry: SecurityGateEntry = {
          ...existing,
          milkRouteDestinations: updatedDests,
        };
        setSecurityLogs((prev) => prev.map((g) => (g.id === id ? updatedEntry : g)));
        triggerVersionIncrement();
        try {
          await saveSecurityEntryToFirestore(updatedEntry);
        } catch (e) {
          console.error('Error updating gate destinations in Firestore:', e);
        }
      } else {
        // Immediately and optimistically remove from local state so it never loops back
        setSecurityLogs((prev) => prev.filter((g) => g.id !== id));
        triggerVersionIncrement();
        try {
          await deleteSecurityEntryFromFirestore(id);
        } catch (e) {
          console.error('Error deleting security entry from Firestore:', e);
        }
      }
    }
  };

  // Plan Handlers (Saved to Firestore)
  const handleArchivePlanEntries = async (entries: PlanEntry[]) => {
    try {
      const entryIds = entries.map(e => e.id);
      // Optimistically remove from active plans
      setPlanEntries(prev => prev.filter(p => !entryIds.includes(p.id)));
      // Optimistically add to history
      const archivedEntries = entries.map(e => ({ ...e, status: 'Confirmed Plan' }));
      setArchivedPlanEntries(prev => [...archivedEntries, ...prev]);
      triggerVersionIncrement();
      
      await archivePlanEntriesToFirestore(entries);
    } catch (e) {
      console.error('Error archiving plan entries:', e);
    }
  };

  const handleAddPlanEntries = async (newEntries: PlanEntry[]) => {
    try {
      await savePlanEntriesToFirestore(newEntries);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error saving plan entries to Firestore:', e);
      setPlanEntries((prev) => [...newEntries, ...prev]);
      triggerVersionIncrement();
    }
  };

  const handleDeletePlanEntry = async (id: string) => {
    // Instant optimistic UI update
    setPlanEntries((prev) => prev.filter((p) => p.id !== id));
    setArchivedPlanEntries((prev) => prev.filter((p) => p.id !== id));
    triggerVersionIncrement();
    try {
      await deletePlanEntryFromFirestore(id);
    } catch (e) {
      console.error('Error deleting plan entry from Firestore:', e);
    }
  };

  // Tracking Handlers (Saved to Firestore)
  const handleAddTrackingRecords = async (newRecords: TrackingRecord[]) => {
    try {
      await saveTrackingRecordsToFirestore(newRecords);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error saving tracking records to Firestore:', e);
      setTrackingRecords((prev) => [...newRecords, ...prev]);
      triggerVersionIncrement();
    }
  };

  const handleDeleteTrackingRecord = async (id: string) => {
    // Instant optimistic UI update
    setTrackingRecords((prev) => prev.filter((t) => t.id !== id));
    triggerVersionIncrement();
    try {
      await deleteTrackingRecordFromFirestore(id);
    } catch (e) {
      console.error('Error deleting tracking record from Firestore:', e);
    }
  };

  // Master Import Handlers (Synced to Firestore)
  const handleImportLocationMaster = async (newLoads: string[], newUnloads: string[]) => {
    setLoadLocations(newLoads);
    setUnloadLocations(newUnloads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_LOAD_LOCATIONS, newLoads);
    await syncMasterListToFirestore(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, newUnloads);
  };

  const handleUpdateLoadLocations = async (newLoads: string[]) => {
    setLoadLocations(newLoads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_LOAD_LOCATIONS, newLoads);
  };

  const handleUpdateUnloadLocations = async (newUnloads: string[]) => {
    setUnloadLocations(newUnloads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, newUnloads);
  };

  const handleImportSupervisorMaster = async (newSups: string[]) => {
    setSupervisors(newSups);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_SUPERVISORS, newSups);
  };

  const handleUpdateTransporters = async (newTrans: string[]) => {
    setTransporters(newTrans);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_TRANSPORTERS, newTrans);
  };

  const handleUpdateVehicleTypes = async (newVehs: string[]) => {
    setVehicleTypes(newVehs);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_VEHICLE_TYPES, newVehs);
  };

  // 1. If not logged in, render the secure authentication screen
  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-800 text-slate-100 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-700">
          <div className="text-center space-y-1.5 pb-2 border-b border-slate-700/80">
            <div className="inline-flex p-2.5 bg-blue-600 rounded-md text-white shadow-xs">
              <Warehouse className="w-6 h-6" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">Integrated Central Hub - Indore</h1>
            <p className="text-[11px] text-slate-400 font-medium">Logistics & Warehouse Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Role</label>
              <select
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value as UserRole)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="ADMIN">Admin (Full Control)</option>
                <option value="SUPERVISOR">Supervisor (Plan & Loading Ops)</option>
                <option value="SECURITY">Security Guard (Gate In / Out)</option>
                <option value="OPERATOR">Operator (Live View)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Username</label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="Enter username (e.g. admin or supervisor)"
                required
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Enter password (e.g. admin123 or super123)"
                required
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {loginError && (
              <div className="text-xs text-rose-300 font-medium bg-rose-950/60 p-2.5 rounded border border-rose-800">
                Invalid credentials. Default: <b>admin / admin123</b> or <b>supervisor / super123</b>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded text-xs transition shadow-xs flex items-center justify-center gap-2 mt-1"
            >
              <Lock className="w-3.5 h-3.5" /> Secure Authentication
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                + Register New Account
              </button>
            </div>
          </form>
        </div>

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onRegister={handleRegisterUser}
        />
      </div>
    );
  }

  const isSecurity = currentUser.role === 'SECURITY';
  const isSupervisor = currentUser.role === 'SUPERVISOR';
  const isFullAccess = currentUser.role === 'ADMIN' || currentUser.role === 'OPERATOR';

  // 2. Main Application Screen (High Density Architecture)
  return (
    <div className="min-h-screen max-w-full overflow-x-hidden w-full flex flex-col selection:bg-blue-600 selection:text-white">
      <div className="flex flex-1 min-h-0 w-full max-w-full overflow-x-hidden">
        {/* Left Sidebar - Modern Clean White / Pastel Blue Navigation */}
        <aside className="hidden md:flex w-72 bg-white text-slate-700 border-r border-slate-200/80 flex-col justify-between p-4 min-h-screen sticky top-0 shrink-0 select-none shadow-xs">
          <div className="space-y-4">
            {/* Header Brand & Title Section */}
            <div className="border-b border-slate-100 pb-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-sm shadow-blue-500/25 shrink-0">
                R
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 leading-snug">Integrated Central Hub</h2>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Indore WMS Portal</p>
              </div>
            </div>

            {/* Role Selector Box (Modern Pastel Accent) */}
            <div 
              onClick={() => setIsRoleBoxSelected(!isRoleBoxSelected)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                isRoleBoxSelected 
                  ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-xs' 
                  : 'bg-blue-50/70 border-blue-200/80 text-blue-900 hover:bg-blue-100/60'
              }`}
              title="Click to toggle selection / switch role"
            >
              <div className="flex items-center gap-2 text-xs font-semibold w-full">
                <span>👤</span>
                <select
                  value={currentUser.role}
                  onChange={(e) => {
                    handleQuickRoleChange(e.target.value as UserRole);
                    setIsRoleBoxSelected(true);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent font-bold outline-none cursor-pointer w-full text-slate-800 border-0 p-0 text-xs"
                  title="Switch Role"
                >
                  <option value="ADMIN" className="bg-white text-slate-800">Role: Admin (Full Access)</option>
                  <option value="OPERATOR" className="bg-white text-slate-800">Role: Operator (Full Access)</option>
                  <option value="SUPERVISOR" className="bg-white text-slate-800">Role: Supervisor (Load/Unload Only)</option>
                  <option value="SECURITY" className="bg-white text-slate-800">Role: Security Guard (Gate Movement Only)</option>
                </select>
              </div>
              <span className="text-[10px] text-slate-400">▼</span>
            </div>

            {/* Navigation Menu */}
            <div className="space-y-1">
              {isSecurity ? (
                <button
                  onClick={() => handleSwitchView('gateSecView')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Security Gate Movement</span>
                  {securityLogs.length > 0 && (
                    <span className="ml-auto bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono">
                      {securityLogs.length}
                    </span>
                  )}
                </button>
              ) : isSupervisor ? (
                <>
                  <button
                    onClick={() => handleSwitchView('waitingQueueView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'waitingQueueView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-amber-500'}`} />
                    <span>Waiting for Loading / Unloading</span>
                    {waitingQueueCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'waitingQueueView' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {waitingQueueCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <ArrowLeftRight className={`w-4 h-4 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-emerald-500'}`} />
                    <span>Loading / Unloading</span>
                    {loadEntries.length > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'loadUnloadView' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {loadEntries.length}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSwitchView('dashboardView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'dashboardView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <LayoutDashboard className={`w-4 h-4 ${activeView === 'dashboardView' ? 'text-white' : 'text-blue-600'}`} />
                    <span>Dashboard</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('planView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'planView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardList className={`w-4 h-4 ${activeView === 'planView' ? 'text-white' : 'text-amber-500'}`} />
                    <span>Plan View</span>
                    {planEntries.length > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'planView' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {planEntries.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('waitingQueueView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'waitingQueueView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-amber-500'}`} />
                    <span>Waiting for Loading / Unloading</span>
                    {waitingQueueCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'waitingQueueView' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 border border-amber-200/80'
                      }`}>
                        {waitingQueueCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <ArrowLeftRight className={`w-4 h-4 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-emerald-500'}`} />
                    <span>Load / Unload Ops</span>
                    {loadEntries.length > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'loadUnloadView' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {loadEntries.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('liveDocksView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'liveDocksView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${activeView === 'liveDocksView' ? 'text-white' : 'text-indigo-500'}`} />
                    <span>Live Docks (1-9)</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('gateSecView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'gateSecView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 ${activeView === 'gateSecView' ? 'text-white' : 'text-emerald-500'}`} />
                    <span>Gate Security</span>
                    {securityLogs.length > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'gateSecView' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {securityLogs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('trackingView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'trackingView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <Navigation className={`w-4 h-4 ${activeView === 'trackingView' ? 'text-white' : 'text-rose-500'}`} />
                    <span>Vehicle Tracking Record</span>
                    {trackingRecords.length > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'trackingView' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {trackingRecords.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('masterLogsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'masterLogsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${activeView === 'masterLogsView' ? 'text-white' : 'text-indigo-500'}`} />
                    <span>Master Logs</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('reportsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'reportsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${activeView === 'reportsView' ? 'text-white' : 'text-purple-500'}`} />
                    <span>Reports & Master Data</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('analyticsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'analyticsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className={`w-4 h-4 ${activeView === 'analyticsView' ? 'text-white' : 'text-cyan-600'}`} />
                    <span>Graphic Analytics</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('dailyMisAnalyticsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'dailyMisAnalyticsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className={`w-4 h-4 ${activeView === 'dailyMisAnalyticsView' ? 'text-white' : 'text-emerald-600'}`} />
                    <span>Daily MIS Analytics</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('performanceSummaryView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'performanceSummaryView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <Timer className={`w-4 h-4 ${activeView === 'performanceSummaryView' ? 'text-white' : 'text-amber-500'}`} />
                    <span>Performance Summary</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Sidebar Bottom Utilities */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {/* User Details Box */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/25 shrink-0">
                {currentUser.name
                  ? currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .substring(0, 2)
                  : 'RM'}
              </div>
              <div className="overflow-hidden flex-1">
                <h3 className="text-xs font-bold text-slate-900 truncate leading-none">{currentUser.name}</h3>
                <p className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wide mt-1">{currentUser.role}</p>
              </div>
            </div>

            <div className={isFullAccess ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5'}>
              {isFullAccess && (
                <button
                  onClick={() => setIsTransportModalOpen(true)}
                  className="px-2 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                  title="Transport Master"
                >
                  <Truck className="w-3.5 h-3.5 text-blue-600" /> Transport
                </button>
              )}
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className={`px-2 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition ${!isFullAccess ? 'w-full' : ''}`}
                title="Help & Support"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> Help & Support
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsVersionModalOpen(true)}
                className="flex-1 px-2 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 rounded-xl text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition"
              >
                <History className="w-3 h-3 text-slate-500" /> <span id="sidebar-version-display">{appVersion}</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden bg-[var(--bg-main)] text-slate-900 dark:text-slate-100">
          {/* Top Header - Modern Clean Utility Toolbar */}
          <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Integrated Central Hub Indore</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                    WMS Cloud Live
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Auto-Refresh Toggle */}
              <div className="flex items-center gap-1.5 hidden md:flex mr-1">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                  title="Auto-refresh data every 30 seconds"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">{autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}</span>
                </button>
              </div>

              {/* Global Date Filter */}
              <div className="flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-1.5 text-xs shadow-2xs hidden md:flex">
                <div className="flex items-center pr-2 border-r border-slate-200 mr-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
                  <select 
                    value={filterType} 
                    onChange={(e) => {
                      setFilterType(e.target.value as 'DATE' | 'MONTH' | 'RANGE' | 'ALL');
                      if (e.target.value === 'MONTH') setFilterValue(filterValue.substring(0, 7));
                    }}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="DATE">Day</option>
                    <option value="MONTH">Month</option>
                    <option value="RANGE">Date Range</option>
                    <option value="ALL">All Time</option>
                  </select>
                </div>
                {filterType !== 'ALL' && filterType !== 'RANGE' && (
                  <input 
                    type={filterType === 'MONTH' ? 'month' : 'date'}
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[115px] text-xs"
                  />
                )}
                {filterType === 'RANGE' && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="date"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[110px] text-xs"
                    />
                    <span className="text-slate-400 font-bold px-1">to</span>
                    <input 
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[110px] text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Quick Transport Master Trigger */}
              {isFullAccess && (
                <button
                  onClick={() => setIsTransportModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs font-semibold hidden sm:flex items-center gap-1.5 transition"
                >
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Transport Master</span>
                </button>
              )}

              {/* Theme Toggle & Selector */}
              <div className="flex items-center gap-1">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  title="Select Theme Mode"
                >
                  <option value="dark">Dark Mode</option>
                  <option value="light">Light Mode</option>
                </select>

                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-full px-3.5 py-2 shadow-2xs transition touch-manipulation cursor-pointer"
                  title="Toggle Dark/Light Mode"
                >
                  {theme === 'light' ? (
                    <>
                      <Moon className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-700 hidden sm:inline">Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-200 hidden sm:inline">Light</span>
                    </>
                  )}
                </button>
              </div>

              {/* Firestore Real-Time Status Indicator */}
              <div
                className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
                  isFirestoreConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFirestoreConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono text-[10px] font-bold">
                  {isFirestoreConnected ? 'FIRESTORE LIVE SYNC' : 'SYNCING...'}
                </span>
              </div>

              <div className="font-mono text-xs text-slate-600 font-bold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl hidden sm:inline-block">
                {clock}
              </div>
            </div>
          </header>

          {/* Main Content Views */}
          <main className="px-1.5 py-2 sm:px-4 md:px-6 pb-28 md:pb-6 space-y-3 sm:space-y-5 flex-1 w-full max-w-full overflow-x-hidden">
            {isSecurity ? (
              <GateSecurityView
                activeOperations={loadEntries}
                onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                securityLogs={securityLogs}
                transporters={transporters}
                vehicleTypes={vehicleTypes}
                loadLocations={loadLocations}
                unloadLocations={unloadLocations}
                planEntries={planEntries}
                onAddGateEntry={handleAddGateEntry}
                onEditGateEntry={(entry) => setEditingSecurity(entry)}
                onDeleteGateEntry={handleDeleteGateEntry}
              />
            ) : isSupervisor ? (
              activeView === 'waitingQueueView' ? (
                <WaitingQueueView
                  loadEntries={loadEntries}
                  securityLogs={securityLogs}
                  transporters={transporters}
                  vehicleTypes={vehicleTypes}
                  loadLocations={loadLocations}
                  unloadLocations={unloadLocations}
                  globalFilterType={filterType}
                  globalFilterValue={filterValue}
                  globalFilterEndDate={filterEndDate}
                  onGlobalDateFilterChange={(type, val, endVal) => {
                    setFilterType(type);
                    if (val) setFilterValue(val);
                    if (endVal) setFilterEndDate(endVal);
                  }}
                  onSelectVehicle={(gateId, dest) => {
                    setInitialGateId(gateId);
                    if (dest) setInitialDest(dest);
                    else setInitialDest(null);
                    handleSwitchView('loadUnloadView');
                  }}
                  onAddGateEntry={handleAddGateEntry}
                  onDeleteGateEntry={handleDeleteGateEntry}
                  onEditGateEntry={handleSaveEditSecurity}
                />
              ) : (
                <LoadUnloadView
                  initialGateId={initialGateId}
                  initialDest={initialDest}
                  onClearInitialGateId={() => {
                    setInitialGateId(null);
                    setInitialDest(null);
                  }}
                  loadEntries={wmsData.filteredLoadEntries}
                  securityLogs={wmsData.filteredSecurityLogs}
                  allSecurityLogs={securityLogs}
                  supervisors={supervisors}
                  transporters={transporters}
                  loadLocations={loadLocations}
                  unloadLocations={unloadLocations}
                  selectedDate={filterValue}
                  globalFilterType={filterType}
                  globalFilterValue={filterValue}
                  globalFilterEndDate={filterEndDate}
                  onAddOperation={handleAddOperation}
                  onAddOperations={handleAddOperations}
                  onEditOperation={(entry) => setEditingOperation(entry)}
                  onDeleteOperation={handleDeleteOperation}
                  onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                  onFinishUnloadDirect={handleFinishUnloadDirect}
                  onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                />
              )
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                {activeView === 'dashboardView' && (
                  <DashboardView
                    planEntries={planEntries}
                    archivedPlanEntries={archivedPlanEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    precomputedWmsData={wmsData}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}
                    onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                    onNavigateToPlans={() => handleSwitchView('planView')}
                    onDeleteGateEntry={handleDeleteGateEntry}
                  />
                )}

                {activeView === 'planView' && (
                  <PlanView
                    planEntries={planEntries}
                    onAddPlanEntries={handleAddPlanEntries}
                    onDeletePlanEntry={handleDeletePlanEntry}
                    onArchivePlanEntries={handleArchivePlanEntries}
                  />
                )}

                {activeView === 'waitingQueueView' && (
                  <WaitingQueueView
                    loadEntries={wmsData.filteredLoadEntries}
                    securityLogs={wmsData.filteredSecurityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}
                    onAddGateEntry={handleAddGateEntry}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    onEditGateEntry={handleSaveEditSecurity}
                  />
                )}

                {activeView === 'loadUnloadView' && (
                  <LoadUnloadView
                    initialGateId={initialGateId}
                    initialDest={initialDest}
                    onClearInitialGateId={() => {
                      setInitialGateId(null);
                      setInitialDest(null);
                    }}
                    loadEntries={wmsData.filteredLoadEntries}
                    securityLogs={wmsData.filteredSecurityLogs}
                    allSecurityLogs={securityLogs}
                    supervisors={supervisors}
                    transporters={transporters}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    selectedDate={filterValue}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onAddOperation={handleAddOperation}
                    onAddOperations={handleAddOperations}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                    onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                  />
                )}

                {activeView === 'liveDocksView' && (
                  <LiveDocksView loadEntries={loadEntries} onUpdateOperation={async (op) => { 
                    await saveOperationToFirestore(op); 
                    if (op.status === 'LOADED') {
                      await syncPlanEntriesOnOperationComplete(op);
                    }
                  }} onEditOperation={(entry) => setEditingOperation(entry)} />
                )}

                {activeView === 'gateSecView' && (
                  <GateSecurityView
                    activeOperations={wmsData.filteredLoadEntries}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    securityLogs={securityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    planEntries={wmsData.filteredPlans}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onAddGateEntry={handleAddGateEntry}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteGateEntry={handleDeleteGateEntry}
                  />
                )}

                {activeView === 'trackingView' && (
                  <TrackingView
                    trackingRecords={trackingRecords}
                    onAddTrackingRecords={handleAddTrackingRecords}
                    onDeleteTrackingRecord={handleDeleteTrackingRecord}
                  />
                )}

                {activeView === 'masterLogsView' && (
                  <MasterLogsView
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    globalFilterValue={filterValue}
                    globalFilterType={filterType}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                  />
                )}

                {activeView === 'reportsView' && (
                  <ReportsView
                    planEntries={[...planEntries, ...archivedPlanEntries]}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    onOpenTransportMasterModal={() => setIsTransportModalOpen(true)}
                    onOpenLocationMasterModal={() => setIsLocationModalOpen(true)}
                    onImportLocationMaster={handleImportLocationMaster}
                    onImportSupervisorMaster={handleImportSupervisorMaster}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    onDeletePlanEntry={handleDeletePlanEntry}
                  />
                )}
                {activeView === 'analyticsView' && (
                  <AnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}
                {activeView === 'dailyMisAnalyticsView' && (
                  <DailyMisAnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}
                {activeView === 'performanceSummaryView' && (
                  <PerformanceSummaryView
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    planEntries={planEntries}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                  />
                )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>

        {/* High Density Status Footer */}
        <footer className="h-9 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 px-4 md:px-6 flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              ICH Indore Warehouse Node
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <span className="hidden sm:inline font-mono">
              Active Ops: {loadEntries.length} | Gate In/Out: {securityLogs.length} | Plans: {planEntries.length}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              Real-time Firestore (ich-indore-v3)
            </span>
          </div>
        </footer>
      </div>
    </div>

      {/* Mobile Bottom Navigation Bar (Visible Strictly on Mobile Screens <= 768px, Hidden completely on Desktop/Laptop) */}
      <div className="mobile-bottom-nav mobile-bottom-dock hidden max-md:flex md:hidden fixed bottom-0 left-0 right-0 w-full max-w-full px-1.5 py-1.5 justify-around items-center z-50 overflow-x-auto no-scrollbar bg-slate-900 border-t border-sky-500/40 shadow-2xl">
        {isSecurity ? (
          <button
            onClick={() => handleSwitchView('gateSecView')}
            className="flex-1 max-w-[100px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold touch-manipulation cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 mb-0.5 text-white" />
            <span className="font-bold tracking-wide leading-none text-white">Gate</span>
          </button>
        ) : isSupervisor ? (
          <>
            <button
              onClick={() => handleSwitchView('waitingQueueView')}
              className={`flex-1 max-w-[120px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'waitingQueueView'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className={`w-5 h-5 mb-0.5 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'waitingQueueView' ? 'text-white font-bold' : 'text-slate-300'}`}>Wait</span>
            </button>
            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={`flex-1 max-w-[120px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'loadUnloadView'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'loadUnloadView' ? 'text-white font-bold' : 'text-slate-300'}`}>Ops</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleSwitchView('dashboardView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'dashboardView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeView === 'dashboardView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'dashboardView' ? 'text-white font-bold' : 'text-slate-300'}`}>Dash</span>
            </button>

            <button
              onClick={() => handleSwitchView('planView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'planView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ClipboardList className={`w-5 h-5 mb-0.5 ${activeView === 'planView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'planView' ? 'text-white font-bold' : 'text-slate-300'}`}>Plan</span>
            </button>

            <button
              onClick={() => handleSwitchView('waitingQueueView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'waitingQueueView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className={`w-5 h-5 mb-0.5 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'waitingQueueView' ? 'text-white font-bold' : 'text-slate-300'}`}>Wait</span>
            </button>

            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'loadUnloadView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'loadUnloadView' ? 'text-white font-bold' : 'text-slate-300'}`}>Ops</span>
            </button>

            <button
              onClick={() => handleSwitchView('liveDocksView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'liveDocksView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className={`w-5 h-5 mb-0.5 ${activeView === 'liveDocksView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'liveDocksView' ? 'text-white font-bold' : 'text-slate-300'}`}>Docks</span>
            </button>

            <button
              onClick={() => handleSwitchView('gateSecView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'gateSecView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 mb-0.5 ${activeView === 'gateSecView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'gateSecView' ? 'text-white font-bold' : 'text-slate-300'}`}>Gate</span>
            </button>

            <button
              onClick={() => handleSwitchView('masterLogsView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'masterLogsView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 mb-0.5 ${activeView === 'masterLogsView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'masterLogsView' ? 'text-white font-bold' : 'text-slate-300'}`}>Logs</span>
            </button>

            <button
              onClick={() => handleSwitchView('reportsView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'reportsView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 mb-0.5 ${activeView === 'reportsView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'reportsView' ? 'text-white font-bold' : 'text-slate-300'}`}>Reports</span>
            </button>
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] text-slate-300 hover:text-white touch-manipulation cursor-pointer"
            >
              <HelpCircle className="w-5 h-5 mb-0.5 text-sky-400" />
              <span className="font-semibold tracking-wide leading-none text-slate-300">Help</span>
            </button>
          </>
        )}
      </div>

      {/* Modals */}
      <VersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        appVersion={appVersion}
      />

      <HelpSupportModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        appVersion={appVersion}
      />

      <TransportMasterModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        transporters={transporters}
        vehicleTypes={vehicleTypes}
        onUpdateTransporters={handleUpdateTransporters}
        onUpdateVehicleTypes={handleUpdateVehicleTypes}
      />

      <LocationMasterModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        loadLocations={loadLocations}
        unloadLocations={unloadLocations}
        onUpdateLoadLocations={handleUpdateLoadLocations}
        onUpdateUnloadLocations={handleUpdateUnloadLocations}
      />

      {editingOperation && (
        <EditOperationModal
          isOpen={true}
          entry={editingOperation}
          loadEntries={loadEntries}
          supervisors={supervisors}
          transporters={transporters}
          loadLocations={loadLocations}
          unloadLocations={unloadLocations}
          onClose={() => setEditingOperation(null)}
          onSave={handleSaveEditOperation}
        />
      )}

      {editingSecurity && (
        <EditSecurityModal
          isOpen={true}
          entry={editingSecurity}
          transporters={transporters}
          vehicleTypes={vehicleTypes}
          loadLocations={loadLocations}
          unloadLocations={unloadLocations}
          onClose={() => setEditingSecurity(null)}
          onSave={handleSaveEditSecurity}
        />
      )}

      {finishingLoadEntry && (
        <FinishLoadModal
          isOpen={true}
          entry={finishingLoadEntry}
          onClose={() => setFinishingLoadEntry(null)}
          onConfirm={handleConfirmFinishLoad}
        />
      )}


    </div>
  );
}
