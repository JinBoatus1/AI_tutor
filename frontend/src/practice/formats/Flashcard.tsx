import { useState } from "react";
import MathText from "../../MathText";
import type { Flashcard as Card } from "../types";

/** A single warm-up recall card. Flips on click / Enter / Space (it is a <button>,
 * so keyboard + screen-reader work natively). Parent passes key={card.id} so the
 * flip resets when the card changes. */
export function Flashcard({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`pr-flashcard${flipped ? " pr-flashcard--flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? "Definition (tap to show the term)" : "Term (tap to show the definition)"}
    >
      <span className="pr-flashcard-face">
        <MathText>{flipped ? card.back : card.front}</MathText>
      </span>
      {!flipped && <span className="pr-flashcard-hint">tap to flip</span>}
    </button>
  );
}
