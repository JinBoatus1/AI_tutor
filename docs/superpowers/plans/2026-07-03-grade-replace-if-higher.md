# Replace-if-higher (Grade Tracker Phase 2A-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `replaceLowest` rubric rule — "your final exam, if higher, lifts your lowest midterm's score" (the final also counts in its own slot) — with correct standing math and a piecewise goal-seek, wired end to end (backend math → serde → route → editor).

**Architecture:** `replaceLowest` reuses the Phase-1 per-item `weight` (like `fixedWeights`) and flags exactly one item as the `replacer`. The category's earned points add a *boost*: the lowest graded non-replacer is lifted to the replacer's fraction when the replacer scores higher. `goal_seek` treats the category's earned as a piecewise-linear function of the unknown item's fraction `x` (kinks only at existing item fractions) and scans pieces for the minimum `x` — the same breakpoint-scan shape the existing rank rule uses, factored into a shared `_solve_piecewise` helper. The rank path is left byte-for-byte unchanged (regression-locked). This slice needs NONE of the max-of-weighting scheme machinery (that is Phase 2A-2).

**Tech Stack:** Python 3 / pytest (backend, `backend/`), React + TypeScript / vitest (frontend, `frontend/`).

**Spec:** `docs/superpowers/specs/2026-07-03-grade-conditional-rules-design.md` (ENG CLEARED; decisions ED1-ED5).

**Test env:** backend `source /tmp/aitutor-testenv/bin/activate` then `cd backend`; frontend `cd frontend`.

---

## File Structure

- `backend/grades_math.py` — add `ReplaceLowest` dataclass, `Item.replacer` field, `_replace_lowest_slots` helper, `_category_earned`/`_category_graded_weight`/`validate_rubric` branches, `_solve_piecewise` helper, `goal_seek` branch + `unknown_is_replacer` param.
- `backend/test_grades_math.py` — replaceLowest compute + goal_seek tests + regression.
- `backend/grades_serde.py` — `rule_from_wire` + `item_from_wire` + `find_wire_item` (return the replacer flag).
- `backend/test_grades_serde.py` — round-trip tests.
- `backend/grades_report.py` — unpack the 4-tuple, pass `unknown_is_replacer` to goal_seek.
- `frontend/src/grades/types.ts` — `replaceLowest` rule + `Item.replacer`.
- `frontend/src/grades/rubric.ts` — `ScoringMode` + `setMode`/`setReplacer`/`activeMode`/`slotCountOf`.
- `frontend/src/grades/rubric.test.ts` — helper unit tests.
- `frontend/src/grades/RubricEditor.tsx` — "Replace lowest" mode + per-row replacer radio.
- `frontend/src/grades/RubricEditor.test.tsx` — component test.
- `frontend/src/Grades.css` + `frontend/src/i18n/messages.ts` — styles + strings.

---

## Task 1: `ReplaceLowest` rule + boost compute (backend)

**Files:**
- Modify: `backend/grades_math.py`
- Test: `backend/test_grades_math.py`

- [ ] **Step 1: Write failing tests for the boost compute**

Add to `backend/test_grades_math.py` (top imports already pull `grades_math as gm` — match the file's existing import style; if it imports symbols individually, add `ReplaceLowest`):

```python
def _rl_course(final_score, m_scores=(80, 60), weights=(10, 10, 10)):
    """Exams: 2 midterms + 1 final (replacer). weights are points-of-100. cutoff A=90."""
    import grades_math as gm
    items = [
        gm.Item(name="M1", score=m_scores[0], max_score=100, weight=weights[0]),
        gm.Item(name="M2", score=m_scores[1], max_score=100, weight=weights[1]),
        gm.Item(name="Final", score=final_score, max_score=100, weight=weights[2], replacer=True),
    ]
    return gm.Course(
        name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)],
    )


def test_replace_lowest_boost_active():
    # Final 0.90 > lowest midterm M2 0.60 -> M2 lifted to 0.90.
    # earned = 10*0.80 + 10*0.90(lifted) + 10*0.90 = 8 + 9 + 9 = 26 ; graded_weight = 30
    import grades_math as gm
    s = gm.compute_standing(_rl_course(90))
    assert s.earned_points == 26.0
    assert s.graded_weight == 30.0
    assert s.percent == 26.0 / 30.0 * 100.0


def test_replace_lowest_boost_inactive():
    # Final 0.50 < lowest midterm 0.60 -> no boost.
    # earned = 10*0.80 + 10*0.60 + 10*0.50 = 8 + 6 + 5 = 19
    import grades_math as gm
    s = gm.compute_standing(_rl_course(50))
    assert s.earned_points == 19.0


def test_replace_lowest_no_boost_when_replacer_ungraded():
    # Only midterms graded (final stripped as null upstream): behaves like fixedWeights.
    import grades_math as gm
    items = [
        gm.Item(name="M1", score=80, max_score=100, weight=10),
        gm.Item(name="M2", score=60, max_score=100, weight=10),
    ]
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=20, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    s = gm.compute_standing(course)
    assert s.earned_points == 8.0 + 6.0  # no boost


def test_replace_lowest_only_replacer_graded_no_lowest():
    import grades_math as gm
    items = [gm.Item(name="Final", score=90, max_score=100, weight=10, replacer=True)]
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=10, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    assert gm.compute_standing(course).earned_points == 9.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source /tmp/aitutor-testenv/bin/activate && cd backend && python -m pytest test_grades_math.py -k replace_lowest -q`
Expected: FAIL with `AttributeError: module 'grades_math' has no attribute 'ReplaceLowest'` (and `Item(... replacer=...)` TypeError).

- [ ] **Step 3: Add the `ReplaceLowest` rule, the `Item.replacer` field, and the boost helper**

In `backend/grades_math.py`, after the `FixedWeights` dataclass (right before `Rule = Union[...]`), add:

```python
@dataclass(frozen=True)
class ReplaceLowest:
    """Per-item FIXED weights (like FixedWeights) with ONE item flagged `replacer`
    (the final). The replacer counts in its own slot AND, if it scores higher than
    the lowest graded non-replacer, that lowest item's fraction is lifted to the
    replacer's. The weights live on the Items; exactly one Item has replacer=True."""
```

Update the `Rule` union to include it:

```python
Rule = Union[Uniform, DropLowest, RankWeights, FixedWeights, ReplaceLowest]
```

Add `replacer` to the `Item` dataclass (after the `weight` field):

```python
    replacer: bool = False  # only meaningful when the category rule is ReplaceLowest
```

Add the boost helper next to `_category_earned` (before it):

```python
def _replace_lowest_slots(slots: list[tuple[float, bool, float]]) -> float:
    """Earned points for a ReplaceLowest category. Each slot = (weight, is_replacer, fraction).
    Base = sum(w*frac); then if a replacer is present alongside >=1 non-replacer and scores
    higher than the lowest non-replacer, that lowest slot is lifted to the replacer fraction."""
    base = sum(w * f for (w, _r, f) in slots)
    reps = [(w, f) for (w, r, f) in slots if r]
    non = [(w, f) for (w, r, f) in slots if not r]
    if not reps or not non:
        return base
    frac_rep = max(f for (_w, f) in reps)
    w_low, f_low = min(non, key=lambda wf: wf[1])
    if frac_rep > f_low:
        return base + w_low * (frac_rep - f_low)
    return base
```

- [ ] **Step 4: Branch `_category_earned` and `_category_graded_weight`**

In `_category_earned`, add a branch BEFORE the `FixedWeights` branch:

```python
    if isinstance(cat.rule, ReplaceLowest):
        return _replace_lowest_slots([(it.weight or 0.0, it.replacer, it.fraction) for it in cat.items])
```

In `_category_graded_weight`, change the `FixedWeights` branch to also cover `ReplaceLowest`:

```python
    if isinstance(cat.rule, (FixedWeights, ReplaceLowest)):
        return sum((it.weight or 0.0) for it in cat.items)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest test_grades_math.py -k replace_lowest -q`
Expected: PASS (4 tests).

- [ ] **Step 6: Add the `validate_rubric` branch (warn on bad weight sum / replacer count)**

Add a failing test first:

```python
def test_validate_replace_lowest_warns_on_replacer_count():
    import grades_math as gm
    items = [gm.Item(name="M1", score=80, max_score=100, weight=10),
             gm.Item(name="M2", score=60, max_score=100, weight=10)]  # zero replacers
    course = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=20, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90)])
    warns = gm.validate_rubric(course)
    assert any("exactly one" in w for w in warns)
```

Run it (expect FAIL), then in `validate_rubric` add a branch alongside the `FixedWeights` branch:

```python
        elif isinstance(cat.rule, ReplaceLowest):
            s = sum((it.weight or 0.0) for it in cat.items)
            if cat.items and abs(s - cat.weight) > tol:
                warnings.append(
                    f"'{cat.name}': item weights sum to {s:g} but the category weight is {cat.weight:g}."
                )
            n_reps = sum(1 for it in cat.items if it.replacer)
            if cat.items and n_reps != 1:
                warnings.append(
                    f"'{cat.name}': replace-lowest needs exactly one item marked as the replacer (got {n_reps})."
                )
            n_slots = len(cat.items)
```

Run: `python -m pytest test_grades_math.py -k "replace_lowest or validate_replace" -q`
Expected: PASS.

- [ ] **Step 7: Regression — the full suite is still green**

Run: `python -m pytest test_grades_math.py test_grades_serde.py -q`
Expected: PASS (existing count + the new tests; no existing test changes value).

- [ ] **Step 8: Commit**

```bash
git add backend/grades_math.py backend/test_grades_math.py
git commit -m "feat(grades): T1 replaceLowest rule + boost compute"
```

---

## Task 2: `goal_seek` piecewise for `replaceLowest` (backend)

**Files:**
- Modify: `backend/grades_math.py`
- Test: `backend/test_grades_math.py`

- [ ] **Step 1: Write failing goal_seek tests (both unknown types + edges)**

```python
def _rl_goal_course(m_scores, final_score=None, weights=(10, 10, 10)):
    """Exams (ReplaceLowest): M1,M2 graded; Final graded only if final_score given.
    Returns (course, final_item_max=100). cutoff A=90 on a 30-pt category = /30 scale."""
    import grades_math as gm
    items = [gm.Item(name="M1", score=m_scores[0], max_score=100, weight=weights[0]),
             gm.Item(name="M2", score=m_scores[1], max_score=100, weight=weights[1])]
    if final_score is not None:
        items.append(gm.Item(name="Final", score=final_score, max_score=100, weight=weights[2], replacer=True))
    return gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=items)],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)])


def test_goal_seek_replacer_unknown_boost_side():
    # M1=1.0, M2=0.5 graded; Final is the unknown (replacer), weight 10, max 100, target A=90% of /30.
    # target earned = 27.0. base(x) = 10*1.0 + 10*0.5 + 10*x + boost.
    # boost active when x>0.5: M2 lifted 0.5->x adds 10*(x-0.5). So for x>0.5:
    #   total = 10 + 5 + 10x + 10(x-0.5) = 10 + 10x - 5 + 10x ... = 10*1 + 10*0.5 + 10x + 10(x-0.5)
    #         = 10 + 5 + 10x + 10x - 5 = 10 + 20x. Set =27 -> x = 0.85 -> needed 85.
    import grades_math as gm
    c = _rl_goal_course((100, 50))
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "ok"
    assert abs(r.needed_score - 85.0) < 1e-6


def test_goal_seek_replacer_unknown_below_breakpoint():
    # M1=1.0, M2=0.95 graded; Final unknown replacer. lowest non-rep frac = 0.95.
    # For x<=0.95 (no boost): total = 10 + 9.5 + 10x. Set =27 -> 10x = 7.5 -> x=0.75 (< 0.95 ok, no boost).
    import grades_math as gm
    c = _rl_goal_course((100, 95))
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "ok"
    assert abs(r.needed_score - 75.0) < 1e-6


def test_goal_seek_nonreplacer_unknown_full_piecewise():
    # M1=1.0 and Final=1.0 (replacer) graded; M2 is the UNKNOWN non-replacer (weight 10).
    # For x<1.0 M2 is the lowest non-rep and is lifted to frac_rep=1.0, so its low score is fully
    # replaced: base = 10*1 + 10*x + 10*1 = 20+10x; boost = 10*(1.0-x); total = 30 (constant).
    # 30 >= target 27 (A=90% of /30) at every x -> already_met, needed 0. Proves full-piecewise boost.
    import grades_math as gm
    c = gm.Course(name="C",
        categories=[gm.Category(name="Exams", weight=30, rule=gm.ReplaceLowest(), items=[
            gm.Item(name="M1", score=100, max_score=100, weight=10),
            gm.Item(name="Final", score=100, max_score=100, weight=10, replacer=True),
        ])],
        cutoffs=[gm.Cutoff(letter="A", min_pct=90), gm.Cutoff(letter="F", min_pct=0)])
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=False)
    assert r.status in ("already_met", "ok")
    assert (r.needed_score or 0.0) < 1e-6  # replaced away -> ~0 needed


def test_goal_seek_replace_lowest_requires_weight():
    import grades_math as gm, pytest
    c = _rl_goal_course((100, 50))
    with pytest.raises(ValueError):
        gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=None, unknown_is_replacer=True)


def test_goal_seek_replace_lowest_infeasible():
    import grades_math as gm
    # M1=0, M2=0; even a perfect boosted final can't reach 90% of /30.
    c = _rl_goal_course((0, 0))
    r = gm.goal_seek(c, "A", "Exams", unknown_max_score=100, unknown_weight=10, unknown_is_replacer=True)
    assert r.status == "infeasible"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest test_grades_math.py -k "goal_seek and (replacer or nonreplacer or replace_lowest)" -q`
Expected: FAIL — `goal_seek()` has no `unknown_is_replacer` kwarg (TypeError).

- [ ] **Step 3: Add the shared `_solve_piecewise` helper**

In `backend/grades_math.py`, immediately BEFORE `def goal_seek(`, add:

```python
def _solve_piecewise(total, breakpoints, target_pct, unknown_max_score, target_letter):
    """Minimum x in [0,1] with total(x) >= target_pct, given a continuous piecewise-linear
    `total` whose only kinks are at `breakpoints` (which must include 0.0 and 1.0). Shared by
    the ReplaceLowest goal-seek (and, later, the 2A-2 scheme goal-seek). The rank path keeps
    its own inline copy (regression-locked)."""
    target_pct = float(target_pct)
    if total(0.0) >= target_pct:
        return GoalSeekResult("already_met", 0.0, 0.0, target_letter, target_pct)
    if total(1.0) < target_pct:
        return GoalSeekResult("infeasible", None, None, target_letter, target_pct)
    for a, b in zip(breakpoints, breakpoints[1:]):
        ta, tb = total(a), total(b)
        if tb < target_pct:
            continue
        x_star = a if tb == ta else a + (target_pct - ta) * (b - a) / (tb - ta)
        return GoalSeekResult("ok", x_star * unknown_max_score, x_star, target_letter, target_pct)
    return GoalSeekResult("infeasible", None, None, target_letter, target_pct)
```

- [ ] **Step 4: Add the `unknown_is_replacer` param and the `ReplaceLowest` branch**

Change the `goal_seek` signature (add the kwarg, keep it last for back-compat):

```python
def goal_seek(
    course: Course,
    target_letter: str,
    unknown_category: str,
    unknown_max_score: float,
    unknown_weight: Optional[float] = None,
    unknown_is_replacer: bool = False,
) -> GoalSeekResult:
```

Then, immediately AFTER the existing `FixedWeights` branch (after its `return GoalSeekResult("ok", ...)` line, before `u_wts = slot_weights_desc(...)`), add:

```python
    if isinstance(unknown_cat.rule, ReplaceLowest):
        if unknown_weight is None:
            raise ValueError("goal_seek on a ReplaceLowest category requires unknown_weight")
        w_u = float(unknown_weight)
        existing = [(it.weight or 0.0, it.replacer, it.fraction) for it in unknown_cat.items]

        def total(x: float) -> float:
            return fixed_other + _replace_lowest_slots(existing + [(w_u, unknown_is_replacer, x)])

        breakpoints = sorted({0.0, 1.0, *(min(max(f, 0.0), 1.0) for (_w, _r, f) in existing)})
        return _solve_piecewise(total, breakpoints, target_pct, unknown_max_score, target_letter)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest test_grades_math.py -q`
Expected: PASS (all, including the rank/fixed tests unchanged).

- [ ] **Step 6: Commit**

```bash
git add backend/grades_math.py backend/test_grades_math.py
git commit -m "feat(grades): T2 goal_seek piecewise for replaceLowest (any unknown)"
```

---

## Task 3: serde + route plumbing (backend)

**Files:**
- Modify: `backend/grades_serde.py`, `backend/grades_report.py`
- Test: `backend/test_grades_serde.py`

- [ ] **Step 1: Write failing serde round-trip tests**

Add to `backend/test_grades_serde.py`:

```python
def test_rule_from_wire_replace_lowest():
    import grades_serde as gs, grades_math as gm
    assert gs.rule_from_wire({"kind": "replaceLowest"}) == gm.ReplaceLowest()


def test_item_from_wire_carries_replacer_flag():
    import grades_serde as gs
    it = gs.item_from_wire({"name": "Final", "score": 90, "maxScore": 100, "weight": 10, "replacer": True})
    assert it is not None and it.replacer is True and it.weight == 10.0


def test_find_wire_item_returns_replacer_flag():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "ex", "name": "Exams", "weight": 30, "rule": {"kind": "replaceLowest"}, "items": [
            {"id": "m1", "name": "M1", "score": 80, "maxScore": 100, "weight": 10},
            {"id": "fin", "name": "Final", "score": None, "maxScore": 100, "weight": 10, "replacer": True},
        ]}], "cutoffs": [{"letter": "A", "min": 90}]}
    found = gs.find_wire_item(course, "fin")
    assert found == ("Exams", 100.0, 10.0, True)
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest test_grades_serde.py -k "replace_lowest or replacer" -q`
Expected: FAIL (unknown rule kind; `find_wire_item` returns a 3-tuple).

- [ ] **Step 3: Extend `rule_from_wire`, `item_from_wire`, `find_wire_item`**

In `backend/grades_serde.py`, in `rule_from_wire`, add before the final `raise SerdeError(...)`:

```python
    if kind == "replaceLowest":
        return gm.ReplaceLowest()
```

Update the unknown-kind error message to list the new kind:

```python
        f"{where}: unknown rule kind {kind!r} (expected uniform|dropLowest|rankWeights|fixedWeights|replaceLowest)"
```

In `item_from_wire`, add `replacer` to the returned `gm.Item(...)`:

```python
        weight=_require_number(raw_weight, f"{where}.weight") if raw_weight is not None else None,
        replacer=bool(d.get("replacer", False)),
    )
```

In `find_wire_item`, change the return type/tuple to include the replacer flag. Update the signature annotation to `Optional[tuple[str, float, Optional[float], bool]]`, the docstring, and the return:

```python
            if itd.get("id") == item_id:
                raw_w = itd.get("weight")
                weight = _require_number(raw_w, "item.weight") if raw_w is not None else None
                replacer = bool(itd.get("replacer", False))
                return cat_name, _require_number(itd.get("maxScore"), "item.maxScore"), weight, replacer
```

- [ ] **Step 4: Update the caller in `grades_report.py`**

In `backend/grades_report.py`, unpack the 4-tuple and pass it through:

```python
    cat_name, max_score, weight, is_replacer = found
```

and in the goal_seek call:

```python
            res = gm.goal_seek(projected, c.letter, cat_name, max_score,
                               unknown_weight=weight, unknown_is_replacer=is_replacer)
```

- [ ] **Step 5: Write a report-level regression + replaceLowest test**

Add to `backend/test_grades_report.py` (create the import if needed; mirror existing tests there):

```python
def test_standing_and_ladder_replace_lowest_ladder():
    import grades_report as gr
    course = {"name": "C", "categories": [
        {"id": "ex", "name": "Exams", "weight": 30, "rule": {"kind": "replaceLowest"}, "items": [
            {"id": "m1", "name": "M1", "score": 100, "maxScore": 100, "weight": 10},
            {"id": "m2", "name": "M2", "score": 50, "maxScore": 100, "weight": 10},
            {"id": "fin", "name": "Final", "score": None, "maxScore": 100, "weight": 10, "replacer": True},
        ]}], "cutoffs": [{"letter": "A", "min": 90}, {"letter": "F", "min": 0}]}
    out = gr.standing_and_ladder(course, "fin")
    a_row = next(r for r in out["ladder"] if r["letter"] == "A")
    assert a_row["status"] == "ok"
    assert abs(a_row["needed"] - 85.0) < 1e-6  # matches test_goal_seek_replacer_unknown_boost_side
```

- [ ] **Step 6: Run the backend suite**

Run: `python -m pytest test_grades_serde.py test_grades_report.py test_grades_math.py test_api_grades.py -q`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add backend/grades_serde.py backend/grades_report.py backend/test_grades_serde.py backend/test_grades_report.py
git commit -m "feat(grades): T3 serde + standing route plumb the replacer flag"
```

---

## Task 4: wire types + rubric helpers (frontend)

**Files:**
- Modify: `frontend/src/grades/types.ts`, `frontend/src/grades/rubric.ts`
- Test: `frontend/src/grades/rubric.test.ts`

- [ ] **Step 1: Add the type shapes**

In `frontend/src/grades/types.ts`, add `replaceLowest` to `Rule` (after `fixedWeights`) and `replacer` to `Item`:

```ts
  | { kind: "fixedWeights" } // per-item fixed weights — the weight lives on each Item.weight (positional, not rank-based)
  | { kind: "replaceLowest" }; // per-item fixed weights + one Item.replacer=true; its score lifts the lowest other item if higher
```

```ts
export type Item = { id: string; name: string; score: number | null; maxScore: number; weight?: number; replacer?: boolean };
```

- [ ] **Step 2: Write failing rubric.ts helper tests**

Add to `frontend/src/grades/rubric.test.ts`:

```typescript
import { setReplacer } from "./rubric";

describe("replaceLowest helpers", () => {
  it("activeMode maps replaceLowest", () => {
    expect(activeMode({ kind: "replaceLowest" })).toBe("replaceLowest");
  });
  it("setMode replaceLowest seeds weights and flags one replacer (the last row)", () => {
    let c = cat({ weight: 30, items: [newItem("M1"), newItem("M2"), newItem("Final")] });
    c = setMode(c, "replaceLowest");
    expect(c.rule).toEqual({ kind: "replaceLowest" });
    expect(itemWeightSum(c)).toBeCloseTo(30, 6);
    expect(c.items.filter((it) => it.replacer)).toHaveLength(1);
    expect(c.items[2].replacer).toBe(true); // last row defaults to the replacer
  });
  it("setReplacer is single-select", () => {
    let c = cat({ rule: { kind: "replaceLowest" }, items: [newItem("M1"), newItem("M2"), newItem("Final")] });
    c = setReplacer(c, c.items[0].id);
    expect(c.items.map((it) => !!it.replacer)).toEqual([true, false, false]);
    c = setReplacer(c, c.items[1].id);
    expect(c.items.map((it) => !!it.replacer)).toEqual([false, true, false]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd frontend && npx vitest run src/grades/rubric.test.ts`
Expected: FAIL — `setReplacer` is not exported; `activeMode`/`setMode` don't handle `replaceLowest`.

- [ ] **Step 4: Implement the helpers in `rubric.ts`**

Change `ScoringMode`:

```ts
export type ScoringMode = "uniform" | "dropLowest" | "fixedWeights" | "replaceLowest";
```

In `activeMode`, add before the `uniform` check:

```ts
  if (rule.kind === "replaceLowest") return "replaceLowest";
```

In `slotCountOf`, add a `replaceLowest` case returning 0 (items are the slots, like fixedWeights):

```ts
    case "fixedWeights":
    case "replaceLowest":
      return 0;
```

In `setMode`, handle `replaceLowest` like `fixedWeights` but also ensure exactly one replacer. Replace the final `// fixedWeights` block with a shared block that covers both:

```ts
  // fixedWeights / replaceLowest: ensure every item carries a weight (even split seed).
  const missing = cat.items.some((it) => it.weight == null);
  let items = cat.items;
  if (missing && n > 0) {
    const seed = evenWeights(cat.weight, n);
    items = cat.items.map((it, i) => ({ ...it, weight: it.weight ?? seed[i] }));
  }
  if (mode === "replaceLowest") {
    // default the LAST row to the replacer (the "final") if none is flagged yet
    if (!items.some((it) => it.replacer)) {
      items = items.map((it, i) => ({ ...it, replacer: i === items.length - 1 }));
    }
    return { ...cat, rule: { kind: "replaceLowest" }, items };
  }
  return { ...cat, rule: { kind: "fixedWeights" }, items };
```

Add the `setReplacer` helper (single-select) after `setMode`:

```ts
/** Flag exactly one item as the replacer (the final); clear the rest. */
export function setReplacer(cat: Category, itemId: string): Category {
  return { ...cat, items: cat.items.map((it) => ({ ...it, replacer: it.id === itemId })) };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/grades/rubric.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no output).

```bash
git add frontend/src/grades/types.ts frontend/src/grades/rubric.ts frontend/src/grades/rubric.test.ts
git commit -m "feat(grades): T4 replaceLowest wire type + rubric helpers"
```

---

## Task 5: "Replace lowest" editor mode (frontend)

**Files:**
- Modify: `frontend/src/grades/RubricEditor.tsx`, `frontend/src/Grades.css`, `frontend/src/i18n/messages.ts`
- Test: `frontend/src/grades/RubricEditor.test.tsx`

- [ ] **Step 1: Add i18n strings (en/zh/es)**

In `frontend/src/i18n/messages.ts`, add these keys in EACH of the three locale blocks (place next to `grades.customWeights`):

- en: `"grades.replaceLowestMode": "Replace lowest"`, `"grades.replacerLabel": "final (replaces lowest)"`, `"grades.replaceLowestHint": "The final, if higher, lifts your lowest item."`
- zh: `"grades.replaceLowestMode": "期末顶替最低"`, `"grades.replacerLabel": "期末（顶替最低）"`, `"grades.replaceLowestHint": "期末若更高，会提升你最低的一项。"`
- es: `"grades.replaceLowestMode": "Reemplazar la más baja"`, `"grades.replacerLabel": "final (reemplaza la más baja)"`, `"grades.replaceLowestHint": "El final, si es más alto, sube tu ítem más bajo."`

(New keys; `MessageKey = keyof typeof EN` enforces all three locales define them — `tsc` fails otherwise.)

- [ ] **Step 2: Write the failing component test**

Add to `frontend/src/grades/RubricEditor.test.tsx`:

```typescript
describe("RubricEditor — Replace lowest mode", () => {
  it("exposes a single-select replacer radio and per-row weights", () => {
    renderEditor(threeTests()); // 3 rows: Test #1/#2/#3, category weight 50
    fireEvent.click(screen.getByRole("radio", { name: /replace lowest/i }));
    // per-row weight inputs appear (like custom weights)
    expect(screen.getByLabelText("Test #1 weight")).toBeTruthy();
    // one replacer radio per row; last row defaults on
    const reps = screen.getAllByRole("radio", { name: /final \(replaces lowest\)/i });
    expect(reps).toHaveLength(3);
    // pick the first row as the replacer -> single select
    fireEvent.click(reps[0]);
    expect((reps[0] as HTMLInputElement).checked).toBe(true);
    expect((reps[2] as HTMLInputElement).checked).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/grades/RubricEditor.test.tsx`
Expected: FAIL — no "Replace lowest" radio / no replacer radios.

- [ ] **Step 4: Wire the mode into the editor**

In `frontend/src/grades/RubricEditor.tsx`:

Add `setReplacer` to the `rubric` import and `MODES`:

```ts
import {
  activeMode, addCategory, addItem, categoryWeightSum, hasEnteredScores,
  itemWeightSum, materializeCourse, removeCategory, removeItem, setMode, setReplacer,
  type ScoringMode,
} from "./rubric";

const MODES: ScoringMode[] = ["uniform", "dropLowest", "fixedWeights", "replaceLowest"];
```

In the mode button label ternary, extend it to name the new mode:

```tsx
                    {m === "uniform"
                      ? t("grades.allEqual")
                      : m === "dropLowest"
                        ? t("grades.dropLowest")
                        : m === "fixedWeights"
                          ? t("grades.customWeights")
                          : t("grades.replaceLowestMode")}
```

Replace the `const isFixed = mode === "fixedWeights";` line with:

```tsx
              const isFixed = mode === "fixedWeights" || mode === "replaceLowest";
              const isReplace = mode === "replaceLowest";
```

(`isFixed` already gates the per-row weight input and the per-category sum chip, so weights now show for replaceLowest too.)

Add the replacer radio inside the item row, right after the weight `<label>` block and before the remove button:

```tsx
                    {isReplace && (
                      <label className="gr-item-rep">
                        <input
                          type="radio"
                          name={`rep-${cat.id}`}
                          checked={!!it.replacer}
                          aria-label={t("grades.replacerLabel")}
                          onChange={() => mutCat(i, (x) => setReplacer(x, it.id))}
                        />
                        {t("grades.replacerLabel")}
                      </label>
                    )}
```

Add the hint under the item list when in replace mode — right after the `.gr-edit-item-foot` block's closing `</div>`, inside `.gr-edit-items`:

```tsx
                {isReplace && <p className="gr-replace-hint">{t("grades.replaceLowestHint")}</p>}
```

- [ ] **Step 5: Add CSS**

In `frontend/src/Grades.css`, in the "rubric editor redesign" block, add:

```css
.gr-item-rep { font-family: var(--sans); font-size: 11.5px; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.gr-replace-hint { font-family: var(--serif); font-style: italic; font-size: 12.5px; color: var(--ink-soft); margin: 8px 0 0; }
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/grades/RubricEditor.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full frontend gate**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc clean; all vitest pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/grades/RubricEditor.tsx frontend/src/Grades.css frontend/src/i18n/messages.ts frontend/src/grades/RubricEditor.test.tsx
git commit -m "feat(grades): T5 Replace-lowest editor mode + replacer radio"
```

---

## Final verification

- [ ] Backend: `source /tmp/aitutor-testenv/bin/activate && cd backend && python -m pytest test_grade*.py test_api_grades.py -q` → all green.
- [ ] Frontend: `cd frontend && npx tsc --noEmit && npx vitest run && npx vite build` → all green.
- [ ] Manual (optional, needs dev fake-auth shim): /grades → new course → Exams category → "Replace lowest" mode → 3 rows M1/M2/Final, mark Final as replacer, weights 10/10/10, category 30 → enter M1=100 M2=50 → goal-seek "need 85 on Final for A" matches the unit test.

## What this does NOT cover (Phase 2A-2, separate PR)

- Max-of-two-weightings (course-level `weightings`, scheme-max compute, intrinsic normalization, div-by-zero guard).
- Syllabus LLM auto-detection of replaceLowest (manual editor only per spec D6).
