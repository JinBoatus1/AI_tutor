"""Wire (frontend / stored) JSON  ->  grades_math compute dataclasses.

The STORED / WIRE doc is the RICH frontend shape (see frontend/src/grades/mockEngine.ts):
  Item  = { id, name, score: number | null, maxScore }
  Rule  = { kind: "uniform",     nSlots }
        | { kind: "dropLowest",  nSlots, k }
        | { kind: "rankWeights", weights: number[] }
  Cutoff = { letter, min }
  Course = { name, term, categories: Category[], cutoffs: Cutoff[] }

grades_math is the PURE compute model: no ids, no term, `score` is a required float,
snake_case, and Rule is a tagged union of dataclasses.

This module PROJECTS the wire doc down to grades_math for COMPUTATION ONLY. It deliberately:
  - drops item ``id`` and ``course.term``  (not needed to compute a grade)
  - STRIPS null-score items  -> an ungraded placeholder (e.g. a Final not taken yet) must
    NOT be counted as 0, which would crater the standing
  - maps camelCase -> dataclass, ``min`` -> ``min_pct``, ``maxScore`` -> ``max_score``,
    and the ``kind`` tag -> the corresponding Rule dataclass

The rich wire doc itself is stored VERBATIM by grade_store; these dataclasses are an
intermediate compute representation and are never persisted. That is why this module is
one-directional (wire -> dataclass): reconstructing a wire doc from a dataclass would lose
the ids/term/null-scores on purpose, so we never do it.
"""

from __future__ import annotations

from typing import Any, Optional

import grades_math as gm


class SerdeError(ValueError):
    """Raised when a wire doc is malformed (bad type, unknown rule kind, missing field)."""


# --------------------------------------------------------------------------- #
# Small typed accessors (explicit > clever: every field is checked once)
# --------------------------------------------------------------------------- #
def _require_dict(value: Any, what: str) -> dict:
    if not isinstance(value, dict):
        raise SerdeError(f"{what} must be an object, got {type(value).__name__}")
    return value


def _require_str(value: Any, what: str) -> str:
    if not isinstance(value, str):
        raise SerdeError(f"{what} must be a string, got {type(value).__name__}")
    return value


def _require_number(value: Any, what: str) -> float:
    # bool is an int subclass; reject it so a stray True/False can't become 1.0/0.0.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SerdeError(f"{what} must be a number, got {type(value).__name__}")
    return float(value)


def _require_int(value: Any, what: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise SerdeError(f"{what} must be an integer, got {type(value).__name__}")
    return value


def _require_list(value: Any, what: str) -> list:
    if not isinstance(value, list):
        raise SerdeError(f"{what} must be a list, got {type(value).__name__}")
    return value


# --------------------------------------------------------------------------- #
# Rule
# --------------------------------------------------------------------------- #
def rule_from_wire(data: Any, *, where: str = "rule") -> gm.Rule:
    d = _require_dict(data, where)
    kind = d.get("kind")
    if kind == "uniform":
        return gm.Uniform(n_slots=_require_int(d.get("nSlots"), f"{where}.nSlots"))
    if kind == "dropLowest":
        return gm.DropLowest(
            n_slots=_require_int(d.get("nSlots"), f"{where}.nSlots"),
            k=_require_int(d.get("k"), f"{where}.k"),
        )
    if kind == "rankWeights":
        weights = _require_list(d.get("weights"), f"{where}.weights")
        return gm.RankWeights(
            slot_weights=tuple(_require_number(w, f"{where}.weights[{i}]") for i, w in enumerate(weights))
        )
    if kind == "fixedWeights":
        # Weights live on the items (Item.weight), not on the rule.
        return gm.FixedWeights()
    if kind == "replaceLowest":
        return gm.ReplaceLowest()
    raise SerdeError(
        f"{where}: unknown rule kind {kind!r} (expected uniform|dropLowest|rankWeights|fixedWeights|replaceLowest)"
    )


# --------------------------------------------------------------------------- #
# Item  (returns None for a null-score item so the caller can strip it)
# --------------------------------------------------------------------------- #
def item_from_wire(data: Any, *, where: str = "item") -> Optional[gm.Item]:
    d = _require_dict(data, where)
    score = d.get("score")
    if score is None:
        return None  # ungraded placeholder -> excluded from the compute model
    raw_weight = d.get("weight")
    return gm.Item(
        name=_require_str(d.get("name", ""), f"{where}.name") if d.get("name") is not None else "",
        score=_require_number(score, f"{where}.score"),
        max_score=_require_number(d.get("maxScore"), f"{where}.maxScore"),
        weight=_require_number(raw_weight, f"{where}.weight") if raw_weight is not None else None,
        replacer=bool(d.get("replacer", False)),
    )


# --------------------------------------------------------------------------- #
# Category
# --------------------------------------------------------------------------- #
def category_from_wire(data: Any, *, where: str = "category") -> gm.Category:
    d = _require_dict(data, where)
    raw_items = _require_list(d.get("items", []), f"{where}.items")
    graded: list[gm.Item] = []
    for i, raw in enumerate(raw_items):
        it = item_from_wire(raw, where=f"{where}.items[{i}]")
        if it is not None:  # strip null-score placeholders (D6)
            graded.append(it)
    return gm.Category(
        name=_require_str(d.get("name", ""), f"{where}.name") if d.get("name") is not None else "",
        weight=_require_number(d.get("weight"), f"{where}.weight"),
        rule=rule_from_wire(d.get("rule"), where=f"{where}.rule"),
        items=graded,
    )


# --------------------------------------------------------------------------- #
# Cutoff
# --------------------------------------------------------------------------- #
def cutoff_from_wire(data: Any, *, where: str = "cutoff") -> gm.Cutoff:
    d = _require_dict(data, where)
    return gm.Cutoff(
        letter=_require_str(d.get("letter"), f"{where}.letter"),
        min_pct=_require_number(d.get("min"), f"{where}.min"),
    )


# --------------------------------------------------------------------------- #
# WeightSchemes  (course-level alternate weighting schemes)
# --------------------------------------------------------------------------- #
def weightings_from_wire(data: Any, categories_wire: list, *, where: str = "course.weightings") -> list["gm.WeightScheme"]:
    """Parse alternate weighting schemes. Wire: [{name, weights: {categoryId: number}}]. Resolves each
    scheme's id-keyed weights to a POSITIONAL list aligned to `categories_wire` (grades_math schemes are
    positional); a category omitted by a scheme falls back to its own primary weight."""
    raw = data.get("weightings")
    if raw is None:
        return []  # absent key = no alternate schemes; a non-list value falls through to _require_list -> SerdeError
    cat_ids = [str(_require_dict(c, f"{where}.category").get("id", "")) for c in categories_wire]
    cat_weights = [_require_number(_require_dict(c, f"{where}.category").get("weight"), f"{where}.category.weight")
                   for c in categories_wire]
    schemes: list[gm.WeightScheme] = []
    for i, s in enumerate(_require_list(raw, where)):
        sd = _require_dict(s, f"{where}[{i}]")
        wmap = sd.get("weights")
        if wmap is None:
            wmap = {}  # a scheme may omit weights entirely -> all categories fall back to primary
        elif not isinstance(wmap, dict):
            raise SerdeError(f"{where}[{i}].weights must be an object")
        weights = [
            _require_number(wmap[cid], f"{where}[{i}].weights[{cid}]") if cid in wmap else cat_weights[j]
            for j, cid in enumerate(cat_ids)
        ]
        schemes.append(gm.WeightScheme(name=str(sd.get("name", "")), weights=weights))
    return schemes


# --------------------------------------------------------------------------- #
# Course  (the projection entry point)
# --------------------------------------------------------------------------- #
def course_from_wire(data: Any, *, where: str = "course") -> gm.Course:
    """Project a rich wire/stored course dict down to a grades_math.Course for compute.

    Drops id/term, strips null-score items. Raises SerdeError on malformed input.
    """
    d = _require_dict(data, where)
    categories_wire = _require_list(d.get("categories", []), f"{where}.categories")
    categories = [
        category_from_wire(c, where=f"{where}.categories[{i}]")
        for i, c in enumerate(categories_wire)
    ]
    cutoffs = [
        cutoff_from_wire(c, where=f"{where}.cutoffs[{i}]")
        for i, c in enumerate(_require_list(d.get("cutoffs", []), f"{where}.cutoffs"))
    ]
    name = d.get("name")
    return gm.Course(
        name=_require_str(name, f"{where}.name") if name is not None else "",
        categories=categories,
        cutoffs=cutoffs,
        weightings=weightings_from_wire(d, categories_wire, where=f"{where}.weightings"),
    )


# --------------------------------------------------------------------------- #
# Convenience: look up a wire item's category name + max_score by item id.
# Needed by the goal-seek route (T3): the unknown is a null-score item that
# course_from_wire has already stripped, so its max_score must come from the
# raw wire doc.
# --------------------------------------------------------------------------- #
def find_wire_item(data: Any, item_id: str) -> Optional[tuple[str, float, Optional[float], bool]]:
    """Return (category_name, max_score, weight, replacer) for the wire item whose id == item_id, else None.

    `weight` is the item's own fixed weight (present only for FixedWeights/ReplaceLowest categories);
    the goal-seek route passes it through as goal_seek's `unknown_weight`.
    `replacer` is the item's replacer flag, passed through as goal_seek's `unknown_is_replacer`.
    """
    d = _require_dict(data, "course")
    for c in _require_list(d.get("categories", []), "course.categories"):
        cd = _require_dict(c, "category")
        cat_name = str(cd.get("name", ""))
        for it in _require_list(cd.get("items", []), "category.items"):
            itd = _require_dict(it, "item")
            if itd.get("id") == item_id:
                raw_w = itd.get("weight")
                weight = _require_number(raw_w, "item.weight") if raw_w is not None else None
                replacer = bool(itd.get("replacer", False))
                return cat_name, _require_number(itd.get("maxScore"), "item.maxScore"), weight, replacer
    return None
