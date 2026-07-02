import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Grades.css";
import type { Course, LadderRow, Standing, StandingResp } from "./grades/types";
import { emptyManualCourse, fakeParseSyllabus } from "./grades/mockData";
import { fetchCourse, saveCourse, fetchStanding } from "./grades/gradesStorage";
import RubricEditor from "./grades/RubricEditor";
import { useLocale } from "./i18n/LocaleContext";
import { useAuth } from "./context/AuthContext";

/**
 * /grades — "My Course". Server-authoritative (T6): the backend owns persistence AND all
 * grade math (standing + goal-seek ladder via /api/grades). Login required (D3); grades
 * sync across devices. Syllabus upload is still a front-end mock (out of scope here).
 */
type Phase = "firstrun" | "parsing" | "confirming" | "ready";

export default function Grades() {
  const { t } = useLocale();
  const { user, token, loading: authLoading, setShowSignIn } = useAuth();

  if (authLoading) {
    return (
      <div className="gr-page">
        <p className="gr-parsing-text">{t("grades.loading")}</p>
      </div>
    );
  }
  if (!user || !token) return <SignedOut onSignIn={() => setShowSignIn(true)} />;
  return <GradesAuthed token={token} />;
}

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useLocale();
  return (
    <div className="gr-page">
      <section className="gr-firstrun">
        <div className="gr-fr-card">
          <div className="gr-fr-mark">∑</div>
          <h2 className="gr-fr-title">{t("grades.signInTitle")}</h2>
          <p className="gr-fr-body">{t("grades.signInBody")}</p>
          <button className="gr-btn-primary gr-fr-cta" onClick={onSignIn}>
            {t("grades.signInCta")}
          </button>
        </div>
      </section>
    </div>
  );
}

function GradesAuthed({ token }: { token: string }) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<Phase>("ready");
  const [course, setCourse] = useState<Course | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const courseBeforeEdit = useRef<Course | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load from the server. No course yet -> first-run.
  useEffect(() => {
    let alive = true;
    fetchCourse(token)
      .then((c) => {
        if (!alive) return;
        setCourse(c);
        setPhase(c ? "ready" : "firstrun");
        setLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setCourse(null);
        setPhase("firstrun");
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  // Debounced persistence so per-keystroke edits don't spam PUT.
  const persist = useCallback(
    (next: Course) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveCourse(token, next).catch(() => {
          /* transient; next edit retries */
        });
      }, 400);
    },
    [token],
  );

  const updateCourse = (next: Course) => {
    setCourse(next);
    persist(next);
  };

  const openEdit = () => {
    courseBeforeEdit.current = course;
    setEditing(true);
  };

  const startParse = () => {
    setPhase("parsing");
    fakeParseSyllabus().then((c) => {
      updateCourse(c);
      setPhase("confirming");
    });
  };
  const startManual = () => {
    updateCourse(emptyManualCourse());
    setPhase("confirming");
  };

  const finishRubricEdit = (final: Course) => {
    updateCourse(final);
    courseBeforeEdit.current = null;
    setEditing(false);
    setPhase("ready");
  };

  const cancelRubricEdit = () => {
    if (courseBeforeEdit.current) updateCourse(courseBeforeEdit.current);
    courseBeforeEdit.current = null;
    setEditing(false);
    setPhase("ready");
  };

  if (!loaded) {
    return (
      <div className="gr-page">
        <p className="gr-parsing-text">{t("grades.loading")}</p>
      </div>
    );
  }

  return (
    <div className="gr-page">
      <header className="gr-head">
        <h1 className="gr-title">
          {phase === "ready" && course ? course.name : t("grades.title")}
          {phase === "ready" && course?.term ? (
            <span className="gr-sub"> <span className="gr-dot">·</span> {course.term}</span>
          ) : null}
        </h1>
        <div className="gr-head-actions">
          {phase === "ready" && (
            <>
              <button className="gr-btn-ghost" onClick={openEdit}>
                ⚙ {t("grades.editRubric")}
              </button>
              <button className="gr-btn-ghost" onClick={() => setPhase("firstrun")}>
                {t("grades.newCourse")}
              </button>
            </>
          )}
        </div>
      </header>

      {phase === "firstrun" && <FirstRun onUpload={startParse} onManual={startManual} />}
      {phase === "parsing" && <Parsing />}
      {(phase === "confirming" || editing) && course && (
        <RubricEditor
          course={course}
          parsed={phase === "confirming"}
          onChange={updateCourse}
          onConfirm={finishRubricEdit}
          onCancel={cancelRubricEdit}
        />
      )}
      {phase === "ready" && !editing && course && (
        <ReadyView token={token} course={course} onChange={updateCourse} />
      )}
    </div>
  );
}

/**
 * Fetches server-computed standing + ladder whenever the course (or chosen unknown item)
 * changes, debounced so live gradebook edits don't fire a request per keystroke.
 */
function useServerStanding(
  token: string,
  course: Course,
  unknownItemId: string | undefined,
): StandingResp | null {
  const [data, setData] = useState<StandingResp | null>(null);
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      fetchStanding(token, course, unknownItemId)
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {
          /* keep last good numbers */
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [token, course, unknownItemId]);
  return data;
}

function ReadyView({
  token,
  course,
  onChange,
}: {
  token: string;
  course: Course;
  onChange: (c: Course) => void;
}) {
  const ungraded = useMemo(
    () =>
      course.categories.flatMap((cat) =>
        cat.items.filter((it) => it.score == null).map((it) => ({ cat, it })),
      ),
    [course],
  );
  const [selId, setSelId] = useState<string>("");
  const sel = ungraded.find((u) => u.it.id === selId) ?? ungraded[0];
  const resp = useServerStanding(token, course, sel?.it.id);

  return (
    <>
      <StandingHero standing={resp?.standing ?? null} />
      <GoalSeek
        ladder={resp?.ladder ?? null}
        ungraded={ungraded}
        sel={sel}
        onSelect={setSelId}
      />
      <Gradebook course={course} onChange={onChange} />
    </>
  );
}

function FirstRun({ onUpload, onManual }: { onUpload: () => void; onManual: () => void }) {
  const { t } = useLocale();
  return (
    <section className="gr-firstrun">
      <div className="gr-fr-card">
        <div className="gr-fr-mark">∑</div>
        <p className="gr-fr-body">{t("grades.firstrunBody")}</p>
        <button className="gr-btn-primary gr-fr-cta" onClick={onUpload}>
          {t("grades.uploadSyllabus")}
        </button>
        <button className="gr-linkbtn" onClick={onManual}>
          {t("grades.enterManually")}
        </button>
      </div>
    </section>
  );
}

function Parsing() {
  const { t } = useLocale();
  return (
    <section className="gr-parsing">
      <div className="gr-spinner" aria-hidden />
      <p className="gr-parsing-text">{t("grades.parsing")}</p>
      <p className="gr-parsing-sub">{t("grades.parsingSub")}</p>
    </section>
  );
}

function StandingHero({ standing }: { standing: Standing | null }) {
  const { t } = useLocale();
  const percent = standing?.percent ?? null;
  const letter = standing?.letter ?? "—";
  // Split a trailing +/− off the letter so it can render as a small serif superscript.
  const letterMain = letter.length > 1 ? letter.slice(0, -1) : letter;
  const letterSup = letter.length > 1 ? letter.slice(-1) : "";
  return (
    <section className="gr-standing" aria-label={t("grades.standing")}>
      {percent == null ? (
        <div className="gr-standing-empty">{t("grades.standingEmpty")}</div>
      ) : (
        <>
          <div className="gr-mark">
            {letterMain}
            {letterSup && <sup>{letterSup}</sup>}
          </div>
          <div className="gr-standing-side">
            <div className="gr-standing-num">
              {percent.toFixed(1)}<small>%</small>
            </div>
            <div className="gr-standing-basis">{t("grades.onGradedSoFar")}</div>
            <span className="gr-seal">● {t("grades.standing")}</span>
          </div>
        </>
      )}
    </section>
  );
}

function Gradebook({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const { t } = useLocale();
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
      <h2 className="gr-sec-label">{t("grades.gradebook")}</h2>
      {course.categories.map((cat) => (
        <div className="gr-gb-cat" key={cat.id}>
          <div className="gr-gb-cat-head">
            <span className="gr-gb-cat-name">{cat.name}</span>
            <span className="gr-gb-cat-weight">{cat.weight}%</span>
          </div>
          {cat.items.length === 0 && <div className="gr-gb-empty">{t("grades.noItems")}</div>}
          {cat.items.map((it) => (
            <div className="gr-gb-row" key={it.id}>
              <span className="gr-gb-name">{it.name}</span>
              <span className="gr-gb-leader" />
              {it.score == null && <span className="gr-gb-upcoming">{t("grades.upcoming")}</span>}
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
            {t("grades.addGrade")}
          </button>
        </div>
      ))}
    </section>
  );
}

type Ungraded = { cat: { name: string }; it: { id: string; name: string; maxScore: number } };

function GoalSeek({
  ladder,
  ungraded,
  sel,
  onSelect,
}: {
  ladder: LadderRow[] | null;
  ungraded: Ungraded[];
  sel: Ungraded | undefined;
  onSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  // Server returns every cutoff letter; the UI shows the top 4 non-F letters.
  const rows: LadderRow[] = (ladder ?? []).filter((r) => r.letter !== "F").slice(0, 4);

  const reachable = rows.find((r) => r.status === "ok");
  const allLocked = rows.length > 0 && rows.every((r) => r.status === "locked");
  const bestLocked = rows.find((r) => r.status === "locked");
  const targetLetter = reachable?.letter ?? rows[0]?.letter ?? "A";

  return (
    <section className="gr-card gr-goal" aria-label={t("grades.pathTo", { letter: targetLetter })}>
      <hr className="gr-rule" />
      <div className="gr-sec-label">
        <span>{t("grades.pathTo", { letter: targetLetter })}</span>
        {sel && ungraded.length > 1 ? (
          <label className="gr-goal-on">
            {t("grades.on")}
            <select value={sel.it.id} onChange={(e) => onSelect(e.target.value)} aria-label="Upcoming item">
              {ungraded.map((u) => (
                <option key={u.it.id} value={u.it.id}>
                  {u.it.name}
                </option>
              ))}
            </select>
          </label>
        ) : sel ? (
          <span className="gr-sec-aside">
            {sel.it.name} {t("grades.remaining")}
          </span>
        ) : null}
      </div>

      {!sel ? (
        <p className="gr-goal-done">{t("grades.allGraded")}</p>
      ) : (
        <>
          <div className="gr-path">
            {reachable && reachable.needed != null ? (
              <>
                <span className="gr-path-q">{t("grades.youNeed")}</span>
                <span className="gr-path-num">
                  {reachable.needed.toFixed(1)}
                  <small> / {sel.it.maxScore}</small>
                </span>
                <span className="gr-hand">
                  {reachable.needed <= sel.it.maxScore * 0.7 ? t("grades.totallyDoable") : t("grades.youGotThis")}
                </span>
              </>
            ) : allLocked ? (
              <>
                <span className="gr-path-q">{t("grades.alreadyAt")}</span>
                <span className="gr-path-num">{rows[0].letter}</span>
                <span className="gr-hand">{t("grades.lockedIn")}</span>
              </>
            ) : (
              <>
                <span className="gr-path-q">{t("grades.onTrackFor")}</span>
                <span className="gr-path-num">{bestLocked?.letter ?? targetLetter}</span>
                <span className="gr-hand">✎</span>
              </>
            )}
          </div>

          <ul className="gr-goal-list">
            {rows.map((r) => (
              <li className="gr-goal-row" key={r.letter}>
                <span className="gr-goal-letter">{r.letter}</span>
                <span className="gr-goal-leader" />
                {r.status === "ok" && r.needed != null ? (
                  <span className="gr-goal-need">
                    {t("grades.scoreOn", { score: r.needed.toFixed(1), item: sel.it.name })}
                  </span>
                ) : r.status === "locked" ? (
                  <span className="gr-goal-locked">{t("grades.alreadyLockedIn")}</span>
                ) : (
                  <span className="gr-goal-unreach">{t("grades.outOfReach")}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
