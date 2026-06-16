import { useMemo, useState } from "react";
import MathText from "../../MathText";
import { gradeProofOrder } from "../grading";
import type { ProofOrderQuestion as Q } from "../types";

/** Start from a scrambled order (reverse of the authored order — a valid proof's
 * reverse is not a valid topological order, so the student always has work to do). */
function scramble(q: Q): string[] {
  return q.steps.map((s) => s.id).reverse();
}

/** Proof-step ordering. Reorder via up/down buttons (keyboard + screen-reader
 * accessible, design D-3) AND native drag (progressive enhancement). Graded as a
 * valid topological order, so any correct ordering passes (design D9). */
export function ProofOrderQuestion({ question, onAnswered }: { question: Q; onAnswered: (correct: boolean) => void }) {
  const [order, setOrder] = useState<string[]>(() => scramble(question));
  const [result, setResult] = useState<boolean | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const byId = useMemo(() => new Map(question.steps.map((s) => [s.id, s])), [question]);

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setResult(null);
    setOrder((o) => {
      const next = [...o];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const submit = () => {
    const ok = gradeProofOrder(question, order);
    setResult(ok);
    onAnswered(ok);
  };

  return (
    <div className="pr-q">
      <p className="pr-q-prompt">
        <MathText>{question.prompt}</MathText>
      </p>
      <ol className="pr-steps" aria-label="Drag or use the arrows to order the proof steps">
        {order.map((id, i) => (
          <li
            key={id}
            className={"pr-step" + (dragIndex === i ? " pr-step--dragging" : "")}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <span className="pr-step-text">
              <MathText>{byId.get(id)!.text}</MathText>
            </span>
            <span className="pr-step-moves">
              <button type="button" className="pr-move" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => reorder(i, i - 1)}>
                ↑
              </button>
              <button type="button" className="pr-move" aria-label={`Move step ${i + 1} down`} disabled={i === order.length - 1} onClick={() => reorder(i, i + 1)}>
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      {result !== true && (
        <button type="button" className="pr-btn" onClick={submit}>
          Check order
        </button>
      )}
      {result === true && (
        <p className="pr-feedback pr-feedback--ok" role="status">
          ✓ Valid proof order
        </p>
      )}
      {result === false && (
        <p className="pr-feedback pr-feedback--no" role="status">
          <MathText>{question.why}</MathText> Keep rearranging.
        </p>
      )}
    </div>
  );
}
