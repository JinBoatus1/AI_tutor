import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <h2>🎓 AI Tutor Demo</h2>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/autograder">Auto Grader</Link>
            <Link to="/learning">Learning Model</Link>
          </div>
        </nav>

        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/autograder" element={<AutoGrader />} />
            <Route path="/learning" element={<LearningModel />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
