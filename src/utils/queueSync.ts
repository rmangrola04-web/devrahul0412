import { LoadUnloadEntry, SecurityGateEntry, WaitingQueueItem } from '../types';

/**
 * Safely parses various date formats used across WMS:
 * - DD/MM/YYYY, HH:MM:SS (Indian formatted gate timestamps)
 * - DD/MM/YYYY
 * - YYYY-MM-DD (standard HTML date inputs)
 * - ISO string timestamps
 */
export function parseWmsDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Check DD/MM/YYYY format with optional time
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
    const minutes = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0;
    const seconds = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check YYYY-MM-DD format
  const yyyymmddMatch = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback standard parse
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Strict purpose checkers to prevent 'unloading' matching .includes('loading')
 */
export function isUnloadingPurpose(purpose?: string): boolean {
  if (!purpose) return false;
  const p = purpose.trim().toLowerCase();
  return p === 'unloading' || p.includes('unload');
}

export function isLoadingPurpose(purpose?: string): boolean {
  if (!purpose) return false;
  const p = purpose.trim().toLowerCase();
  return (p === 'loading' || p.includes('load')) && !p.includes('unload');
}

/**
 * Checks if a log's date corresponds to today's date
 */
export function isWmsLogToday(dateTimeStr?: string, entryDateStr?: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;

  if (entryDateStr && entryDateStr.trim() === todayIso) {
    return true;
  }

  const d1 = parseWmsDate(dateTimeStr);
  if (d1 && d1.getFullYear() === today.getFullYear() && d1.getMonth() === today.getMonth() && d1.getDate() === today.getDate()) {
    return true;
  }

  const d2 = parseWmsDate(entryDateStr);
  if (d2 && d2.getFullYear() === today.getFullYear() && d2.getMonth() === today.getMonth() && d2.getDate() === today.getDate()) {
    return true;
  }

  return false;
}

/**
 * Normalizes vehicle registration strings by removing spaces, dashes, dots,
 * and converting to uppercase so "MP-09-AB-1234", "MP09AB1234", "MP 09 AB 1234" match cleanly.
 */
export function normalizeVehicleNo(v: string | undefined | null): string {
  if (!v) return '';
  return v.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Evaluates whether a gate security entry is strictly still pending / waiting in the yard
 * (i.e., has no dock assigned, no exit time logged, no completed or in-progress operations).
 * ONLY vehicles from previous days that have NEVER been assigned to a dock or operated on
 * will return true (carrying forward into the Waiting Queue).
 */
export function isPendingGateEntry(veh: SecurityGateEntry, loadEntries: LoadUnloadEntry[] = []): boolean {
  if (!veh) return false;
  if (veh.purpose === 'Parking / Transit') return false;

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
    'GATE OUT',
    'FINISHED',
    'FINISH',
    'DONE',
    'CONFIRMED',
    'RESOLVED',
    'ARCHIVED'
  ];

  const statusUpper = (veh.status || '').trim().toUpperCase();
  if (nonWaitingStatuses.some(st => statusUpper.includes(st))) return false;
  if ((veh as any).completed === true) return false;

  // Skip if dock already assigned directly on security gate entry
  if (veh.assignedDock && veh.assignedDock !== 'Unassigned' && veh.assignedDock.trim() !== '') return false;
  if (veh.bayNo && veh.bayNo !== 'Unassigned' && veh.bayNo.trim() !== '') return false;

  // Skip if exit time has been logged in any format
  if (veh.loadingExitTime && veh.loadingExitTime.trim() !== '') return false;
  if ((veh as any).exitTime && (veh as any).exitTime.trim() !== '') return false;
  if ((veh as any).gateOutTime && (veh as any).gateOutTime.trim() !== '') return false;
  if ((veh as any).exitDateTime && (veh as any).exitDateTime.trim() !== '') return false;
  if ((veh as any).outTime && (veh as any).outTime.trim() !== '') return false;

  // Check against loadEntries operations using normalized vehicle numbers & gateId
  const vehNorm = normalizeVehicleNo(veh.vehicle);
  if (loadEntries && loadEntries.length > 0) {
    const hasAssignedOrActiveOp = loadEntries.some((op) => {
      const isGateIdMatch = op.gateId && veh.id && op.gateId === veh.id;
      const opVehNorm = normalizeVehicleNo(op.vehicleNo);
      const isVehMatch = Boolean(vehNorm && opVehNorm && vehNorm === opVehNorm);

      if (!isGateIdMatch && !isVehMatch) return false;

      // If an operation record exists in loadEntries for this vehicle, assignment/operation has occurred!
      const opStatusUpper = (op.status || '').trim().toUpperCase();
      const hasDock = Boolean(
        (op.bayNo && op.bayNo !== 'Unassigned' && op.bayNo.trim() !== '') ||
        (op.assignedDock && op.assignedDock !== 'Unassigned' && op.assignedDock.trim() !== '')
      );

      return (
        hasDock ||
        opStatusUpper.length > 0
      );
    });

    if (hasAssignedOrActiveOp) return false;
  }

  return true;
}

/**
 * Resolves the actual target location / destination for a gate entry,
 * preventing generic 'Warehouse' from masking the real location in the waiting queue.
 */
export function resolveQueueActualLocation(veh: SecurityGateEntry, isUnloadVeh: boolean): string {
  // 1. Check explicit target_location or destination
  const explicit = (veh.target_location || (veh as any).destination || (veh as any).targetLocation || (veh as any).location || '')?.trim();
  if (explicit && explicit.toUpperCase() !== 'WAREHOUSE' && explicit.toUpperCase() !== 'UNASSIGNED') {
    return explicit;
  }

  const fromTrim = (veh.fromLoc || '').trim();
  const toTrim = (veh.toLoc || '').trim();

  const isFromValid = fromTrim && fromTrim.toUpperCase() !== 'WAREHOUSE' && fromTrim.toUpperCase() !== 'UNASSIGNED';
  const isToValid = toTrim && toTrim.toUpperCase() !== 'WAREHOUSE' && toTrim.toUpperCase() !== 'UNASSIGNED';

  if (isUnloadVeh) {
    if (isFromValid) return fromTrim;
    if (isToValid) return toTrim;
  } else {
    if (isToValid) return toTrim;
    if (isFromValid) return fromTrim;
  }

  if (explicit) return explicit;
  if (fromTrim && fromTrim.toUpperCase() !== 'WAREHOUSE') return fromTrim;
  if (toTrim && toTrim.toUpperCase() !== 'WAREHOUSE') return toTrim;

  return 'INDORE HUB';
}

/**
 * Centralized, authoritative calculation of active items in the Waiting Queue.
 * Synchronizes gate arrivals with active and completed dock operations.
 * Strictly displays only records with pending/waiting status (waiting for dock assignment)
 * and automatically removes vehicles as soon as a dock is assigned or operations start/complete.
 */
export function computeWaitingQueueItems(
  securityLogs: SecurityGateEntry[],
  loadEntries: LoadUnloadEntry[],
  dismissedQueueKeys?: Set<string>
): WaitingQueueItem[] {
  const items: WaitingQueueItem[] = [];

  securityLogs.forEach((veh) => {
    // 1. Exclude if not strictly pending / waiting for assignment
    if (!isPendingGateEntry(veh, loadEntries)) return;

    // 2. Exclude if user manually dismissed/deleted from waiting queue
    const queueKey = veh.id;
    if (dismissedQueueKeys && dismissedQueueKeys.has(queueKey)) return;

    // 1. Guard ke dwara select kiya gaya purpose (Loading/Unloading) hi Waiting Queue me show hona chahiye.
    const isUnloadVeh = isUnloadingPurpose(veh.purpose);
    const authoritativePurpose: 'Loading' | 'Unloading' = isUnloadVeh ? 'Unloading' : 'Loading';

    // Build target locations / destinations for this vehicle arrival
    const targets: { location: string; unit: string }[] = [];

    const hasMultipleDestinations = 
      (veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) ||
      (veh.multiDestinations && veh.multiDestinations.length > 0);

    if (hasMultipleDestinations) {
      if (veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) {
        veh.milkRouteDestinations.forEach((m) => {
          const loc = m.location?.trim();
          if (!loc) return;
          const u = m.unit?.trim().toUpperCase() || veh.unit?.trim().toUpperCase() || 'AHPL';
          if (u === 'BOTH') {
            targets.push({ location: loc, unit: 'AHPL' });
            targets.push({ location: loc, unit: 'AIL' });
          } else {
            targets.push({ location: loc, unit: u });
          }
        });
      } else if (veh.multiDestinations && veh.multiDestinations.length > 0) {
        veh.multiDestinations.forEach((m: any) => {
          const loc = typeof m === 'string' ? m.trim() : m?.location?.trim();
          if (!loc) return;
          const u = (typeof m === 'object' && m?.unit) ? m.unit.trim().toUpperCase() : (veh.unit?.trim().toUpperCase() || 'AHPL');
          targets.push({ location: loc, unit: u });
        });
      }
    } else {
      // 2. Waiting Queue me sirf 'Warehouse' likhne ki jagah actual selected location/destination show honi chahiye.
      const rawLoc = resolveQueueActualLocation(veh, isUnloadVeh);
      const splitLocs = rawLoc.split(/[/,]/).map((s) => s.trim()).filter(Boolean);
      const locList = splitLocs.length > 0 ? splitLocs : [rawLoc.trim() || 'INDORE HUB'];
      const u = veh.unit?.trim().toUpperCase() || 'AHPL';

      locList.forEach((loc) => {
        if (u === 'BOTH') {
          targets.push({ location: loc, unit: 'AHPL' });
          targets.push({ location: loc, unit: 'AIL' });
        } else {
          targets.push({ location: loc, unit: u });
        }
      });
    }

    // Deduplicate targets for this vehicle arrival
    const uniqueTargets: { location: string; unit: string }[] = [];
    targets.forEach((t) => {
      if (!uniqueTargets.some((u) => u.location.toLowerCase() === t.location.toLowerCase() && u.unit === t.unit)) {
        uniqueTargets.push(t);
      }
    });

    const isToday = isWmsLogToday(veh.dateTime, veh.entryDate);
    const isCarriedForward = veh.isCarriedForward || !isToday;

    const resolvedLocation = uniqueTargets[0]?.location || resolveQueueActualLocation(veh, isUnloadVeh);
    const targetDivision = veh.unit || 'AIL';

    items.push({
      queueKey,
      gateId: veh.id,
      entryDate: veh.entryDate || (veh.dateTime ? veh.dateTime.substring(0, 10) : new Date().toISOString().split('T')[0]),
      vehicle: veh.vehicle,
      vType: veh.vType || '32FT MXL',
      mobile: veh.mobile || 'N/A',
      transporter: veh.transporter || 'N/A',
      purpose: authoritativePurpose,
      unit: targetDivision,
      location: resolvedLocation,
      target_location: resolvedLocation,
      dateTime: veh.dateTime || '',
      remarks: veh.remarks || veh.supervisorNameRemarks,
      grNo: veh.grNo,
      routeType: veh.routeType || 'Single Drop',
      isSplit: uniqueTargets.length > 1,
      totalLocationsInEntry: uniqueTargets.length,
      originalGateEntry: veh,
      allTargets: uniqueTargets.length > 0 ? uniqueTargets : [{ location: resolvedLocation, unit: targetDivision }],
      isCarriedForward,
      status: veh.status || (isCarriedForward ? 'Rollover Pending' : 'Waiting'),
      completed: false,
    });
  });

  return items;
}

