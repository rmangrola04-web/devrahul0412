import React, { useState, useEffect } from 'react';
import { Edit3, X, AlertTriangle, Clock, MapPin, CheckCircle2, ShieldAlert, Play } from 'lucide-react';
import { LoadUnloadEntry } from '../types';
import { DOCK_CONFIG } from '../data/defaultData';

interface EditOperationModalProps {
  isOpen: boolean;
  entry: LoadUnloadEntry | null;
  onClose: () => void;
  onSave: (updated: LoadUnloadEntry) => void;
  supervisors: string[];
  transporters: string[];
  loadLocations?: string[];
  unloadLocations?: string[];
  loadEntries?: LoadUnloadEntry[];
}

export const EditOperationModal: React.FC<EditOperationModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave,
  supervisors,
  transporters,
  loadLocations = [],
  unloadLocations = [],
  loadEntries = []
}) => {
  const [formData, setFormData] = useState<Partial<LoadUnloadEntry>>({});
  const [useCustomRoute, setUseCustomRoute] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({ ...entry });
      setUseCustomRoute(false);
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const currentUnit = formData.unit || 'AHPL';
  const dockOptions = DOCK_CONFIG[currentUnit] || DOCK_CONFIG['AHPL'];
  const isUnloading = formData.opType === 'UNLOADING';

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

  const handleOpTypeChange = (newOpType: 'LOADING' | 'UNLOADING') => {
    const isUnload = newOpType === 'UNLOADING';
    let from = formData.fromLoc || 'INDORE HUB';
    let to = formData.toLoc || 'INDORE HUB';

    if (isUnload) {
      from = unloadLocations[0] || 'DELHI';
      to = 'INDORE HUB';
    } else {
      from = 'INDORE HUB';
      to = loadLocations[0] || 'MUMBAI';
    }

    setFormData({
      ...formData,
      opType: newOpType,
      fromLoc: from,
      toLoc: to,
      status: formData.endTime ? (isUnload ? 'UNLOADED' : 'LOADED') : (isUnload ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS')
    });
  };

  const handlePickCurrentTime = (field: 'startTime' | 'endTime') => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    setFormData({ ...formData, [field]: timeStr });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNo || !formData.vehicleNo.trim()) {
      alert('Please enter a valid Vehicle Number');
      return;
    }

    const selectedBay = formData.bayNo || dockOptions[0] || 'Dock 1';
    const occupant = occupiedDocks.get(selectedBay);
    const editingVeh = formData.vehicleNo || entry.vehicleNo;
    if (occupant && editingVeh && occupant.toUpperCase() !== editingVeh.toUpperCase()) {
      alert(`${selectedBay} is currently Occupied by vehicle ${occupant}. Please select an available dock.`);
      return;
    }

    let duration = formData.duration || '-- In Progress --';
    let status = formData.status;

    if (formData.endTime && formData.endTime.trim()) {
      status = isUnloading ? 'UNLOADED' : 'LOADED';
      if (formData.startTime && formData.startTime.trim()) {
        const sParts = formData.startTime.split(':');
        const eParts = formData.endTime.split(':');
        if (sParts.length === 2 && eParts.length === 2) {
          let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
          if (diff < 0) diff += 1440;
          duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
        }
      }
    } else {
      status = isUnloading ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS';
      duration = '-- In Progress --';
    }

    const updated: LoadUnloadEntry = {
      ...entry,
      ...formData,
      vehicleNo: formData.vehicleNo.trim().toUpperCase(),
      opType: formData.opType || 'LOADING',
      unit: formData.unit || 'AHPL',
      bayNo: formData.bayNo || dockOptions[0] || 'Dock 1',
      fromLoc: formData.fromLoc?.trim().toUpperCase() || 'INDORE HUB',
      toLoc: formData.toLoc?.trim().toUpperCase() || 'INDORE HUB',
      transporter: formData.transporter || transporters[0] || 'DHTC',
      operator: formData.operator || supervisors[0] || 'Supervisor',
      startTime: formData.startTime || '00:00',
      endTime: formData.endTime || '',
      status: status as any,
      duration,
      totalCases: formData.totalCases !== undefined && formData.totalCases !== ('' as any) ? Number(formData.totalCases) : 0,
      damagedCases: formData.damagedCases !== undefined && formData.damagedCases !== ('' as any) ? Number(formData.damagedCases) : 0,
      damagedValue: formData.damagedValue !== undefined && formData.damagedValue !== ('' as any) ? Number(formData.damagedValue) : 0,
      podStatus: isUnloading ? (formData.podStatus || 'POD Clean') : undefined,
      sealNo: !isUnloading ? (formData.sealNo?.trim().toUpperCase() || '') : undefined,
      remarks: formData.remarks?.trim() || ''
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto py-6">
      <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 max-w-lg w-full p-4 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Edit Supervisor Operation (Full Form)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vehicle: <b className="font-mono text-slate-800 dark:text-slate-200">{entry.vehicleNo}</b> &bull; Op ID: #{entry.id.slice(-6)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Operation Activity (Loading / Unloading) */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              Operation Activity *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleOpTypeChange('LOADING')}
                className={`py-1.5 px-3 rounded font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                  !isUnloading
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                <Play className="w-3.5 h-3.5" /> LOADING (OUTGOING)
              </button>
              <button
                type="button"
                onClick={() => handleOpTypeChange('UNLOADING')}
                className={`py-1.5 px-3 rounded font-bold text-xs transition border flex items-center justify-center gap-1.5 ${
                  isUnloading
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> UNLOADING (INCOMING)
              </button>
            </div>
          </div>

          {/* Vehicle Number & Unit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Vehicle Number *
              </label>
              <input
                type="text"
                value={formData.vehicleNo || ''}
                onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value.toUpperCase() })}
                required
                placeholder="MP-09-AB-1234"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold uppercase text-blue-600 dark:text-blue-400"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Company / Unit *
              </label>
              <select
                value={currentUnit}
                onChange={(e) => {
                  const unit = e.target.value;
                  const docks = DOCK_CONFIG[unit] || DOCK_CONFIG['AHPL'];
                  setFormData({ ...formData, unit, bayNo: docks[0] });
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
              >
                <option value="AHPL">AHPL (Dock 1 to 4)</option>
                <option value="AIL">AIL (Dock 5 to 9)</option>
                <option value="One Abbott">One Abbott (Dock 1 to 9)</option>
                <option value="BOTH">BOTH (AHPL & AIL - Dock 1 to 9)</option>
                <option value="THERMOCOL">THERMOCOL (All Docks)</option>
              </select>
            </div>
          </div>

          {/* Assigned Dock & Transporter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Assigned Dock No. *
              </label>
              <select
                value={formData.bayNo || dockOptions[0]}
                onChange={(e) => setFormData({ ...formData, bayNo: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              >
                {dockOptions.map((dock) => {
                  const occupant = occupiedDocks.get(dock);
                  const editingVeh = formData.vehicleNo || entry.vehicleNo;
                  const isOcc = occupant && editingVeh && occupant.toUpperCase() !== editingVeh.toUpperCase();
                  return (
                    <option key={dock} value={dock} disabled={isOcc}>
                      {dock} ({currentUnit}) {isOcc ? `(Occupied - ${occupant})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Transporter
              </label>
              <select
                value={formData.transporter || transporters[0]}
                onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {transporters.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Route (Origin & Destination) */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Route & Location
              </span>
              <button
                type="button"
                onClick={() => setUseCustomRoute(!useCustomRoute)}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                {useCustomRoute ? '← Select from Master' : '✍ Type Custom'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">From (Origin)</label>
                {useCustomRoute ? (
                  <input
                    type="text"
                    value={formData.fromLoc || ''}
                    onChange={(e) => setFormData({ ...formData, fromLoc: e.target.value.toUpperCase() })}
                    placeholder="e.g. INDORE HUB"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-medium text-slate-800 dark:text-slate-200"
                  />
                ) : isUnloading ? (
                  <select
                    value={formData.fromLoc || unloadLocations[0] || ''}
                    onChange={(e) => setFormData({ ...formData, fromLoc: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-blue-600 dark:text-blue-400"
                  >
                    {unloadLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.fromLoc || 'INDORE HUB'}
                    onChange={(e) => setFormData({ ...formData, fromLoc: e.target.value.toUpperCase() })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">To (Destination)</label>
                {useCustomRoute ? (
                  <input
                    type="text"
                    value={formData.toLoc || ''}
                    onChange={(e) => setFormData({ ...formData, toLoc: e.target.value.toUpperCase() })}
                    placeholder="e.g. MUMBAI"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-medium text-slate-800 dark:text-slate-200"
                  />
                ) : !isUnloading ? (
                  <select
                    value={formData.toLoc || loadLocations[0] || ''}
                    onChange={(e) => setFormData({ ...formData, toLoc: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-blue-600 dark:text-blue-400"
                  >
                    {loadLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.toLoc || 'INDORE HUB'}
                    onChange={(e) => setFormData({ ...formData, toLoc: e.target.value.toUpperCase() })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Supervisor Incharge & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Supervisor Incharge *
              </label>
              <select
                value={formData.operator || supervisors[0]}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {supervisors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Current Status
              </label>
              <select
                value={
                  formData.status ||
                  (isUnloading ? 'UNLOADING IN-PROGRESS' : 'LOADING IN-PROGRESS')
                }
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="LOADING IN-PROGRESS">⏳ LOADING IN-PROGRESS</option>
                <option value="LOADED">✔ LOADED (Completed)</option>
                <option value="UNLOADING IN-PROGRESS">⏳ UNLOADING IN-PROGRESS</option>
                <option value="UNLOADED">✔ UNLOADED (Completed)</option>
              </select>
            </div>
          </div>

          {/* Timings: Start Time & End Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500">
                  Start Time *
                </label>
                <button
                  type="button"
                  onClick={() => handlePickCurrentTime('startTime')}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                >
                  ⚡ Pick
                </button>
              </div>
              <input
                type="time"
                value={formData.startTime || ''}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] uppercase font-bold text-slate-500">
                  End Time (Optional)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePickCurrentTime('endTime')}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    ⚡ Pick
                  </button>
                  {formData.endTime && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, endTime: '' })}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                type="time"
                value={formData.endTime || ''}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Cases & Damaged Values */}
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-800 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                {isUnloading ? 'Total Cases Unloaded (Qty)' : 'Total Cases Loaded (Qty)'}
              </label>
            </div>
            <input
              type="number"
              min="0"
              value={formData.totalCases !== undefined ? formData.totalCases : ''}
              onChange={(e) => setFormData({ ...formData, totalCases: e.target.value })}
              placeholder="e.g. 150"
              className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded p-1.5 text-xs font-bold text-amber-800 dark:text-amber-200"
            />
          </div>

          {/* Damaged Cases & Damaged Value for Unloading */}
          {isUnloading && (
            <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded border border-rose-200 dark:border-rose-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Damage Inspection (Optional)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Damaged Cases (Qty)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.damagedCases !== undefined ? formData.damagedCases : ''}
                    onChange={(e) => setFormData({ ...formData, damagedCases: e.target.value })}
                    placeholder="0"
                    className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded p-1.5 text-xs font-bold text-rose-600 dark:text-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Damaged Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.damagedValue !== undefined ? formData.damagedValue : ''}
                    onChange={(e) => setFormData({ ...formData, damagedValue: e.target.value })}
                    placeholder="₹ 0"
                    className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded p-1.5 text-xs font-bold text-rose-600 dark:text-rose-400"
                  />
                </div>
              </div>
            </div>
          )}

          {isUnloading ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded border border-emerald-200 dark:border-emerald-800 space-y-1">
              <label className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                Unloading Inspection Status
              </label>
              <select
                value={formData.podStatus || 'POD Clean'}
                onChange={(e) => setFormData({ ...formData, podStatus: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded p-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"
              >
                <option value="POD Clean">✔ POD Clean</option>
                <option value="POD Hold Due to Discrepancy">⚠ POD Hold Due to Discrepancy</option>
                <option value="Reported Checked Cases">📦 Checked Cases Verified</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Seal Number (Optional)</label>
              <input
                type="text"
                value={formData.sealNo || ''}
                onChange={(e) => setFormData({ ...formData, sealNo: e.target.value.toUpperCase() })}
                placeholder="e.g. SL-99882"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-mono font-bold uppercase text-slate-800 dark:text-slate-200"
              />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Remarks</label>
            <input
              type="text"
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Optional remarks"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" /> Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 rounded text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
