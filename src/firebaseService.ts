import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import { getStorage,
         ref,
         uploadBytes,
         getDownloadURL} from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyChx0Ro7ArYxM1CQcBf41mq63p4AEVWZC4",
  authDomain: "fi-travel.firebaseapp.com",
  projectId: "fi-travel",
  storageBucket: "fi-travel.appspot.com",
  messagingSenderId: "158292900207",
  appId: "1:158292900207:web:40d53c028906d66b88109a",
};

const DEFAULT_TRIP_ID = 'trip_2025_nordic_master';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch((err) => {
  console.warn('IndexedDB persistence failed:', err.code);
});
async function ensureAuthReady() {
  return new Promise<void>((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) resolve();
    });
  });
}
export async function uploadMemberAvatar(memberId: string, file: File) {
  await ensureAuthReady();

  const avatarRef = ref(storage, `avatars/${memberId}.jpg`);
  await uploadBytes(avatarRef, file);

  const url = await getDownloadURL(avatarRef);

  await updateDoc(doc(db, 'trips', DEFAULT_TRIP_ID, 'members', memberId)), {
    avatar: url
  });

  return url;
}

const auth = getAuth(app);

export const dbService = {
  initAuth: () =>
    new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (!user) signInAnonymously(auth);
        resolve(user);
      });
    }),

  subscribeField: (field: string, cb: (data: any) => void) => {
    const ref = doc(db, 'trips', DEFAULT_TRIP_ID);
    return onSnapshot(ref, (snap) => {
      cb(snap.exists() ? snap.data()[field] : undefined);
    });
  },

  updateField: async (field: string, value: any) => {
    const ref = doc(db, 'trips', DEFAULT_TRIP_ID);
    try {
      await updateDoc(ref, { [field]: value });
    } catch {
      await setDoc(ref, { [field]: value }, { merge: true });
    }
  },

};
