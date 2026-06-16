import { useState } from "react";
import MathText from "../../MathText";
import { gradeSpotFlaw } from "../grading";
import type { SpotFlawQuestion as Q } from "../types";

/** Click the invalid line in a "proof". Lines are real focusable <button>s
 * (Tab/Enter, aria-pressed, 44px — design D-3). Explain-on-wrong + retry (D-1). */
export function SpotFlawQuestion({ question, onAnswered }: { question: Q; onAnswered: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const locked = result === true;

  const submit = () => {
    if (!picked) return;
    const ok = gradeSpotFlaw(question, picked);
    setResult(ok);
    onAnswered(ok);
  };
  const retry = () => {
    setResult(null);
    setPicked(null);
  };

  return (
    <div className="pr-q">
      <p className="pr-q-prompt">
        <MathText>{question.prompt}</MathText>
      </p>
      <ol className="pr-flaw-lines" aria-label="Proof lines — select the invalid step">
        {question.lines.map((line) => (
          <li key={line.id}>
            <button
              type="button"
              aria-pressed={picked === line.id}
              disabled={locked}
              className={
                "pr-flaw-line" +
                (picked === line.id ? " pr-flaw-line--picked" : "") +
                (result !== null && line.id === question.flawLineId ? " pr-flaw-line--flaw" : "")
              }
              onClick={() => setPicked(line.id)}
            >
              <MathText>{line.text}</MathText>
            </button>
          </li>
        ))}
      </ol>

      {result === null && (
        <button type="button" className="pr-btn" disabled={!picked} onClick={submit}>
          Check
        </button>
      )}
      {result === true && (
        <p className="pr-feedback pr-feedback--ok" role="status">
          ✓ Found the flaw
        </p>
      )}
      {result === false && (
        <div className="pr-feedback pr-feedback--no" role="status">
          <span>
            Not quite — <MathText>{question.why}</MathText>
          </span>
          <button type="button" className="pr-btn pr-btn--ghost" onClick={retry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
