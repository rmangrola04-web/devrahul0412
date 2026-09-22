
import React, { useState, useMemo } from 'react';
import { Layers, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoadUnloadEntry } from '../types';
import { DOCK_CONFIG, DEFAULT_SUPERVISORS, DEFAULT_VEHICLE_TYPES } from '../data/defaultData';
import { StartStepModal } from '../components/StartStepModal';
import { FinishStepModal } from '../components/FinishStepModal';
import { AnimatedStatusChip } from '../components/AnimatedStatusChip';
import { isCourierTransporter } from '../utils/wmsDataEngine';

interface LiveDocksViewProps {
  loadEntries: LoadUnloadEntry[];
  onUpdateOperation: (updatedEntry: LoadUnloadEntry) => void;
  onEditOperation: (entry: LoadUnloadEntry) => void;
}

const isOpCompleted = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return (
    s === 'LOADED' ||
    s === 'UNLOADED' ||
    s === 'COMPLETED' ||
    s === 'DISPATCHED' ||
    s === 'DONE' ||
    s === 'FINISHED' ||
    s === 'EXITED' ||
    s.includes('LOADED') ||
    s.includes('UNLOADED') ||
    s.includes('COMPLETED') ||
    s.includes('DISPATCHED') ||
    s.includes('DONE') ||
    s.includes('FINISHED') ||
    s.includes('EXITED')
  );
};

const getActivesForDock = (dockName: string, loadEntries: LoadUnloadEntry[]): LoadUnloadEntry[] => {
  return loadEntries.filter((d) => {
    // 0. Exclude courier transporters from dock occupancy
    if (isCourierTransporter(d.transporter, d.vType || (d as any).vehicleType)) return false;

    // 1. If overall operation status is completed / finished / dispatched / exited, remove from dock immediately!
    if (isOpCompleted(d.status)) return false;

    // 2. If shuttle steps exist, vehicle ONLY belongs to dockName if the active or first non-completed step is at dockName
    if (d.shuttleSteps && d.shuttleSteps.length > 0) {
      const activeStep =
        d.shuttleSteps.find((s) => s.status === 'IN-PROGRESS') ||
        d.shuttleSteps.find((s) => s.status === 'PENDING');
      if (activeStep) {
        return activeStep.bayNo === dockName && activeStep.status !== 'COMPLETED';
      }
      return false; // All steps completed
    }

    // 3. Single-step operation without shuttle steps
    const isAssignedToDock = d.bayNo === dockName || d.assignedDock === dockName;
    const isActiveStatus =
      d.status === 'PENDING' ||
      d.status === 'LOADING IN-PROGRESS' ||
      d.status === 'UNLOADING IN-PROGRESS' ||
      d.status === 'SHUTTLE TRANSIT' ||
      (d.status || '').toUpperCase().includes('IN-PROGRESS');

    return isAssignedToDock && isActiveStatus;
  });
};

export const LiveDocksView: React.FC<LiveDocksViewProps> = ({ loadEntries, onUpdateOperation, onEditOperation }) => {
  const [startingStep, setStartingStep] = useState<{ entry: LoadUnloadEntry; index: number } | null>(null);
  const [finishingStep, setFinishingStep] = useState<{ entry: LoadUnloadEntry; index: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const ahplDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'];
  const commonDocks = ['Dock 5', 'Dock 6'];
  const ailDocks = ['Dock 7', 'Dock 8', 'Dock 9'];
  const allDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'];

  const [maintenanceBays, setMaintenanceBays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('warehouse_maintenance_bays');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleMaintenance = (dockName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = maintenanceBays.includes(dockName)
      ? maintenanceBays.filter(b => b !== dockName)
      : [...maintenanceBays, dockName];
    setMaintenanceBays(updated);
    try {
      localStorage.setItem('warehouse_maintenance_bays', JSON.stringify(updated));
    } catch {}
  };

  const occupancyStats = useMemo(() => {
    let occupied = 0;
    let empty = 0;
    let maintenance = 0;
    allDocks.forEach(dock => {
      if (maintenanceBays.includes(dock)) {
        maintenance++;
      } else if (getActivesForDock(dock, loadEntries).length > 0) {
        occupied++;
      } else {
        empty++;
      }
    });
    return { occupied, empty, maintenance, total: allDocks.length };
  }, [loadEntries, maintenanceBays]);

  const handleStart = (entry: LoadUnloadEntry) => {
    onUpdateOperation(entry);
    setStartingStep(null);
  };

  const handleFinish = (entry: LoadUnloadEntry) => {
    onUpdateOperation(entry);
    setFinishingStep(null);
  };

  const renderDockCard = (dockName: string, activeRecords: LoadUnloadEntry[]) => {
    if (activeRecords.length > 0) {
      const record = activeRecords[0];
      const isLoad = record.opType === 'LOADING';
      const vehicleNo = record.vehicleNo;

      const isAHPL = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'].includes(dockName);
      const isCommon = ['Dock 5', 'Dock 6'].includes(dockName);
      
      const cardColorClass = isAHPL
        ? 'border-l-[6px] border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20 border-t border-r border-b border-blue-200 dark:border-blue-800/50' 
        : isCommon
        ? 'border-l-[6px] border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/20 border-t border-r border-b border-amber-200 dark:border-amber-800/50'
        : 'border-l-[6px] border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 border-t border-r border-b border-indigo-200 dark:border-indigo-800/50';

      const dotClass = isLoad ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse';
      const statusClass = isLoad ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

      const cardId = `dock-card-${dockName.replace(/\s+/g, '-').toLowerCase()}`;
      
      const MAX_CAPACITY = 4;
      const currentCount = activeRecords.length;
      const capacityPercent = Math.min(100, (currentCount / MAX_CAPACITY) * 100);
      let progressColor = 'bg-emerald-500';
      if (currentCount >= MAX_CAPACITY) progressColor = 'bg-red-500';
      else if (currentCount >= MAX_CAPACITY - 1) progressColor = 'bg-amber-500';

      return (
        <div key={dockName} id={cardId} className={`flex flex-col p-4 rounded-xl shadow-sm min-h-[220px] text-[11px] transition-all scroll-mt-6 ${cardColorClass}`}>
          <div className="flex justify-between items-center font-bold mb-2">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{dockName}</span>
            <AnimatedStatusChip status={record.status || ''} size="sm" />
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Queue</span>
              <span className="text-[8px] font-bold text-slate-700 dark:text-slate-300">{currentCount}/{MAX_CAPACITY}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${capacityPercent}%` }} />
            </div>
          </div>
          
          {/* Top: Vehicle Number & Status */}
          <div className="bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 shadow-sm flex flex-col items-center justify-center space-y-0.5">
             <p className="font-black text-lg text-slate-800 dark:text-slate-100 font-mono tracking-widest leading-none">{vehicleNo}</p>
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{record.vType || "Vehicle"}</p>
          </div>
          
          {/* Middle: Shuttle Steps */}
          <div className="flex-1 space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Destination Stops</p>
            {record.shuttleSteps && record.shuttleSteps.map((step, index) => {
              const isActive = index === record.currentStepIndex;
              const isCompleted = step.status === 'COMPLETED';
              const isPending = step.status === 'PENDING';
              
              let stepBg = 'bg-slate-100 dark:bg-slate-800';
              if (step.status === 'IN-PROGRESS') stepBg = 'bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200';
              else if (isPending) stepBg = 'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 cursor-pointer hover:bg-amber-200';
              else if (isCompleted) stepBg = 'bg-emerald-50 dark:bg-emerald-900/30 opacity-70';

              return (
                <div 
                  key={step.id} 
                  className={`p-2.5 rounded-lg ${stepBg} transition shadow-sm border border-slate-200/50 dark:border-slate-700/50`}
                  onClick={() => {
                    const el = document.getElementById(cardId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    if (isPending) {
                      setStartingStep({ entry: record, index });
                    } else if (step.status === 'IN-PROGRESS' || isCompleted) {
                      setFinishingStep({ entry: record, index });
                    }
                  }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] ${
                      step.unit === 'AIL' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {step.unit || 'PENDING'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500">Step {index + 1}</span>
                  </div>
                  
                  <div className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold mt-0.5 mb-0.5">
                    {step.destination}
                  </div>
                  
                  {step.operator && (
                    <div className="text-[8px] text-slate-500 mt-0.5">Sup: {step.operator}</div>
                  )}
                  {isCompleted && (
                    <div className="text-[8px] text-emerald-600 font-bold mt-0.5">Cases: {step.cases} | {step.endTime}</div>
                  )}
                  {isPending && (
                    <div className="text-[8px] text-amber-600 font-bold mt-0.5 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Start</span>
                    </div>
                  )}
                  {step.status === 'IN-PROGRESS' && (
                    <div className="text-[8px] text-blue-600 font-bold mt-0.5 animate-pulse flex items-center justify-center gap-1">
                      <span>Click to Finish</span>
                    </div>
                  )}
                </div>
              );
            })}
            {(!record.shuttleSteps || record.shuttleSteps.length === 0) && (
               <div 
                  className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 border border-blue-300 cursor-pointer hover:bg-blue-200 transition shadow-sm"
                  onClick={() => onEditOperation(record)}
               >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-white dark:bg-slate-800 text-blue-600 border border-blue-200 dark:border-blue-700 shadow-sm">
                      {record.unit || 'PENDING'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-500">Destination</span>
                  </div>
                  
                  <div className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold mt-1 mb-1 line-clamp-2">
                    {record.opType === 'LOADING' ? record.toLoc : record.fromLoc}
                  </div>
                  
                  {record.operator && (
                    <div className="text-[8px] text-slate-500 mt-1">Sup: {record.operator}</div>
                  )}
                  <div className="text-[8px] text-blue-600 font-bold mt-1 flex items-center justify-center gap-1">
                    <span>Click to Edit Operation</span>
                  </div>
               </div>
            )}
          </div>
        </div>
      );
    }
    const cardId = `dock-card-${dockName.replace(/\s+/g, '-').toLowerCase()}`;
    const MAX_CAPACITY = 4;
    return (
      <div key={dockName} id={cardId} className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 text-[11px] text-slate-400 space-y-2 border-2 border-dashed border-slate-300 dark:border-slate-600 min-h-[220px] flex flex-col transition-all hover:bg-slate-50 dark:hover:bg-slate-800 scroll-mt-6">
        <div className="flex justify-between items-center font-bold mb-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">{dockName}</span>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Queue</span>
            <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">0/{MAX_CAPACITY}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-500" style={{ width: '0%' }} />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available / Idle</p>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      {/* Simplified Visual Dock Occupancy Grid */}
      <div className="bg-white dark:bg-slate-800 p-4 lg:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Dock Bay Occupancy Status Grid
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Live status overview of all warehouse bays (Click card to scroll or toggle 🛠️ maintenance)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-[10px] font-bold">
              Empty: {occupancyStats.empty}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 rounded-lg text-[10px] font-bold">
              Occupied: {occupancyStats.occupied}
            </span>
            <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 rounded-lg text-[10px] font-bold">
              Maintenance: {occupancyStats.maintenance}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
          {allDocks.map(dock => {
            const actives = getActivesForDock(dock, loadEntries);
            const isMaint = maintenanceBays.includes(dock);
            const isOcc = actives.length > 0;
            const occupant = isOcc ? actives[0] : null;

            let bgClass = "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200";
            let statusText = "Empty";
            let dotBg = "bg-emerald-500";

            if (isMaint) {
              bgClass = "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200";
              statusText = "Maintenance";
              dotBg = "bg-rose-500";
            } else if (isOcc) {
              bgClass = "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-900 dark:text-blue-200";
              statusText = "Occupied";
              dotBg = "bg-blue-500 animate-pulse";
            }

            return (
              <div 
                key={dock}
                onClick={() => {
                  const el = document.getElementById(`dock-card-${dock.replace(/\s+/g, '-').toLowerCase()}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`p-2.5 rounded-xl border ${bgClass} shadow-xs transition hover:scale-[1.02] cursor-pointer flex flex-col justify-between items-center text-center space-y-1 relative group`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="text-[10px] font-black uppercase tracking-wider">{dock}</span>
                  <button
                    type="button"
                    title="Toggle Maintenance"
                    onClick={(e) => toggleMaintenance(dock, e)}
                    className="text-[9px] px-1 py-0.5 rounded bg-white/70 dark:bg-slate-800/70 text-slate-500 hover:text-rose-600 transition font-bold"
                  >
                    🛠️
                  </button>
                </div>

                <div className="flex items-center gap-1 my-1">
                  <span className={`w-2 h-2 rounded-full ${dotBg}`} />
                  <span className="text-[10px] font-extrabold">{statusText}</span>
                </div>

                {occupant ? (
                  <div className="text-[9px] font-mono font-bold bg-white/80 dark:bg-slate-900/70 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 truncate w-full">
                    {occupant.vehicleNo}
                  </div>
                ) : (
                  <div className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">
                    {isMaint ? "Service" : "Available"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Filter docks by Vehicle Number or Destination Location..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {/* AHPL Docks */}
      <div className="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-blue-500" /> AHPL Dedicated Docks (1 to 4)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ahplDocks.map((dockName) => {
            const actives = getActivesForDock(dockName, loadEntries);
            
            if (searchTerm.trim() !== '') {
               if (actives.length === 0) return null;
               const term = searchTerm.toLowerCase();
               const matches = actives.some(record => {
                  const matchVehicle = record.vehicleNo?.toLowerCase().includes(term);
                  const matchDest = record.toLoc?.toLowerCase().includes(term) || record.shuttleSteps?.some(s => s.destination?.toLowerCase().includes(term));
                  return matchVehicle || matchDest;
               });
               if (!matches) return null;
            }

            return renderDockCard(dockName, actives);
          })}
        </div>
      </div>

      {/* Common / Shared Docks */}
      <div className="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-amber-500" /> Common & Flexible Docks (5 to 6)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {commonDocks.map((dockName) => {
            const actives = getActivesForDock(dockName, loadEntries);
            
            if (searchTerm.trim() !== '') {
               if (actives.length === 0) return null;
               const term = searchTerm.toLowerCase();
               const matches = actives.some(record => {
                  const matchVehicle = record.vehicleNo?.toLowerCase().includes(term);
                  const matchDest = record.toLoc?.toLowerCase().includes(term) || record.shuttleSteps?.some(s => s.destination?.toLowerCase().includes(term));
                  return matchVehicle || matchDest;
               });
               if (!matches) return null;
            }

            return renderDockCard(dockName, actives);
          })}
        </div>
      </div>

      {/* AIL Docks */}
      <div className="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-indigo-500" /> AIL Dedicated Docks (7 to 9)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ailDocks.map((dockName) => {
            const actives = getActivesForDock(dockName, loadEntries);
            
            if (searchTerm.trim() !== '') {
               if (actives.length === 0) return null;
               const term = searchTerm.toLowerCase();
               const matches = actives.some(record => {
                  const matchVehicle = record.vehicleNo?.toLowerCase().includes(term);
                  const matchDest = record.toLoc?.toLowerCase().includes(term) || record.shuttleSteps?.some(s => s.destination?.toLowerCase().includes(term));
                  return matchVehicle || matchDest;
               });
               if (!matches) return null;
            }

            return renderDockCard(dockName, actives);
          })}
        </div>
      </div>

      {startingStep && (
        <StartStepModal 
          entry={startingStep.entry} 
          stepIndex={startingStep.index}
          supervisors={DEFAULT_SUPERVISORS}
          vehicleTypes={DEFAULT_VEHICLE_TYPES}
          loadEntries={loadEntries}
          onClose={() => setStartingStep(null)}
          onStart={handleStart}
        />
      )}

      {finishingStep && (
        <FinishStepModal 
          entry={finishingStep.entry} 
          stepIndex={finishingStep.index}
          onClose={() => setFinishingStep(null)}
          onFinish={handleFinish}
        />
      )}
    </section>
  );
};

