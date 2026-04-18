import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import type { AuthMethod } from "./context/AuthContext";
import "./SignInModal.css";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M22 4l-10 8L2 4"/>
    </svg>
  );
}

function AnonymousIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

type View = "main" | "email";

export default function SignInModal() {
  const { showSignIn, setShowSignIn, loginWithProvider, loginWithEmail } = useAuth();
  const [view, setView] = useState<View>("main");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  if (!showSignIn) return null;

  const reset = () => {
    setView("main");
    setError(null);
    setBusy(false);
    setEmail("");
    setPassword("");
    setIsSignUp(false);
  };

  const close = () => {
    reset();
    setShowSignIn(false);
  };

  const handleProvider = async (method: AuthMethod) => {
    setError(null);
    setBusy(true);
    try {
      await loginWithProvider(method);
    } catch (e: any) {
      setError(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithEmail(email, password, isSignUp);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else if (code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in instead.");
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
      } else {
        setError(err?.message || "Sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin-overlay" onClick={close}>
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        {/* Decorative brand panel */}
        <div className="signin-brand">
          <svg className="signin-brand-deco" viewBox="0 0 220 480" fill="none" aria-hidden>
            <circle cx="170" cy="60" r="130" fill="rgba(255,255,255,0.03)" />
            <circle cx="40" cy="380" r="100" fill="rgba(255,255,255,0.02)" />
            <circle cx="190" cy="300" r="50" fill="rgba(94,234,212,0.05)" />
            <line x1="0" y1="160" x2="220" y2="175" stroke="rgba(94,234,212,0.06)" strokeWidth="0.5" />
            <line x1="0" y1="240" x2="220" y2="225" stroke="rgba(94,234,212,0.04)" strokeWidth="0.5" />
          </svg>
          <div className="signin-brand-inner">
            <div className="signin-brand-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
              </svg>
            </div>
            <h3 className="signin-brand-title">AI Tutor</h3>
            <p className="signin-brand-tagline">Personalized math learning, powered by AI</p>
          </div>
        </div>

        {/* Form panel */}
        <div className="signin-form-panel">
          <button className="signin-close" onClick={close} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div className="signin-header">
            <h2 className="signin-title">
              {view === "main" ? "Welcome" : isSignUp ? "Create account" : "Email sign-in"}
            </h2>
            <p className="signin-subtitle">
              {view === "main" ? "Sign in to save your progress" : "Save your progress and chat history"}
            </p>
          </div>

          {error && <div className="signin-error">{error}</div>}

          {view === "main" && (
            <div className="signin-providers">
              <button className="signin-provider-btn signin-provider--google" onClick={() => handleProvider("google")} disabled={busy}>
                <span className="signin-provider-icon signin-provider-icon--google"><GoogleIcon /></span>
                Continue with Google
              </button>

              <button className="signin-provider-btn signin-provider--email" onClick={() => { setError(null); setView("email"); }} disabled={busy}>
                <span className="signin-provider-icon signin-provider-icon--email"><EmailIcon /></span>
                Continue with email
              </button>

              <div className="signin-divider"><span>or</span></div>

              <button className="signin-provider-btn signin-provider--anonymous" onClick={() => handleProvider("anonymous")} disabled={busy}>
                <span className="signin-provider-icon signin-provider-icon--anon"><AnonymousIcon /></span>
                Continue as guest
              </button>
            </div>
          )}

          {view === "email" && (
            <form className="signin-form" onSubmit={handleEmailSubmit}>
              <input
                className="signin-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                className="signin-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button className="signin-submit-btn" type="submit" disabled={busy}>
                {busy ? "..." : isSignUp ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                className="signin-toggle-link"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </button>
              <button type="button" className="signin-back-link" onClick={reset}>Back to all options</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
