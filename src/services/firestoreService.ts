import {
  db,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch
} from '../firebase';
import {
  UserAccount,
  PlanEntry,
  LoadUnloadEntry,
  SecurityGateEntry,
  TrackingRecord
} from '../types';

// Collection Names in Firestore
export const COLLECTIONS = {
  OPERATIONS: 'ich_operations',
  SECURITY_LOGS: 'ich_security_logs',
  PLAN_ENTRIES: 'ich_plan_entries',
  TRACKING_RECORDS: 'ich_tracking_records',
  USERS: 'ich_users',
  MASTER_TRANSPORTERS: 'ich_master_transporters',
  MASTER_VEHICLE_TYPES: 'ich_master_vehicle_types',
  MASTER_LOAD_LOCATIONS: 'ich_master_load_locations',
  MASTER_UNLOAD_LOCATIONS: 'ich_master_unload_locations',
  MASTER_SUPERVISORS: 'ich_master_supervisors',
  ARCHIVED_PLAN_ENTRIES: 'ich_archived_plan_entries'
};

// ==========================================
// REAL-TIME LISTENERS (onSnapshot)
// ==========================================

// Helper function to normalize any raw date string/number/timestamp into YYYY-MM-DD local format
function normalizeDateToYmd(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  }
  const str = String(val).trim();
  if (!str) return '';

  // 1. YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // 2. DD/MM/YYYY
  const slash = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slash) {
    const p1 = parseInt(slash[1], 10);
    const p2 = parseInt(slash[2], 10);
    const year = slash[3];
    let month: number;
    let day: number;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      month = p1;
      day = p2;
    } else {
      // Indian DD/MM/YYYY default
      day = p1;
      month = p2;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return '';
}

export const subscribeToOperations = (
  callback: (data: LoadUnloadEntry[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTIONS.OPERATIONS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: LoadUnloadEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as LoadUnloadEntry;
        list.push({ ...item, id: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Operations offline; serving from local cache.');
      } else {
        console.error('Firestore onSnapshot error for subscribeToOperations:', err);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToSecurityLogs = (
  callback: (data: SecurityGateEntry[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTIONS.SECURITY_LOGS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: SecurityGateEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as SecurityGateEntry;
        list.push({ ...item, id: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Security Logs offline; serving from local cache.');
      } else {
        console.error('Firestore onSnapshot error for subscribeToSecurityLogs:', err);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToPlanEntries = (
  callback: (data: PlanEntry[]) => void,
  onError?: (err: any) => void,
  startDateIso?: string,
  endDateIso?: string
) => {
  const colRef = collection(db, COLLECTIONS.PLAN_ENTRIES);
  
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        if (startDateIso && endDateIso) {
          const itemRaw = item.date || item.planDate || item.targetDate || item.entryDate || item.createdAt || item.updatedAt || '';
          let dateStr = itemRaw;
          if (!dateStr && item.id.startsWith('PLAN-')) {
            const m = item.id.match(/PLAN-(\d{12,14})/);
            if (m) dateStr = new Date(Number(m[1])).toISOString();
          }
          if (dateStr) {
            const itemYmd = dateStr.slice(0, 10);
            const startYmd = startDateIso.slice(0, 10);
            const endYmd = endDateIso.slice(0, 10);
            if (itemYmd < startYmd || itemYmd > endYmd) {
              return;
            }
          } else {
            return;
          }
        }
        list.push(item);
      });

      list.sort((a, b) => {
        const aTime = a.updatedAt || a.date || a.createdAt ? new Date(a.updatedAt || a.date || a.createdAt || '').getTime() : 0;
        const bTime = b.updatedAt || b.date || b.createdAt ? new Date(b.updatedAt || b.date || b.createdAt || '').getTime() : 0;
        return bTime - aTime;
      });

      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Plan Entries offline; serving from local cache.');
      } else {
        console.error('Firestore onSnapshot error for subscribeToPlanEntries:', err);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToTrackingRecords = (
  callback: (data: TrackingRecord[]) => void,
  onError?: (err: any) => void,
  startDateIso?: string,
  endDateIso?: string
) => {
  const colRef = collection(db, COLLECTIONS.TRACKING_RECORDS);
  let q: any = colRef;
  if (startDateIso && endDateIso) {
    q = query(colRef, where('updatedAt', '>=', startDateIso), where('updatedAt', '<=', endDateIso));
  }
  return onSnapshot(
    q,
    (snapshot) => {
      const list: TrackingRecord[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as TrackingRecord;
        list.push({ ...item, id: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Tracking Records offline; serving from local cache.');
      } else {
        console.error('Firestore onSnapshot error for subscribeToTrackingRecords:', err);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToUsers = (
  callback: (data: UserAccount[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, COLLECTIONS.USERS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as UserAccount;
        list.push({ ...item, user: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn('Firestore Users offline; serving from local cache.');
      } else {
        console.error('Firestore Users onSnapshot error:', err);
      }
      if (onError) onError(err);
    }
  );
};

export const subscribeToMasterList = (
  collectionName: string,
  callback: (data: string[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const docsData: { name: string; order?: number }[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const val = data?.name || docSnap.id;
        if (val) {
          docsData.push({
            name: String(val).trim(),
            order: typeof data?.order === 'number' ? data.order : 999999
          });
        }
      });
      // Sort by original inserted order
      docsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const list = docsData.map((d) => d.name);
      if (list.length > 0) {
        callback(list);
      }
    },
    (err) => {
      if (err?.code === 'unavailable') {
        console.warn(`Firestore ${collectionName} offline; using local cache.`);
      } else {
        console.error(`Firestore ${collectionName} onSnapshot error:`, err);
      }
      if (onError) onError(err);
    }
  );
};

// ==========================================
// FIRESTORE CRUD OPERATIONS (addDoc, setDoc, deleteDoc)
// ==========================================

// Operations (Loading / Unloading)
export const saveOperationToFirestore = async (op: LoadUnloadEntry): Promise<string> => {
  const cleanData: Record<string, any> = {
    ...op,
    entryDate: op.entryDate || new Date().toISOString().split('T')[0],
    totalCases: op.totalCases !== undefined && op.totalCases !== ('' as any) ? Number(op.totalCases) : 0,
    damagedCases: op.damagedCases !== undefined && op.damagedCases !== ('' as any) ? Number(op.damagedCases) : 0,
    damagedValue: op.damagedValue !== undefined && op.damagedValue !== ('' as any) ? Number(op.damagedValue) : 0,
    updatedAt: new Date().toISOString()
  };

  // Remove undefined values
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  });

  if (op.id && !op.id.startsWith('temp-')) {
    const docRef = doc(db, COLLECTIONS.OPERATIONS, op.id);
    await setDoc(docRef, cleanData, { merge: true });
    return op.id;
  } else {
    const colRef = collection(db, COLLECTIONS.OPERATIONS);
    const res = await addDoc(colRef, cleanData);
    return res.id;
  }
};

export const deleteOperationFromFirestore = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.OPERATIONS, id);
  await deleteDoc(docRef);
};

// Security Gate Logs
export const saveSecurityEntryToFirestore = async (entry: SecurityGateEntry): Promise<string> => {
  const cleanData: Record<string, any> = {
    ...entry,
    entryDate: entry.entryDate || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) delete cleanData[key];
  });

  if (entry.id && !entry.id.startsWith('temp-')) {
    const docRef = doc(db, COLLECTIONS.SECURITY_LOGS, entry.id);
    await setDoc(docRef, cleanData, { merge: true });
    return entry.id;
  } else {
    const colRef = collection(db, COLLECTIONS.SECURITY_LOGS);
    const res = await addDoc(colRef, cleanData);
    return res.id;
  }
};

export const deleteSecurityEntryFromFirestore = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.SECURITY_LOGS, id);
  await deleteDoc(docRef);
};

// Plan Entries
export const savePlanEntriesToFirestore = async (entries: PlanEntry[]): Promise<void> => {
  const todayIso = new Date().toISOString().split('T')[0];
  for (const entry of entries) {
    const cleanData: Record<string, any> = {
      ...entry,
      date: entry.date || entry.planDate || entry.targetDate || entry.entryDate || todayIso,
      updatedAt: new Date().toISOString()
    };
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === undefined) delete cleanData[key];
    });
    if (entry.id && !entry.id.startsWith('temp-')) {
      const docRef = doc(db, COLLECTIONS.PLAN_ENTRIES, entry.id);
      await setDoc(docRef, cleanData, { merge: true });
    } else {
      const colRef = collection(db, COLLECTIONS.PLAN_ENTRIES);
      await addDoc(colRef, cleanData);
    }
  }
};

export const deletePlanEntryFromFirestore = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.PLAN_ENTRIES, id);
  await deleteDoc(docRef);
};

// Tracking Records
export const saveTrackingRecordsToFirestore = async (records: TrackingRecord[]): Promise<void> => {
  for (const rec of records) {
    const cleanData: Record<string, any> = {
      ...rec,
      updatedAt: new Date().toISOString()
    };
    if (rec.id && !rec.id.startsWith('temp-')) {
      const docRef = doc(db, COLLECTIONS.TRACKING_RECORDS, rec.id);
      await setDoc(docRef, cleanData, { merge: true });
    } else {
      const colRef = collection(db, COLLECTIONS.TRACKING_RECORDS);
      await addDoc(colRef, cleanData);
    }
  }
};

export const deleteTrackingRecordFromFirestore = async (id: string): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.TRACKING_RECORDS, id);
  await deleteDoc(docRef);
};

// User Accounts
export const saveUserToFirestore = async (user: UserAccount): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.USERS, user.user.toLowerCase().trim());
  await setDoc(docRef, {
    user: user.user.toLowerCase().trim(),
    pass: user.pass,
    role: user.role,
    name: user.name || user.user,
    updatedAt: new Date().toISOString()
  });
};

// Master Lists Bulk Sync & Reconciliation (Replaces and cleans old items with no limitation)
export const syncMasterListToFirestore = async (collectionName: string, items: string[]): Promise<void> => {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    
    // Create clean unique list of items
    const seen = new Set<string>();
    const validItems: string[] = [];
    for (const raw of items) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean.length > 0 && !seen.has(clean.toUpperCase())) {
          seen.add(clean.toUpperCase());
          validItems.push(clean);
        }
      }
    }

    // 1. Delete existing documents in chunks of 400 using writeBatch
    const existingDocIds: string[] = [];
    snapshot.forEach((docSnap) => {
      existingDocIds.push(docSnap.id);
    });

    for (let i = 0; i < existingDocIds.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = existingDocIds.slice(i, i + 400);
      chunk.forEach((id) => {
        batch.delete(doc(db, collectionName, id));
      });
      await batch.commit();
    }

    // 2. Insert all items in chunks of 400 using writeBatch with safe doc IDs
    const getDocId = (name: string, index: number) => {
      const clean = name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase().slice(0, 80);
      return clean.length > 0 ? `${clean}_${index}` : `ITEM_${index}`;
    };

    for (let i = 0; i < validItems.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = validItems.slice(i, i + 400);
      chunk.forEach((item, chunkIdx) => {
        const itemIdx = i + chunkIdx;
        const docId = getDocId(item, itemIdx);
        batch.set(doc(db, collectionName, docId), {
          name: item,
          order: itemIdx,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error(`Error syncing master list for ${collectionName}:`, error);
  }
};

export const archivePlanEntriesToFirestore = async (entries: PlanEntry[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    entries.forEach((entry) => {
      // Add to archived collection
      const archivedRef = doc(db, COLLECTIONS.ARCHIVED_PLAN_ENTRIES, entry.id);
      batch.set(archivedRef, {
        ...entry,
        status: 'Confirmed Plan',
        archivedAt: (entry as any).archivedAt || nowIso,
        updatedAt: nowIso
      });
      
      // Delete from active collection
      const activeRef = doc(db, COLLECTIONS.PLAN_ENTRIES, entry.id);
      batch.delete(activeRef);
    });
    await batch.commit();
  } catch (error) {
    console.error('Error archiving plan entries:', error);
    throw error;
  }
};

export const subscribeToArchivedPlanEntries = (
  callback: (data: PlanEntry[]) => void,
  startDate?: string,
  endDate?: string
) => {
  const colRef = collection(db, COLLECTIONS.ARCHIVED_PLAN_ENTRIES);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        if (startDate && endDate) {
          const itemRaw = (item as any).archivedAt || item.date || item.planDate || item.targetDate || item.entryDate || item.updatedAt || item.createdAt || '';
          let dateStr = itemRaw;
          if (!dateStr && item.id.startsWith('PLAN-')) {
            const m = item.id.match(/PLAN-(\d{12,14})/);
            if (m) dateStr = new Date(Number(m[1])).toISOString();
          }
          if (dateStr) {
            const itemYmd = dateStr.slice(0, 10);
            const startYmd = startDate.slice(0, 10);
            const endYmd = endDate.slice(0, 10);
            if (itemYmd < startYmd || itemYmd > endYmd) {
              return;
            }
          } else {
            return;
          }
        }
        list.push(item);
      });

      list.sort((a, b) => {
        const aTime = (a as any).archivedAt || a.updatedAt ? new Date((a as any).archivedAt || a.updatedAt || '').getTime() : 0;
        const bTime = (b as any).archivedAt || b.updatedAt ? new Date((b as any).archivedAt || b.updatedAt || '').getTime() : 0;
        return bTime - aTime;
      });

      callback(list);
    },
    (err) => {
      console.error('Firestore onSnapshot error for subscribeToArchivedPlanEntries:', err);
    }
  );
};
