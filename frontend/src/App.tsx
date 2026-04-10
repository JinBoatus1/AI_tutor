import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./Home";
import AutoGrader from "./AutoGrader";
import LearningModel from "./LearningModel";
import MyLearningBar from "./MyLearningBar";
import { useAuth } from "./context/AuthContext";

import "./App.css";

function App() {
  const { user, loading, login, logout } = useAuth();

  return (
    <Router>
      <div className="app-container">
        {!loading && !user && (
          <div className="auth-banner">
            Sign in to save your chat history and learning progress.
            <button className="auth-banner-btn" onClick={login}>Sign in</button>
          </div>
        )}
        <nav className="navbar">
          <h2 className="navbar-brand">Equal Education for Everyone</h2>
          <div className="nav-buttons">
            <Link to="/" className="btn-nav">Home</Link>
            <Link to="/autograder" className="btn-nav">Auto Grader</Link>
            <Link to="/learning" className="btn-nav btn-nav--learning">Learning Model</Link>
            <Link to="/learning-bar" className="btn-nav">My Learning bar</Link>
          </div>
          <div className="nav-auth">
            {loading ? null : user ? (
              <div className="nav-user">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className="nav-user-avatar" referrerPolicy="no-referrer" />
                )}
                <span className="nav-user-name">{user.displayName || user.email}</span>
                <button className="btn-nav btn-nav--logout" onClick={logout}>Sign out</button>
              </div>
            ) : (
              <button className="btn-nav btn-nav--login" onClick={login}>Sign in with Google</button>
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
