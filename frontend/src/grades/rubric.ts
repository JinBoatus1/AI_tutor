// Pure rubric-editing helpers for the RubricEditor redesign (spec 2026-07-02).
//
// The editor's central shift: the ITEM ROWS are the authoritative slot list. The rule
// only carries the mode (+ its own params); the number of slots is derived from the item
// rows. So editing rows here pre-creates gradebook items (score=null) that the gradebook
// can fill immediately (fixes gap 3). These functions keep `rule` consistent with `items`.
//
// Kept as pure Course->Course / Category->Category transforms so they unit-test in node
// (no jsdom); RubricEditor.tsx is a thin view over them.

import type { Category, Course, Item, Rule } from "./types";

// The three modes the editor exposes. `rankWeights` is preserved in the model but not a
// selectable mode (rare score-rank rubrics from the old editor); see activeMode().
export type ScoringMode = "uniform" | "dropLowest" | "fixedWeights";

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
  const isFixed = cat.rule.kind === "fixedWeights";
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
  // fixedWeights: ensure every item carries a weight. Preserve any existing weights;
  // seed the rest with an even split of the category weight so the sum starts sensible.
  const missing = cat.items.some((it) => it.weight == null);
  let items = cat.items;
  if (missing && n > 0) {
    const seed = evenWeights(cat.weight, n);
    items = cat.items.map((it, i) => ({ ...it, weight: it.weight ?? seed[i] }));
  }
  return { ...cat, rule: { kind: "fixedWeights" }, items };
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
  return { ...course, categories: [...course.categories, cat] };
}

export function removeCategory(course: Course, catId: string): Course {
  return { ...course, categories: course.categories.filter((c) => c.id !== catId) };
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
