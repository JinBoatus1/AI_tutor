# fix(practice): 29-chapter content correctness audit

Audits the hand-authored practice content for all 29 FOCS chapters and fixes the
defects found. Method: a permanent structural test guard plus a multi-agent
adversarial audit (per-chapter auditor → per-defect refutation), then main-loop-applied
fixes. Spec: `docs/superpowers/specs/2026-07-14-practice-content-audit-design.md` ·
Plan: `docs/superpowers/plans/2026-07-14-practice-content-audit.md` ·
Ledger: `docs/superpowers/artifacts/2026-07-14-practice-audit-ledger.json`.

## Audit outcome

- **Structural guard** (`focsPracticeSets.test.ts`): added id-uniqueness + LaTeX-balance
  checks. The LaTeX guard immediately caught an unterminated `$` in **ch2-p2**.
- **Adversarial audit**: 35 agents, ~917k tokens, 29-chapter sweep. **6 defects flagged,
  all 6 confirmed real** by an independent refutation pass. 2 hard, 4 soft.

## Fixes applied (ledger summary)

| Ch | Item | Sev | Class | Fix (old → new) |
|----|------|-----|-------|-----------------|
| 2  | ch2-p2 | — | unterminated `$` (LaTeX) | `…$\|\mathcal{P}(A)\| = ____` → `…$\|\mathcal{P}(A)\|$ = ____` (closed the math span) |
| 9  | ch9-c1 | soft | non-analogous twin | `twinPromptId: "ch9-c2"` removed — c2 is a Θ-bound proof, not summation induction; no same-method challenge exists in ch9 |
| 10 | ch10-c1 | soft | non-analogous twin | `twinPromptId: "ch10-c2"` removed — c2 is a congruence proof, not a Bézout computation |
| 11 | ch11-path | **hard** | wrong definition (trail vs path) | back: "no repeated **edge**" → "no repeated **vertex** (so no repeated edge either)" |
| 20 | ch20-p2 | **hard** | two correct MCQ choices | choice 0 `∑_{t≥1} t·P(X=t)` (= E[X], also correct) → `∑_{t≥0} P(X≥t)` (= 1+E[X], wrong); answerIndex unchanged; sharpened `why` |
| 22 | c22-f2 | soft | imprecise definition | back: "uncountable iff no bijection with ℕ" → "**infinite and** no bijection with ℕ (= not countable)" — old form mislabeled every finite set uncountable |
| 24 | c24-p2 | soft | ambiguous spot-flaw | `flawLineId: "l1"` (a valid hypothesis) → `"l3"` ("So it is still a DFA", the actually-false conclusion); rewrote `why` |

**Note on the two soft fixes with `fixOk=false`** (ch9-c1, c24-p2): the verify stage
confirmed the defect but rejected the auditor's *proposed* fix (ch9's pointed at a
practice-array id that would break the twin-resolution test; c24's made every line true,
leaving no flaw). Both were applied using the verifier's own recommended alternative.

## Verification

- `npx vitest run` — **352 passed** (16 files), including the extended structural guard (236).
- `npm run build` (`tsc -b && vite build`) — **clean**.
- KaTeX render check of all 6 changed strings — **10/10 math segments render, 0 failures**.
- Grading of the changed items (ch20-p2, c24-p2) is handled by the unit-tested pure
  functions `gradeMcq`/`gradeSpotFlaw`; only data changed.

## Non-goals (unchanged)

No file-structure refactor, no new practice items, no proof-order gap-fill in ch 21/23–29,
no textbook-edition wording changes.
