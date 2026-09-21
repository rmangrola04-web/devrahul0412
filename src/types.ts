export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'SECURITY' | 'OPERATOR';

export interface UserAccount {
  user: string;
  pass: string;
  role: UserRole;
  name: string;
}

export interface PlanEntry {
  id: string;
  deliveryNo: string;
  code: string;
  unit: string;
  destination: string;
  weight: number;
  cft: number;
  vType: string;
  transporter: string;
  mode?: string;
  status?: string;
  isCarriedForward?: boolean;
  updatedAt?: string;
  tripId?: string;
  date?: string;
  planDate?: string;
  targetDate?: string;
  entryDate?: string;
  createdAt?: string;
  archivedAt?: string;
  vehicleNo?: string;
  vehNo?: string;
}

export interface ShuttleStep {
  id: string;
  unit: string;
  bayNo: string;
  destination: string;
  cases: number | string;
  status: 'PENDING' | 'IN-PROGRESS' | 'COMPLETED';
  startTime?: string;
  endTime?: string;
  operator?: string;
  remarks?: string;
  assignedDock?: string;
}

export interface LoadUnloadEntry {
  entryDate?: string;
  id: string;
  gateId?: string;
  opType: 'LOADING' | 'UNLOADING';
  unit: string;
  bayNo: string;
  assignedDock?: string;
  vehicleNo: string;
  vType?: string;
  fromLoc: string;
  toLoc: string;
  transporter: string;
  operator: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: 'PENDING' | 'LOADING IN-PROGRESS' | 'UNLOADING IN-PROGRESS' | 'LOADED' | 'UNLOADED' | 'SHUTTLE TRANSIT';
  totalCases: number | string;
  dest1?: string;
  cases1?: number | string;
  dest2?: string;
  cases2?: number | string;
  damagedCases?: number | string;
  damagedValue?: number | string;
  podStatus?: string;
  sealNo?: string;
  remarks?: string;
  grNo?: string;
  deliveryNo?: string;
  planId?: string;
  shuttleSteps?: ShuttleStep[];
  currentStepIndex?: number;
  milkRouteDestinations?: {location: string, unit: string}[];
}

export interface SecurityGateEntry {
  entryDate?: string;
  id: string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  vehicle: string;
  vType: string;
  mobile: string;
  transporter: string;
  fromLoc: string;
  toLoc: string;
  dateTime: string;
  remarks: string;
  unit?: string;
  grNo?: string;
  routeType?: string;
  milkRouteDestinations?: {location: string, unit: string}[];
  assignedDock?: string;
  bayNo?: string;
  loadingStartInTime?: string;
  loadingExitTime?: string;
  totalCases?: number | string;
  supervisorNameRemarks?: string;
  multiDestinations?: string[];
  status?: string;
  isCarriedForward?: boolean;
  destination?: string;
  target_location?: string;
}

export interface WaitingQueueItem {
  queueKey: string;
  gateId: string;
  entryDate?: string;
  vehicle: string;
  vType: string;
  mobile: string;
  transporter: string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  unit: string;
  location: string;
  target_location?: string;
  dateTime: string;
  remarks?: string;
  grNo?: string;
  routeType?: string;
  isSplit: boolean;
  totalLocationsInEntry: number;
  originalGateEntry: SecurityGateEntry;
  allTargets?: { location: string; unit: string }[];
  isCarriedForward?: boolean;
  status?: string;
  completed?: boolean;
}

export interface TrackingRecord {
  id: string;
  entryDate?: string;
  invoiceNo: string;
  invoiceDate: string;
  receivingPlant: string;
  mode: string;
  transporter: string;
  lrNo: string;
  lrDate: string;
  vehicleNo: string;
  vType?: string;
  expectedDate: string;
  deliveryDate: string;
  status?: string;
}

export interface MasterTransportItem {
  transporter: string;
  vehicleType: string;
}
