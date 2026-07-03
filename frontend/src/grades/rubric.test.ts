import { describe, it, expect } from "vitest";
import {
  activeMode,
  addCategory,
  addItem,
  categoryWeightSum,
  evenWeights,
  hasEnteredScores,
  itemWeightSum,
  materializeCourse,
  newItem,
  removeCategory,
  removeItem,
  setMode,
  slotCountOf,
  syncSlots,
} from "./rubric";
import type { Category, Course } from "./types";

const cat = (over: Partial<Category> = {}): Category => ({
  id: "c1",
  name: "Tests",
  weight: 50,
  rule: { kind: "uniform", nSlots: 0 },
  items: [],
  ...over,
});

describe("activeMode / slotCountOf", () => {
  it("maps each editable rule to its mode", () => {
    expect(activeMode({ kind: "uniform", nSlots: 3 })).toBe("uniform");
    expect(activeMode({ kind: "dropLowest", nSlots: 3, k: 1 })).toBe("dropLowest");
    expect(activeMode({ kind: "fixedWeights" })).toBe("fixedWeights");
  });
  it("returns null for a legacy rank rule (not editor-exposed)", () => {
    expect(activeMode({ kind: "rankWeights", weights: [7, 7, 4] })).toBeNull();
  });
  it("slotCountOf: fixedWeights count comes from items, so rule implies 0", () => {
    expect(slotCountOf({ kind: "uniform", nSlots: 4 })).toBe(4);
    expect(slotCountOf({ kind: "dropLowest", nSlots: 5, k: 1 })).toBe(5);
    expect(slotCountOf({ kind: "rankWeights", weights: [7, 7, 4] })).toBe(3);
    expect(slotCountOf({ kind: "fixedWeights" })).toBe(0);
  });
});

describe("evenWeights", () => {
  it("splits into n weights summing EXACTLY to total", () => {
    expect(evenWeights(50, 2)).toEqual([25, 25]);
    const three = evenWeights(100, 3);
    expect(three).toHaveLength(3);
    expect(three.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });
  it("returns [] for n<=0", () => {
    expect(evenWeights(50, 0)).toEqual([]);
  });
});

describe("add/remove item keeps nSlots in sync (rows ARE slots)", () => {
  it("uniform nSlots tracks the row count", () => {
    let c = cat();
    c = addItem(c);
    c = addItem(c);
    expect(c.items).toHaveLength(2);
    expect(c.rule).toEqual({ kind: "uniform", nSlots: 2 });
    c = removeItem(c, c.items[0].id);
    expect(c.items).toHaveLength(1);
    expect(c.rule).toEqual({ kind: "uniform", nSlots: 1 });
  });
  it("dropLowest clamps k to at most rows-1", () => {
    let c = cat({ rule: { kind: "dropLowest", nSlots: 3, k: 2 }, items: [newItem("a"), newItem("b"), newItem("c")] });
    c = syncSlots(c);
    expect(c.rule).toEqual({ kind: "dropLowest", nSlots: 3, k: 2 });
    // remove down to one row -> k must clamp to 0
    c = removeItem(c, c.items[0].id);
    c = removeItem(c, c.items[0].id);
    expect(c.items).toHaveLength(1);
    expect(c.rule).toEqual({ kind: "dropLowest", nSlots: 1, k: 0 });
  });
});

describe("setMode", () => {
  it("Custom (fixedWeights) lets 10/15/25 live in ONE category", () => {
    // three named rows, switch to custom, set distinct weights
    let c = cat({ weight: 50, items: [newItem("Test #1"), newItem("Test #2"), newItem("Test #3")] });
    c = setMode(c, "fixedWeights");
    expect(c.rule).toEqual({ kind: "fixedWeights" });
    // seeded with an even split first...
    expect(itemWeightSum(c)).toBeCloseTo(50, 6);
    // ...then the user edits them to the syllabus's distinct weights
    c = { ...c, items: c.items.map((it, i) => ({ ...it, weight: [10, 15, 25][i] })) };
    expect(c.items.map((it) => it.weight)).toEqual([10, 15, 25]);
    expect(itemWeightSum(c)).toBe(50);
  });
  it("preserves existing scores when switching modes", () => {
    let c = cat({ items: [{ id: "x", name: "E1", score: 88, maxScore: 100 }] });
    c = setMode(c, "fixedWeights");
    expect(c.items[0].score).toBe(88);
    c = setMode(c, "dropLowest");
    expect(c.items[0].score).toBe(88);
    expect(c.rule.kind).toBe("dropLowest");
  });
  it("switching to fixedWeights keeps weights already present", () => {
    const c = cat({
      items: [newItem("a", 30), newItem("b", 20)],
      rule: { kind: "uniform", nSlots: 2 },
    });
    const out = setMode(c, "fixedWeights");
    expect(out.items.map((it) => it.weight)).toEqual([30, 20]);
  });
});

describe("categories", () => {
  it("addCategory / removeCategory", () => {
    let course: Course = { name: "X", term: "", categories: [], cutoffs: [] };
    course = addCategory(course);
    expect(course.categories).toHaveLength(1);
    expect(course.categories[0].rule).toEqual({ kind: "uniform", nSlots: 0 });
    const id = course.categories[0].id;
    course = removeCategory(course, id);
    expect(course.categories).toHaveLength(0);
  });
  it("categoryWeightSum totals the category weights", () => {
    const course: Course = {
      name: "X",
      term: "",
      categories: [cat({ id: "a", weight: 40 }), cat({ id: "b", weight: 60 })],
      cutoffs: [],
    };
    expect(categoryWeightSum(course)).toBe(100);
  });
  it("hasEnteredScores flags a category with any graded item", () => {
    expect(hasEnteredScores(cat({ items: [newItem("a")] }))).toBe(false);
    expect(hasEnteredScores(cat({ items: [{ id: "x", name: "a", score: 1, maxScore: 10 }] }))).toBe(true);
  });
});

describe("materializeCourse (T3 pre-generate fillable rows)", () => {
  it("a parsed 3-test uniform category lands with 3 fillable rows", () => {
    const course: Course = {
      name: "Logic",
      term: "",
      categories: [cat({ rule: { kind: "uniform", nSlots: 3 }, items: [] })],
      cutoffs: [],
    };
    const out = materializeCourse(course);
    expect(out.categories[0].items).toHaveLength(3);
    expect(out.categories[0].items.every((it) => it.score === null)).toBe(true);
  });
  it("does not touch a category that already has enough rows (and preserves scores)", () => {
    const course: Course = {
      name: "X",
      term: "",
      categories: [
        cat({ rule: { kind: "uniform", nSlots: 2 }, items: [{ id: "e1", name: "E1", score: 91, maxScore: 100 }, newItem("E2")] }),
      ],
      cutoffs: [],
    };
    const out = materializeCourse(course);
    expect(out.categories[0].items).toHaveLength(2);
    expect(out.categories[0].items[0].score).toBe(91);
  });
  it("fixedWeights rows come from items, so materialize is a no-op on them", () => {
    const course: Course = {
      name: "X",
      term: "",
      categories: [cat({ rule: { kind: "fixedWeights" }, items: [newItem("Test #1", 10)] })],
      cutoffs: [],
    };
    const out = materializeCourse(course);
    expect(out.categories[0].items).toHaveLength(1);
  });
});
