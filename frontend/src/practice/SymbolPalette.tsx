/** Clickable math-symbol palette for the challenge answer box.
 * Keyboards can't type ∀ ∃ ∈ ⇒ ω δ …, so this inserts the Unicode glyph at the
 * cursor (plain text — the student sees the real symbol and the AI grader reads it).
 * Categorized; `onMouseDown preventDefault` keeps the textarea's focus + selection
 * so insertion lands at the caret, not the end. */

const CATEGORIES: { name: string; symbols: string[] }[] = [
  { name: "Greek", symbols: "α β γ δ ε θ λ μ π ρ σ τ φ ψ ω Γ Δ Θ Λ Π Σ Φ Ψ Ω".split(" ") },
  { name: "Logic", symbols: "∀ ∃ ∄ ¬ ∧ ∨ ⇒ ⇔ → ↔ ⊕ ≡ ⊢ ⊨ ⊤ ⊥ ∴ ∵".split(" ") },
  { name: "Sets", symbols: "∈ ∉ ⊆ ⊊ ⊂ ⊇ ⊃ ∪ ∩ ∅ ∖ △ ℘ × ⟨ ⟩".split(" ") },
  { name: "Relations", symbols: "≤ ≥ ≠ ≈ ≅ ≡ ∣ ∤ ∼ ≺ ≻ ⪯ ⪰ ≪ ≫ ∝".split(" ") },
  { name: "Operators", symbols: "∑ ∏ √ ∛ ∞ ∫ · × ÷ ± ∓ ∘ ⌊ ⌋ ⌈ ⌉ ≜ ∎ □".split(" ") },
  { name: "Powers", symbols: "⁰ ¹ ² ³ ⁿ ᵏ ⁺ ⁻ ₀ ₁ ₂ ₙ ₖ ₊".split(" ") },
  { name: "Numbers", symbols: "ℕ ℤ ℚ ℝ ℂ ℙ ℵ".split(" ") },
];

import { useState } from "react";

export function SymbolPalette({
  onInsert,
  disabled,
}: {
  onInsert: (symbol: string) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(0);
  const cat = CATEGORIES[active];
  return (
    <div className="pr-palette">
      <div className="pr-palette-label">Insert symbol</div>
      <div className="pr-palette-tabs" role="tablist" aria-label="Symbol categories">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={`pr-palette-tab${i === active ? " is-on" : ""}`}
            onClick={() => setActive(i)}
            disabled={disabled}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="pr-palette-grid">
        {cat.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            className="pr-sym"
            aria-label={`Insert ${sym}`}
            // preventDefault on mousedown so the textarea keeps focus + selection.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(sym)}
            disabled={disabled}
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
