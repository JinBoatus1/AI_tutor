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
  `_category_graded_weight` = Σ graded `w_i` (same as fixedWeights). **This is the ONLY new
  compute in Phase 2A-1 — no scheme/normalization machinery needed for replace-if-higher.**
- **Normalization (2A-2 only):** compute `e_cat`/`gw_cat` from the category's **intrinsic
  relative slot weights** (normalized to sum to 1 within the category), NOT by dividing by
  `category.weight` (eng-review): a brand-new category can have `category.weight == 0`, and an
  alternate scheme may reassign a category's weight, so `category.weight` is the wrong divisor —
  it risks div-by-zero and mis-scales fixed item weights. A category with 0 slots contributes 0
  to every scheme (guard).
- **Regression rule (IRON):** with no `weightings` and no `replaceLowest`, `standing`/`goal_seek`
  match Phase 1 **within float tolerance (≤1e-9), not byte-for-byte** (eng-review: the
  normalization refactor reorders float ops, so exact bit-equality is unrealistic; assert
  `pytest.approx`). The 105-test suite stays green. A single implicit scheme with `max` over one
  element must reduce to the current path.

## goal_seek generalization (the piecewise moat)

The unknown (upcoming) item is *going to be graded* — its slot weight counts toward the
denominator regardless of the score. So the renormalization base `graded_weight_s` is
**constant in `x`**; only the numerator `earned_s(x)` varies. `percent_s(x)` is therefore
**linear per piece** (the Phase-1 fixed-weight solve `x* = (target − total0)/w_u`, generalized),
NOT linear-fractional. What makes it piecewise / multi-branch:
- `earned_s(x) = Σ_cat W_s[cat]·earned_cat(x)`; only the unknown's category depends on `x`.
- Ordinary rule ⇒ `earned_cat(x)` linear in `x`.
- `replaceLowest` ⇒ **piecewise-linear** for ANY unknown in the category (eng-review D3 = full
  modeling, not the frozen-boost approximation):
  - **unknown = the replacer** (the common case): one breakpoint at `x = frac_lowest_graded_nonreplacer`
    (below it: no boost; above: `+ w_low·(x − frac_low)`).
  - **unknown = a non-replacer** (upcoming midterm, replacer already graded): the boost target is
    `argmin` over non-replacer fractions, which changes as `x` crosses each other non-replacer's
    fraction AND `frac_replacer`. Enumerate those candidate breakpoints, solve linearly per piece.
    Bounded (a handful of items). If the replacer is ungraded too, no boost term (linear).
- **Selecting the branch requires knowing whether the unknown is the replacer** (eng-review D2):
  `find_wire_item` returns the item's `replacer` flag, `goal_seek` takes an `unknown_is_replacer`
  param, and the `/api/grades/standing` route plumbs it through.

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

## Task breakdown (phased delivery — eng-review D1)

**Phase 2A-1 — replace-if-higher (ships FIRST, its own PR stacked on `feat/grade-backend`):**
- **T1 (backend, replaceLowest compute)** — `ReplaceLowest` rule dataclass + `Item.replacer` +
  `_category_earned`/`_category_graded_weight` boost branch. Files: `grades_math.py`,
  `test_grades_math.py`. Verify: boost-active + boost-inactive hand-calc; replacer-ungraded ⇒
  no boost; only-replacer-graded ⇒ no lowest; **regression: no-replaceLowest path unchanged (±1e-9)**.
- **T2 (backend goal_seek, full piecewise — D3)** — piecewise solver for a `replaceLowest`
  category with ANY unknown; `unknown_is_replacer` param; shared `min-x over pieces` helper (do
  NOT touch the rank path). Files: `grades_math.py`, `test_grades_math.py`. Verify: unknown=replacer
  breakpoint two-sided; unknown=non-replacer crossing-lowest breakpoint two-sided; already_met/infeasible.
- **T3 (serde + route plumbing — D2)** — parse `{kind:"replaceLowest"}` + `item.replacer`;
  `find_wire_item` returns the `replacer` flag; `/api/grades/standing` passes `unknown_is_replacer`
  to goal_seek. Files: `grades_serde.py`, `test_grades_serde.py`, the grades route module + route test.
  Verify: round-trip; goal_seek picks boost math only when the unknown is the replacer.
- **T4 (wire types + rubric helpers)** — `types.ts` `replaceLowest` + `Item.replacer`; `rubric.ts`
  replacer single-select toggle (exactly one per category) + mode plumbing; unit tests. Files:
  `frontend/src/grades/{types,rubric,rubric.test}.ts`.
- **T5 (editor UI)** — "Replace lowest" scoring mode: custom-weight rows + a per-row replacer radio +
  hint. Files: `RubricEditor.tsx`, `Grades.css`, `RubricEditor.test.tsx`, i18n `messages.ts`.

**Phase 2A-2 — max-of-weighting (fast-follow, separate PR after 2A-1 lands):**
- **T6 (backend scheme core)** — per-category `e_cat`/`gw_cat` via **intrinsic relative weights**
  (not `category.weight`; 0-slot guard); `Course.weightings`; scheme-max `compute_standing`;
  goal_seek min-x over schemes. Files: `grades_math.py`, `test_grades_math.py`. Verify: scheme-A-wins
  vs scheme-B-wins hand-calc; div-by-zero/0-weight-category guard; **regression ±1e-9**.
- **T7 (serde weightings)** — parse `course.weightings` (id-keyed, each covers all categories, sum 100).
  Files: `grades_serde.py`, `test_grades_serde.py`.
- **T8 (editor alternate-weighting section)** — course-level add/remove scheme, per-category weight
  inputs, sum-to-100 chip; scheme sync on category add/remove. Files: `RubricEditor.tsx`, `rubric.ts`,
  `Grades.css`, tests, i18n.

## Locked decisions

- **D1:** unified max-over-scenarios core; both rules ship in this spec (user pick).
- **D2:** replace-if-higher = replacer counts in its own slot AND boosts the lowest non-replacer (user pick).
- **D3:** `replaceLowest` reuses per-item `weight`; the replacer is an **item flag**, not a rule field (consistent with Phase-1 D2 anti-coupling).
- **D4:** alternate weightings keyed by **category id**, each a full vector summing to 100; primary scheme implicit.
- **D5:** normalized per-category (`e_cat`/`gw_cat`) is the parametrization seam; Phase-1 category math reused.
- **D6:** syllabus auto-detection deferred; manual editor only.

### Eng-review decisions (2026-07-03)
- **ED1 (delivery):** phased — **replace-if-higher (Phase 2A-1) ships first** as its own PR stacked
  on `feat/grade-backend`; max-of-weighting (2A-2) is a fast-follow. Same unified-core design; the
  scheme machinery is 2A-2 only (replace-if-higher needs none of it). Keeps each PR reviewable and
  off an already-unmerged base longer than necessary.
- **ED2 (replacer plumbing):** `find_wire_item` returns the item's `replacer` flag; `goal_seek` takes
  `unknown_is_replacer`; the standing route plumbs it through — so goal_seek can select the boost math.
- **ED3 (full piecewise):** goal_seek models the boost for ANY unknown in a `replaceLowest` category
  (replacer or non-replacer), enumerating breakpoints — NOT the frozen-boost approximation.
- **ED4 (normalization, 2A-2):** normalize by intrinsic relative slot weights (sum-to-1 within the
  category), not `category.weight`; guard 0-slot / 0-weight categories to avoid div-by-zero.
- **ED5 (regression):** the no-new-feature regression asserts float tolerance (≤1e-9 / `pytest.approx`),
  not byte-for-byte — the normalization refactor reorders float ops.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (optional) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 2 arch findings resolved, 0 critical gaps; scope phased 2A-1/2A-2 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run (editor add: replacer radio + alt-weighting section) |
| Outside Voice | `/codex` | Independent 2nd opinion | 0 | — | codex unavailable on this install; skipped |

- **SCOPE (Step 0):** complexity smell fired (~13 files, 2 new dataclasses) but essential (full-stack
  + test-per-source) and product-scope was brainstorming-locked. Resolved by **phasing delivery**
  (ED1): 2A-1 replace-if-higher first, 2A-2 max-of-weighting fast-follow.
- **ARCH D2 (confidence 8):** replacer flag must be plumbed through `find_wire_item` → `goal_seek`
  (`unknown_is_replacer`) → route, or the boost breakpoint can't be selected → wrong needed-score. **Fixed in spec (ED2).**
- **ARCH D3 (confidence 7):** unknown = non-replacer in a `replaceLowest` category — user chose FULL
  piecewise over the frozen-boost approximation. **Fixed in spec (ED3).**
- **CODE QUALITY:** 1 note (share one `min-x over pieces` solver across replaceLowest + 2A-2 schemes;
  rank path stays untouched) — baked into T2/T6 as a guideline, no decision needed.
- **TESTS:** coverage diagram produced; 11 new paths + IRON regression (±1e-9) folded into T1-T3/T6.
  Regression is auto-added (no question). No test-strategy decision outstanding.
- **PERFORMANCE:** small N (items/schemes single-digit); no N+1, no hotspot. No issues.
- **KNOWN TOOLING:** `gstack-review-log` / dashboard binary is v1.40 vs 1.58.5 on this install
  (upgrade available) — the /ship review dashboard may not reflect this run until gstack upgrades.
- **UNRESOLVED:** 0. **Critical gaps:** 0.
- **VERDICT:** ENG CLEARED — ready to implement (Phase 2A-1 first: T1 compute → T2 goal_seek → T3
  serde+route → T4 helpers → T5 editor). Then writing-plans to expand T1-T5 into a step plan.
