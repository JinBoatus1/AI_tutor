import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { API_BASE, apiBlockedByMixedContent } from "./apiBase";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import UserProfile from "./UserProfile";
import Grades from "./Grades";
import SignInModal from "./SignInModal";
import FeedbackModal from "./feedback/FeedbackModal";
import Sidebar from "./components/Sidebar";
import OnboardingTour from "./components/OnboardingTour";
import { OnboardingProvider } from "./context/OnboardingContext";

import "./App.css";

function AppShell() {
  const showDeployWarning = apiBlockedByMixedContent();
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
        <FeedbackModal />
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
