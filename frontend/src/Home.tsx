import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Home.css";
import IridescenceBackground from "./components/IridescenceBackground";

export default function Home() {
  const { user, loading, setShowSignIn } = useAuth();

  return (
    <div className="home-page">
      <div className="home-page-bg" aria-hidden>
        <IridescenceBackground color={[0.95, 1, 0.98]} speed={0.85} amplitude={0.12} />
      </div>

      <section className="home-hero" aria-labelledby="home-headline">
        <p className="home-eyebrow">AI Tutor</p>
        <h1 id="home-headline" className="home-headline">
          Equal Education for Everyone
        </h1>
        <p className="home-lede">
          Ask a math question in plain language. We match your textbook, explain with structure, and remember your
          topic checklist when you sign in.
        </p>

        {!loading && user && (
          <div className="home-welcome-inline">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="home-welcome-inline-avatar" referrerPolicy="no-referrer" />
            ) : null}
            <p className="home-welcome-inline-text">
              Signed in as <strong>{user.isAnonymous ? "Guest" : (user.displayName || user.email)}</strong>
            </p>
          </div>
        )}

        <div className="home-primary-block">
          <Link to="/learning" className="home-btn home-btn--primary home-btn--hero">
            {user ? "Continue to Learning Mode" : "Start learning"}
          </Link>
          {!loading && !user && (
            <button type="button" className="home-btn home-btn--signin" onClick={() => setShowSignIn(true)}>
              Sign in
            </button>
          )}
        </div>

        {!loading && !user && (
          <p className="home-microcopy">
            You can open Learning Mode without an account. Sign in to save chats and sync progress.
          </p>
        )}

        <nav className="home-secondary-links" aria-label="Other tools">
          <Link to="/autograder" className="home-secondary-link">
            Auto Grader
          </Link>
          <span className="home-secondary-sep" aria-hidden>
            ·
          </span>
          <Link to="/profile" className="home-secondary-link">
            My profile
          </Link>
        </nav>
      </section>
    </div>
  );
}
