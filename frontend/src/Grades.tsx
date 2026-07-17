import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import "./Grades.css";
import type { Course, LadderRow, Standing, StandingResp, WinningScheme } from "./grades/types";
import { emptyManualCourse } from "./grades/mockData";
import {
  fetchCourse,
  saveCourse,
  fetchStanding,
  importLegacyCourseIfAny,
  parseSyllabus,
} from "./grades/gradesStorage";
import RubricEditor from "./grades/RubricEditor";
import Gradebook from "./grades/Gradebook";
import { materializeCourse } from "./grades/rubric";
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
  const [parseError, setParseError] = useState<string | null>(null);
  const courseBeforeEdit = useRef<Course | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load from the server. If the server has no course, try a one-time import of a
  // course saved to localStorage while logged out (T7); otherwise first-run.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let c = await fetchCourse(token);
        if (!c) c = await importLegacyCourseIfAny(token);
        if (!alive) return;
        setCourse(c);
        setPhase(c ? "ready" : "firstrun");
      } catch {
        if (!alive) return;
        setCourse(null);
        setPhase("firstrun");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
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

  const startParse = (file: File) => {
    setParseError(null);
    setPhase("parsing");
    parseSyllabus(token, file)
      .then((c) => {
        // T3: pre-generate fillable rows so the gradebook is usable the moment they confirm.
        updateCourse(materializeCourse(c));
        setPhase("confirming");
      })
      .catch((e) => {
        setParseError(e?.message || "Could not read that syllabus.");
        setPhase("firstrun");
      });
  };
  const startManual = () => {
    updateCourse(materializeCourse(emptyManualCourse()));
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
      {phase === "ready" && !editing && course && (
        <header className="gr-head">
          <div className="gr-masthead">
            <div className="gr-eyebrow">{t("grades.reportCard")}</div>
            <h1 className="gr-course">{course.name}</h1>
            {course.term ? <div className="gr-term">{course.term}</div> : null}
          </div>
          <div className="gr-head-actions">
            <button className="gr-btn-ghost" onClick={openEdit}>
              ⚙ {t("grades.editRubric")}
            </button>
            <button className="gr-btn-ghost" onClick={() => setPhase("firstrun")}>
              {t("grades.newCourse")}
            </button>
          </div>
        </header>
      )}

      {phase === "firstrun" && (
        <FirstRun onUpload={startParse} onManual={startManual} error={parseError} />
      )}
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
  const totalItems = useMemo(
    () => course.categories.reduce((n, cat) => n + cat.items.length, 0),
    [course],
  );
  const gradedItems = totalItems - ungraded.length;
  const [selId, setSelId] = useState<string>("");
  const sel = ungraded.find((u) => u.it.id === selId) ?? ungraded[0];
  const resp = useServerStanding(token, course, sel?.it.id);

  const breakdown = resp?.breakdown;
  return (
    <>
      <StandingHero
        standing={resp?.standing ?? null}
        graded={gradedItems}
        total={totalItems}
        winningScheme={breakdown?.winningScheme ?? null}
      />
      <GoalSeek
        ladder={resp?.ladder ?? null}
        ungraded={ungraded}
        sel={sel}
        onSelect={setSelId}
      />
      <Gradebook
        course={course}
        onChange={onChange}
        catStandings={breakdown?.categories ?? null}
        boosts={breakdown?.replaceBoosts ?? null}
      />
    </>
  );
}

function FirstRun({
  onUpload,
  onManual,
  error,
}: {
  onUpload: (file: File) => void;
  onManual: () => void;
  error: string | null;
}) {
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (f) onUpload(f);
  };
  return (
    <section className="gr-firstrun">
      <div className="gr-fr-card">
        <div className="gr-fr-eyebrow">{t("grades.reportCard")}</div>
        <div className="gr-fr-mark">∑</div>
        <h2 className="gr-fr-title">{t("grades.firstrunTitle")}</h2>
        <p className="gr-fr-body">{t("grades.firstrunBody")}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={onPick}
        />
        <button className="gr-btn-primary gr-fr-cta" onClick={() => fileRef.current?.click()}>
          {t("grades.uploadSyllabus")}
        </button>
        <button className="gr-linkbtn" onClick={onManual}>
          {t("grades.enterManually")}
        </button>
        {error && <p className="gr-fr-error">{error}</p>}
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

export function StandingHero({
  standing,
  graded,
  total,
  winningScheme = null,
}: {
  standing: Standing | null;
  graded: number;
  total: number;
  winningScheme?: WinningScheme | null;
}) {
  const { t } = useLocale();
  const percent = standing?.percent ?? null;
  const letter = standing?.letter ?? "—";
  // Split a trailing +/− off the letter so it can render as a small serif superscript.
  const letterMain = letter.length > 1 ? letter.slice(0, -1) : letter;
  const letterSup = letter.length > 1 ? letter.slice(-1) : "";
  const pctGraded = total > 0 ? Math.round((graded / total) * 100) : 0;
  return (
    <section className="gr-hero" aria-label={t("grades.standing")}>
      {percent == null ? (
        <div className="gr-hero-empty">{t("grades.standingEmpty")}</div>
      ) : (
        <>
          <div className="gr-hero-mark">
            <div className="gr-hero-eyebrow">{t("grades.currentGrade")}</div>
            <div className="gr-hero-letter">
              {letterMain}
              {letterSup && <sup>{letterSup}</sup>}
            </div>
          </div>
          <div className="gr-hero-stats">
            <div className="gr-hero-pct">
              {percent.toFixed(1)}<small>%</small>
            </div>
            <div className="gr-hero-basis">{t("grades.onGradedSoFar")}</div>
            {total > 0 && (
              <div className="gr-progress">
                <div className="gr-progress-track">
                  <div className="gr-progress-fill" style={{ width: `${pctGraded}%` }} />
                </div>
                <div className="gr-progress-cap">
                  <span>{t("grades.gradedLabel")}</span>
                  <span>{t("grades.gradedCount", { n: String(graded), total: String(total) })}</span>
                </div>
              </div>
            )}
            <span className="gr-seal">● {t("grades.standing")}</span>
            {winningScheme && (
              <div className="gr-hero-scheme">
                {t("grades.gradedUnder", {
                  scheme: winningScheme.name ?? t("grades.primaryWeights"),
                  count: String(winningScheme.count),
                })}
              </div>
            )}
          </div>
        </>
      )}
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
    <section className="gr-goal" aria-label={t("grades.pathTo", { letter: targetLetter })}>
      <div className="gr-sec">
        <span>{t("grades.pathTo", { letter: targetLetter })}</span>
        {sel && ungraded.length > 1 ? (
          <label className="gr-sec-aside">
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
          <div className="gr-goal-focal">
            {reachable && reachable.needed != null ? (
              <>
                <span className="gr-goal-q">{t("grades.youNeed")}</span>
                <span className="gr-goal-num">
                  {reachable.needed.toFixed(1)}
                  <small> / {sel.it.maxScore}</small>
                </span>
                <span className="gr-hand">
                  {reachable.needed <= sel.it.maxScore * 0.7 ? t("grades.totallyDoable") : t("grades.youGotThis")}
                </span>
              </>
            ) : allLocked ? (
              <>
                <span className="gr-goal-q">{t("grades.alreadyAt")}</span>
                <span className="gr-goal-num">{rows[0].letter}</span>
                <span className="gr-hand">{t("grades.lockedIn")}</span>
              </>
            ) : (
              <>
                <span className="gr-goal-q">{t("grades.onTrackFor")}</span>
                <span className="gr-goal-num">{bestLocked?.letter ?? targetLetter}</span>
                <span className="gr-hand">✎</span>
              </>
            )}
          </div>

          <ul className="gr-ladder">
            {rows.map((r) => (
              <li
                className={`gr-ladder-row${reachable && r.letter === reachable.letter ? " is-target" : ""}`}
                key={r.letter}
              >
                <span className="gr-ladder-letter">{r.letter}</span>
                <span className="gr-ladder-bar" />
                {r.status === "ok" && r.needed != null ? (
                  <span className="gr-ladder-need">
                    {t("grades.scoreOn", { score: r.needed.toFixed(1), item: sel.it.name })}
                  </span>
                ) : r.status === "locked" ? (
                  <span className="gr-ladder-locked">{t("grades.alreadyLockedIn")}</span>
                ) : (
                  <span className="gr-ladder-unreach">{t("grades.outOfReach")}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
