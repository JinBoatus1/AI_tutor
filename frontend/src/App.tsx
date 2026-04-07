import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";

import "./App.css";

function App() {
  return (
    <Router>
      <div className="app-container">
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
