# Grade Tracker — Result Transparency ("b") — Design Spec

Date: 2026-07-06 · Branch: `feat/grade-transparency` (off `origin/function`)
Design cleared via `superpowers:brainstorming`. Follows the `/grades` UI redesign (PR #20, merged).

## Goal

Surface *why* the standing is what it is, using data the moat math already computes. Three
additive, mostly-conditional readouts on the ready view:

1. **Per-category subtotal** — each gradebook category shows its own standing (`Exams · 92% so far`). Universal.
2. **Which weighting scheme won** — a caption under the standing seal (`graded under Final-heavy · best of 2 weightings`). Only when the course has alternate `weightings`.
3. **Replace-if-higher boost** — a note in the affected category (`↑ Final replaced Midterm 2 · +3.2%`). Only when a `replaceLowest` rule actually fires.

## Architecture (locked)

**Extend the existing `POST /api/grades/standing` response with a `breakdown` block.** The frontend
already refetches standing live (debounced) on every gradebook edit, so the breakdown updates for
free — no new endpoint, no extra per-keystroke round-trip. The client renders what the server sends;
**it computes no grades** (moat preserved).

Everything is additive: existing `standing` + `ladder` fields are unchanged. A plain uniform course
gets per-category percents and `winningScheme: null`, `replaceBoosts: []`.

### Key math facts (confirmed against `grades_math.py`)

- **Per-category percent is scheme-invariant.** Scaling a category's weight scales its `_category_earned`
  and `_category_graded_weight` equally, so `earned/graded_weight` (the percent) is unchanged. Compute it
  once from the base course; no scheme loop needed.
- `course_from_wire` builds **one projected category per wire category, in order** (it strips only
  null-score items, never categories). So `breakdown.categories[i]` is index-aligned with the frontend's
  `course.categories[i]`.
- `_replace_lowest_slots` already knows the boost: it returns `base + w_low*(frac_rep − f_low)`.

## Backend

### 1. `grades_math.py` — three pure helpers

```python
@dataclass(frozen=True)
class CategoryStanding:
    name: str
    weight: float
    percent: Optional[float]   # None when the category has no graded items
    graded: bool

def category_breakdown(course: Course) -> list[CategoryStanding]:
    """Per-category standing, index-aligned with course.categories. Scheme-invariant."""
    out = []
    for cat in course.categories:
        gw = _category_graded_weight(cat)
        pct = (_category_earned(cat) / gw * 100.0) if gw > 0 else None
        out.append(CategoryStanding(cat.name, cat.weight, pct, gw > 0))
    return out
```

**Winning scheme** — new function reusing the tested cores; leaves `compute_standing` untouched:

```python
# Sentinel name for the course's own category weights (the "primary" candidate).
PRIMARY_SCHEME = "__primary__"

def winning_scheme(course: Course) -> Optional[tuple[str, int]]:
    """(winner_name, candidate_count) or None when there are no alternate weightings.
    Winner is the scheme (incl. primary) that maximizes standing percent; ties keep the
    earlier candidate (primary first), matching compute_standing."""
    if not course.weightings:
        return None
    best_name, best = PRIMARY_SCHEME, _standing_core(course)
    for scheme in course.weightings:
        cand = _standing_core(apply_scheme(course, scheme.weights))
        if cand.percent is not None and (best.percent is None or cand.percent > best.percent):
            best_name, best = scheme.name, cand
    return best_name, len(course.weightings) + 1  # +1 for primary
```

*Note:* `compute_standing` uses strict `>` so ties keep the earlier (primary-first) candidate;
`winning_scheme` mirrors that exactly so the reported winner is the one that produced the shown standing.

**Replace boost** — per `replaceLowest` category, the overall-standing lift:

```python
@dataclass(frozen=True)
class ReplaceBoost:
    category_name: str
    replacer: str      # item whose score did the replacing
    lifted: str        # the lowest non-replacer it lifted
    delta_pct: float   # how much it raised the OVERALL standing

def replace_boosts(course: Course) -> list[ReplaceBoost]:
    """One entry per replaceLowest category whose boost actually fired (frac_rep > f_low)."""
    total_gw = sum(_category_graded_weight(c) for c in course.categories)
    out = []
    for cat in course.categories:
        if not isinstance(cat.rule, ReplaceLowest) or total_gw <= 0:
            continue
        graded = [it for it in cat.items]           # projected items are already graded-only
        reps = [it for it in graded if it.replacer]
        non  = [it for it in graded if not it.replacer]
        if not reps or not non:
            continue
        rep = max(reps, key=lambda it: it.fraction)
        low = min(non, key=lambda it: it.fraction)
        if rep.fraction <= low.fraction:
            continue
        boost_points = (low.weight or 0.0) * (rep.fraction - low.fraction)
        out.append(ReplaceBoost(cat.name, rep.name, low.name, boost_points / total_gw * 100.0))
    return out
```

`delta_pct` = `boost_points / total_graded_weight * 100` — the exact change in the base standing
percent (points/denominator). This is the "how much it raised your overall grade" number the user
approved. Computed on the base (primary) course; documented as such.

> **Requires `Item.name`** to survive projection. Verify `grades_serde.category_from_wire` keeps
> `name` on graded items (it should; only null-score items are dropped). If not, plumb it through.

### 2. `grades_report.py` — assemble the block

`standing_and_ladder` gains a `breakdown` key (always present):

```python
ws = gm.winning_scheme(projected)          # (name, count) or None
winning = None
if ws is not None:
    name, count = ws
    winning = {"name": None if name == gm.PRIMARY_SCHEME else name, "count": count}

payload["breakdown"] = {
    "categories": [
        {"name": c.name, "weight": c.weight, "percent": c.percent, "graded": c.graded}
        for c in gm.category_breakdown(projected)
    ],
    "winningScheme": winning,
    "replaceBoosts": [
        {"categoryName": b.category_name, "replacer": b.replacer,
         "lifted": b.lifted, "deltaPct": round(b.delta_pct, 1)}
        for b in gm.replace_boosts(projected)
    ],
}
```

`build_standing_prompt` (chat injection) is **unchanged**.

### JSON contract

```jsonc
{
  "standing": { "percent": 90.4, "letter": "A-" },
  "ladder": [ /* unchanged */ ],
  "breakdown": {
    "categories": [
      { "name": "Exams",  "weight": 50, "percent": 92.0, "graded": true },
      { "name": "Essays", "weight": 50, "percent": null, "graded": false }
    ],
    "winningScheme": { "name": "Final-heavy", "count": 2 },   // or null
    "replaceBoosts": [
      { "categoryName": "Exams", "replacer": "Final", "lifted": "Midterm 2", "deltaPct": 3.2 }
    ]
  }
}
```

`winningScheme.name === null` means the primary weights won → frontend shows `t("grades.primaryWeights")`.

## Frontend

### `grades/types.ts`

```ts
export type CategoryStanding = { name: string; weight: number; percent: number | null; graded: boolean };
export type WinningScheme = { name: string | null; count: number };
export type ReplaceBoost = { categoryName: string; replacer: string; lifted: string; deltaPct: number };
export type Breakdown = { categories: CategoryStanding[]; winningScheme: WinningScheme | null; replaceBoosts: ReplaceBoost[] };
export type StandingResp = { standing: Standing; ladder: LadderRow[] | null; breakdown?: Breakdown };
```

`breakdown` is optional so an older server response still type-checks (defensive; the UI treats a
missing breakdown as "hide all three").

### Data flow

`useServerStanding` already returns the whole `StandingResp`. `ReadyView` threads the pieces down:

```
ReadyView
  ├─ <StandingHero standing winningScheme={resp?.breakdown?.winningScheme ?? null} ... />
  ├─ <GoalSeek ... />                                    (unchanged)
  └─ <Gradebook course onChange
        catStandings={resp?.breakdown?.categories ?? null}
        boosts={resp?.breakdown?.replaceBoosts ?? null} />
```

- **StandingHero** — after the seal, render `t("grades.gradedUnder", {scheme, count})` when
  `winningScheme != null` (scheme label = `winningScheme.name ?? t("grades.primaryWeights")`).
- **Gradebook** — per category header, if `catStandings?.[i]?.graded`, render the subtotal
  `<b>{pct}%</b> {t("grades.soFar")}`. Under the header, for each boost whose `categoryName === cat.name`,
  render the boost note `↑ {replacer} {t("grades.replacedBy")} {lifted}` + `+{deltaPct}%`.
  Gradebook is index-aligned with `catStandings` (both come from `course.categories`); boosts match by
  category name.

### CSS (`Grades.css`) — 3 new classes (from the approved mock)

```css
.gr-hero-scheme { font-family: var(--mono); font-size: 11px; letter-spacing: 0.03em; color: var(--ink-soft); margin-top: 12px; }
.gr-hero-scheme b { color: var(--teal); font-weight: 500; }
.gr-gb-cat-title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.gr-gb-cat-sub { font-family: var(--mono); font-size: 12.5px; letter-spacing: 0.02em; color: var(--ink-soft); }
.gr-gb-cat-sub b { color: var(--teal); font-weight: 500; }
.gr-boost { display: flex; align-items: center; gap: 8px; margin: 12px 0 2px; font-family: var(--sans); font-size: 12.5px; color: var(--teal); background: #e7f6f2; border-radius: 10px; padding: 8px 13px; }
.gr-boost b { font-weight: 600; }
.gr-boost-delta { margin-left: auto; font-family: var(--mono); color: var(--teal-mid); font-weight: 500; }
```

The category header wraps name + subtotal in `.gr-gb-cat-title` (replacing the bare name span), weight
badge stays on the right.

### i18n (en / zh / es)

- `grades.soFar` — "so far" / "目前" / "hasta ahora"
- `grades.gradedUnder` — "graded under {scheme} · best of {count} weightings" / "按 {scheme} 计（{count} 套权重取最优）" / "calificado con {scheme} · mejor de {count}"
- `grades.primaryWeights` — "Primary weights" / "主权重" / "Pesos principales"
- `grades.replacedBy` — "replaced" / "替换了" / "reemplazó a" (rendered as `{replacer} replaced {lifted}`)

## Edge cases

- Category with no graded items → `percent: null, graded: false` → subtotal hidden.
- No `weightings` → `winningScheme: null` → caption hidden.
- No replace rule, or boost didn't fire (`frac_rep ≤ f_low`) → `replaceBoosts: []` → note hidden.
- Multiple replace categories → multiple boost entries, each rendered under its own category.
- Nothing graded at all → `standing.percent` already null (empty hero handles it); breakdown categories all `graded:false`.

## Testing

**Backend (`test_grade_transparency.py`, pure):**
- `category_breakdown`: two graded categories → correct percents, index-aligned; an ungraded category → `percent None, graded False`; scheme-invariance (same percents with vs. without `weightings`).
- `winning_scheme`: `None` with no weightings; alternate wins → its name + count; primary wins on a tie → `PRIMARY_SCHEME`, count = len+1.
- `replace_boosts`: boost fires → correct replacer/lifted/delta_pct (hand-checked); boost doesn't fire (replacer ≤ lowest) → empty; non-replace category → empty.
- `standing_and_ladder`: response includes a well-formed `breakdown`; existing standing/ladder unchanged (regression).

**Frontend (`grades/*.test.tsx`, jsdom):**
- Gradebook: renders `92% so far` for a graded category; hides it when `graded:false`; renders the boost note when a matching boost is passed; hides when none.
- StandingHero: renders the scheme caption when `winningScheme` present (incl. `name:null` → "Primary weights"); hides when null.

**Gate:** `tsc -b`, all vitest, `vite build`; backend pytest green.

## Locked decisions

- **D1** Extend `/api/grades/standing` (no new endpoint) — the live refetch carries the breakdown for free.
- **D2** Per-category number = **percent "so far"** (scheme-invariant; matches the hero framing).
- **D3** `winning_scheme` mirrors `compute_standing`'s strict-`>` tie rule exactly; primary is a named candidate.
- **D4** Replace `deltaPct` = overall-standing lift = `boost_points / total_graded_weight * 100` on the base course, rounded to 1 dp.
- **D5** All three are additive + default-hidden; a plain course only ever shows per-category percents.
- **D6** Client still computes no grades; `breakdown` is server-authoritative like `standing`/`ladder`.

## NOT in scope (deferred)

- Multi-course support (user explicitly deferred).
- Per-item contribution breakdown / what-if beyond the existing live gradebook.
- Showing every scheme's result (only the winner + count).
