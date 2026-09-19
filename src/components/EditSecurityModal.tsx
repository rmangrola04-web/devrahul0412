import React, { useState, useEffect } from 'react';
import { Edit3, X, Shield, Clock, Phone, MapPin, Truck, AlertTriangle } from 'lucide-react';
import { SecurityGateEntry } from '../types';

interface EditSecurityModalProps {
  isOpen: boolean;
  entry: SecurityGateEntry | null;
  onClose: () => void;
  onSave: (updated: SecurityGateEntry) => void;
  transporters: string[];
  vehicleTypes: string[];
  loadLocations?: string[];
  unloadLocations?: string[];
}

export const EditSecurityModal: React.FC<EditSecurityModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave,
  transporters,
  vehicleTypes,
  loadLocations = [],
  unloadLocations = []
}) => {
  const [formData, setFormData] = useState<Partial<SecurityGateEntry>>({});
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({ ...entry });
      setUseCustomLocation(false);
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handlePurposeChange = (newPurpose: 'Loading' | 'Unloading' | 'Parking / Transit') => {
    let from = formData.fromLoc || 'INDORE HUB';
    let to = formData.toLoc || 'INDORE HUB';

    if (newPurpose === 'Loading') {
      from = 'INDORE HUB';
      to = loadLocations[0] || 'MUMBAI';
    } else if (newPurpose === 'Unloading') {
      from = unloadLocations[0] || 'DELHI';
      to = 'INDORE HUB';
    } else {
      from = 'INDORE HUB';
      to = 'INDORE HUB';
    }

    setFormData({
      ...formData,
      purpose: newPurpose,
      fromLoc: from,
      toLoc: to
    });
  };

  const handleSetCurrentDateTime = () => {
    const now = new Date();
    const formatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setFormData({ ...formData, dateTime: formatted });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle || !formData.vehicle.trim()) {
      alert('Please enter a valid Vehicle Number');
      return;
    }

    const rawMobile = formData.mobile || '';
    const cleanMobile = rawMobile.replace(/\D/g, '');

    if (cleanMobile.length !== 10) {
      alert('Driver Mobile number must be exactly 10 digits!');
      return;
    }

    onSave({
      ...entry,
      ...formData,
      purpose: formData.purpose || 'Loading',
      vehicle: formData.vehicle.trim().toUpperCase(),
      vType: formData.vType || vehicleTypes[0] || '32SXL',
      transporter: formData.transporter || transporters[0] || 'DHTC',
      mobile: cleanMobile,
      fromLoc: formData.fromLoc?.trim().toUpperCase() || 'INDORE HUB',
      toLoc: formData.toLoc?.trim().toUpperCase() || 'INDORE HUB',
      dateTime: formData.dateTime || entry.dateTime,
      remarks: formData.remarks?.trim() || '-',
      unit: formData.purpose === 'Unloading' ? (formData.unit || 'AIL') : undefined,
      grNo: formData.purpose === 'Unloading' ? (formData.grNo || '') : undefined
    } as SecurityGateEntry);
    onClose();
  };

  const mobileClean = (formData.mobile || '').replace(/\D/g, '');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 overflow-y-auto py-6">
      <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 max-w-lg w-full p-4 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Edit Security Gate Entry (Full Form)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Vehicle: <b className="font-mono text-slate-800 dark:text-slate-200">{entry.vehicle}</b> &bull; Gate ID: #{entry.id.slice(-6)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Purpose */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Purpose *
            </label>
            <select
              value={formData.purpose || 'Loading'}
              onChange={(e) => handlePurposeChange(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
            >
              <option value="Loading">📦 Loading</option>
              <option value="Unloading">📥 Unloading</option>
              <option value="Parking / Transit">🅿 Parking / Transit</option>
            </select>
          </div>

          {/* Vehicle No & Vehicle Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Vehicle Number *
              </label>
              <input
                type="text"
                value={formData.vehicle || ''}
                onChange={(e) => setFormData({ ...formData, vehicle: e.target.value.toUpperCase() })}
                required
                placeholder="MP-09-AB-1234"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-blue-600 dark:text-blue-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Vehicle Type
              </label>
              <select
                value={formData.vType || vehicleTypes[0]}
                onChange={(e) => setFormData({ ...formData, vType: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-semibold font-mono text-slate-800 dark:text-slate-200"
              >
                {vehicleTypes.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Driver Mobile (10 digits) & Transporter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Driver Mobile *
                </label>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    mobileClean.length === 10 ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                >
                  {mobileClean.length}/10
                </span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={formData.mobile || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mobile: e.target.value.replace(/\D/g, '').slice(0, 10)
                  })
                }
                placeholder="9876543210"
                required
                className={`w-full bg-slate-50 dark:bg-slate-900 border rounded p-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 transition ${
                  mobileClean.length === 10
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : mobileClean.length > 0
                    ? 'border-amber-400 focus:border-amber-500'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
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

          {/* UNLOADING SPECIAL: UNIT & GR NUMBER */}
          {formData.purpose === 'Unloading' && (
            <div className="p-2.5 rounded bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Unloading GR & Unit
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                  {formData.unit === 'AHPL' ? 'AHPL (691+)' : 'AIL (616+)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Company / Unit *
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, unit: 'AIL' })}
                      className={`py-1 px-1 rounded text-xs font-bold text-center border transition ${
                        (formData.unit || 'AIL') === 'AIL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      AIL (616)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, unit: 'AHPL' })}
                      className={`py-1 px-1 rounded text-xs font-bold text-center border transition ${
                        formData.unit === 'AHPL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      AHPL (691)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    GR Number *
                  </label>
                  <input
                    type="text"
                    value={formData.grNo || ''}
                    onChange={(e) => setFormData({ ...formData, grNo: e.target.value.replace(/\D/g, '') })}
                    placeholder={formData.unit === 'AHPL' ? '691' : '616'}
                    className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded p-1.5 text-xs font-mono font-black text-blue-700 dark:text-blue-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Location & Route Fields */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> Route & Locations
              </span>
              <button
                type="button"
                onClick={() => setUseCustomLocation(!useCustomLocation)}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                {useCustomLocation ? '← Use Master List' : '✍ Type Custom'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">From (Origin)</label>
                {useCustomLocation || formData.purpose === 'Parking / Transit' ? (
                  <input
                    type="text"
                    value={formData.fromLoc || ''}
                    onChange={(e) => setFormData({ ...formData, fromLoc: e.target.value.toUpperCase() })}
                    placeholder="e.g. INDORE HUB"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-medium text-slate-800 dark:text-slate-200"
                  />
                ) : formData.purpose === 'Unloading' ? (
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
                {useCustomLocation || formData.purpose === 'Parking / Transit' ? (
                  <input
                    type="text"
                    value={formData.toLoc || ''}
                    onChange={(e) => setFormData({ ...formData, toLoc: e.target.value.toUpperCase() })}
                    placeholder="e.g. MUMBAI"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-medium text-slate-800 dark:text-slate-200"
                  />
                ) : formData.purpose === 'Loading' ? (
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

          {/* Date & Time with quick pick button */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Gate Entry Date & Time
              </label>
              <button
                type="button"
                onClick={handleSetCurrentDateTime}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
              >
                <Clock className="w-3 h-3" /> Pick Current Time
              </button>
            </div>
            <input
              type="text"
              value={formData.dateTime || ''}
              onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
              placeholder="DD/MM/YYYY HH:MM"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-mono text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Optional remarks (e.g. Seal intact / Driver reported)"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" /> Save Entry
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
