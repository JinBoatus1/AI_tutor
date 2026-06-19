import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { API_BASE, apiBlockedByMixedContent } from "./apiBase";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import UserProfile from "./UserProfile";
import Grades from "./Grades";
import SignInModal from "./SignInModal";
import Sidebar from "./components/Sidebar";
import OnboardingTour from "./components/OnboardingTour";
import { OnboardingProvider } from "./context/OnboardingContext";
import { useAuth } from "./context/AuthContext";

import "./App.css";

function AppShell() {
  const showDeployWarning = apiBlockedByMixedContent();
  const { user, loading, setShowSignIn } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className={`app-container${isHome ? " app-container--home" : ""}`}>
      {!isHome && <Sidebar />}
      <div className="app-main">
        {!isHome && showDeployWarning ? (
          <div className="deploy-config-banner" role="alert">
            <p>
              <strong>Mixed content blocked:</strong> This site is served over HTTPS, but the configured
              API base URL is <code>{API_BASE}</code>. Serve the API over <code>https://</code> and set{" "}
              <code>VITE_API_URL</code> to that HTTPS origin, then rebuild and redeploy.
            </p>
          </div>
        ) : null}
        {!isHome && !loading && !user && !bannerDismissed && (
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

        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/autograder" element={<AutoGrader />} />
            <Route path="/learning" element={<LearningModel />} />
            <Route path="/learning-bar" element={<MyLearningBar />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/grades" element={<Grades />} />
          </Routes>
        </div>

        <SignInModal />
        <OnboardingTour />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <OnboardingProvider>
        <AppShell />
      </OnboardingProvider>
    </Router>
  );
}

export default App;
