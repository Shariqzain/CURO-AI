import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDSJGelu_9IKCFnK-wKmJI70wDmYDWNV7E",
  authDomain: "curo-ai-96f2a.firebaseapp.com",
  projectId: "curo-ai-96f2a",
  storageBucket: "curo-ai-96f2a.firebasestorage.app",
  messagingSenderId: "309666425443",
  appId: "1:309666425443:web:c0fb30c58403f23de9e656",
  measurementId: "G-61WJPV26CS"
};

// Initialize Firebase only if it hasn't been initialized to prevent Next.js SSR errors
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);