import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyB5OKNxpdv2mgRkCt0oIsvM8MLoS2zKb8A",
  authDomain: "ich-indore-v3.firebaseapp.com",
  projectId: "ich-indore-v3",
  storageBucket: "ich-indore-v3.firebasestorage.app",
  messagingSenderId: "300004032729",
  appId: "1:300004032729:web:ff8b48d345f8fa9189bec8"
};

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use experimentalForceLongPolling to avoid WebChannel streaming failures in proxies/containers,
// and enable persistentLocalCache for smooth offline operation.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);

export {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,  where,
  orderBy,
  writeBatch
};
