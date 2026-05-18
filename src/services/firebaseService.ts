import { getFirestore, initializeFirestore, collection, addDoc, setDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { VesselApplication } from '../types';

if (!firebaseConfig) {
  console.error("firebase-applet-config.json is missing");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const saveApplicationToFirestore = async (application: Partial<VesselApplication> & { id?: string }) => {
  const { id, ...appData } = application;
  const newApp = {
    ...appData,
    createdAt: application.createdAt || new Date().toISOString(),
    status: application.status || 'Pending'
  };
  
  if (id) {
    await setDoc(doc(db, 'applications', id), newApp);
    return { id, ...newApp } as VesselApplication;
  } else {
    const docRef = await addDoc(collection(db, 'applications'), newApp);
    return { id: docRef.id, ...newApp } as VesselApplication;
  }
};

export const updateApplicationStatusInFirestore = async (id: string, status: 'Approved' | 'Rejected') => {
  const docRef = doc(db, 'applications', id);
  await updateDoc(docRef, { status });
};

export const updateApplicationInFirestore = async (id: string, data: Partial<VesselApplication>) => {
  const docRef = doc(db, 'applications', id);
  await updateDoc(docRef, data);
};

export const deleteApplicationFromFirestore = async (id: string) => {
  const docRef = doc(db, 'applications', id);
  await deleteDoc(docRef);
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
    console.error("Firestore Error:", error);
  });
};
