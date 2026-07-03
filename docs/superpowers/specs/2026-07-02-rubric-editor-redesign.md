# RubricEditor Redesign — Design Spec (plan-design-review 2026-07-02)

Branch: `feat/grade-backend` · Component: `frontend/src/grades/RubricEditor.tsx` (+ backend rule)
Trigger: a real 12-page prose logic syllabus parsed to 5 categories (Test #1 10% / #2 15% /
#3 25% / Homework 40% / Live logic 10%), but the editor couldn't manage or express it.

> Design decisions are LOCKED where marked. UX-detail calls are marked (call) — veto on review.

## The three real gaps (observed)

1. **Can't add/remove categories** — only edit existing name/weight.
2. **Can't express fixed per-item weights** — the `rankWeights` UI is two-tier ("lowest N count X,
   rest Y"), so 10/15/25 collapses to 25/25/10.
3. **No pre-generated fillable rows** — parsed categories have `items: []`; the student must
   "add grade" manually in the gradebook.

## Pivotal decision (LOCKED — D1: option C)

**`rankWeights` is rank-based** (`grades_math._earned_for_values` gives the largest weight to the
highest-scoring item). So it means "your *best* test counts 25", NOT "Test 3 counts 25". A syllabus
that says "tests weighted 10%, 15%, 25% respectively" means **fixed per-item weights**, which the
model cannot express inside one category today. Three separate categories (what the LLM produced) is
the only *correct* representation today — but hierarchically awkward.

**Decision: add a new `fixedWeights` rule (per-item fixed weights, not rank-based) AND keep category
grouping.** So "Tests" can be ONE category with 3 fixed-weight items (10/15/25), and unrelated buckets
stay separate categories. This touches the backend (grades_math + serde + goal_seek), so it is NOT a
pure-frontend change.

### fixedWeights semantics (LOCKED — eng-review D2: option B, per-item weight)
- **Weight lives ON the item, not on the rule.** `Item = {id, name, score, maxScore, weight?}`; the
  rule is just `{kind:"fixedWeights"}` (no weights array). Avoids the fragile item-list-order ↔
  weights[] index coupling; each editor row is self-contained; `goal_seek` uses the unknown item's
  OWN weight (no index guessing). `weight` is only meaningful when the category rule is fixedWeights.
- **New POSITIONAL compute path (NOT the rank-sorted helpers).** The existing
  `_earned_for_values` SORTS fractions descending (rank assignment) — wrong for fixed. Add
  `_earned_positional(items)` = `Σ item.weight · item.fraction` with NO sorting. `compute_standing`
  branches on rule kind: fixedWeights → earned = `Σ w_i·frac_i` over GRADED items; graded_weight =
  `Σ w_i` over graded items (renormalization base).
- **goal_seek fixedWeights path is LINEAR.** The unknown item has a constant weight `w_u`, so
  `total(x) = fixed_parts + w_u·x`. Solve `x* = (target_pct − total(0)) / w_u`, clamp to [0,1], scale
  by the item's max_score. No rank-flip breakpoints. A separate, simpler branch from the rank solver.
- **Do NOT touch the rank-based path.** RankWeights compute + goal_seek stay byte-for-byte; a
  regression test locks them (the existing 245-line suite must stay green).
- **validate_rubric:** for a fixedWeights category, warn if the item weights don't sum to the
  category weight.

## Editor model (redesign)

Each category card = **name + category weight% + a scoring mode + an item list**. Modes collapse the
rule taxonomy to what real syllabi need:

```
CATEGORY CARD
┌─────────────────────────────────────────────────────────────┐
│  [Exams                    ]   weight [50] %        (× delete)│
│  Scoring:  ( ) Equal   ( ) Drop lowest   (•) Custom weights   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ Test #1            weight [10] pts        (× remove row)│   │
│  │ Test #2            weight [15] pts        (× remove row)│   │
│  │ Test #3            weight [25] pts        (× remove row)│   │
│  │ + add item                          item wts sum 50 ✓  │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        + add category                     category wts sum 100 ✓
```

- **Equal** → `uniform(nSlots)`: item list shows N named rows, no per-row weight (all equal).
- **Drop lowest** → `dropLowest(nSlots, k)`: N rows + a "drop lowest [k]" control.
- **Custom weights** → `fixedWeights(weights[])`: each row has a name + a weight input (call: **points**
  out of the category weight, shown with a live "sums to {catWeight}" check).
- Rows ARE the item slots. Editing rows here pre-creates gradebook items (score=null) so the gradebook
  is immediately fillable. (Fixes gap 3.)
- `+ add category` / `× delete category` (fixes gap 1); `+ add item` / `× remove row` per category.
- (call) The old rank-based `rankWeights` two-tier UI is **removed** from the editor; the underlying
  rank rule stays in the model but isn't editor-exposed (rare; revisit if a real syllabus needs it).

## Information architecture (Pass 1)

Scan order top→bottom: **category name+weight (what bucket)** → **scoring mode (how it splits)** →
**item rows (the actual graded things)** → **per-category sum check** → **+add** → **global weights-sum
chip**. One job per row. The global "weights sum to X%" chip stays pinned in the editor header (exists
today) as the single source of "is this rubric valid".

## Interaction states (Pass 2)

| Surface | Empty | Error | Live feedback |
|---|---|---|---|
| Category list | no categories → a single "+ add your first category" affordance with a one-line hint | — | — |
| Item list (per cat) | no items → "+ add item" row only, muted "no items yet" | — | — |
| Category weights | — | sum ≠ 100 → header chip turns warn, shows the actual sum | chip flips ok/warn live per keystroke |
| Custom item weights | — | item weights sum ≠ category weight → per-category inline warn (exists for rankWeights today, reuse) | inline sum vs category weight |
| Delete category | confirm inline only if it has entered scores (else instant) | — | — |
| Parsed (confirm) | pre-filled from syllabus; note "Review what we read — edit anything" | — | — |

## Alignment with syllabus parse (Pass — cross-cutting)

- LLM prompt (`grades_syllabus.SYSTEM_PROMPT`) should prefer **one category with `fixedWeights`** when a
  bucket has items of DISTINCT fixed weights ("tests weighted 10/15/25"), and **pre-name items** (Test 1/2/3)
  so rows arrive named. Falls back to separate categories only for truly unrelated buckets.
- Parse/normalize must accept `fixedWeights` and pre-generate item rows from the weights length.

## NOT in scope (deferred)

- Rank-based `rankWeights` editor UI — kept in the model, not exposed; add back only if a real syllabus needs "best N count more".
- Weight-as-percentage-of-total (vs points-of-category) toggle — pick one unit (points of category) for v1.
- Drag-to-reorder items/categories — nice-to-have, not blocking.

## What already exists (reuse)

- Editorial ivory/teal tokens + `.gr-edit-*` / `.gr-seg` / `.gr-sumchip` styles in `Grades.css`.
- The per-category "sum vs weight" warn pattern (currently on rankWeights two-tier) → reuse for custom weights.
- Header weights-sum chip (`gr-sumchip`) — keep as the global validity indicator.
- Backend `grades_math` compute/goal_seek pipeline — extend, don't replace.

## Implementation Tasks

- [ ] **T1 (P1, backend, human ~2.5h / CC ~30m)** — `fixedWeights` in `grades_math` per eng-review D2 (model B):
  add optional `Item.weight`; `_earned_positional` (no sort); `compute_standing` + `goal_seek` (linear) +
  `validate_rubric` branches on rule kind; `grades_serde` parses `{kind:"fixedWeights"}` + `item.weight`
  - Files: `backend/grades_math.py`, `backend/grades_serde.py`, `backend/test_grades_math.py`, `backend/test_grades_serde.py`
  - Verify (pytest): **(a) CRITICAL regression** — existing rank-based standing/goal_seek unchanged (245-line
    suite green); **(b)** fixed vs rank on the SAME weights `[25,15,10]` give DIFFERENT standing; **(c)** goal_seek
    linear `x*=(target−total0)/w_u`, already_met/infeasible; **(d)** partial-graded renormalization; **(e)** serde
    round-trip fixedWeights + per-item weight, null-score item stripped but graded weights preserved
- [ ] **T2 (P1, frontend, human ~4h / CC ~40m)** — RubricEditor: per-category item-row list, Equal/Drop-lowest/Custom-weights modes, add/remove item + add/remove category, live per-category + global sum checks
  - Files: `frontend/src/grades/RubricEditor.tsx`, `frontend/src/grades/types.ts` (add fixedWeights to Rule), `frontend/src/Grades.css`
  - Verify: vitest + click-through; 10/15/25 expressible in one category
- [ ] **T3 (P1, frontend, human ~1h / CC ~15m)** — pre-generate item rows: on parse-confirm and mode-change, materialize `nSlots`/weights.length empty items (score=null) so the gradebook is immediately fillable
  - Files: `frontend/src/grades/RubricEditor.tsx`, `frontend/src/Grades.tsx`
  - Verify: parsed 3-test course lands with 3 fillable rows
- [ ] **T4 (P2, LLM, human ~1h / CC ~15m)** — update `grades_syllabus` prompt to emit `fixedWeights` + named items for distinct-weight buckets; extend normalize; add a syllabus-fixture eval case
  - Files: `backend/grades_syllabus.py`, `backend/test_grades_syllabus.py`
  - Verify: the logic-syllabus fixture yields one Tests category (fixedWeights 10/15/25) + named rows
- [ ] **T5 (P3, states)** — empty/first-category affordance + delete-with-scores confirm
  - Files: `frontend/src/grades/RubricEditor.tsx`, `frontend/src/Grades.css`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score 4/10 → 8/10, 1 pivotal decision (fixedWeights + grouping) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 1 arch finding (per-item weight model), 0 critical gaps |

- **DESIGN D1:** option C — add `fixedWeights` (backend) AND keep category grouping. Corrects the
  earlier "pure frontend" framing: `rankWeights` is rank-based, so fixed per-item weights (10/15/25)
  need a new rule.
- **ENG D2:** option B — the fixed weight lives **on the item** (`Item.weight?`), rule is just
  `{kind:"fixedWeights"}`. Avoids item-order↔weights[] index coupling; `goal_seek` uses the unknown
  item's own weight. Validated: needs a NEW positional compute path (not the rank-sorted helpers);
  `goal_seek` is linear (`x*=(target−total0)/w_u`); the rank path stays byte-for-byte (regression-locked).
- **TESTS (mandatory):** rank-path regression + fixed-vs-rank divergence on the same weights are IRON-RULE.
- **KNOWN TOOLING:** `gstack-review-log` binary broken on this install (v1.40 vs 1.58.5) — /ship dashboard
  won't reflect these reviews until gstack upgrades. Outside voice skipped (math validated by direct code read).
- **UNRESOLVED:** 0. **Critical gaps:** 0.
- **VERDICT:** DESIGN + ENG CLEARED — ready to implement (T1 backend first, then T2/T3 editor, T4 parse).
