// Pure rubric-editing helpers for the RubricEditor redesign (spec 2026-07-02).
//
// The editor's central shift: the ITEM ROWS are the authoritative slot list. The rule
// only carries the mode (+ its own params); the number of slots is derived from the item
// rows. So editing rows here pre-creates gradebook items (score=null) that the gradebook
// can fill immediately (fixes gap 3). These functions keep `rule` consistent with `items`.
//
// Kept as pure Course->Course / Category->Category transforms so they unit-test in node
// (no jsdom); RubricEditor.tsx is a thin view over them.

import type { Category, Course, Item, Rule, WeightScheme } from "./types";

// The three modes the editor exposes. `rankWeights` is preserved in the model but not a
// selectable mode (rare score-rank rubrics from the old editor); see activeMode().
export type ScoringMode = "uniform" | "dropLowest" | "fixedWeights" | "replaceLowest";

// --------------------------------------------------------------------------- //
// ids
// --------------------------------------------------------------------------- //
let _seq = 0;
export const genId = (prefix = "it"): string =>
  `${prefix}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

// --------------------------------------------------------------------------- //
// rule <-> mode
// --------------------------------------------------------------------------- //
/** The selected mode, or null for a legacy rank-weights rule (no button highlighted). */
export function activeMode(rule: Rule): ScoringMode | null {
  if (rule.kind === "dropLowest") return "dropLowest";
  if (rule.kind === "fixedWeights") return "fixedWeights";
  if (rule.kind === "replaceLowest") return "replaceLowest";
  if (rule.kind === "uniform") return "uniform";
  return null; // rankWeights — legacy, not editor-exposed
}

/** Slot count IMPLIED by a rule (used only to materialize rows on parse-confirm). For
 *  fixedWeights the count comes from the items themselves, so this returns 0. */
export function slotCountOf(rule: Rule): number {
  switch (rule.kind) {
    case "uniform":
      return rule.nSlots;
    case "dropLowest":
      return rule.nSlots;
    case "rankWeights":
      return rule.weights.length;
    case "replaceLowest":
    case "fixedWeights":
      return 0;
  }
}

// --------------------------------------------------------------------------- //
// weight helpers
// --------------------------------------------------------------------------- //
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Split `total` into `n` weights that sum EXACTLY to total (rounding drift on the first). */
export function evenWeights(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = round2(total / n);
  const arr = Array<number>(n).fill(each);
  arr[0] = round2(arr[0] + (total - each * n));
  return arr;
}

/** Sum of per-item fixed weights in a category (0 for missing weights). */
export const itemWeightSum = (cat: Category): number =>
  round2(cat.items.reduce((s, it) => s + (it.weight ?? 0), 0));

/** Sum of category weights across the course (for the global "should be 100%" chip). */
export const categoryWeightSum = (course: Course): number =>
  round2(course.categories.reduce((s, c) => s + c.weight, 0));

// --------------------------------------------------------------------------- //
// items
// --------------------------------------------------------------------------- //
export function newItem(name: string, weight?: number): Item {
  return { id: genId(), name, score: null, maxScore: 100, ...(weight != null ? { weight } : {}) };
}

/** Keep `rule` consistent with the current item rows after an add/remove.
 *  - uniform / dropLowest: nSlots tracks the row count (clamp dropLowest.k in range).
 *  - fixedWeights / rankWeights: unchanged (weights live on items / are legacy). */
export function syncSlots(cat: Category): Category {
  const n = cat.items.length;
  if (cat.rule.kind === "uniform") return { ...cat, rule: { kind: "uniform", nSlots: n } };
  if (cat.rule.kind === "dropLowest") {
    const k = Math.min(Math.max(cat.rule.k, 0), Math.max(0, n - 1));
    return { ...cat, rule: { kind: "dropLowest", nSlots: n, k } };
  }
  return cat;
}

export function addItem(cat: Category): Category {
  const isFixed = cat.rule.kind === "fixedWeights" || cat.rule.kind === "replaceLowest";
  const row = newItem(`Item ${cat.items.length + 1}`, isFixed ? 0 : undefined);
  return syncSlots({ ...cat, items: [...cat.items, row] });
}

export function removeItem(cat: Category, itemId: string): Category {
  return syncSlots({ ...cat, items: cat.items.filter((it) => it.id !== itemId) });
}

// --------------------------------------------------------------------------- //
// mode switch (reconciles rule + item weights)
// --------------------------------------------------------------------------- //
export function setMode(cat: Category, mode: ScoringMode): Category {
  const n = cat.items.length;
  if (mode === "uniform") {
    return { ...cat, rule: { kind: "uniform", nSlots: n } };
  }
  if (mode === "dropLowest") {
    const prevK = cat.rule.kind === "dropLowest" ? cat.rule.k : 1;
    const k = Math.min(Math.max(prevK, 0), Math.max(0, n - 1));
    return { ...cat, rule: { kind: "dropLowest", nSlots: n, k } };
  }
  // fixedWeights / replaceLowest: ensure every item carries a weight (even-split seed).
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
}

/** Flag exactly one item as the replacer (the final); clear the rest. */
export function setReplacer(cat: Category, itemId: string): Category {
  return { ...cat, items: cat.items.map((it) => ({ ...it, replacer: it.id === itemId })) };
}

// --------------------------------------------------------------------------- //
// weighting schemes
// --------------------------------------------------------------------------- //
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

/** Keep schemes aligned when a category is added/removed: rebuild each scheme's weights to exactly
 *  the current categories (new cats seed their own weight; removed cats drop out). */
export function syncSchemes(course: Course): Course {
  if (!course.weightings?.length) return course;
  const weightings = course.weightings.map((s) => {
    const weights: Record<string, number> = {};
    for (const cat of course.categories) weights[cat.id] = s.weights[cat.id] ?? cat.weight;
    return { ...s, weights };
  });
  return { ...course, weightings };
}

// --------------------------------------------------------------------------- //
// categories
// --------------------------------------------------------------------------- //
export function addCategory(course: Course): Course {
  const cat: Category = {
    id: genId("cat"),
    name: `Category ${course.categories.length + 1}`,
    weight: 0,
    rule: { kind: "uniform", nSlots: 0 },
    items: [],
  };
  return syncSchemes({ ...course, categories: [...course.categories, cat] });
}

export function removeCategory(course: Course, catId: string): Course {
  return syncSchemes({ ...course, categories: course.categories.filter((c) => c.id !== catId) });
}

/** True if a category holds any entered score — deleting it should be confirmed (T5). */
export const hasEnteredScores = (cat: Category): boolean =>
  cat.items.some((it) => it.score != null);

// --------------------------------------------------------------------------- //
// materialization (T3): pre-generate fillable rows so the gradebook is usable at once
// --------------------------------------------------------------------------- //
/** Ensure each category has at least the rows its rule implies. Appends placeholder rows
 *  (score=null) — never removes or reorders existing rows, never touches scores. Applied
 *  on syllabus parse-confirm so a parsed 3-test course lands with 3 fillable rows. */
export function materializeCourse(course: Course): Course {
  return {
    ...course,
    categories: course.categories.map((cat) => {
      const want = slotCountOf(cat.rule);
      if (cat.items.length >= want) return cat;
      const extra: Item[] = [];
      for (let i = cat.items.length; i < want; i++) extra.push(newItem(`Item ${i + 1}`));
      return { ...cat, items: [...cat.items, ...extra] };
    }),
  };
}
