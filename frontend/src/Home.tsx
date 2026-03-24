import { Link } from "react-router-dom";
import "./Home.css";

function IconPolya() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="none" stroke="url(#home-grad-a)" strokeWidth="1.5" opacity="0.35" />
      <path
        fill="none"
        stroke="url(#home-grad-a)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 32V16l8 8 8-8v16"
      />
      <circle cx="24" cy="14" r="2" fill="url(#home-grad-a)" />
    </svg>
  );
}

function IconGrade() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="28" height="22" rx="3" fill="none" stroke="url(#home-grad-b)" strokeWidth="1.75" />
      <path d="M16 22h16M16 28h10" stroke="url(#home-grad-b)" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M30 8l4 4-4 4"
        fill="none"
        stroke="url(#home-grad-b)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAdaptive() {
  return (
    <svg className="home-feature-icon-svg" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="home-grad-c" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="20" r="8" fill="none" stroke="url(#home-grad-c)" strokeWidth="1.75" />
      <path
        d="M14 36c4-6 20-6 24 0"
        fill="none"
        stroke="url(#home-grad-c)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="24" cy="20" r="3" fill="url(#home-grad-c)" opacity="0.4" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-page-bg" aria-hidden />

      <section className="home-hero">
        <p className="home-eyebrow">AI Tutor</p>
        <h1 className="home-headline">Equal Education for Every Child</h1>
        <p className="home-lede">
          Step-by-step reasoning, textbook-grounded answers, and instant feedback — in one place.
        </p>
        <div className="home-actions">
          <Link to="/learning" className="home-btn home-btn--primary">
            Learning Mode
          </Link>
          <Link to="/autograder" className="home-btn home-btn--ghost">
            Auto Grader
          </Link>
          <Link to="/upload" className="home-btn home-btn--ghost">
            Upload Textbook
          </Link>
        </div>
      </section>

      <section className="home-features" aria-label="Features">
        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconPolya />
          </div>
          <h2 className="home-feature-title">Step-by-Step Teaching</h2>
          <p className="home-feature-desc">Interactive guidance inspired by Polya’s method — understand the problem before the proof.</p>
        </article>

        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconGrade />
          </div>
          <h2 className="home-feature-title">Auto Grading</h2>
          <p className="home-feature-desc">Submit text or images and get structured feedback when you need it.</p>
        </article>

        <article className="home-feature-card">
          <div className="home-feature-icon-wrap">
            <IconAdaptive />
          </div>
          <h2 className="home-feature-title">Adaptive Learning</h2>
          <p className="home-feature-desc">Responses tuned to your chapter and pace, with memory of what you’ve covered.</p>
        </article>
      </section>
    </div>
  );
}
