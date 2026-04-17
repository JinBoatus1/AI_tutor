import type { FirebaseApp } from "firebase/app";
import { initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
} from "firebase/auth";

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const firebaseReady =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId);

if (!firebaseReady) {
  console.warn(
    "[Firebase] Missing VITE_FIREBASE_* env vars. Auth is disabled (the app will still work)."
  );
}

export const app: FirebaseApp | null = firebaseReady ? initializeApp(firebaseConfig) : null;
export const auth: Auth | null = app ? getAuth(app) : null;

export const googleProvider: GoogleAuthProvider | null = app ? new GoogleAuthProvider() : null;
export const microsoftProvider: OAuthProvider | null = app ? new OAuthProvider("microsoft.com") : null;
export const appleProvider: OAuthProvider | null = app ? new OAuthProvider("apple.com") : null;
