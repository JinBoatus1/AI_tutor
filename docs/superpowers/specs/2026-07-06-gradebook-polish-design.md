# Gradebook Polish (Grade Tracker Phase 2C, round 1) — Design Spec

Date: 2026-07-06 · Branch: `feat/grade-gradebook-polish` (off `origin/function`; independent of the pending #18)
Design cleared via `superpowers:brainstorming`.

## Scope (locked)

Two small, pure-frontend gradebook improvements, plus one enabling refactor:

- **A. Editable per-item max score.** The gradebook shows a static `/ {maxScore}`. Make it an input so a student can enter items scored out of 20, 50, etc. (not just /100).
- **B. Score-over-max validation (non-blocking).** When an entered `score` is `< 0` or `> maxScore`, flag the row with a subtle warning. The value is still saved (validation is non-blocking, per the project's premise-3); it is only surfaced so the student notices a typo.
- **Refactor (enabler): extract `Gradebook` out of `Grades.tsx` into `frontend/src/grades/Gradebook.tsx`.** It is already a self-contained `Gradebook({ course, onChange })` function; moving it to its own file makes A/B unit-testable (today it is buried behind auth/fetch gates in the 500-line `Grades.tsx`) and shrinks that file.

**Architecture unchanged:** the frontend only edits the rubric/item SHAPE; the server stays authoritative for all grade math. `item.maxScore` already feeds the backend `Item.fraction = score / max_score` (which returns 0 for `max_score <= 0`), so no backend change is needed.

## NOT in scope (deferred)

- Per-category subtotal ("87% so far") — needs the server to return a per-category breakdown (bigger; server-authoritative).
- "Which weighting scheme wins" caption — depends on `Course.weightings` (Phase 2A-2 / PR #18), not yet in `function`.
- What-if projection — already effectively covered by the live-updating gradebook (editing a score re-fetches the standing).
- Editing `maxScore` in the RubricEditor — the gradebook (where scores are entered) is the natural home; the editor stays about rubric structure.

## Components / data flow

```
Grades.tsx (ReadyView)
  └── <Gradebook course onChange />        [MOVED to grades/Gradebook.tsx]
        per category → per item row:
          [name]  ...  [score input]  / [maxScore input]   (+ warn if over/under)
        setScore(catId,itemId,raw)     → onChange(course')   (exists)
        setMaxScore(catId,itemId,raw)  → onChange(course')   (NEW, mirrors setScore)
        addItem(catId)                 → onChange(addItemRow(cat))  (exists)
```
`onChange` flows to the existing debounced `saveCourse` + `/api/grades/standing` refetch in `GradesAuthed` — so an edited maxScore re-persists and re-computes standing automatically. No new wiring.

### A — setMaxScore
Mirror `setScore`: `const setMaxScore = (catId, itemId, raw) => onChange({ ...course, categories: map cat → map item → { ...it, maxScore: Number(raw) || 100 } })`. Empty/NaN falls back to 100 (a sane default; never `0`, which would zero the item's contribution). Render `/ ` + a small number input (`aria-label={`${it.name} max score`}`) in place of the static `.gr-gb-max` span.

### B — scoreWarning (pure, testable)
Add a pure helper (in `grades/rubric.ts`, next to the other item helpers):
```ts
/** True when an entered score is outside [0, maxScore] — a likely typo. Non-blocking. */
export const scoreWarning = (it: Pick<Item, "score" | "maxScore">): boolean =>
  it.score != null && (it.score < 0 || it.score > it.maxScore);
```
In the row: when `scoreWarning(it)`, add a `warn` class to the score cell and render a small note `t("grades.scoreOverMax")` (e.g. "over the max"). Reuse the existing warn color (`#9a5b3b`, as used by `.gr-sumchip.warn` / `.gr-tier-sum.warn`).

## Testing

- **`scoreWarning` unit tests** (`grades/rubric.test.ts`, node): null score → false; in-range → false; `> maxScore` → true; `< 0` → true; boundary `score == maxScore` → false.
- **`Gradebook` component tests** (`grades/Gradebook.test.tsx`, jsdom, wrapped in `LocaleProvider` like the RubricEditor tests): (1) editing the max-score input calls `onChange` with the new `maxScore`; (2) a score above the max renders the warning; (3) an in-range score does not. Use a small stub course + a spy `onChange`.
- Full gate: `tsc --noEmit`, all vitest, `vite build`.

## Tasks

- **T1** — extract `Gradebook` to `frontend/src/grades/Gradebook.tsx` (verbatim move + export; `Grades.tsx` imports it). Verify: `tsc` clean, existing vitest + build unchanged (pure move, no behavior change).
- **T2** — `scoreWarning` helper + unit tests (`grades/rubric.ts`, `grades/rubric.test.ts`).
- **T3** — editable max-score input + over-max warning in `Gradebook.tsx` (uses `setMaxScore` + `scoreWarning`); CSS in `Grades.css`; i18n `grades.scoreOverMax` in en/zh/es; component tests `grades/Gradebook.test.tsx`.

## Locked decisions
- **D1:** pure-frontend only; server math untouched (`maxScore` already used server-side).
- **D2:** validation is non-blocking (flag, don't reject) — matches premise-3 (human-confirm, never auto-reject).
- **D3:** empty/invalid maxScore falls back to 100, never 0.
- **D4:** extract `Gradebook` to its own file to enable component tests + shrink `Grades.tsx`.
- **D5:** branch off `function` (no dependency on the pending #18 weightings work).
