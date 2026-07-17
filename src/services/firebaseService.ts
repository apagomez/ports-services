import { getFirestore, initializeFirestore, collection, addDoc, setDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocFromServer, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { VesselApplication } from '../types';
import { safeStorage } from '../utils/safeStorage';

if (!firebaseConfig) {
  console.error("firebase-applet-config.json is missing");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
} as any, firebaseConfig.firestoreDatabaseId || '(default)');
let _auth: any = null;
export const getAuthInstance = () => {
  if (!_auth) {
    _auth = getAuth(app);
  }
  return _auth;
};

// Connectivity validation mandated by Firebase Integration Skill
async function testFirestoreConnectionOnBoot() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successfully verified on boot.");
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
      console.warn("Firestore connection check warning: Device operates in offline/restricted sandbox mode.", error);
    } else {
      console.log("Firestore connection check skipped or complete.", error);
    }
  }
}
testFirestoreConnectionOnBoot();

// Complies with the Firestore Integration Skill for structured error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: getAuthInstance().currentUser?.uid,
      email: getAuthInstance().currentUser?.email,
      emailVerified: getAuthInstance().currentUser?.emailVerified,
      isAnonymous: getAuthInstance().currentUser?.isAnonymous,
      tenantId: getAuthInstance().currentUser?.tenantId,
      providerInfo: getAuthInstance().currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Structured Firestore Error Logs: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  const result = await signInWithPopup(getAuthInstance(), provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    safeStorage.setItem('google_access_token', credential.accessToken);
  }
  return result.user;
};

export const firebaseLogout = async () => {
  await signOut(getAuthInstance());
};

export const observeAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(getAuthInstance(), callback);
};

export const saveApplicationToFirestore = async (application: Partial<VesselApplication> & { id?: string }) => {
  const { id, ...appData } = application;
  const newApp = {
    ...appData,
    createdAt: application.createdAt || new Date().toISOString(),
    status: application.status || 'Pending Check'
  };
  
  try {
    if (id) {
      await setDoc(doc(db, 'applications', id), newApp);
      return { id, ...newApp } as VesselApplication;
    } else {
      const docRef = await addDoc(collection(db, 'applications'), newApp);
      return { id: docRef.id, ...newApp } as VesselApplication;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, id ? `applications/${id}` : 'applications');
  }
};

export const updateApplicationStatusInFirestore = async (id: string, status: VesselApplication['status']) => {
  try {
    const docRef = doc(db, 'applications', id);
    await setDoc(docRef, { status }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `applications/${id}`);
  }
};

export const updateApplicationInFirestore = async (id: string, data: Partial<VesselApplication>) => {
  try {
    const newId = data.id;
    if (newId && newId !== id) {
      const oldDocRef = doc(db, 'applications', id);
      const oldSnap = await getDoc(oldDocRef);
      let mergedPayload = {};
      if (oldSnap.exists()) {
        mergedPayload = { ...oldSnap.data(), ...data };
      } else {
        mergedPayload = { ...data };
      }
      delete (mergedPayload as any).id;
      
      const newDocRef = doc(db, 'applications', newId);
      await setDoc(newDocRef, mergedPayload);
      await deleteDoc(oldDocRef);
    } else {
      const { id: _, ...payload } = data as any;
      const docRef = doc(db, 'applications', id);
      await setDoc(docRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `applications/${id}`);
  }
};

export const deleteApplicationFromFirestore = async (id: string) => {
  try {
    const docRef = doc(db, 'applications', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `applications/${id}`);
  }
};

export const subscribeToApplications = (callback: (apps: VesselApplication[]) => void) => {
  console.log('Subscribing to applications...');
  const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    console.log('Firestore snapshot received. Size:', snapshot.size, 'Docs:', snapshot.docs.map(d => d.id));
    const apps = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as VesselApplication[];
    callback(apps);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'applications');
  });
};
