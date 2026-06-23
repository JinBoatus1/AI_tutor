import { useState } from "react";
import MathText from "../../MathText";
import { gradeMcq } from "../grading";
import type { McqQuestion as Q } from "../types";

/** Multiple choice with explain-on-wrong feedback (design D-1): correct → check;
 * wrong → gentle "not quite" + the `why` line + retry, never a penalty. */
export function McqQuestion({ question, onAnswered }: { question: Q; onAnswered: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);

  const submit = () => {
    if (picked === null) return;
    const ok = gradeMcq(question, picked);
    setResult(ok);
    onAnswered(ok);
  };
  const retry = () => {
    setResult(null);
    setPicked(null);
  };
  const locked = result === true;

  return (
    <div className="pr-q">
      <p className="pr-q-prompt">
        <MathText>{question.prompt}</MathText>
      </p>
      <ul className="pr-choices" role="radiogroup" aria-label="Answer choices">
        {question.choices.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={locked}
              className={
                "pr-choice" +
                (picked === i ? " pr-choice--picked" : "") +
                (result !== null && i === question.answerIndex ? " pr-choice--correct" : "")
              }
              onClick={() => setPicked(i)}
            >
              <MathText>{c}</MathText>
            </button>
          </li>
        ))}
      </ul>

      {result === null && (
        <button type="button" className="pr-btn" disabled={picked === null} onClick={submit}>
          Check
        </button>
      )}
      {result === true && (
        <p className="pr-feedback pr-feedback--ok" role="status">
          ✓ Correct
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
