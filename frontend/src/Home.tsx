import { Link } from "react-router-dom";
import "./Home.css";

export default function Home() {
  return (
    <div className="home-container">

      {/* Hero Section */}
      <section className="hero">
        <h1 className="title"> AI Tutor System Demo</h1>
        <p className="subtitle">
          Empowering Math Learning with AI-guided Teaching, Polya Reasoning, and Auto Grading.
        </p>

        <div className="hero-buttons">
          <Link to="/learning" className="btn primary"> Go to Learning Model</Link>
          <Link to="/autograder" className="btn secondary"> Go to Auto Grader</Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="feature-card">
          <img src="https://cdn-icons-png.flaticon.com/512/4341/4341139.png" />
          <h3>Step-by-Step Teaching</h3>
          <p>Interactive multi-round guidance using Polya’s method.</p>
        </div>

        <div className="feature-card">
          <img src="https://cdn-icons-png.flaticon.com/512/2907/2907300.png" />
          <h3>Auto Grading</h3>
          <p>Upload answers or images, and receive instant AI grading.</p>
        </div>

        <div className="feature-card">
          <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" />
          <h3>Adaptive Learning</h3>
          <p>Future versions support student profiles & personalized tasks.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        © 2025 AI Tutor Research Project — Bo Jin
      </footer>

    </div>
  );
}
