import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { resetServerTextbookSessionForLogout } from "../learningTextbooks";

interface AuthUser {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  uid: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured; keep app usable without auth.
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

  const login = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") {
        console.error("[Auth] Sign-in failed:", e);
        alert(`Sign-in failed: ${e?.message || e}`);
      }
    }
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    resetServerTextbookSessionForLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
