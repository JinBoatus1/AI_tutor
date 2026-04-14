import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { API_BASE, apiBlockedByMixedContent } from "./apiBase";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";

import "./App.css";

function App() {
  const showDeployWarning = apiBlockedByMixedContent();

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
        <nav className="navbar">
          <h2 className="navbar-brand">Equal Education for Everyone</h2>
            <div className="nav-buttons">
                <Link to="/" className="btn-nav">Home</Link>
                <Link to="/autograder" className="btn-nav">Auto Grader</Link>
                <Link to="/learning" className="btn-nav btn-nav--learning">Learning Model</Link>
                <Link to="/learning-bar" className="btn-nav">My Learning bar</Link>
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
