import { Link } from "react-router-dom";
import "./home.css";

export default function Home() {
  return (
    <div className="home-container">

      {/* Hero */}
      <section className="hero">
        <h1 className="hero-headline">
          Equal Education<br />for Every Child.
        </h1>
        <p className="hero-sub">
          AI-powered step-by-step teaching, instant grading, and adaptive learning
          &mdash; designed to help every student succeed.
        </p>
        <div className="hero-buttons">
          <Link to="/learning" className="hero-btn hero-btn-fill">Start Learning</Link>
          <Link to="/autograder" className="hero-btn hero-btn-outline">Auto Grader</Link>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="feature-card">
          <div className="feature-icon fi-blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <h3>Step-by-Step Teaching</h3>
          <p>Interactive multi-round guidance using Polya's problem-solving method.</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon fi-green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M9 15l2 2 4-4"/>
            </svg>
          </div>
          <h3>Auto Grading</h3>
          <p>Upload answers or handwritten images and receive instant AI-powered grading.</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon fi-orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <h3>Adaptive Learning</h3>
          <p>Personalized responses that adapt to each student's knowledge and pace.</p>
        </div>
      </section>

      <footer className="footer">
        &copy; 2025 AI Tutor Research Project &mdash; Bo Jin
      </footer>
    </div>
  );
}
