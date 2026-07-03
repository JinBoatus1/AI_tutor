# Grade Tracker Phase 2A — Conditional / Scenario Weighting (the moat)

Date: 2026-07-03 · Branch: `feat/grade-phase2-conditional` (off `feat/grade-backend`, stacked on PR #15)
Design cleared via `superpowers:brainstorming`. Eng review (`/plan-eng-review`) recommended before build.

## Why

The Grade Tracker's differentiation is **deterministic piecewise math over conditional
weights** — the class of rubric that a static fixed-weight calculator (RogerHub, a
spreadsheet) structurally cannot solve. Phase 1 shipped `uniform | dropLowest | rankWeights |
fixedWeights` (all *static* weights). Phase 2A adds the two conditional rules that show up in
real syllabi and require *the grade to be a max over weighting scenarios*:

1. **Replace-if-higher** (within a category) — "your final exam score, if higher, replaces
   your lowest midterm." The final ALSO counts in its own weighted slot ("counts twice").
2. **Max-of-two-weightings** (course level) — "the final is 25% of the grade, OR 40% with the
   midterm dropped, whichever is better for you."

Both are the SAME core: **grade = max over a finite set of weighting scenarios**, and the
`goal_seek` becomes piecewise. We build that core once; both rules plug in.

## Locked semantics

- **Replace-if-higher (locked):** the replacer item (final) contributes its own weighted slot
  normally; ADDITIONALLY, if `frac_replacer > frac_lowest_nonreplacer`, the lowest
  non-replacer item's fraction is boosted to `frac_replacer`. The final effectively counts
  twice (its slot + the boost). Only the single lowest non-replacer is boosted.
- **Max-of-weighting (locked):** the course grade is the MAX over the primary scheme (each
  `category.weight`) and every alternate scheme; each scheme is a full per-category weight
  vector that must sum to 100.

## Data model

### Wire types (`frontend/src/grades/types.ts`, mirrored in `grades_serde`)
```ts
Rule |= { kind: "replaceLowest" }          // per-item weights (like fixedWeights) + one replacer item
Item  = { ..., weight?: number, replacer?: boolean }   // replacer only meaningful in a replaceLowest category
Course = { ..., weightings?: WeightScheme[] }
WeightScheme = { name?: string; weights: Record<CategoryId, number> } // must cover ALL categories, sum 100
```
- `replaceLowest` reuses the Phase-1 per-item `weight` (points that sum to the category weight);
  exactly one item in the category is flagged `replacer: true`.
- `weightings` are keyed by **category id** (stable in the frontend); serde resolves id→category
  for compute. Absent/empty ⇒ single implicit scheme = today's behavior (fully back-compat).

## Compute core (`grades_math.py`)

**Key abstraction — normalize each category, then parametrize by scheme weight.**
Per category compute two weight-independent quantities:
- `e_cat` ∈ [0,1] — the category's earned fraction over its GRADED items (this is where the
  `replaceLowest` boost is applied, at the item level).
- `gw_cat` ∈ [0,1] — the graded coverage (fraction of the category's slot weight that is graded;
  the renormalization base).

These come straight from the Phase-1 helpers divided by `category.weight`
(`e_cat = _category_earned/ w`, `gw_cat = _category_graded_weight / w`), so the existing rule
math is reused, not rewritten.

Then each weighting scheme `s` (primary + alternates) is just a per-category weight vector `W_s`:
```
earned_s        = Σ_cat  W_s[cat] · e_cat
graded_weight_s = Σ_cat  W_s[cat] · gw_cat
percent_s       = earned_s / graded_weight_s · 100          (None if graded_weight_s == 0)
standing.percent = max over schemes of percent_s            (the scheme most favorable to the student)
```
- `_category_earned` gains a `replaceLowest` branch: non-replacer items contribute `w_i·frac_i`
  except the single lowest **graded** non-replacer, which contributes `w_low·max(frac_low,
  frac_replacer)` (ties: boost any one — same value); the replacer contributes `w_R·frac_R`.
  Boost applies only when BOTH the replacer and ≥1 non-replacer are graded.
  `_category_graded_weight` = Σ graded `w_i` (same as fixedWeights).
- **Regression rule (IRON):** with no `weightings` and no `replaceLowest`, `standing`/`goal_seek`
  are byte-for-byte identical to Phase 1 (the 105-test suite stays green). A single implicit
  scheme with `max` over one element must reduce to the current path.

## goal_seek generalization (the piecewise moat)

The unknown (upcoming) item is *going to be graded* — its slot weight counts toward the
denominator regardless of the score. So the renormalization base `graded_weight_s` is
**constant in `x`**; only the numerator `earned_s(x)` varies. `percent_s(x)` is therefore
**linear per piece** (the Phase-1 fixed-weight solve `x* = (target − total0)/w_u`, generalized),
NOT linear-fractional. What makes it piecewise / multi-branch:
- `earned_s(x) = Σ_cat W_s[cat]·earned_cat(x)`; only the unknown's category depends on `x`.
- Ordinary rule ⇒ `earned_cat(x)` linear in `x`.
- `replaceLowest` with the replacer as the unknown ⇒ **piecewise-linear**, one breakpoint at
  `x = frac_lowest_graded_nonreplacer` (below it: no boost; above: `+ w_low·(x − frac_low)`).

For scheme `s` on a given piece, `percent_s(x) = 100·(A_s·x + B_s)/D_s` with `D_s =
graded_weight_s` constant, so `percent_s(x) ≥ target` solves to one root
`x* = (target·D_s/100 − B_s)/A_s`. Algorithm:
```
for each cutoff target:
  candidates = []
  for each scheme s, for each piece of x:
     solve percent_s(x) ≥ target on that piece; keep the smallest feasible x within the piece
  needed = min(candidates) clamped to [0,1], × unknown.max_score
  status = already_met | ok | infeasible
```
Max over schemes ⇒ we want the smallest `x` that satisfies ANY scheme (the student picks the
favorable one), i.e. `min` over scheme/piece candidates. `unknown_weight` (the replacer/fixed
item's own weight) is passed through as in Phase 1. Rank-based `rankWeights` goal_seek path is
untouched (regression-locked).

## Editor UI (`RubricEditor.tsx`, `Grades.css`)

- **New scoring mode "Replace lowest"** (4th segmented option): reuses the custom-weights row
  editor (per-row name + weight) plus a **per-row "final / replacer" radio** (exactly one).
  Row hint: "if the final scores higher, it lifts your lowest item." Per-category weight sum
  check as in fixedWeights.
- **Alternate weighting** — a course-level collapsible section under the categories: "+ add an
  alternate weighting", each scheme = a name + one weight input per category + a "sums to 100"
  chip. Standing shows the max; (nice-to-have, deferred) a caption "counting scheme: <name>".
- Human-confirm always (premise 3). rankWeights stays legacy/not-exposed.

## Testing

**pytest (mandatory / IRON):**
- (a) **Regression** — no `weightings`, no `replaceLowest` ⇒ Phase-1 standing/goal_seek byte-for-byte (105-suite green).
- (b) **replaceLowest hand-calc** — boost-active and boost-inactive cases both match a hand computation; replacer ungraded ⇒ no boost; only-replacer-graded ⇒ no lowest to boost.
- (c) **max-of-weighting hand-calc** — a course where scheme A wins for one score set and scheme B wins for another; standing = max.
- (d) **goal_seek piecewise** — replaceLowest unknown solved on BOTH sides of the breakpoint (different roots); multi-scheme goal_seek takes the min feasible x; already_met / infeasible.
- (e) **serde round-trip** — replaceLowest + item.replacer + course.weightings parse & validate; back-compat when absent.

**vitest:** RubricEditor "Replace lowest" mode (designate replacer, sum check) + alternate-weighting section (add scheme, per-category sum). Pure rubric.ts helpers for scheme add/remove and replacer toggle.

## Scope boundaries (YAGNI)

- **Deferred:** syllabus LLM does NOT auto-detect these rules (rare wording, high misparse risk) →
  reachable only via the manual editor for now. Note in the parse prompt that these stay manual.
- **Out:** bonus / extra-credit points, conditional-drop (both explicitly deselected in brainstorming).
- **Out:** multi-course (Phase 2B) and gradebook polish (Phase 2C) — separate sub-projects.

## Task breakdown (for writing-plans to expand)

- **T1 (backend core)** — normalize per-category (`e_cat`/`gw_cat`), scheme-max `compute_standing`, `replaceLowest` earned branch. Files: `grades_math.py`, `test_grades_math.py`. Verify: regression (a) + replaceLowest (b) + max-scheme (c).
- **T2 (backend goal_seek)** — linear-fractional per-piece solver, piecewise for replaceLowest, min-x over schemes. Files: `grades_math.py`, `test_grades_math.py`. Verify: (d).
- **T3 (serde)** — parse `replaceLowest` + `item.replacer` + `course.weightings` (id-keyed), validate sums. Files: `grades_serde.py`, `test_grades_serde.py`. Verify: (e).
- **T4 (wire types + rubric helpers)** — `types.ts` additions; `rubric.ts` replacer toggle + scheme add/remove/sync-on-category-change; unit tests. Files: `frontend/src/grades/{types,rubric,rubric.test}.ts`.
- **T5 (editor UI)** — "Replace lowest" mode + alternate-weighting section. Files: `RubricEditor.tsx`, `Grades.css`, `RubricEditor.test.tsx`, i18n `messages.ts`.
- **T6 (standing route wiring)** — ensure `/api/grades/standing` passes `weightings`/replacer through (mostly serde-driven; confirm the route + `find_wire_item` handle the new shape). Files: `api_routes.py` (or the grades route module), route test.

## Locked decisions

- **D1:** unified max-over-scenarios core; both rules ship in this spec (user pick).
- **D2:** replace-if-higher = replacer counts in its own slot AND boosts the lowest non-replacer (user pick).
- **D3:** `replaceLowest` reuses per-item `weight`; the replacer is an **item flag**, not a rule field (consistent with Phase-1 D2 anti-coupling).
- **D4:** alternate weightings keyed by **category id**, each a full vector summing to 100; primary scheme implicit.
- **D5:** normalized per-category (`e_cat`/`gw_cat`) is the parametrization seam; Phase-1 category math reused.
- **D6:** syllabus auto-detection deferred; manual editor only.
