import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { resetServerTextbookSessionForLogout } from "../learningTextbooks";

interface AuthUser {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  uid: string;
  isAnonymous: boolean;
}

export type AuthMethod = "google" | "email" | "anonymous";

/**
 * How often to ask Firebase for the ID token. ID tokens last an hour, and Firebase hands back
 * the cached one until it is within five minutes of expiring, then refreshes it. Asking more
 * often than every five minutes keeps `token` valid for as long as the tab stays open.
 */
const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  loginWithProvider: (method: AuthMethod) => Promise<void>;
  loginWithEmail: (email: string, password: string, isSignUp: boolean) => Promise<void>;
  logout: () => Promise<void>;
  showSignIn: boolean;
  setShowSignIn: (v: boolean) => void;
  /** Asks Firebase for a token now: the cached one, or a new one when it is close to expiring. */
  getFreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn("[Auth] onAuthStateChanged did not fire within 3 s — forcing loading=false");
        settled = true;
        setLoading(false);
      }
    }, 3000);

    try {
      unsub = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        settled = true;
        clearTimeout(timeout);
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken(true);
          setUser({
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            uid: firebaseUser.uid,
            isAnonymous: firebaseUser.isAnonymous,
          });
          setToken(idToken);
        } else {
          resetServerTextbookSessionForLogout();
          setUser(null);
          setToken(null);
        }
        setLoading(false);
      });
    } catch (e) {
      console.error("[Auth] Firebase auth init failed:", e);
      clearTimeout(timeout);
      setLoading(false);
    }
    return () => {
      clearTimeout(timeout);
      unsub?.();
    };
  }, []);

  // The token above is fetched once per sign-in. Keep it fresh, or a tab left open for more
  // than an hour starts failing every signed-in request.
  useEffect(() => {
    if (!auth) return;
    const firebaseAuth = auth;
    const refresh = () => {
      const current = firebaseAuth.currentUser;
      if (!current) return;
      current
        .getIdToken()
        .then((fresh) => {
          // A token that arrives after sign-out, or after switching accounts, is stale.
          if (firebaseAuth.currentUser?.uid === current.uid) setToken(fresh);
        })
        .catch(() => {
          // Offline or a transient Firebase error: keep the current token and retry next time.
        });
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(refresh, TOKEN_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("online", refresh);
    };
  }, []);

  const loginWithProvider = async (method: AuthMethod) => {
    if (!auth) return;
    try {
      if (method === "anonymous") {
        await signInAnonymously(auth);
      } else {
        const provider = method === "google" ? googleProvider : null;
        if (!provider) return;
        await signInWithPopup(auth, provider);
      }
      setShowSignIn(false);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") {
        console.error("[Auth] Sign-in failed:", e);
        throw e;
      }
    }
  };

  const loginWithEmail = async (email: string, password: string, isSignUp: boolean) => {
    if (!auth) return;
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowSignIn(false);
    } catch (e: any) {
      console.error("[Auth] Email sign-in failed:", e);
      throw e;
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    resetServerTextbookSessionForLogout();
  };

  const getFreshToken = useCallback(async () => {
    const current = auth?.currentUser;
    return current ? current.getIdToken() : null;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      loginWithProvider, loginWithEmail,
      logout, showSignIn, setShowSignIn,
      getFreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
