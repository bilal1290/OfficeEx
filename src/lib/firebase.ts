import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

function readEnv(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? '';
}

export const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: readEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

export const missingFirebaseKeys = (
  [
    ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
    ['VITE_FIREBASE_DATABASE_URL', firebaseConfig.databaseURL],
    ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
    ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
  ] as const
).filter(([, value]) => !value).map(([key]) => key);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let analytics: Analytics | null = null;

if (isFirebaseConfigured) {
  const { measurementId, ...requiredConfig } = firebaseConfig;
  app = initializeApp(
    measurementId ? { ...requiredConfig, measurementId } : requiredConfig,
  );
  auth = getAuth(app);
  db = getDatabase(app);

  if (measurementId && typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
}

export { app, auth, db, analytics };
