import { getFirestore, initializeFirestore, collection, addDoc, setDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { VesselApplication } from '../types';

if (!firebaseConfig) {
  console.error("firebase-applet-config.json is missing");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
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
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const firebaseLogout = async () => {
  await signOut(auth);
};

export const observeAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
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
    const docRef = doc(db, 'applications', id);
    await setDoc(docRef, data, { merge: true });
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
      id: doc.id,
      ...doc.data()
    })) as VesselApplication[];
    callback(apps);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'applications');
  });
};
