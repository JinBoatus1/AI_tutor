import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./Home.css";

export default function Home() {
  const { user, loading, setShowSignIn } = useAuth();

  return (
    <div className="home-scrap">
      <div className="home-inner">
        {/* scattered discrete-math glyphs */}
        <div className="hs-glyphs" aria-hidden>
          <span className="hs-g g1">∀</span>
          <span className="hs-g g2">∃</span>
          <span className="hs-g g3">∧</span>
          <span className="hs-g g4">¬</span>
          <span className="hs-g g5">⊆</span>
          <span className="hs-g g6">∈</span>
          <span className="hs-g g7">≡</span>
          <span className="hs-g g8">∅</span>
          <span className="hs-g g9 mono">p→q</span>
          <span className="hs-g g10 mono">(mod n)</span>
        </div>

        <div className="hs-wrap">
          {/* HERO */}
          <section className="hs-hero">
            <div className="hs-hero-copy">
              <span className="hs-eyebrow">start here</span>
              <h1 className="hs-headline">
                Equal Education<br />
                for <span className="hs-mark">Everyone</span>
              </h1>
              <p className="hs-lede">
                Ask a discrete-math question in plain language. We <b>match your textbook</b>, explain
                with structure — proofs, truth tables, counting — and remember your <b>topic checklist</b>{" "}
                when you sign in.
              </p>

              {!loading && user && (
                <div className="hs-signedin">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="hs-signedin-avatar" referrerPolicy="no-referrer" />
                  ) : null}
                  <span>
                    Signed in as <strong>{user.isAnonymous ? "Guest" : user.displayName || user.email}</strong>
                  </span>
                </div>
              )}

              <div className="hs-cta-row">
                <Link to="/learning" className="hs-btn-primary">
                  {user ? "Continue to Learning Mode" : "Start learning"} <span className="hs-arrow">→</span>
                </Link>
                {!loading && !user && <span className="hs-note">↜ free for students!</span>}
              </div>

              {!loading && !user && (
                <div className="hs-cta-row hs-cta-row--sub">
                  <button type="button" className="hs-btn-ghost" onClick={() => setShowSignIn(true)}>
                    Sign in
                  </button>
                  <p className="hs-microcopy">
                    Open Learning Mode without an account. <span className="hs-dot">●</span> Sign in to save
                    chats &amp; sync progress.
                  </p>
                </div>
              )}
            </div>

            {/* COLLAGE */}
            <div className="hs-collage">
              <figure className="hs-card hs-polaroid">
                <span className="hs-tape hs-tape--top" />
                <div className="hs-photo">
                  <svg viewBox="0 0 220 200" aria-hidden>
                    <g stroke="#0c1222" strokeWidth="2.4" fill="none">
                      <line x1="55" y1="55" x2="160" y2="48" />
                      <line x1="55" y1="55" x2="70" y2="150" />
                      <line x1="160" y1="48" x2="70" y2="150" />
                      <line x1="160" y1="48" x2="172" y2="148" />
                      <line x1="70" y1="150" x2="172" y2="148" />
                    </g>
                    <g fill="#0c1222">
                      <circle cx="55" cy="55" r="11" />
                      <circle cx="160" cy="48" r="11" fill="#14b8a6" />
                      <circle cx="70" cy="150" r="11" />
                      <circle cx="172" cy="148" r="11" />
                    </g>
                  </svg>
                  <span className="hs-glabel">∑ deg(v) = 2|E|</span>
                </div>
                <figcaption className="hs-cap">
                  matched to your book <span className="hs-chk">✓</span>
                </figcaption>
              </figure>

              <div className="hs-card hs-sticky">
                <span className="hs-pin" />
                <div className="hs-kicker">Topic checklist</div>
                <ul>
                  <li className="done"><span className="hs-box">✓</span><span>Logic &amp; Proofs</span></li>
                  <li className="done"><span className="hs-box">✓</span><span>Sets &amp; Relations</span></li>
                  <li><span className="hs-box" /><span>Combinatorics</span></li>
                  <li><span className="hs-box" /><span>Graph Theory</span></li>
                </ul>
              </div>

              <div className="hs-card hs-chat">
                <div className="hs-dots"><i /><i /><i /></div>
                <div className="hs-bubble q">
                  Why is <code>¬(p→q) ≡ p ∧ ¬q</code>? 🤔
                </div>
                <div className="hs-bubble a">
                  <code>p→q</code> is false only when p is true, q false. So its negation is exactly{" "}
                  <code>p ∧ ¬q</code> — truth table →
                </div>
                <span className="hs-srctag">▦ your textbook · Ch.1 Logic</span>
              </div>

              <div className="hs-card hs-formula">
                <span className="hs-pin hs-pin--pen" />
                <div className="hs-formula-lbl">counting</div>
                <div className="hs-formula-eq">C(8,3)=56</div>
                <div className="hs-formula-sub">ways to choose 3</div>
              </div>
            </div>
          </section>

          {/* PIPELINE */}
          <section className="hs-pipeline-sec">
            <div className="hs-pipeline">
              <div className="hs-pipeline-grid">
                <div className="hs-pl-copy">
                  <span className="hs-pl-label">how your tutor thinks</span>
                  <h2>
                    A study pipeline <span className="hs-hl"><span>you can inspect.</span></span>
                  </h2>
                  <p>
                    It doesn't just answer. It pulls the exact definition or theorem from your book, lays
                    out a proof skeleton, then turns it into practice you can check.
                  </p>
                </div>
                <div className="hs-agents" aria-label="teaching pipeline">
                  <article className="hs-agent s1">
                    <div className="hs-agent-id">STEP 01 · TEXTBOOK</div>
                    <div className="hs-agent-t">Read the source</div>
                    <p>Definitions, theorems, and worked examples from your exact section get pulled into one grounded packet.</p>
                  </article>
                  <span className="hs-arrow-cx" aria-hidden />
                  <article className="hs-agent s2">
                    <div className="hs-agent-id">STEP 02 · PLAN</div>
                    <div className="hs-agent-t">Build the proof skeleton</div>
                    <p>Cases, base &amp; inductive steps, and the formulas you'll need get ordered like a study guide before any prose.</p>
                  </article>
                  <span className="hs-arrow-cx" aria-hidden />
                  <article className="hs-agent s3">
                    <div className="hs-agent-id">STEP 03 · CHECK</div>
                    <div className="hs-agent-t">Teach, then test</div>
                    <p>The explanation becomes truth tables and practice problems — not a paragraph you trust blindly.</p>
                  </article>
                </div>
              </div>
            </div>
          </section>

          {/* TOOLS */}
          <section className="hs-tools">
            <div className="hs-tools-head">
              <h2>Three ways to study.</h2>
              <p>pick one — they all share your progress.</p>
            </div>
            <div className="hs-tools-grid">
              <Link to="/learning" className="hs-tool">
                <span className="hs-tab">/learning</span>
                <div className="hs-ic">∴</div>
                <h3>Learning Mode</h3>
                <p>Ask in plain language. Get a textbook-matched explanation, step by step, with your topic checklist on the side.</p>
                <span className="hs-go">Start learning <span className="hs-arrow">→</span></span>
              </Link>
              <Link to="/autograder" className="hs-tool">
                <span className="hs-tab">/autograder</span>
                <div className="hs-ic">✓</div>
                <h3>Auto Grader</h3>
                <p>Drop a Question PDF and an Answer PDF. Get structured, criterion-by-criterion grading on proofs and problem sets.</p>
                <span className="hs-go">Grade a paper <span className="hs-arrow">→</span></span>
              </Link>
              <Link to="/profile" className="hs-tool">
                <span className="hs-tab">/profile</span>
                <div className="hs-ic">☺</div>
                <h3>My profile</h3>
                <p>Your textbooks, appearance, and saved progress — synced across every session once you sign in.</p>
                <span className="hs-go">Open profile <span className="hs-arrow">→</span></span>
              </Link>
            </div>
          </section>
        </div>

        {/* ACES YOUR EXAMS */}
        <footer className="hs-acefoot">
          <div className="hs-acefoot-inner">
            <div className="hs-acefoot-grid">
              <div>
                <span className="hs-ace-eyebrow">last page before the exam</span>
                <h2>Aces Your Exams.</h2>
                <p className="hs-ace-sub">Your notes, your textbook, one workspace.</p>
                {user ? (
                  <Link to="/learning" className="hs-btn-create">
                    Continue learning <span>→</span>
                  </Link>
                ) : (
                  <button type="button" className="hs-btn-create" onClick={() => setShowSignIn(true)}>
                    Create free account <span>→</span>
                  </button>
                )}
                <div className="hs-ace-meta">© 2026 AI Tutor · equal education for everyone</div>
              </div>
              <aside className="hs-ace-checklist" aria-label="exam prep checklist">
                <div className="hs-ace-grade">A+</div>
                <h3>before test day</h3>
                <ul>
                  <li>Truth tables drilled</li>
                  <li>Proof techniques mapped</li>
                  <li>Counting &amp; graphs practiced</li>
                </ul>
              </aside>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
