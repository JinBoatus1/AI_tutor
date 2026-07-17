# 29-Chapter Practice Content Correctness Audit — Design Spec

**Date:** 2026-07-14
**Status:** Approved (brainstorming)
**Branch:** `feat/practice-content-audit` (off latest `origin/function`)
**Related:** [Practice/Quiz Mode](./2026-06-12-chapter-1-practice-mode-design.md) · content lives in `frontend/src/data/practice/`

## 1. Goal & Scope

Audit the correctness and quality of the hand-authored practice content for all 29
FOCS chapters and fix the defects found in place.

**In scope — audit all 29 `PracticeSet`s** (`frontend/src/data/practice/chapter04.ts` +
`chapters01to10.ts` / `chapters11to20.ts` / `chapters21to29.ts`), covering every
`warmup` / `practice` / `challenge` item. Both **hard errors** and **soft quality**
defects are in scope (§2). Fixes are applied in place, in the existing files.

**Non-goals (explicitly excluded to prevent scope creep):**

- **No file-structure refactor.** The shared multi-chapter files (`chapters01to10.ts`,
  etc.) stay as they are; we do not split them into one-file-per-chapter.
- **No new items.** We do not add practice questions or challenges, and we do **not**
  fill the proof-order format gap in chapters 21, 23–29 (that is a separate content
  direction).
- **No textbook-edition fidelity check.** We audit **mathematical correctness,
  internal consistency, and unambiguity** — universal properties (e.g. "the sum of two
  odd integers is even") — not fidelity to any one edition's exact wording or notation.

## 2. Defect Taxonomy

The audit checklist, defined per item format. Item shapes are in
`frontend/src/practice/types.ts`.

### Hard errors (found → fixed; require high confidence per §4)

- **`mcq`** — `answerIndex` points to a choice that is not the uniquely correct one; or
  a distractor is also correct (two right answers).
- **`spot-flaw`** — `flawLineId` is not the actually-invalid step; or another line is
  also invalid; or the designated "flaw" line is in fact valid.
- **`proof-order`** — the `deps` graph admits an ordering that is logically nonsensical
  (a missing dependency); or it rejects a genuinely valid ordering (a spurious
  dependency); or the steps do not compose into a correct proof.
- **`fill-blank`** — `accept` omits a reasonable phrasing of the correct answer; or it
  admits a wrong answer.
- **`challenge`** — `solution` is an incorrect or incomplete proof; `rubric` does not
  match the solution's key steps or is not gradeable; `twinPromptId` resolves to a
  problem that is not genuinely analogous.
- **`flashcard`** — `back` is factually wrong or does not answer `front`.

### Soft quality (fixed only when genuinely misleading — no style churn)

- `why` explanation is weak, wrong, or inconsistent with the answer.
- `prompt` (or `before`/`after` framing) is ambiguous.
- `accept` is too strict or too loose (borderline of the hard-error case).
- LaTeX that will mis-render (unbalanced `$`, malformed `\begin{}`…`\end{}`, bad escapes).
- Duplicate `id`s.

## 3. Method — Two Layers

### Layer 1 — Structural check test (permanent regression guard)

A new vitest suite (`frontend/src/data/focsPracticeSets.audit.test.ts`) that
mechanically validates every item across all 29 sets. Zero AI cost; run first so it
catches mechanical defects before the semantic pass, and kept afterward as a guard.
Assertions:

- Every `id` (warmup, practice, challenge, and nested step/line ids) is unique within
  its scope; no `PracticeSet.chapter` collisions.
- `mcq.answerIndex ∈ [0, choices.length)`.
- Each `proof-order` `deps` graph is a DAG (no cycle), every `dep` references an
  existing step id in the same question, and at least one valid topological order
  exists.
- Every `spot-flaw.flawLineId` exists in that question's `lines`.
- Every `fill-blank.accept` is non-empty.
- Every `challenge.twinPromptId`, when present, resolves to a `challenge.id` in the
  same chapter.
- LaTeX delimiters balance: `$` count is even; `\begin{X}` / `\end{X}` are matched.

### Layer 2 — Multi-agent adversarial audit workflow (semantic / math layer)

A `Workflow` run structured as a `pipeline` over the 29 chapters (chapters are
independent — natural parallelism, no barrier):

- **Stage 1 (audit)** — one agent per chapter receives that chapter's full content and
  re-derives the mathematics of every item against the §2 checklist, returning a
  structured defect list. Schema per defect:
  `{ chapter, itemId, format, severity: "hard" | "soft", class, evidence, proposedFix }`.
- **Stage 2 (adversarial verify)** — for each defect the chapter surfaced, one agent
  attempts to **refute** it (prompt: "is this really an error? default to skeptical")
  and **independently checks the `proposedFix`** for correctness and for introducing no
  new error, returning `{ verdict: "confirmed" | "rejected", fixOk: boolean, note }`.

**Key constraint — workflow agents read and reason only; they do not edit files.** The
workflow's output is a *verified defect ledger*. Agents are not allowed to write because
multiple chapters share one file (`chapters01to10.ts`, etc.), so parallel edits would
collide.

## 4. Fix Application & Verification

- The **main loop applies the fixes** from the verified ledger, **one chapter at a time,
  sequentially**, editing the existing files. This avoids parallel-edit conflicts and
  keeps edits under direct control.
- **Confidence bar:** a hard error is applied only when Stage 2 returned
  `verdict === "confirmed" && fixOk === true`. A soft-quality change has the same
  `confirmed` bar **and** is applied only when the item is genuinely misleading — pure
  style preferences are left alone.
- After each chapter (or small batch) is edited: run **Layer 1 structural test + the full
  existing vitest suite + the production build (`tsc` + build)**.
- Final step: `/browse` smoke-test **2 sampled chapters** — one proof chapter and one
  theory-of-computation chapter — to confirm prompts render and grading behaves.

## 5. Deliverables & Git

- Branch `feat/practice-content-audit` cut from latest `origin/function`.
- Commits: the structural test as its own commit; fixes committed per chapter or per
  small batch, each message stating what changed and why.
- The PR body carries the **defect-ledger summary** — one row per defect:
  chapter · itemId · class · old → new · verify verdict — so the change set is auditable.

## 6. Acceptance Criteria

- Structural test (Layer 1) green.
- Existing vitest suite green.
- `tsc` + production build clean.
- Browser smoke of the 2 sampled chapters passes.
- Every "fixed" entry in the ledger is backed by a Stage-2 `confirmed` verdict.
