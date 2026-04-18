import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { API_BASE, apiBlockedByMixedContent } from "./apiBase";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import UserProfile from "./UserProfile";
import SignInModal from "./SignInModal";
import { useAuth } from "./context/AuthContext";

import "./App.css";

function App() {
  const showDeployWarning = apiBlockedByMixedContent();
  const { user, loading, logout, setShowSignIn } = useAuth();
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
              <button className="auth-prompt-signin" onClick={() => setShowSignIn(true)}>
                Sign in
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
        <nav className="navbar" aria-label="Main navigation">
          <Link to="/" className="nav-brand">
            <span className="nav-brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
              </svg>
            </span>
            <span className="nav-brand-text">AI Tutor</span>
          </Link>
          <div className="nav-buttons">
            <Link to="/" className="btn-nav">Home</Link>
            <Link to="/autograder" className="btn-nav">Auto Grader</Link>
            <Link to="/learning" className="btn-nav btn-nav--learning">Learning Mode</Link>
            <Link to="/profile" className="btn-nav" onClick={(e) => {
              if (!user && !loading) {
                e.preventDefault();
                setShowSignIn(true);
              }
            }}>My profile</Link>
          </div>
          <div className="nav-auth">
            {loading ? null : user ? (
              <div className="nav-user-card">
                {user.photoURL && (
                  <div className="nav-avatar-wrap">
                    <img src={user.photoURL} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
                  </div>
                )}
                <span className="nav-user-name">
                  {user.isAnonymous ? "Guest" : (user.displayName || user.email)}
                </span>
                <button className="nav-signout-btn" onClick={logout}>Sign out</button>
              </div>
            ) : (
              <button className="nav-avatar-empty" onClick={() => setShowSignIn(true)} aria-label="Sign in">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
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
            <Route path="/profile" element={<UserProfile />} />
          </Routes>
        </div>

        <SignInModal />
      </div>
    </Router>
  );
}

export default App;
