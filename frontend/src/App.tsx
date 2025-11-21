import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import UploadTextbook from "./UploadTextbook";

import "./App.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <h2> AI Tutor Demo</h2>
            <div className="nav-buttons">
                <Link to="/" className="btn-nav">Home</Link>
                <Link to="/autograder" className="btn-nav">Auto Grader</Link>
                <Link to="/learning" className="btn-nav">Learning Model</Link>
            </div>

        </nav>

        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/autograder" element={<AutoGrader />} />
            <Route path="/learning" element={<LearningModel />} />
            <Route path="/upload" element={<UploadTextbook />} />
          </Routes>

        </div>
      </div>
    </Router>
  );
}

export default App;
