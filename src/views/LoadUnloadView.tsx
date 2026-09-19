import React, { useState, useMemo } from 'react';
import { ArrowLeftRight, Link as LinkIcon, Play, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoadUnloadEntry, SecurityGateEntry } from '../types';
import { DOCK_CONFIG } from '../data/defaultData';
import { matchesWmsDateFilter, getGateRecordDate } from '../utils/wmsDataEngine';

interface LoadUnloadViewProps {
  initialGateId?: string | null;
  initialDest?: {location: string, unit?: string} | null;
  onClearInitialGateId?: () => void;
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  supervisors: string[];
  transporters: string[];
  loadLocations: string[];
  unloadLocations: string[];
  selectedDate?: string;
  globalFilterType?: string;
  globalFilterValue?: string;
  globalFilterEndDate?: string;
  onAddOperation: (newOp: LoadUnloadEntry) => Promise<void> | void;
  onNavigateToQueue?: () => void;
}

export const LoadUnloadView: React.FC<LoadUnloadViewProps> = ({
  initialGateId,
  initialDest,
  onClearInitialGateId,
  loadEntries,
  securityLogs,
  supervisors,
  transporters,
  loadLocations,
  unloadLocations,
  selectedDate,
  globalFilterType,
  globalFilterValue,
  globalFilterEndDate,
  onAddOperation,
  onNavigateToQueue
}) => {
  const [selectedGateId, setSelectedGateId] = useState(initialGateId || '');
  
  React.useEffect(() => {
    if (initialGateId) {
      handleGateSelect(initialGateId, initialDest);
      if (onClearInitialGateId) {
        onClearInitialGateId();
      }
    }
  }, [initialGateId, initialDest]);

  const [opType, setOpType] = useState<'LOADING' | 'UNLOADING'>('LOADING');
  const activeDashboardDate = selectedDate || globalFilterValue || new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState<string>(() => activeDashboardDate);

  React.useEffect(() => {
    if (selectedDate) {
      setEntryDate(selectedDate);
    } else if (globalFilterValue) {
      setEntryDate(globalFilterValue);
    }
  }, [selectedDate, globalFilterValue]);

  const [unit, setUnit] = useState('AHPL');
  const [bayNo, setBayNo] = useState('Dock 1');
  const [vehicleNo, setVehicleNo] = useState('');
  const [isVehicleLocked, setIsVehicleLocked] = useState(false);
  const [fromLoc, setFromLoc] = useState('INDORE HUB');
  const [toLoc, setToLoc] = useState('');
  const [transporter, setTransporter] = useState(transporters[0] || 'DHTC');
  const [operator, setOperator] = useState(supervisors[0] || 'Rahul Mangrola');
  const [sealNumber, setSealNumber] = useState('');
  const [vType, setVType] = useState('32SXL');
  const [startTime, setStartTime] = useState(() => new Date().toTimeString().substring(0, 5));

  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [savedDetails, setSavedDetails] = useState<{ vehicle: string; bay: string; opType: string } | null>(null);

  const occupiedDocks = React.useMemo(() => {
    const map = new Map<string, string>();
    loadEntries.forEach(item => {
      const st = (item.status || '').toUpperCase().trim();
      const isCompleted =
        st === 'LOADED' ||
        st === 'UNLOADED' ||
        st === 'COMPLETED' ||
        st === 'DISPATCHED' ||
        st === 'DONE' ||
        st === 'FINISHED' ||
        st === 'EXITED' ||
        st.includes('LOADED') ||
        st.includes('UNLOADED') ||
        st.includes('COMPLETED') ||
        st.includes('DISPATCHED') ||
        st.includes('DONE') ||
        st.includes('FINISHED') ||
        st.includes('EXITED');

      if (!isCompleted) {
        if (item.shuttleSteps && item.shuttleSteps.length > 0) {
          const activeStep =
            item.shuttleSteps.find(s => s.status === 'IN-PROGRESS') ||
            item.shuttleSteps.find(s => s.status === 'PENDING');
          if (activeStep && activeStep.bayNo && activeStep.status !== 'COMPLETED') {
            map.set(activeStep.bayNo, item.vehicleNo);
          }
        } else if (item.bayNo && item.bayNo !== 'Unassigned') {
          map.set(item.bayNo, item.vehicleNo);
        }
      }
    });
    return map;
  }, [loadEntries]);

  // Handle unit change
  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    const available = DOCK_CONFIG[newUnit] || DOCK_CONFIG['AHPL'];
    setBayNo(available[0]);
  };

  // Auto-pick current time
  const handlePickCurrentTime = () => {
    const now = new Date();
    setStartTime(now.toTimeString().substring(0, 5));
  };

  const handleGateSelect = (gateId: string, specificDest?: {location: string, unit?: string} | null) => {
    setSelectedGateId(gateId);
    
    if (gateId.startsWith('SHUTTLE_')) {
      const realId = gateId.replace('SHUTTLE_', '');
      const shuttle = loadEntries.find(l => l.id === realId);
      if (shuttle && shuttle.shuttleSteps && shuttle.currentStepIndex !== undefined) {
        const activeStep = shuttle.shuttleSteps[shuttle.currentStepIndex];
        setVehicleNo(shuttle.vehicleNo);
        setIsVehicleLocked(true);
        setTransporter(shuttle.transporter);
        setOpType('LOADING');
        setUnit(activeStep.unit);
        setBayNo(activeStep.bayNo);
        setToLoc(activeStep.destination);
        setFromLoc('INDORE HUB');
        handlePickCurrentTime();
      }
      return;
    }
    
    if (!gateId) {
      setIsVehicleLocked(false);
      setVehicleNo('');
      setFromLoc('INDORE HUB');
      setToLoc('');
      return;
    }

    const gate = securityLogs.find((s) => s.id === gateId);
    if (!gate) return;

    setVehicleNo(gate.vehicle);
    setIsVehicleLocked(true);
    if (gate.transporter && transporters.includes(gate.transporter)) {
      setTransporter(gate.transporter);
    }

    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      setFromLoc('INDORE HUB');
      
      if (specificDest) {
        if (specificDest.unit) handleUnitChange(specificDest.unit);
        setToLoc(specificDest.location);
      } else {
        if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
          handleUnitChange(gate.unit);
        }
        if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
          const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? `${m.location} (${m.unit})` : m.location).join(' / ');
          setToLoc(combinedDest);
        } else {
          setToLoc(gate.toLoc || '');
        }
      }
    } else {
      setOpType('UNLOADING');
      setToLoc('INDORE HUB');
      
      if (specificDest) {
        if (specificDest.unit) handleUnitChange(specificDest.unit);
        setFromLoc(specificDest.location);
      } else {
        if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
          handleUnitChange(gate.unit);
        }
        if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
          const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? `${m.location} (${m.unit})` : m.location).join(' / ');
          setFromLoc(combinedDest);
        } else {
          setFromLoc(gate.fromLoc || '');
        }
      }
    }

    handlePickCurrentTime();
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) {
      alert('Please enter a vehicle number');
      return;
    }
    
    // Prevent submitting to an occupied dock
    const occupant = occupiedDocks.get(bayNo);
    if (occupant && occupant.toUpperCase() !== vehicleNo.trim().toUpperCase()) {
      alert(`${bayNo} is currently Occupied by vehicle ${occupant}. Please select an available dock.`);
      return;
    }
    
    try {
      const isUnloading = opType === 'UNLOADING';

      const gateMatch = securityLogs.find((s) => s.id === selectedGateId || (s.vehicle === vehicleNo.trim().toUpperCase() && s.purpose === 'Unloading'));
      const opGrNo = isUnloading ? (gateMatch?.grNo || '') : '';

      const newOp: LoadUnloadEntry = {
        entryDate: entryDate || gateMatch?.entryDate || new Date().toISOString().split('T')[0],
        gateId: selectedGateId,
        id: `OP-${Date.now()}`,
        opType,
        unit,
        bayNo,
        vehicleNo: vehicleNo.trim().toUpperCase(),
        fromLoc: fromLoc.trim().toUpperCase(),
        toLoc: toLoc.trim().toUpperCase(),
        transporter,
        operator: operator.trim(),
        startTime: startTime || new Date().toTimeString().substring(0, 5),
        endTime: '',
        duration: '-- In Progress --',
        status: opType === 'LOADING' ? 'LOADING IN-PROGRESS' : 'UNLOADING IN-PROGRESS',
        totalCases: totalCases ? Number(totalCases) : 0,
        damagedCases: 0,
        damagedValue: 0,
        podStatus: 'N/A',
        grNo: opGrNo,
        sealNo: sealNumber.trim() || undefined,
        remarks: ''
      };
      await onAddOperation(newOp);

      // Trigger animated success notification
      setSavedDetails({
        vehicle: newOp.vehicleNo,
        bay: newOp.bayNo,
        opType: newOp.opType
      });
      setShowSuccessToast(true);

      // Automatically reset / clear all form fields (blank out)
      setSelectedGateId('');
      setIsVehicleLocked(false);
      setVehicleNo('');
      setFromLoc(opType === 'LOADING' ? 'INDORE HUB' : '');
      setToLoc(opType === 'UNLOADING' ? 'INDORE HUB' : '');
      setTotalCases('');
      setSealNumber('');
      setVType('');
      setOperator(supervisors[0] || '');
      setTransporter(transporters[0] || '');
      handlePickCurrentTime();

      // Auto dismiss success toast after 4 seconds
      setTimeout(() => {
        setShowSuccessToast(false);
      }, 4000);
      
    } catch (err) {
      console.error('Error starting operation:', err);
      alert('Failed to submit. Please check missing fields or connection.');
    }
  };

  // Active target date for arrived vehicles waiting queue: strictly matches selectedDate / active dashboard date
  const targetFilterDate = selectedDate || globalFilterValue || entryDate;

  // Pending gate arrivals that haven't been started yet
  const usedGateIds = useMemo(() => new Set(loadEntries.map((l) => l.gateId).filter(Boolean)), [loadEntries]);

  const pendingGateLogs = useMemo(() => {
    return securityLogs.filter((veh) => {
      if (veh.purpose === 'Parking / Transit') return false;

      // Strict Current-Date Filter: Vehicle must have arrived on the active date
      const sDate = getGateRecordDate(veh);
      const isDateMatched = matchesWmsDateFilter(
        sDate,
        targetFilterDate,
        targetFilterDate,
        globalFilterEndDate,
        globalFilterType || 'DATE'
      );
      if (!isDateMatched) return false;

      // Strict status filter: Exclude non-waiting statuses
      const nonWaitingStatuses = [
        'COMPLETED',
        'CLOSED',
        'LOADED',
        'UNLOADED',
        'EXITED',
        'DISPATCHED',
        'DOCK ASSIGNED',
        'IN DOCK',
        'LOADING IN-PROGRESS',
        'UNLOADING IN-PROGRESS',
        'IN-PROGRESS',
        'SHUTTLE TRANSIT',
        'CANCELLED',
        'REJECTED',
        'OUT',
        'GATE OUT'
      ];
      const statusUpper = (veh.status || '').trim().toUpperCase();
      if (nonWaitingStatuses.some(st => statusUpper.includes(st))) return false;
      if ((veh as any).completed === true) return false;

      // Skip if dock already assigned on security log
      if (veh.assignedDock && veh.assignedDock !== 'Unassigned' && veh.assignedDock.trim() !== '') return false;
      if (veh.bayNo && veh.bayNo !== 'Unassigned' && veh.bayNo.trim() !== '') return false;

      // Skip if exit time logged
      if (veh.loadingExitTime && veh.loadingExitTime.trim() !== '') return false;
      if ((veh as any).exitTime && (veh as any).exitTime.trim() !== '') return false;
      if ((veh as any).gateOutTime && (veh as any).gateOutTime.trim() !== '') return false;
      if ((veh as any).exitDateTime && (veh as any).exitDateTime.trim() !== '') return false;

      // 1. If it was explicitly processed with gateId logic
      if (usedGateIds.has(veh.id)) return false;

      // 2. If it's a vehicle that currently has an ACTIVE operation or assigned dock in loadEntries
      const vehClean = (veh.vehicle || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const hasActiveOp = loadEntries.some((l) => {
        const isNotFinished = l.status !== 'LOADED' && l.status !== 'UNLOADED' && l.status !== 'COMPLETED';
        const lClean = (l.vehicleNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return isNotFinished && lClean && lClean === vehClean;
      });
      if (hasActiveOp) return false;

      return true;
    });
  }, [securityLogs, targetFilterDate, globalFilterEndDate, globalFilterType, usedGateIds, loadEntries]);

  // Clean up selectedGateId if it is no longer valid in current pendingGateLogs
  React.useEffect(() => {
    if (selectedGateId && !selectedGateId.startsWith('SHUTTLE_') && !pendingGateLogs.some((p) => p.id === selectedGateId)) {
      setSelectedGateId('');
    }
  }, [pendingGateLogs, selectedGateId]);

  return (
    <div id="loading-operations-wrapper" className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Floating Animated Success Toast Notification */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="fixed top-6 right-4 sm:right-8 z-50 flex items-center gap-3.5 bg-emerald-600 dark:bg-emerald-700 text-white px-5 py-4 rounded-2xl shadow-2xl border border-emerald-400/40 max-w-md"
          >
            <div className="bg-white/20 p-2.5 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="flex-1 pr-1">
              <div className="flex items-center gap-1.5 font-black text-sm tracking-wide">
                <span>Data Successfully Saved!</span>
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
              </div>
              {savedDetails && (
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  {savedDetails.opType} operation for <span className="font-bold font-mono text-white underline">{savedDetails.vehicle}</span> at <span className="font-bold text-white">{savedDetails.bay}</span> saved &amp; started. Form cleared.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessToast(false)}
              className="text-emerald-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Close message"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-3 sm:p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
        
        {/* Title Block */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-blue-600" /> Operational Entry Form
            </h2>
            <p className="text-xs text-slate-400 mt-1">Initiate a loading or unloading sequence for active gate-ins.</p>
          </div>
          <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800 shrink-0">
            Active Stage: Start
          </span>
        </div>

        {/* Inline Animated Success Banner */}
        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-xs font-semibold">
                  <span className="font-bold">Success!</span> Data saved successfully. All form fields have been automatically reset.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Link Arrived Vehicle from Gate */}
          <div className="bg-blue-50/70 dark:bg-slate-900/90 p-3.5 rounded-xl border border-blue-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5" /> Select Arrived Vehicle from Gate
              </label>
              {onNavigateToQueue && (
                <button
                  type="button"
                  onClick={onNavigateToQueue}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 hover:underline cursor-pointer"
                  title="Open Waiting for Loading / Unloading Queue"
                >
                  <span>Waiting Queue ({pendingGateLogs.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <select
              id="select-arrived-vehicle-gate"
              value={selectedGateId}
              onChange={(e) => handleGateSelect(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">
                {pendingGateLogs.length === 0
                  ? `-- No Arrived Vehicles for ${targetFilterDate || 'Today'} (0) --`
                  : `-- Choose Arrived Vehicle (Auto-Fill) --`}
              </option>
              {pendingGateLogs.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  🚛 {veh.vehicle} | {veh.transporter || 'Transp'} | {veh.purpose} ({veh.purpose === 'Loading' ? `To: ${veh.toLoc}` : `From: ${veh.fromLoc}`})
                </option>
              ))}
            </select>

            {pendingGateLogs.length > 0 ? (
              <div className="pt-1.5">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Quick Select Waiting Vehicle:</span>
                  <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">{pendingGateLogs.length} Waiting</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                  {pendingGateLogs.slice(0, 8).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleGateSelect(v.id)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
                        selectedGateId === v.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50'
                      }`}
                    >
                      <span>{v.vehicle}</span>
                      <span className="text-[8px] font-sans font-bold opacity-75">{v.purpose === 'Loading' ? '⬆' : '⬇'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-1 text-[10px] text-slate-500 dark:text-slate-400 italic px-1 flex items-center justify-between">
                <span>No arrived vehicles waiting at gate for {targetFilterDate || 'today'}.</span>
                <span className="text-[9px] font-mono text-slate-400 font-semibold">(0 waiting)</span>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Operation Date *
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Operation Activity Switcher */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Operation Activity *
            </label>
            <select
              value={opType}
              onChange={(e) => {
                const val = e.target.value as 'LOADING' | 'UNLOADING';
                setOpType(val);
                if (val === 'LOADING') {
                  setFromLoc('INDORE HUB');
                  setToLoc('');
                } else {
                  setFromLoc('');
                  setToLoc('INDORE HUB');
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-black text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="LOADING">⬆ START LOADING (Status: LOADING IN-PROGRESS)</option>
              <option value="UNLOADING">⬇ START UNLOADING (Status: UNLOADING IN-PROGRESS)</option>
            </select>
          </div>

          {/* Assigned Dock & Supervisor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Assigned Dock *
              </label>
              <select
                value={bayNo}
                onChange={(e) => setBayNo(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'].map((d) => {
                  const occupant = occupiedDocks.get(d);
                  return (
                    <option key={d} value={d} className={occupant ? 'text-rose-500 font-bold' : 'text-slate-700'}>
                      {d} {occupant ? `(Occupied: ${occupant})` : '(Available)'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Supervisor *
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">-- Select Supervisor --</option>
                {supervisors.map((sup) => (
                  <option key={sup} value={sup}>
                    👤 {sup}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vehicle & Division */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Vehicle No *
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="MP-09-AB-1234"
                disabled={isVehicleLocked}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Division / Company *
              </label>
              <select
                value={unit}
                onChange={(e) => {
                  const u = e.target.value;
                  setUnit(u);
                  if (u.includes('AIL')) {
                    setOpType('LOADING');
                    setFromLoc('INDORE HUB');
                    setToLoc('');
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="AHPL">AHPL</option>
                <option value="AIL">AIL (Strictly Loading Only)</option>
              </select>
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                From Location *
              </label>
              <select
                value={fromLoc}
                onChange={(e) => setFromLoc(e.target.value)}
                disabled={opType === 'LOADING'}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2 text-xs font-bold text-slate-800 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">-- Choose Origin --</option>
                {unloadLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                To Location *
              </label>
              <select
                value={toLoc}
                onChange={(e) => setToLoc(e.target.value)}
                disabled={opType === 'UNLOADING'}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2 text-xs font-bold text-slate-800 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">-- Choose Destination --</option>
                {loadLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    🏁 {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transporter & Vehicle Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Transporter Name *
              </label>
              <select
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">-- Select Transporter --</option>
                {transporters.map((tr) => (
                  <option key={tr} value={tr}>
                    🚚 {tr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Vehicle Type (vType) *
              </label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">-- Select Type --</option>
                {['32SXL', '32MXL', '20FT', '24FT', 'PART_LOAD', 'REFRIGERATED', 'OPEN_TRUCK', 'TEMPO'].map((vt) => (
                  <option key={vt} value={vt}>
                    🚛 {vt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Case Count & Time Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Total Planned Cases *
              </label>
              <input
                type="number"
                value={totalCases}
                onChange={(e) => setTotalCases(Number(e.target.value) || '')}
                placeholder="Planned Box Count"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Start In-Time *
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="HH:MM"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setStartTime(new Date().toTimeString().substring(0, 5))}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3.5 rounded-xl border border-slate-300 dark:border-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Now
                </button>
              </div>
            </div>
          </div>

          {/* Action Processing Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-md mt-4 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-300" /> Save Changes &amp; Start Operation
          </button>
        </form>
      </div>
    </div>
  );
};
