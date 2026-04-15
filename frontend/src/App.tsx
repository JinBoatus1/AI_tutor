import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { API_BASE, apiBlockedByMixedContent } from "./apiBase";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import { useAuth } from "./context/AuthContext";

import "./App.css";

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

function App() {
  const showDeployWarning = apiBlockedByMixedContent();
  const { user, loading, login, logout } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <Router>
      <div className="app-container">
        {showDeployWarning ? (
          <div className="deploy-config-banner" role="alert">
            <p>
              <strong>Mixed content blocked:</strong> This site is served over HTTPS, but the configured
              API base URL is <code>{API_BASE}</code>. Serve the API over <code>https://</code> and set{" "}
              <code>VITE_API_URL</code> to that HTTPS origin, then rebuild and redeploy.
            </p>
          </div>
        ) : null}
        {!loading && !user && !bannerDismissed && (
          <div className="auth-prompt">
            <div className="auth-prompt-inner">
              <div className="auth-prompt-content">
                <svg className="auth-prompt-lock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <span className="auth-prompt-text">Sign in to save chat history and track your learning progress</span>
              </div>
              <button className="auth-prompt-signin" onClick={login}>
                <GoogleIcon size={16} />
                Sign in with Google
              </button>
              <button className="auth-prompt-close" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        )}
        <nav className="navbar">
          <h2 className="navbar-brand">Equal Education for Everyone</h2>
          <div className="nav-buttons">
            <Link to="/" className="btn-nav">Home</Link>
            <Link to="/autograder" className="btn-nav">Auto Grader</Link>
            <Link to="/learning" className="btn-nav btn-nav--learning">Learning Mode</Link>
            <Link to="/learning-bar" className="btn-nav">My Learning bar</Link>
          </div>
          <div className="nav-auth">
            {loading ? null : user ? (
              <div className="nav-user-card">
                {user.photoURL && (
                  <div className="nav-avatar-wrap">
                    <img src={user.photoURL} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
                  </div>
                )}
                <span className="nav-user-name">{user.displayName || user.email}</span>
                <button className="nav-signout-btn" onClick={logout}>Sign out</button>
              </div>
            ) : (
              <button className="nav-signin-btn" onClick={login}>
                <GoogleIcon size={16} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </nav>

        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/autograder" element={<AutoGrader />} />
            <Route path="/learning" element={<LearningModel />} />
            <Route path="/learning-bar" element={<MyLearningBar />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
