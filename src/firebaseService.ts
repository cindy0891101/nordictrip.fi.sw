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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import type { Member } from './types';
import { compressImage } from './imageUtils';

const firebaseConfig = {
  apiKey: "AIzaSyChx0Ro7ArYxM1CQcBf41mq63p4AEVWZC4",
  authDomain: "fi-travel.firebaseapp.com",
  projectId: "fi-travel",
  storageBucket: "fi-travel.firebasestorage.app",
  messagingSenderId: "158292900207",
  appId: "1:158292900207:web:40d53c028906d66b88109a",
};

const DEFAULT_TRIP_ID = 'trip_2025_nordic_master';

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
export const storage = getStorage(app);

const auth = getAuth(app);

async function ensureAuthReady(): Promise<void> {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('IndexedDB persistence failed:', err.code);
});

export async function uploadMemberAvatar(
  memberId: string,
  file: File,
  currentMembers: Member[]
) {
  await ensureAuthReady();
  // 🔥 新增：壓縮 + 轉 JPEG
  const safeFile = await compressImage(file);

  console.log('Uploading avatar:', {
    originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
    compressedSizeMB: (safeFile.size / 1024 / 1024).toFixed(2),
    type: safeFile.type,
  });

  const avatarRef = ref(
    storage,
    `avatars/${memberId}_${Date.now()}.jpg` // 🔥 避免快取
  );

  await uploadBytes(avatarRef, safeFile);

  const url = await getDownloadURL(avatarRef);

  const updatedMembers = currentMembers.map(m =>
    m.id === memberId ? { ...m, avatar: url } : m
  );

  await updateDoc(
    doc(db, 'trips', DEFAULT_TRIP_ID),
    { members: updatedMembers }
  );

  return url;
}

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









