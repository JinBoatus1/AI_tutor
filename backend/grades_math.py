"""
Deterministic grade math for the Course Grade Tracker (phase 1).

PURE + dependency-free (stdlib only) on purpose: this is the one place grades are
computed, so it can be exhaustively unit-tested and the number it returns is
guaranteed to match a hand calculation. The Learning-Mode agent and the /grades
UI both READ this module's output; neither recomputes. Never let the LLM do the
arithmetic.

Why this exists (the moat)
--------------------------
Real rubrics use CONDITIONAL / rank-based weights that a fixed-weight calculator
(RogerHub, spreadsheets) cannot express. Example that motivated this feature:

    A course with NO final, 4 exams in an "Exams" category worth 25 points, where
    the LOWEST-scoring exam counts 4 points and the other three count 7 each
    (7*3 + 4 = 25).

So the upcoming exam's *effective weight is conditional*: 4 points if it lands as
the lowest, otherwise 7 (and it bumps a prior exam into the 4-point slot). The
"what do I need for an A?" answer is therefore PIECEWISE - the unknown item's
weight can change with its own value. `goal_seek` solves this exactly.

Model
-----
- A Category contributes `weight` points to a 100-point course total.
- A Category's `rule` says how that weight is split across item-slots:
    Uniform(n_slots)            -> every slot equal
    DropLowest(n_slots, k)      -> k lowest-scoring slots drop to 0, rest equal
    RankWeights(slot_weights)   -> explicit per-slot points, assigned to items by
                                   score rank (best score gets the largest weight)
  DropLowest is just RankWeights with trailing zeros; Uniform is RankWeights with
  equal weights. They are kept as distinct, explicit rules for readability.
- Items carry score/max_score; only the *fraction* (score/max) matters for weighting.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Union


# --------------------------------------------------------------------------- #
# Rules
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Uniform:
    """Every slot in the category weighs equally."""

    n_slots: int


@dataclass(frozen=True)
class DropLowest:
    """`n_slots` slots; the `k` lowest-scoring drop to weight 0, the rest share equally."""

    n_slots: int
    k: int


@dataclass(frozen=True)
class RankWeights:
    """Explicit per-slot points (e.g. (7, 7, 7, 4)), assigned to items by score rank.

    The largest weight goes to the highest-scoring item (the rule rewards your
    better scores). Should sum to the owning category's `weight`.
    """

    slot_weights: tuple[float, ...]


@dataclass(frozen=True)
class FixedWeights:
    """Per-item FIXED weights: each item carries its own `weight` (POSITIONAL, not
    rank-assigned). Item i always contributes `item.weight` points regardless of how
    it scores relative to siblings — e.g. "three tests weighted 10%, 15%, 25%
    respectively". The rule itself holds no numbers; the weights live on the Items
    (see Item.weight). Item weights should sum to the owning category's `weight`.

    Contrast RankWeights, which SORTS weights onto items by score. Do NOT route
    FixedWeights through slot_weights_desc (it has no rule-level weights)."""


@dataclass(frozen=True)
class ReplaceLowest:
    """Per-item FIXED weights (like FixedWeights) with ONE item flagged `replacer`
    (the final). The replacer counts in its own slot AND, if it scores higher than
    the lowest graded non-replacer, that lowest item's fraction is lifted to the
    replacer's. The weights live on the Items; exactly one Item has replacer=True."""


Rule = Union[Uniform, DropLowest, RankWeights, FixedWeights, ReplaceLowest]


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
@dataclass
class Item:
    name: str
    score: float
    max_score: float
    weight: Optional[float] = None  # only meaningful when the category rule is FixedWeights
    replacer: bool = False  # only meaningful when the category rule is ReplaceLowest

    @property
    def fraction(self) -> float:
        if self.max_score <= 0:
            return 0.0
        return self.score / self.max_score


@dataclass
class Category:
    name: str
    weight: float  # points contributed to the 100-point course total
    rule: Rule
    items: list[Item] = field(default_factory=list)  # graded items only


@dataclass(frozen=True)
class Cutoff:
    letter: str
    min_pct: float  # inclusive lower bound, 0..100


@dataclass
class Course:
    name: str
    categories: list[Category] = field(default_factory=list)
    cutoffs: list[Cutoff] = field(default_factory=list)


@dataclass
class Standing:
    percent: Optional[float]  # grade on graded work so far; None if nothing graded
    letter: Optional[str]
    earned_points: float
    graded_weight: float  # weight of the slots actually graded (renormalization base)


@dataclass
class GoalSeekResult:
    status: str  # "ok" | "already_met" | "infeasible"
    needed_score: Optional[float]  # on the unknown item's own max scale
    needed_fraction: Optional[float]  # 0..1
    target_letter: str
    target_pct: float


# --------------------------------------------------------------------------- #
# Weight assignment
# --------------------------------------------------------------------------- #
def slot_weights_desc(rule: Rule, category_weight: float) -> list[float]:
    """Per-slot weights, largest first. Length == the rule's slot count."""
    if isinstance(rule, Uniform):
        if rule.n_slots <= 0:
            return []
        per = category_weight / rule.n_slots
        return [per] * rule.n_slots
    if isinstance(rule, DropLowest):
        kept = rule.n_slots - rule.k
        per = category_weight / kept if kept > 0 else 0.0
        weights = [per] * max(kept, 0) + [0.0] * rule.k
        return sorted(weights, reverse=True)
    if isinstance(rule, RankWeights):
        return sorted(rule.slot_weights, reverse=True)
    raise TypeError(f"unknown rule type: {type(rule)!r}")


def _earned_for_values(weights_desc: list[float], fractions: list[float]) -> float:
    """Assign the largest weights to the highest fractions; sum weight * fraction.

    zip() truncates to the shorter list:
      - more slots than items (ungraded slots) -> the extra (smallest) weights are
        simply not used (they contribute 0 until an item fills them).
      - more items than slots (a malformed rubric) -> extra items are ignored;
        validate_rubric() flags this case.
    """
    fr = sorted(fractions, reverse=True)
    return sum(w * f for w, f in zip(weights_desc, fr))


def _used_weight(weights_desc: list[float], n_items: int) -> float:
    """Sum of the weights actually assigned to `n_items` graded items (top n)."""
    fr = sorted(weights_desc, reverse=True)
    return sum(fr[:n_items])


# --------------------------------------------------------------------------- #
# Per-category earned / graded-weight (branches rank-based vs positional fixed)
# --------------------------------------------------------------------------- #
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


def _category_earned(cat: "Category") -> float:
    """Points earned in a category from its (graded) items."""
    if isinstance(cat.rule, ReplaceLowest):
        return _replace_lowest_slots([(it.weight or 0.0, it.replacer, it.fraction) for it in cat.items])
    if isinstance(cat.rule, FixedWeights):
        # POSITIONAL: each item contributes its OWN weight (no rank sorting).
        return sum((it.weight or 0.0) * it.fraction for it in cat.items)
    wts = slot_weights_desc(cat.rule, cat.weight)
    return _earned_for_values(wts, [it.fraction for it in cat.items])


def _category_graded_weight(cat: "Category") -> float:
    """Renormalization base: total weight of the graded slots in a category."""
    if isinstance(cat.rule, (FixedWeights, ReplaceLowest)):
        return sum((it.weight or 0.0) for it in cat.items)
    wts = slot_weights_desc(cat.rule, cat.weight)
    return _used_weight(wts, len(cat.items))


# --------------------------------------------------------------------------- #
# Cutoffs
# --------------------------------------------------------------------------- #
def letter_for(percent: Optional[float], cutoffs: list[Cutoff]) -> Optional[str]:
    if percent is None or not cutoffs:
        return None
    for c in sorted(cutoffs, key=lambda c: c.min_pct, reverse=True):
        if percent >= c.min_pct:
            return c.letter
    return None  # below the lowest defined cutoff


def min_pct_for_letter(letter: str, cutoffs: list[Cutoff]) -> Optional[float]:
    for c in cutoffs:
        if c.letter == letter:
            return c.min_pct
    return None


# --------------------------------------------------------------------------- #
# Current standing (grade on graded work so far)
# --------------------------------------------------------------------------- #
def compute_standing(course: Course) -> Standing:
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


# --------------------------------------------------------------------------- #
# Goal seek (single unknown item) - the piecewise solver
# --------------------------------------------------------------------------- #
#  total(x) as the unknown's fraction x rises from 0 -> 1:
#
#   points
#     ^                                         ____ slope = W[rank0]  (x is now the BEST)
#     |                                   _____/
#     |                          ________/  slope = W[rank1]
#     |                _________/
#     |          _____/  slope = W[rankN-1] (x is the WORST -> smallest weight)
#     +-------+--------+---------+----------+----> x
#            g3       g2        g1         g0   (other items' fractions = breakpoints
#                                                where x changes rank)
#
#  Between consecutive breakpoints total() is LINEAR, so we evaluate total() at the
#  breakpoints and interpolate exactly inside the interval that crosses the target.
#  total() is non-decreasing (a higher score never lowers your grade), so the first
#  crossing is the minimum needed score.
# --------------------------------------------------------------------------- #
def goal_seek(
    course: Course,
    target_letter: str,
    unknown_category: str,
    unknown_max_score: float,
    unknown_weight: Optional[float] = None,
) -> GoalSeekResult:
    """Minimum score on ONE ungraded item to reach `target_letter`.

    Treats every existing item as final (single-unknown solve). The unknown is an
    extra slot in `unknown_category`; its fraction x in [0, 1] is the variable.

    `unknown_weight` is REQUIRED for a FixedWeights unknown category (the ungraded
    item's own fixed weight); ignored for rank-based rules (weight comes from the rule).
    """
    target_pct = min_pct_for_letter(target_letter, course.cutoffs)
    if target_pct is None:
        raise ValueError(f"no cutoff defined for letter {target_letter!r}")

    # Fixed contribution from every category except the unknown's (branches per rule).
    fixed_other = 0.0
    unknown_cat: Optional[Category] = None
    for cat in course.categories:
        if cat.name == unknown_category and unknown_cat is None:
            unknown_cat = cat
            continue
        fixed_other += _category_earned(cat)
    if unknown_cat is None:
        raise ValueError(f"unknown_category {unknown_category!r} not found")
    if unknown_max_score <= 0:
        return GoalSeekResult("infeasible", None, None, target_letter, target_pct)

    # FixedWeights: the unknown item's weight is CONSTANT -> total(x) is linear, no
    # rank breakpoints. total(x) = fixed_other + (graded fixed items) + w_u * x.
    if isinstance(unknown_cat.rule, FixedWeights):
        if unknown_weight is None:
            raise ValueError("goal_seek on a FixedWeights category requires unknown_weight")
        base = fixed_other + _category_earned(unknown_cat)  # graded items already fixed
        w_u = float(unknown_weight)
        if base >= target_pct:
            return GoalSeekResult("already_met", 0.0, 0.0, target_letter, target_pct)
        if w_u <= 0 or base + w_u < target_pct:
            return GoalSeekResult("infeasible", None, None, target_letter, target_pct)
        x_star = (target_pct - base) / w_u
        return GoalSeekResult("ok", x_star * unknown_max_score, x_star, target_letter, target_pct)

    u_wts = slot_weights_desc(unknown_cat.rule, unknown_cat.weight)
    others = [it.fraction for it in unknown_cat.items]

    def total(x: float) -> float:
        return fixed_other + _earned_for_values(u_wts, others + [x])

    # Already met at the floor? Then 0 is enough.
    if total(0.0) >= target_pct:
        return GoalSeekResult("already_met", 0.0, 0.0, target_letter, target_pct)
    # Unreachable even at a perfect score?
    if total(1.0) < target_pct:
        return GoalSeekResult("infeasible", None, None, target_letter, target_pct)

    # Piecewise-linear scan over breakpoints (rank flips at the other fractions).
    breakpoints = sorted({0.0, 1.0, *(min(max(f, 0.0), 1.0) for f in others)})
    for a, b in zip(breakpoints, breakpoints[1:]):
        ta, tb = total(a), total(b)
        if tb < target_pct:
            continue  # target not reached by the end of this piece
        if tb == ta:
            # Flat piece that is already >= target would have been caught above;
            # a flat piece below target is skipped by the `tb < target` guard.
            x_star = a
        else:
            x_star = a + (target_pct - ta) * (b - a) / (tb - ta)
        return GoalSeekResult(
            "ok", x_star * unknown_max_score, x_star, target_letter, target_pct
        )

    # Should be unreachable given the feasibility guards above.
    return GoalSeekResult("infeasible", None, None, target_letter, target_pct)


# --------------------------------------------------------------------------- #
# Rubric validation (non-blocking warnings, per design decision D7)
# --------------------------------------------------------------------------- #
def validate_rubric(course: Course, tol: float = 0.01) -> list[str]:
    """Return human-readable warnings. NEVER raises - the UI shows these and the
    student resolves them in the editor; a rubric is never auto-rejected."""
    warnings: list[str] = []

    total_weight = sum(c.weight for c in course.categories)
    if abs(total_weight - 100.0) > tol:
        warnings.append(
            f"Category weights sum to {total_weight:g}, not 100."
        )

    for cat in course.categories:
        if isinstance(cat.rule, RankWeights):
            s = sum(cat.rule.slot_weights)
            if abs(s - cat.weight) > tol:
                warnings.append(
                    f"'{cat.name}': rank weights sum to {s:g} but the category weight is {cat.weight:g}."
                )
            n_slots = len(cat.rule.slot_weights)
        elif isinstance(cat.rule, Uniform):
            n_slots = cat.rule.n_slots
        elif isinstance(cat.rule, DropLowest):
            n_slots = cat.rule.n_slots
            if cat.rule.k >= cat.rule.n_slots:
                warnings.append(
                    f"'{cat.name}': drops {cat.rule.k} of {cat.rule.n_slots} slots - nothing would count."
                )
        elif isinstance(cat.rule, FixedWeights):
            # Weights live on the items; they should sum to the category weight.
            s = sum((it.weight or 0.0) for it in cat.items)
            if cat.items and abs(s - cat.weight) > tol:
                warnings.append(
                    f"'{cat.name}': item weights sum to {s:g} but the category weight is {cat.weight:g}."
                )
            n_slots = len(cat.items)  # items ARE the slots here
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
        else:
            n_slots = 0

        if n_slots <= 0:
            warnings.append(f"'{cat.name}': has no slots.")
        if len(cat.items) > n_slots:
            warnings.append(
                f"'{cat.name}': {len(cat.items)} items entered but only {n_slots} slots."
            )

    if not course.cutoffs:
        warnings.append("No letter-grade cutoffs defined.")

    return warnings
