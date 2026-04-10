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
              <strong>混合内容被拦截：</strong>
              本站为 HTTPS，但当前 API 为 <code>{API_BASE}</code>
              。请把后端改为 <code>https://</code>，并把{" "}
              <code>VITE_API_URL</code> 设为该 HTTPS 地址后重新构建部署。
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
