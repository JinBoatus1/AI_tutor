import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Home.css";

function IconPolya() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="none" stroke="url(#home-grad-a)" strokeWidth="1.5" opacity="0.35" />
      <path
        fill="none"
        stroke="url(#home-grad-a)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 32V16l8 8 8-8v16"
      />
      <circle cx="24" cy="14" r="2" fill="url(#home-grad-a)" />
    </svg>
  );
}

function IconGrade() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="28" height="22" rx="3" fill="none" stroke="url(#home-grad-b)" strokeWidth="1.75" />
      <path d="M16 22h16M16 28h10" stroke="url(#home-grad-b)" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M30 8l4 4-4 4"
        fill="none"
        stroke="url(#home-grad-b)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAdaptive() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-c" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="20" r="8" fill="none" stroke="url(#home-grad-c)" strokeWidth="1.75" />
      <path
        d="M14 36c4-6 20-6 24 0"
        fill="none"
        stroke="url(#home-grad-c)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="24" cy="20" r="3" fill="url(#home-grad-c)" opacity="0.4" />
    </svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Home() {
  const { user, loading, login } = useAuth();

  return (
    <div className="home-page">
      <div className="home-page-bg" aria-hidden />

      <section className="home-hero">
        <p className="home-eyebrow">AI Tutor</p>
        <h1 className="home-headline">Equal Education for Everyone</h1>
        <p className="home-lede">
          Step-by-step reasoning, textbook-grounded answers, and instant feedback — in one place.
        </p>
        <div className="home-actions">
          <Link to="/learning" className="home-btn home-btn--primary">
            Learning Mode
          </Link>
          <Link to="/autograder" className="home-btn home-btn--ghost">
            Auto Grader
          </Link>
          <Link to="/learning-bar" className="home-btn home-btn--ghost">
            My Learning bar
          </Link>
        </div>
      </section>

      {!loading && !user && (
        <section className="home-signin-section" aria-label="Sign in">
          <div className="home-signin-card">
            <div className="home-signin-glow" aria-hidden />
            <div className="home-signin-content">
              <div className="home-signin-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="home-signin-text">
                <h2 className="home-signin-title">Save your learning journey</h2>
                <p className="home-signin-desc">Keep your chat history, track mastered topics, and pick up right where you left off.</p>
              </div>
              <button className="home-signin-btn" onClick={login}>
                <GoogleIcon size={18} />
                Sign in with Google
              </button>
            </div>
          </div>
        </section>
      )}

      {!loading && user && (
        <section className="home-welcome-section">
          <div className="home-welcome-card">
            {user.photoURL && (
              <img src={user.photoURL} alt="" className="home-welcome-avatar" referrerPolicy="no-referrer" />
            )}
            <div className="home-welcome-text-wrap">
              <p className="home-welcome-greeting">Welcome back, <strong>{user.displayName || user.email}</strong></p>
              <p className="home-welcome-sub">Your progress is saved and synced.</p>
            </div>
          </div>
        </section>
      )}

      <section className="home-features" aria-label="Features">
        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconPolya />
          </div>
          <h2 className="home-feature-title">Step-by-Step Teaching</h2>
          <p className="home-feature-desc">Interactive guidance inspired by Polya's method — understand the problem before the proof.</p>
        </article>

        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconGrade />
          </div>
          <h2 className="home-feature-title">Auto Grading</h2>
          <p className="home-feature-desc">Submit text or images and get structured feedback when you need it.</p>
        </article>

        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconAdaptive />
          </div>
          <h2 className="home-feature-title">Adaptive Learning</h2>
          <p className="home-feature-desc">Responses tuned to your chapter and pace, with memory of what you've covered.</p>
        </article>
      </section>
    </div>
  );
}
