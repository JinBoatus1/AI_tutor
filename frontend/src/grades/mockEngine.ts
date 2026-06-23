// PREVIEW MOCK of the backend grades_math engine (Python).
// This recomputes standing + goal-seek CLIENT-SIDE so the mock page is interactive.
// When the backend is wired, DELETE this and call GET /api/courses/{id}/standing —
// the real numbers are server-authoritative (eng review D4); never ship client math.

export type Rule =
  | { kind: "uniform"; nSlots: number }
  | { kind: "dropLowest"; nSlots: number; k: number }
  | { kind: "rankWeights"; weights: number[] }; // absolute per-slot points

export type Item = { id: string; name: string; score: number | null; maxScore: number };
export type Category = { id: string; name: string; weight: number; rule: Rule; items: Item[] };
export type Cutoff = { letter: string; min: number };
export type Course = { name: string; term: string; categories: Category[]; cutoffs: Cutoff[] };

export function slotWeightsDesc(rule: Rule, weight: number): number[] {
  if (rule.kind === "uniform") {
    if (rule.nSlots <= 0) return [];
    return Array(rule.nSlots).fill(weight / rule.nSlots);
  }
  if (rule.kind === "dropLowest") {
    const kept = rule.nSlots - rule.k;
    const per = kept > 0 ? weight / kept : 0;
    return [...Array(Math.max(kept, 0)).fill(per), ...Array(rule.k).fill(0)].sort((a, b) => b - a);
  }
  return [...rule.weights].sort((a, b) => b - a);
}

const frac = (it: Item) => (it.maxScore <= 0 || it.score == null ? 0 : it.score / it.maxScore);

function earnedForValues(weightsDesc: number[], fractions: number[]): number {
  const fr = [...fractions].sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < Math.min(weightsDesc.length, fr.length); i++) sum += weightsDesc[i] * fr[i];
  return sum;
}

export function letterFor(pct: number | null, cutoffs: Cutoff[]): string | null {
  if (pct == null) return null;
  for (const c of [...cutoffs].sort((a, b) => b.min - a.min)) if (pct >= c.min) return c.letter;
  return null;
}

export function computeStanding(course: Course): { percent: number | null; letter: string | null } {
  let earned = 0;
  let gradedWeight = 0;
  for (const cat of course.categories) {
    const wts = slotWeightsDesc(cat.rule, cat.weight);
    const graded = cat.items.filter((it) => it.score != null);
    earned += earnedForValues(wts, graded.map(frac));
    gradedWeight += [...wts].sort((a, b) => b - a).slice(0, graded.length).reduce((a, b) => a + b, 0);
  }
  if (gradedWeight <= 0) return { percent: null, letter: null };
  const percent = (earned / gradedWeight) * 100;
  return { percent, letter: letterFor(percent, course.cutoffs) };
}

export type GoalResult = { status: "ok" | "locked" | "unreachable"; needed: number | null };

// Minimum score on ONE ungraded item to reach targetLetter (single-unknown, piecewise).
export function goalSeek(
  course: Course,
  targetLetter: string,
  categoryName: string,
  unknownItemId: string,
): GoalResult {
  const target = course.cutoffs.find((c) => c.letter === targetLetter)?.min;
  if (target == null) return { status: "unreachable", needed: null };

  let fixedOther = 0;
  let unknownCat: Category | undefined;
  for (const cat of course.categories) {
    if (cat.name === categoryName && !unknownCat) {
      unknownCat = cat;
      continue;
    }
    fixedOther += earnedForValues(
      slotWeightsDesc(cat.rule, cat.weight),
      cat.items.filter((i) => i.score != null).map(frac),
    );
  }
  if (!unknownCat) return { status: "unreachable", needed: null };
  const unknown = unknownCat.items.find((i) => i.id === unknownItemId);
  if (!unknown || unknown.maxScore <= 0) return { status: "unreachable", needed: null };

  const uWts = slotWeightsDesc(unknownCat.rule, unknownCat.weight);
  const others = unknownCat.items.filter((i) => i.id !== unknownItemId && i.score != null).map(frac);
  const total = (x: number) => fixedOther + earnedForValues(uWts, [...others, x]);

  if (total(0) >= target) return { status: "locked", needed: 0 };
  if (total(1) < target) return { status: "unreachable", needed: null };

  const bps = Array.from(new Set([0, 1, ...others.map((f) => Math.min(Math.max(f, 0), 1))])).sort(
    (a, b) => a - b,
  );
  for (let i = 0; i < bps.length - 1; i++) {
    const a = bps[i];
    const b = bps[i + 1];
    const ta = total(a);
    const tb = total(b);
    if (tb < target) continue;
    const x = tb === ta ? a : a + ((target - ta) * (b - a)) / (tb - ta);
    return { status: "ok", needed: x * unknown.maxScore };
  }
  return { status: "unreachable", needed: null };
}

export function weightsSum(course: Course): number {
  return course.categories.reduce((s, c) => s + c.weight, 0);
}
