import { useRef, useState } from "react";
import MathText from "../MathText";
import { initialLadder, recordAttempt, advance, reveal, type LadderState, type GradeVerdict } from "./hintLadder";
import { fetchHint, gradeChallenge } from "./challengeChat";
import { SymbolPalette } from "./SymbolPalette";
import type { ChallengeProblem } from "./types";

/** The challenge stage: free-response attempt + the escalating hint ladder.
 * One rung per "still stuck"; the final answer (L6) needs an explicit confirm,
 * after which a twin problem is offered (pedagogy, design D8). */
export function HintLadderPanel({
  problem,
  token,
  hasTwin,
  onSolved,
  onTwin,
}: {
  problem: ChallengeProblem;
  token: string | null;
  hasTwin: boolean;
  onSolved: () => void;
  onTwin: () => void;
}) {
  const [attempt, setAttempt] = useState("");
  const [ladder, setLadder] = useState<LadderState>(initialLadder());
  const [hints, setHints] = useState<{ rung: number; text: string }[]>([]);
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null);
  const [loading, setLoading] = useState<"grade" | "hint" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askReveal, setAskReveal] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const solved = verdict === "correct";
  const canAct = attempt.trim().length > 0 && !loading;

  // Insert a palette symbol at the caret (falls back to append if the ref is missing),
  // then restore focus + caret just after the inserted glyph so typing continues.
  const insertSymbol = (sym: string) => {
    const ta = taRef.current;
    const start = ta ? ta.selectionStart : attempt.length;
    const end = ta ? ta.selectionEnd : attempt.length;
    setAttempt(attempt.slice(0, start) + sym + attempt.slice(end));
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + sym.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const grade = async () => {
    if (!canAct) return;
    setLoading("grade");
    setError(null);
    try {
      const v = await gradeChallenge(problem, attempt, token);
      setVerdict(v);
      if (v === "correct") onSolved();
    } catch {
      setError("Couldn't reach the tutor — your attempt is saved. Try again.");
    } finally {
      setLoading(null);
    }
  };

  const getHint = async () => {
    if (!canAct) return;
    // First hint: pass the attempt gate (L0 -> L1). Later: advance one rung.
    const next = ladder.attempted ? advance(ladder) : recordAttempt(ladder);
    setLadder(next);
    setLoading("hint");
    setError(null);
    try {
      const text = await fetchHint(next.rung, problem, attempt, token);
      setHints((h) => [...h, { rung: next.rung, text }]);
    } catch {
      setError("Couldn't reach the tutor — try the hint again.");
    } finally {
      setLoading(null);
    }
  };

  const doReveal = async () => {
    setAskReveal(false);
    setLadder((l) => reveal(l));
    setRevealed(true);
    setLoading("hint");
    setError(null);
    try {
      const text = await fetchHint(6, problem, attempt, token);
      setHints((h) => [...h, { rung: 6, text }]);
    } catch {
      setError("Couldn't reach the tutor — try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pr-challenge">
      <p className="pr-q-prompt">
        <MathText>{problem.prompt}</MathText>
      </p>
      <textarea
        ref={taRef}
        className="pr-attempt"
        placeholder="Type what you've tried — even a first idea unlocks help."
        aria-label="Your proof attempt"
        value={attempt}
        onChange={(e) => setAttempt(e.target.value)}
        disabled={solved}
      />
      {!solved && <SymbolPalette onInsert={insertSymbol} />}

      {hints.length > 0 && (
        <div className="pr-hints">
          {hints.map((h, i) => (
            <div key={i} className="pr-hint">
              <span className="pr-hint-rung">{h.rung === 6 ? "Answer" : `Hint L${h.rung}`}</span>
              <MathText>{h.text}</MathText>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <p className="pr-spinner">{loading === "grade" ? "Checking your proof…" : "Thinking…"}</p>
      )}
      {error && (
        <p className="pr-error" role="alert">
          {error}
        </p>
      )}

      {verdict && verdict !== "correct" && !loading && (
        <p className="pr-feedback pr-feedback--no" role="status">
          {verdict === "incomplete"
            ? "Not complete yet — keep going, or ask for a hint."
            : "Not quite right — try again, or ask for a hint."}
        </p>
      )}
      {solved && (
        <p className="pr-feedback pr-feedback--ok" role="status">
          ✓ Correct — chapter mastered!
        </p>
      )}

      {!solved && (
        <div className="pr-actions">
          <button type="button" className="pr-btn" disabled={!canAct} onClick={grade}>
            Submit for grading
          </button>
          {!revealed && ladder.rung < 5 && (
            <button type="button" className="pr-btn pr-btn--ghost" disabled={!canAct} onClick={getHint}>
              {ladder.attempted ? "Still stuck — hint" : "Get a hint"}
            </button>
          )}
          {!revealed && ladder.rung >= 5 && !askReveal && (
            <button type="button" className="pr-btn pr-btn--ghost" disabled={!!loading} onClick={() => setAskReveal(true)}>
              Show the full answer
            </button>
          )}
        </div>
      )}

      {askReveal && (
        <div className="pr-reveal-confirm">
          <p>You've worked through the hints. Reveal the full proof? You'll get a similar problem to try afterward.</p>
          <div className="pr-actions">
            <button type="button" className="pr-btn" onClick={doReveal}>
              Yes, show it
            </button>
            <button type="button" className="pr-btn pr-btn--ghost" onClick={() => setAskReveal(false)}>
              Keep trying
            </button>
          </div>
        </div>
      )}

      {revealed && hasTwin && (
        <button type="button" className="pr-btn" style={{ marginTop: 10 }} onClick={onTwin}>
          Try a similar problem
        </button>
      )}
    </div>
  );
}
