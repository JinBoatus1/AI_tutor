import { useMemo, useState } from "react";
import "./Grades.css";
import { computeStanding, goalSeek, type Course } from "./grades/mockEngine";
import { demoCourse, emptyManualCourse, fakeParseSyllabus } from "./grades/mockData";
import RubricEditor from "./grades/RubricEditor";

/**
 * /grades — "My Course" (Lane D, mock-backed).
 * Built to the locked design (plan-design-review 2026-06-03): state-driven IA,
 * plain-English rubric editor, pre-listed gradebook with inline edit, goal-seek
 * ladder + item picker. Numbers come from a CLIENT mock engine so the page is
 * interactive; the real numbers are server-computed once the backend is wired.
 */
type Phase = "firstrun" | "parsing" | "confirming" | "ready";

export default function Grades() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [course, setCourse] = useState<Course>(demoCourse());
  const [editing, setEditing] = useState(false);

  const startParse = () => {
    setPhase("parsing");
    fakeParseSyllabus().then((c) => {
      setCourse(c);
      setPhase("confirming");
    });
  };
  const startManual = () => {
    setCourse(emptyManualCourse());
    setPhase("confirming");
  };

  return (
    <div className="gr-page">
      <header className="gr-head">
        <h1 className="gr-title">
          {phase === "ready" ? course.name : "Grades"}
          {phase === "ready" && course.term ? (
            <span className="gr-sub"> <span className="gr-dot">·</span> {course.term}</span>
          ) : null}
        </h1>
        <div className="gr-head-actions">
          <span className="gr-mockpill">Preview · mock data</span>
          {phase === "ready" && (
            <>
              <button className="gr-btn-ghost" onClick={() => setEditing(true)}>
                ⚙ Edit rubric
              </button>
              <button className="gr-btn-ghost" onClick={() => setPhase("firstrun")}>
                + New course
              </button>
            </>
          )}
        </div>
      </header>

      {phase === "firstrun" && <FirstRun onUpload={startParse} onManual={startManual} />}
      {phase === "parsing" && <Parsing />}
      {(phase === "confirming" || editing) && (
        <RubricEditor
          course={course}
          parsed={phase === "confirming"}
          onChange={setCourse}
          onConfirm={() => {
            setEditing(false);
            setPhase("ready");
          }}
          onCancel={() => {
            setEditing(false);
            setPhase("ready");
          }}
        />
      )}
      {phase === "ready" && !editing && (
        <>
          <StandingHero course={course} />
          <GoalSeek course={course} />
          <Gradebook course={course} onChange={setCourse} />
        </>
      )}
    </div>
  );
}

function FirstRun({ onUpload, onManual }: { onUpload: () => void; onManual: () => void }) {
  return (
    <section className="gr-firstrun">
      <div className="gr-fr-card">
        <div className="gr-fr-mark">∑</div>
        <p className="gr-fr-body">
          Upload your syllabus and AI Tutor pulls out the grading rubric — categories,
          weights, and letter cutoffs — for you to confirm.
        </p>
        <button className="gr-btn-primary gr-fr-cta" onClick={onUpload}>
          Upload syllabus (PDF)
        </button>
        <button className="gr-linkbtn" onClick={onManual}>
          or enter the rubric manually
        </button>
      </div>
    </section>
  );
}

function Parsing() {
  return (
    <section className="gr-parsing">
      <div className="gr-spinner" aria-hidden />
      <p className="gr-parsing-text">Reading your syllabus…</p>
      <p className="gr-parsing-sub">Pulling out categories, weights, and cutoffs.</p>
    </section>
  );
}

function StandingHero({ course }: { course: Course }) {
  const s = useMemo(() => computeStanding(course), [course]);
  // Split a trailing +/− off the letter so it can render as a small serif superscript.
  const letter = s.letter ?? "—";
  const letterMain = letter.length > 1 ? letter.slice(0, -1) : letter;
  const letterSup = letter.length > 1 ? letter.slice(-1) : "";
  return (
    <section className="gr-standing" aria-label="Current standing">
      {s.percent == null ? (
        <div className="gr-standing-empty">Add grades to see your standing.</div>
      ) : (
        <>
          <div className="gr-mark">
            {letterMain}
            {letterSup && <sup>{letterSup}</sup>}
          </div>
          <div className="gr-standing-side">
            <div className="gr-standing-num">
              {s.percent.toFixed(1)}<small>%</small>
            </div>
            <div className="gr-standing-basis">on graded work so far</div>
            <span className="gr-seal">● Standing</span>
          </div>
        </>
      )}
    </section>
  );
}

function Gradebook({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const setScore = (catId: string, itemId: string, raw: string) => {
    const score = raw.trim() === "" ? null : Number(raw);
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, score } : it)) },
      ),
    });
  };
  const addItem = (catId: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : {
              ...cat,
              items: [
                ...cat.items,
                { id: `${catId}-${Date.now()}`, name: `Item ${cat.items.length + 1}`, score: null, maxScore: 100 },
              ],
            },
      ),
    });

  return (
    <section className="gr-card gr-gradebook">
      <h2 className="gr-sec-label">Gradebook</h2>
      {course.categories.map((cat) => (
        <div className="gr-gb-cat" key={cat.id}>
          <div className="gr-gb-cat-head">
            <span className="gr-gb-cat-name">{cat.name}</span>
            <span className="gr-gb-cat-weight">{cat.weight}%</span>
          </div>
          {cat.items.length === 0 && <div className="gr-gb-empty">No items yet.</div>}
          {cat.items.map((it) => (
            <div className="gr-gb-row" key={it.id}>
              <span className="gr-gb-name">{it.name}</span>
              <span className="gr-gb-leader" />
              {it.score == null && <span className="gr-gb-upcoming">upcoming</span>}
              <span className="gr-gb-score">
                <input
                  className="gr-gb-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={it.score ?? ""}
                  aria-label={`${it.name} score`}
                  onChange={(e) => setScore(cat.id, it.id, e.target.value)}
                />
                <span className="gr-gb-max">/ {it.maxScore}</span>
              </span>
            </div>
          ))}
          <button className="gr-linkbtn gr-gb-add" onClick={() => addItem(cat.id)}>
            + add grade
          </button>
        </div>
      ))}
    </section>
  );
}

function GoalSeek({ course }: { course: Course }) {
  const ungraded = useMemo(
    () =>
      course.categories.flatMap((cat) =>
        cat.items.filter((it) => it.score == null).map((it) => ({ cat, it })),
      ),
    [course],
  );
  const [selId, setSelId] = useState<string>("");
  const sel = ungraded.find((u) => u.it.id === selId) ?? ungraded[0];
  const ladder = useMemo(() => {
    if (!sel) return [];
    return course.cutoffs
      .filter((x) => x.letter !== "F")
      .slice(0, 4)
      .map((x) => ({ letter: x.letter, res: goalSeek(course, x.letter, sel.cat.name, sel.it.id) }));
  }, [course, sel]);

  // Hero line: the highest letter still reachable by scoring on this item.
  const reachable = ladder.find((r) => r.res.status === "ok");
  const allLocked = ladder.length > 0 && ladder.every((r) => r.res.status === "locked");
  const bestLocked = ladder.find((r) => r.res.status === "locked");
  const targetLetter = reachable?.letter ?? ladder[0]?.letter ?? "A";

  return (
    <section className="gr-card gr-goal" aria-label="What do I need">
      <hr className="gr-rule" />
      <div className="gr-sec-label">
        <span>The path to an {targetLetter}</span>
        {sel && ungraded.length > 1 ? (
          <label className="gr-goal-on">
            on
            <select value={sel.it.id} onChange={(e) => setSelId(e.target.value)} aria-label="Upcoming item">
              {ungraded.map((u) => (
                <option key={u.it.id} value={u.it.id}>
                  {u.it.name}
                </option>
              ))}
            </select>
          </label>
        ) : sel ? (
          <span className="gr-sec-aside">{sel.it.name} remaining</span>
        ) : null}
      </div>

      {!sel ? (
        <p className="gr-goal-done">Everything's graded — your standing above is final.</p>
      ) : (
        <>
          <div className="gr-path">
            {reachable ? (
              <>
                <span className="gr-path-q">You need</span>
                <span className="gr-path-num">
                  {reachable.res.needed!.toFixed(1)}
                  <small> / {sel.it.maxScore}</small>
                </span>
                <span className="gr-hand">
                  {reachable.res.needed! <= sel.it.maxScore * 0.7 ? "totally doable ✎" : "you've got this ✎"}
                </span>
              </>
            ) : allLocked ? (
              <>
                <span className="gr-path-q">You're already at</span>
                <span className="gr-path-num">{ladder[0].letter}</span>
                <span className="gr-hand">locked in ✎</span>
              </>
            ) : (
              <>
                <span className="gr-path-q">On track for</span>
                <span className="gr-path-num">{bestLocked?.letter ?? targetLetter}</span>
                <span className="gr-hand">✎</span>
              </>
            )}
          </div>

          <ul className="gr-goal-list">
            {ladder.map(({ letter, res }) => (
              <li className="gr-goal-row" key={letter}>
                <span className="gr-goal-letter">{letter}</span>
                <span className="gr-goal-leader" />
                {res.status === "ok" ? (
                  <span className="gr-goal-need">
                    score <b>{res.needed!.toFixed(1)}</b> on {sel.it.name}
                  </span>
                ) : res.status === "locked" ? (
                  <span className="gr-goal-locked">already locked in</span>
                ) : (
                  <span className="gr-goal-unreach">out of reach</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
