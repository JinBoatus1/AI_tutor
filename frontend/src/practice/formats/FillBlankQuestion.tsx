import { useState } from "react";
import MathText from "../../MathText";
import { gradeFillBlank } from "../grading";
import type { FillBlankQuestion as Q } from "../types";

/** Fill the missing justification. Inline text input between `before`/`after`.
 * Normalized grading (case/whitespace/$latex$); explain-on-wrong + retry (D-1). */
export function FillBlankQuestion({ question, onAnswered }: { question: Q; onAnswered: (correct: boolean) => void }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const locked = result === true;

  const submit = () => {
    if (!value.trim()) return;
    const ok = gradeFillBlank(question, value);
    setResult(ok);
    onAnswered(ok);
  };

  return (
    <div className="pr-q">
      <p className="pr-q-prompt">
        <MathText>{question.prompt}</MathText>
      </p>
      <p className="pr-fill">
        <MathText>{question.before}</MathText>
        <input
          className="pr-blank"
          aria-label="Fill in the blank"
          value={value}
          disabled={locked}
          onChange={(e) => {
            setValue(e.target.value);
            if (result === false) setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <MathText>{question.after}</MathText>
      </p>

      {result === null && (
        <button type="button" className="pr-btn" disabled={!value.trim()} onClick={submit}>
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
          <button type="button" className="pr-btn pr-btn--ghost" onClick={() => setResult(null)}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
