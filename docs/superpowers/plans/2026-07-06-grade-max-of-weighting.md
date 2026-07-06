# Max-of-two-weightings (Grade Tracker Phase 2A-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a course carry alternate category-weighting schemes and grade the student under the **most favorable** one — "the final is 25% of the grade, OR 40% with the midterm dropped, whichever helps you" — with correct standing (max over schemes) and goal-seek (min needed over schemes).

**Architecture:** A weighting scheme is just a per-category weight vector (summing to 100). To evaluate under a scheme we **`apply_scheme(course, weights)`** — a pure transform that re-weights each category (and proportionally rescales any per-item `fixedWeights`/`replaceLowest` weights so intra-category proportions hold) — then run the EXISTING `compute_standing` / `goal_seek` cores unchanged. Standing = max percent over the primary + alternate schemes; goal-seek = the most favorable (min needed) over schemes. When a course has no `weightings`, both wrappers delegate to the untouched core, so every existing rule is byte-for-byte unchanged (regression-locked). This deliberately AVOIDS the spec's `e_cat/gw_cat` refactor (eng-review ED4 sketch): wrapping tested cores is lower-risk than rewriting them, and it never touches the rank/fixed/replaceLowest branch internals.

**Tech Stack:** Python 3 / pytest (backend `backend/`), React + TypeScript / vitest (frontend `frontend/`).

**Spec:** `docs/superpowers/specs/2026-07-03-grade-conditional-rules-design.md` (Phase 2A-2 = T6-T8; this plan realizes it as T6-T10). ENG CLEARED; decisions ED1, ED4 (div-by-zero guard), ED5 (regression tolerance — here we achieve EXACT via delegation, better than ±1e-9).

**Test env:** backend `source /tmp/aitutor-testenv/bin/activate && cd backend`; frontend `cd frontend`.

**Key convention (from 2A-1, do not break):** goal_seek compares raw earned POINTS to `target_pct` directly and assumes course weights sum to 100 (earned points == percent). Every weighting scheme sums to 100, so each scheme individually satisfies this convention — that is exactly why per-scheme delegation is correct.

---

## File Structure

- `backend/grades_math.py` — `WeightScheme` dataclass; `Course.weightings`; `apply_scheme`; refactor `compute_standing`→`_standing_core`+wrapper and `goal_seek`→`_goal_seek_core`+wrapper; `_better_goal` helper.
- `backend/test_grades_math.py` — apply_scheme + scheme-max standing + scheme-min goal_seek + regression tests.
- `backend/grades_serde.py` — parse `course.weightings` (id-keyed → positional).
- `backend/test_grades_serde.py` — weightings round-trip.
- `frontend/src/grades/types.ts` — `Course.weightings?: WeightScheme[]`.
- `frontend/src/grades/rubric.ts` — scheme add/remove/set-weight + sync-on-category-change helpers.
- `frontend/src/grades/rubric.test.ts` — helper unit tests.
- `frontend/src/grades/RubricEditor.tsx`, `frontend/src/Grades.css`, `frontend/src/i18n/messages.ts`, `frontend/src/grades/RubricEditor.test.tsx` — the alternate-weighting editor section.

---

## Task 6: `apply_scheme` + scheme-max `compute_standing` (backend)

**Files:** modify `backend/grades_math.py`; test `backend/test_grades_math.py`.

- [ ] **Step 1: Write failing tests**

Append to `backend/test_grades_math.py`:

```python
def _two_cat_scheme_course(m_frac, f_frac, with_alt=True):
    """Midterm(w60, 1 uniform item) + Final(w40, 1 uniform item). Alt scheme = Midterm 40 / Final 60.
    Both items graded, weights sum to 100, so earned points == percent."""
    import grades_math as gm
    course = gm.Course(
        name="C",
        categories=[
            gm.Category(name="Midterm", weight=60, rule=gm.Uniform(n_slots=1),
                        items=[gm.Item(name="M", score=m_frac * 100, max_score=100)]),
            gm.Category(name="Final", weight=40, rule=gm.Uniform(n_slots=1),
                        items=[gm.Item(name="F", score=f_frac * 100, max_score=100)]),
        ],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)],
    )
    if with_alt:
        course.weightings = [gm.WeightScheme(name="final-heavy", weights=[40.0, 60.0])]
    return course


def test_apply_scheme_reweights_and_scales_fixed_items():
    import grades_math as gm
    from grades_math import apply_scheme
    course = gm.Course(name="C", categories=[
        gm.Category(name="Tests", weight=50, rule=gm.FixedWeights(),
                    items=[gm.Item(name="T1", score=100, max_score=100, weight=20),
                           gm.Item(name="T2", score=100, max_score=100, weight=30)])],
        cutoffs=[])
    out = apply_scheme(course, [100.0])  # category weight doubled -> item weights x2
    assert out.categories[0].weight == 100.0
    assert [it.weight for it in out.categories[0].items] == [40.0, 60.0]
    # uniform items (weight=None) are left as None
    u = gm.Course(name="C", categories=[gm.Category(name="U", weight=30, rule=gm.Uniform(n_slots=2),
                  items=[gm.Item(name="a", score=1, max_score=1)])], cutoffs=[])
    assert apply_scheme(u, [60.0]).categories[0].items[0].weight is None


def test_standing_scheme_max_primary_wins():
    # great midterm (1.0), weak final (0.5): primary M60/F40 = 80 beats alt M40/F60 = 70
    import grades_math as gm
    s = gm.compute_standing(_two_cat_scheme_course(1.0, 0.5))
    assert abs(s.percent - 80.0) < 1e-9


def test_standing_scheme_max_alt_wins():
    # weak midterm (0.5), great final (1.0): alt M40/F60 = 80 beats primary M60/F40 = 70
    import grades_math as gm
    s = gm.compute_standing(_two_cat_scheme_course(0.5, 1.0))
    assert abs(s.percent - 80.0) < 1e-9


def test_standing_no_weightings_is_unchanged():
    import grades_math as gm
    s = gm.compute_standing(_two_cat_scheme_course(0.5, 1.0, with_alt=False))
    assert abs(s.percent - 70.0) < 1e-9  # primary only: 60*0.5 + 40*1.0 = 70


def test_apply_scheme_zero_weight_category_guard():
    # a 0-weight category must not ZeroDivisionError when a scheme reassigns it
    import grades_math as gm
    course = gm.Course(name="C", categories=[
        gm.Category(name="Empty", weight=0, rule=gm.Uniform(n_slots=0), items=[]),
        gm.Category(name="Final", weight=100, rule=gm.Uniform(n_slots=1),
                    items=[gm.Item(name="F", score=90, max_score=100)])],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    course.weightings = [gm.WeightScheme(name="alt", weights=[0.0, 100.0])]
    s = gm.compute_standing(course)
    assert abs(s.percent - 90.0) < 1e-9
```

- [ ] **Step 2: Run to confirm failure**

Run: `source /tmp/aitutor-testenv/bin/activate && cd backend && python -m pytest test_grades_math.py -k "scheme or apply_scheme" -q`
Expected: FAIL — no `WeightScheme`, no `apply_scheme`, `Course` has no `weightings`.

- [ ] **Step 3: Add `replace` import, `WeightScheme`, `Course.weightings`**

At the top of `backend/grades_math.py`, add `replace` to the dataclasses import:

```python
from dataclasses import dataclass, field, replace
```

(If the existing import is `from dataclasses import dataclass, field`, extend it. If `field` isn't imported yet, include it.)

Add the `WeightScheme` dataclass right ABOVE the `Course` dataclass:

```python
@dataclass
class WeightScheme:
    """An alternate per-category weight vector (positional to Course.categories). Each scheme
    should sum to 100. The course grade is the MAX over the primary weights + all schemes."""

    name: str
    weights: list[float]
```

Add `weightings` to `Course`:

```python
@dataclass
class Course:
    name: str
    categories: list[Category] = field(default_factory=list)
    cutoffs: list[Cutoff] = field(default_factory=list)
    weightings: list[WeightScheme] = field(default_factory=list)  # alternate schemes; primary is implicit
```

- [ ] **Step 4: Add `apply_scheme`**

Add near the top of the compute section (right before `compute_standing`):

```python
def apply_scheme(course: Course, weights: list[float]) -> Course:
    """Return a copy of `course` re-weighted to `weights[i]` per category. Slot-weighted rules
    (uniform/dropLowest/rankWeights) pick up the new weight through `category.weight`; per-item
    rules (fixedWeights/replaceLowest) have their item weights scaled by weights[i]/old_weight so
    intra-category proportions are preserved. A category whose ORIGINAL weight is 0 keeps 0-weight
    items (contributes nothing) — this is the div-by-zero guard (ED4)."""
    new_cats: list[Category] = []
    for cat, w in zip(course.categories, weights):
        if cat.weight > 0:
            scale = w / cat.weight
            items = [replace(it, weight=(it.weight * scale)) if it.weight is not None else it for it in cat.items]
        else:
            items = [replace(it, weight=0.0) if it.weight is not None else it for it in cat.items]
        new_cats.append(replace(cat, weight=w, items=items))
    return replace(course, categories=new_cats, weightings=[])
```

- [ ] **Step 5: Refactor `compute_standing` into core + scheme-max wrapper**

Rename the existing `def compute_standing(course: Course) -> Standing:` body to `_standing_core`, then add a new `compute_standing` wrapper. The final shape:

```python
def _standing_core(course: Course) -> Standing:
    earned = 0.0
    graded_weight = 0.0
    for cat in course.categories:
        earned += _category_earned(cat)
        graded_weight += _category_graded_weight(cat)
    if graded_weight <= 0:
        return Standing(percent=None, letter=None, earned_points=0.0, graded_weight=0.0)
    percent = earned / graded_weight * 100.0
    return Standing(
        percent=percent,
        letter=letter_for(percent, course.cutoffs),
        earned_points=earned,
        graded_weight=graded_weight,
    )


def compute_standing(course: Course) -> Standing:
    """Standing under the most favorable weighting scheme. With no `weightings`, delegates to the
    core unchanged (byte-for-byte for every existing rule)."""
    if not course.weightings:
        return _standing_core(course)
    best = _standing_core(course)  # the primary scheme
    for scheme in course.weightings:
        cand = _standing_core(apply_scheme(course, scheme.weights))
        if cand.percent is not None and (best.percent is None or cand.percent > best.percent):
            best = cand
    return best
```

IMPORTANT: copy the existing body EXACTLY into `_standing_core` (do not alter its math). Read the current `compute_standing` first and preserve every line, including the `Standing(...)` fields.

- [ ] **Step 6: Run to confirm pass**

Run: `python -m pytest test_grades_math.py -k "scheme or apply_scheme" -q`
Expected: PASS (7 tests).

- [ ] **Step 7: Full regression**

Run: `python -m pytest test_grades_math.py test_grades_serde.py test_grades_report.py -q`
Expected: PASS — all existing tests unchanged (no-weightings path delegates to the untouched core).

- [ ] **Step 8: Commit**

```bash
git add backend/grades_math.py backend/test_grades_math.py
git commit -m "feat(grades): T6 apply_scheme + scheme-max compute_standing"
```

---

## Task 7: scheme-min `goal_seek` (backend)

**Files:** modify `backend/grades_math.py`; test `backend/test_grades_math.py`.

- [ ] **Step 1: Write failing tests**

```python
def test_goal_seek_scheme_min_picks_favorable():
    # Midterm 0.5 (w60), Final ungraded (w40). Target B=70. alt = M40/F60.
    #   primary: 60*0.5 + 40*x = 30 + 40x = 70 -> x=1.0 (needed 100)
    #   alt:     40*0.5 + 60*x = 20 + 60x = 70 -> x=0.8333 (needed 83.33)
    # student picks the easier scheme -> min needed = 83.33
    import grades_math as gm
    course = gm.Course(name="C", categories=[
        gm.Category(name="Midterm", weight=60, rule=gm.Uniform(n_slots=1),
                    items=[gm.Item(name="M", score=50, max_score=100)]),
        gm.Category(name="Final", weight=40, rule=gm.Uniform(n_slots=1), items=[])],
        cutoffs=[gm.Cutoff(letter="B", min_pct=70), gm.Cutoff(letter="F", min_pct=0)])
    course.weightings = [gm.WeightScheme(name="final-heavy", weights=[40.0, 60.0])]
    r = gm.goal_seek(course, "B", "Final", unknown_max_score=100, unknown_weight=None)
    assert r.status == "ok"
    assert abs(r.needed_score - (50.0 / 0.6)) < 1e-6  # 83.333...


def test_goal_seek_scheme_already_met_wins():
    # Midterm 1.0 (w60). Target C=70. Primary total(0)=60 < 70 (needs the final: ok).
    # Alt mid-heavy [80,20]: total(0)=80 >= 70 -> already_met. The alt wins (0 needed).
    import grades_math as gm
    course = gm.Course(name="C", categories=[
        gm.Category(name="Midterm", weight=60, rule=gm.Uniform(n_slots=1),
                    items=[gm.Item(name="M", score=100, max_score=100)]),
        gm.Category(name="Final", weight=40, rule=gm.Uniform(n_slots=1), items=[])],
        cutoffs=[gm.Cutoff(letter="C", min_pct=70), gm.Cutoff(letter="F", min_pct=0)])
    course.weightings = [gm.WeightScheme(name="mid-heavy", weights=[80.0, 20.0])]
    r = gm.goal_seek(course, "C", "Final", unknown_max_score=100, unknown_weight=None)
    assert r.status == "already_met"  # alt scheme already clears 70 with the final ungraded


def test_goal_seek_no_weightings_unchanged():
    # regression: without weightings, behaves exactly like before
    import grades_math as gm
    course = gm.Course(name="C", categories=[
        gm.Category(name="Midterm", weight=60, rule=gm.Uniform(n_slots=1),
                    items=[gm.Item(name="M", score=50, max_score=100)]),
        gm.Category(name="Final", weight=40, rule=gm.Uniform(n_slots=1), items=[])],
        cutoffs=[gm.Cutoff(letter="B", min_pct=70), gm.Cutoff(letter="F", min_pct=0)])
    r = gm.goal_seek(course, "B", "Final", unknown_max_score=100, unknown_weight=None)
    assert r.status == "ok"
    assert abs(r.needed_score - 100.0) < 1e-6  # 30 + 40x = 70 -> x=1.0
```

- [ ] **Step 2: Run to confirm failure**

Run: `python -m pytest test_grades_math.py -k "goal_seek_scheme or goal_seek_no_weightings" -q`
Expected: FAIL — `already_met` not chosen / scheme min not applied (weightings ignored by the current goal_seek).

- [ ] **Step 3: Add the `_better_goal` helper**

Add right ABOVE `def goal_seek(` (after `_solve_piecewise`):

```python
_GS_RANK = {"already_met": 0, "ok": 1, "infeasible": 2}


def _better_goal(a: Optional[GoalSeekResult], b: GoalSeekResult) -> GoalSeekResult:
    """Pick the more favorable goal-seek result across schemes: already_met > ok(min needed) >
    infeasible. The student may pick whichever scheme is easiest."""
    if a is None:
        return b
    ra, rb = _GS_RANK.get(a.status, 3), _GS_RANK.get(b.status, 3)
    if rb < ra:
        return b
    if rb > ra:
        return a
    if a.status == "ok" and b.needed_score is not None and (
        a.needed_score is None or b.needed_score < a.needed_score
    ):
        return b
    return a
```

- [ ] **Step 4: Refactor `goal_seek` into core + scheme-min wrapper**

Rename the existing `def goal_seek(course, target_letter, unknown_category, unknown_max_score, unknown_weight=None, unknown_is_replacer=False) -> GoalSeekResult:` body to `_goal_seek_core` (same signature). Then add the wrapper:

```python
def goal_seek(
    course: Course,
    target_letter: str,
    unknown_category: str,
    unknown_max_score: float,
    unknown_weight: Optional[float] = None,
    unknown_is_replacer: bool = False,
) -> GoalSeekResult:
    """Minimum needed score across the primary + alternate weighting schemes (the student picks
    the most favorable). With no `weightings`, delegates to the core unchanged."""
    if not course.weightings:
        return _goal_seek_core(course, target_letter, unknown_category, unknown_max_score,
                               unknown_weight, unknown_is_replacer)
    idx = next((i for i, c in enumerate(course.categories) if c.name == unknown_category), None)
    if idx is None:
        raise ValueError(f"unknown_category {unknown_category!r} not found")
    orig_w = course.categories[idx].weight
    schemes = [[c.weight for c in course.categories]] + [s.weights for s in course.weightings]
    best: Optional[GoalSeekResult] = None
    for w in schemes:
        # per-item unknown weight (fixedWeights/replaceLowest) scales with the category's scheme weight
        scaled_uw = unknown_weight
        if unknown_weight is not None and orig_w > 0:
            scaled_uw = unknown_weight * (w[idx] / orig_w)
        res = _goal_seek_core(apply_scheme(course, w), target_letter, unknown_category,
                              unknown_max_score, scaled_uw, unknown_is_replacer)
        best = _better_goal(best, res)
    assert best is not None  # schemes always has >=1 entry
    return best
```

IMPORTANT: the renamed `_goal_seek_core` body must be the existing `goal_seek` body verbatim (FixedWeights branch, ReplaceLowest branch, rank breakpoint scan — all unchanged).

- [ ] **Step 5: Run to confirm pass**

Run: `python -m pytest test_grades_math.py -q`
Expected: PASS (all — new scheme tests + every existing goal_seek/standing test).

- [ ] **Step 6: Commit**

```bash
git add backend/grades_math.py backend/test_grades_math.py
git commit -m "feat(grades): T7 scheme-min goal_seek over weighting schemes"
```

---

## Task 8: serde — parse `course.weightings` (backend)

**Files:** modify `backend/grades_serde.py`; test `backend/test_grades_serde.py`.

- [ ] **Step 1: Write failing tests**

Append to `backend/test_grades_serde.py`:

```python
def test_course_from_wire_parses_weightings_positional():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "mid", "name": "Midterm", "weight": 60, "rule": {"kind": "uniform", "nSlots": 1},
         "items": [{"id": "m", "name": "M", "score": 50, "maxScore": 100}]},
        {"id": "fin", "name": "Final", "weight": 40, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
    ], "cutoffs": [{"letter": "A", "min": 90}],
        "weightings": [{"name": "final-heavy", "weights": {"mid": 40, "fin": 60}}]}
    gm_course = gs.course_from_wire(course)
    assert len(gm_course.weightings) == 1
    assert gm_course.weightings[0].name == "final-heavy"
    assert gm_course.weightings[0].weights == [40.0, 60.0]  # positional: [Midterm, Final]


def test_course_from_wire_weightings_missing_category_falls_back_to_primary():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "mid", "name": "Midterm", "weight": 60, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
        {"id": "fin", "name": "Final", "weight": 40, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
    ], "cutoffs": [], "weightings": [{"name": "partial", "weights": {"fin": 70}}]}
    gm_course = gs.course_from_wire(course)
    # 'mid' omitted -> falls back to its primary weight 60; 'fin' -> 70
    assert gm_course.weightings[0].weights == [60.0, 70.0]


def test_course_from_wire_no_weightings_is_empty():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "c", "name": "C", "weight": 100, "rule": {"kind": "uniform", "nSlots": 1}, "items": []}],
        "cutoffs": []}
    assert gs.course_from_wire(course).weightings == []
```

- [ ] **Step 2: Run to confirm failure**

Run: `python -m pytest test_grades_serde.py -k weightings -q`
Expected: FAIL — `course_from_wire` ignores `weightings` (AttributeError or `[]`).

- [ ] **Step 3: Add a weightings parser and wire it into `course_from_wire`**

In `backend/grades_serde.py`, add this helper (near `course_from_wire`):

```python
def weightings_from_wire(data: Any, categories_wire: list, *, where: str = "course.weightings") -> list["gm.WeightScheme"]:
    """Parse alternate weighting schemes. Wire shape: [{name, weights: {categoryId: number}}].
    Resolves each scheme's id-keyed weights to a POSITIONAL list aligned to `categories_wire`
    (grades_math schemes are positional); a category omitted by a scheme falls back to its own
    primary weight."""
    raw = data.get("weightings")
    if not raw:
        return []
    cat_ids = [str(_require_dict(c, f"{where}.category").get("id", "")) for c in categories_wire]
    cat_weights = [_require_number(_require_dict(c, f"{where}.category").get("weight"), f"{where}.category.weight")
                   for c in categories_wire]
    schemes: list[gm.WeightScheme] = []
    for i, s in enumerate(_require_list(raw, where)):
        sd = _require_dict(s, f"{where}[{i}]")
        wmap = sd.get("weights") or {}
        if not isinstance(wmap, dict):
            raise SerdeError(f"{where}[{i}].weights must be an object")
        weights = [
            _require_number(wmap[cid], f"{where}[{i}].weights[{cid}]") if cid in wmap else cat_weights[j]
            for j, cid in enumerate(cat_ids)
        ]
        schemes.append(gm.WeightScheme(name=str(sd.get("name", "")), weights=weights))
    return schemes
```

Then, inside `course_from_wire`, build the categories-wire list and pass weightings into the returned `gm.Course`. Read the current `course_from_wire`; it computes `categories` from `d.get("categories", [])`. Capture that raw list and add the `weightings` kwarg:

```python
    categories_wire = _require_list(d.get("categories", []), f"{where}.categories")
    # ... existing category/cutoff parsing ...
    return gm.Course(
        name=_require_str(name, f"{where}.name") if name is not None else "",
        categories=categories,
        cutoffs=cutoffs,
        weightings=weightings_from_wire(d, categories_wire, where=f"{where}.weightings"),
    )
```

(Reuse the existing `categories` list comprehension's source; just also keep `categories_wire` for the id lookup. Don't double-parse — bind `categories_wire` once and iterate it for both.)

- [ ] **Step 4: Run to confirm pass**

Run: `python -m pytest test_grades_serde.py -q`
Expected: PASS (all).

- [ ] **Step 5: Full backend regression**

Run: `python -m pytest test_grade*.py test_api_grades.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/grades_serde.py backend/test_grades_serde.py
git commit -m "feat(grades): T8 serde parses course.weightings (id-keyed -> positional)"
```

---

## Task 9: wire type + rubric scheme helpers (frontend)

**Files:** modify `frontend/src/grades/types.ts`, `frontend/src/grades/rubric.ts`; test `frontend/src/grades/rubric.test.ts`.

- [ ] **Step 1: Add the type**

In `frontend/src/grades/types.ts`, add a `WeightScheme` type and `weightings` to `Course`:

```ts
// Alternate course-level weighting scheme; the grade is the MAX over the primary weights + these.
// `weights` is keyed by category id; a category omitted falls back to its own weight (backend).
export type WeightScheme = { name: string; weights: Record<string, number> };
export type Course = { name: string; term: string; categories: Category[]; cutoffs: Cutoff[]; weightings?: WeightScheme[] };
```

- [ ] **Step 2: Write failing helper tests**

Append to `frontend/src/grades/rubric.test.ts` (add the new fns to the existing `./rubric` import):

```typescript
import { addScheme, removeScheme, setSchemeWeight, schemeSum } from "./rubric";

describe("weighting-scheme helpers", () => {
  const base = (): Course => ({
    name: "C", term: "",
    categories: [
      { id: "mid", name: "Midterm", weight: 60, rule: { kind: "uniform", nSlots: 1 }, items: [] },
      { id: "fin", name: "Final", weight: 40, rule: { kind: "uniform", nSlots: 1 }, items: [] },
    ],
    cutoffs: [],
  });
  it("addScheme seeds a scheme from the current category weights", () => {
    const c = addScheme(base());
    expect(c.weightings).toHaveLength(1);
    expect(c.weightings![0].weights).toEqual({ mid: 60, fin: 40 });
  });
  it("setSchemeWeight edits one category's weight in one scheme", () => {
    let c = addScheme(base());
    c = setSchemeWeight(c, 0, "fin", 60);
    c = setSchemeWeight(c, 0, "mid", 40);
    expect(c.weightings![0].weights).toEqual({ mid: 40, fin: 60 });
    expect(schemeSum(c.weightings![0])).toBe(100);
  });
  it("removeScheme drops it", () => {
    let c = addScheme(base());
    c = removeScheme(c, 0);
    expect(c.weightings).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `cd frontend && npx vitest run src/grades/rubric.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 4: Implement the helpers in `frontend/src/grades/rubric.ts`**

Import `WeightScheme` from types (extend the existing `import type { ... } from "./types"`), then add:

```ts
/** Sum of a scheme's per-category weights (for the "should be 100" chip). */
export const schemeSum = (s: WeightScheme): number =>
  Math.round(Object.values(s.weights).reduce((a, b) => a + b, 0) * 100) / 100;

/** Append a new scheme seeded from the current category weights. */
export function addScheme(course: Course): Course {
  const weights: Record<string, number> = {};
  for (const cat of course.categories) weights[cat.id] = cat.weight;
  const scheme: WeightScheme = { name: `Option ${(course.weightings?.length ?? 0) + 2}`, weights };
  return { ...course, weightings: [...(course.weightings ?? []), scheme] };
}

/** Remove scheme at index i. */
export function removeScheme(course: Course, i: number): Course {
  return { ...course, weightings: (course.weightings ?? []).filter((_, j) => j !== i) };
}

/** Set one category's weight within scheme i. */
export function setSchemeWeight(course: Course, i: number, catId: string, weight: number): Course {
  return {
    ...course,
    weightings: (course.weightings ?? []).map((s, j) =>
      j === i ? { ...s, weights: { ...s.weights, [catId]: weight } } : s,
    ),
  };
}

/** Keep schemes aligned when a category is added/removed: seed a new category into every scheme
 *  (default its own weight) and drop weights for categories that no longer exist. */
export function syncSchemes(course: Course): Course {
  if (!course.weightings?.length) return course;
  const weightings = course.weightings.map((s) => {
    const weights: Record<string, number> = {};
    // rebuild to exactly the current categories: new cats seed their own weight, removed cats drop out
    for (const cat of course.categories) weights[cat.id] = s.weights[cat.id] ?? cat.weight;
    return { ...s, weights };
  });
  return { ...course, weightings };
}
```

- [ ] **Step 5: Run to confirm pass + typecheck**

Run: `npx vitest run src/grades/rubric.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Wire `syncSchemes` into `addCategory`/`removeCategory`**

In `rubric.ts`, make `addCategory` and `removeCategory` call `syncSchemes` on their result so schemes never drift from the category list:

```ts
export function addCategory(course: Course): Course {
  const cat: Category = { id: genId("cat"), name: `Category ${course.categories.length + 1}`, weight: 0, rule: { kind: "uniform", nSlots: 0 }, items: [] };
  return syncSchemes({ ...course, categories: [...course.categories, cat] });
}
export function removeCategory(course: Course, catId: string): Course {
  return syncSchemes({ ...course, categories: course.categories.filter((c) => c.id !== catId) });
}
```

Run: `npx vitest run src/grades/ && npx tsc --noEmit`
Expected: PASS (existing addCategory/removeCategory tests still pass — with no weightings, syncSchemes is a no-op).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/grades/types.ts frontend/src/grades/rubric.ts frontend/src/grades/rubric.test.ts
git commit -m "feat(grades): T9 weighting-scheme wire type + rubric helpers"
```

---

## Task 10: alternate-weighting editor section (frontend)

**Files:** modify `frontend/src/grades/RubricEditor.tsx`, `frontend/src/Grades.css`, `frontend/src/i18n/messages.ts`; test `frontend/src/grades/RubricEditor.test.tsx`.

- [ ] **Step 1: i18n strings (en/zh/es)**

In `frontend/src/i18n/messages.ts`, add these keys to EACH of the EN, ZH, ES objects (near `grades.customWeights`):

- EN: `"grades.altWeighting": "Alternate weighting"`, `"grades.altWeightingHint": "Grade with whichever weighting helps you most."`, `"grades.addScheme": "+ add an alternate weighting"`, `"grades.removeScheme": "Remove weighting"`, `"grades.schemeSumOk": "✓ sums to 100"`, `"grades.schemeSumWarn": "= {sum}, not 100"`
- ZH: `"grades.altWeighting": "备选权重方案"`, `"grades.altWeightingHint": "取对你最有利的那套权重来算成绩。"`, `"grades.addScheme": "+ 添加备选权重"`, `"grades.removeScheme": "删除该方案"`, `"grades.schemeSumOk": "✓ 合计 100"`, `"grades.schemeSumWarn": "= {sum}，不是 100"`
- ES: `"grades.altWeighting": "Ponderación alternativa"`, `"grades.altWeightingHint": "Se califica con la ponderación que más te beneficie."`, `"grades.addScheme": "+ añadir ponderación alternativa"`, `"grades.removeScheme": "Quitar ponderación"`, `"grades.schemeSumOk": "✓ suma 100"`, `"grades.schemeSumWarn": "= {sum}, no 100"`

- [ ] **Step 2: Write the failing component test**

Append to `frontend/src/grades/RubricEditor.test.tsx`:

```typescript
describe("RubricEditor — alternate weighting", () => {
  it("adds a scheme with a per-category weight input and a sum chip", () => {
    renderEditor(threeTests()); // one category "Tests" weight 50
    fireEvent.click(screen.getByRole("button", { name: /add an alternate weighting/i }));
    // a weight input for the category appears within the scheme
    const input = screen.getByLabelText("Tests weight in Option 2");
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "100" } });
    expect(screen.getByText("✓ sums to 100")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run src/grades/RubricEditor.test.tsx`
Expected: FAIL — no "add an alternate weighting" button.

- [ ] **Step 4: Add the section to `RubricEditor.tsx`**

Extend the `./rubric` import with `addScheme, removeScheme, setSchemeWeight, schemeSum` and the `WeightScheme` type import from `./types`. Add a render block AFTER the categories list (`.gr-editor-cats`) and BEFORE the cutoffs section (`.gr-edit-cutoffs`):

```tsx
      <div className="gr-alt-weighting">
        <div className="gr-edit-cutoffs-label">{t("grades.altWeighting")}</div>
        {(c.weightings ?? []).map((s, si) => {
          const ssum = schemeSum(s);
          const ok = Math.abs(ssum - 100) < 0.01;
          return (
            <div className="gr-scheme" key={si}>
              <div className="gr-scheme-head">
                <span className="gr-scheme-name">{s.name}</span>
                <button className="gr-edit-x" aria-label={`${t("grades.removeScheme")}: ${s.name}`}
                  onClick={() => push((prev) => removeScheme(prev, si))}>×</button>
              </div>
              <div className="gr-scheme-rows">
                {c.categories.map((cat) => (
                  <label className="gr-scheme-w" key={cat.id}>
                    <span>{cat.name}</span>
                    <input type="number" value={s.weights[cat.id] ?? cat.weight}
                      aria-label={`${cat.name} weight in ${s.name}`}
                      onChange={(e) => push((prev) => setSchemeWeight(prev, si, cat.id, Number(e.target.value) || 0))} />
                  </label>
                ))}
              </div>
              <span className={`gr-tier-sum${ok ? " ok" : " warn"}`}>
                {ok ? t("grades.schemeSumOk") : t("grades.schemeSumWarn", { sum: String(ssum) })}
              </span>
            </div>
          );
        })}
        <button className="gr-linkbtn" onClick={() => push(addScheme)}>{t("grades.addScheme")}</button>
        {(c.weightings?.length ?? 0) > 0 && <p className="gr-replace-hint">{t("grades.altWeightingHint")}</p>}
      </div>
```

NOTE: `push` is the existing local updater in RubricEditor (`push((prev) => ...)`). Read the component to confirm its signature and reuse it. Do not add new state.

- [ ] **Step 5: Add CSS**

In `frontend/src/Grades.css` (rubric-editor block), add:

```css
.gr-alt-weighting { margin-top: 18px; padding-top: 14px; border-top: 1px dotted var(--rule); }
.gr-scheme { margin: 10px 0; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 10px; }
.gr-scheme-head { display: flex; align-items: center; justify-content: space-between; }
.gr-scheme-name { font-family: var(--serif); font-size: 15px; color: var(--navy); }
.gr-scheme-rows { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; }
.gr-scheme-w { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 6px; }
.gr-scheme-w input { width: 56px; min-height: 32px; text-align: right; font-family: var(--mono); font-size: 14px; border: 1px solid var(--rule); border-radius: 8px; padding: 4px 6px; background: var(--paper-card); }
```

- [ ] **Step 6: Run to confirm pass**

Run: `npx vitest run src/grades/RubricEditor.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full frontend gate**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc clean; all vitest pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/grades/RubricEditor.tsx frontend/src/Grades.css frontend/src/i18n/messages.ts frontend/src/grades/RubricEditor.test.tsx
git commit -m "feat(grades): T10 alternate-weighting editor section"
```

---

## Final verification

- [ ] Backend: `source /tmp/aitutor-testenv/bin/activate && cd backend && python -m pytest test_grade*.py test_api_grades.py -q` → all green.
- [ ] Frontend: `cd frontend && npx tsc --noEmit && npx vitest run && npx vite build` → all green.
- [ ] End-to-end shape: a course with `weightings:[{name, weights:{catId:number}}]` round-trips through serde and the standing route returns the max-scheme percent + the min-needed ladder.

## What this does NOT cover (deferred)

- Surfacing WHICH scheme is currently winning in the /grades UI (a caption) — nice-to-have.
- Syllabus LLM auto-detecting alternate weightings — manual editor only (spec D6).
- More than the two conditional rules already specced.
