import "./Grades.css";
import { mockCourse, mockStanding, mockGoalItem, mockGoals } from "./gradesMock";

/**
 * /grades — "My Course" preview (Lane D).
 * Read-only standing + goal-seek surface. Numbers are mocked from the tested
 * grades_math engine; the rubric editor + grade entry land when the backend is
 * wired (D4: the real numbers are server-computed, never client/LLM).
 */
export default function Grades() {
  return (
    <div className="gr-page">
      <header className="gr-head">
        <div>
          <h1 className="gr-title">My Course</h1>
          <p className="gr-sub">
            {mockCourse.name} <span className="gr-dot">·</span> {mockCourse.term}
          </p>
        </div>
        <span className="gr-mockpill">Preview · mock data</span>
      </header>

      <section className="gr-standing" aria-label="Current standing">
        <div className="gr-standing-num">{mockStanding.percent.toFixed(1)}%</div>
        <div className="gr-standing-meta">
          <span className="gr-letter">{mockStanding.letter}</span>
          <span className="gr-standing-basis">{mockStanding.basis}</span>
        </div>
      </section>

      <div className="gr-grid">
        <section className="gr-card">
          <h2 className="gr-card-h">Rubric</h2>
          {mockCourse.categories.map((c) => (
            <div className="gr-cat" key={c.name}>
              <div className="gr-cat-top">
                <span className="gr-cat-name">{c.name}</span>
                <span className="gr-cat-weight">{c.weight}%</span>
              </div>
              <div className="gr-cat-rule">{c.rule}</div>
              <div className="gr-cat-note">{c.note}</div>
            </div>
          ))}
          <div className="gr-cutoffs">{mockCourse.cutoffs}</div>
        </section>

        <section className="gr-card gr-goal">
          <h2 className="gr-card-h">
            What do I need on <span className="gr-goal-item">{mockGoalItem}</span>?
          </h2>
          <ul className="gr-goal-list">
            {mockGoals.map((g) => (
              <li className="gr-goal-row" key={g.letter}>
                <span className="gr-goal-letter">{g.letter}</span>
                {g.status === "ok" ? (
                  <span className="gr-goal-need">
                    {g.needed?.toFixed(1)} <em>/ 100</em>
                  </span>
                ) : g.status === "locked" ? (
                  <span className="gr-goal-locked">already locked in</span>
                ) : (
                  <span className="gr-goal-unreach">not reachable</span>
                )}
              </li>
            ))}
          </ul>
          <p className="gr-note">
            Exam 4&rsquo;s weight is conditional — 4 points if it&rsquo;s your lowest, otherwise 7.{" "}
            <span className="gr-hand">RogerHub can&rsquo;t do this ✦</span>
          </p>
        </section>
      </div>
    </div>
  );
}
