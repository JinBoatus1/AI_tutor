// T5 — deterministic grading for the four auto-graded formats. No React, no I/O.
import type {
  McqQuestion,
  FillBlankQuestion,
  SpotFlawQuestion,
  ProofOrderQuestion,
  ProofOrderStep,
} from "./types";

export function gradeMcq(q: McqQuestion, choiceIndex: number): boolean {
  return choiceIndex === q.answerIndex;
}

export function gradeSpotFlaw(q: SpotFlawQuestion, lineId: string): boolean {
  return lineId === q.flawLineId;
}

/** Trim, lowercase, collapse internal whitespace, and strip $...$ latex delimiters. */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\s+/g, " ");
}

export function gradeFillBlank(q: FillBlankQuestion, input: string): boolean {
  const got = normalizeAnswer(input);
  return q.accept.some((a) => normalizeAnswer(a) === got);
}

/**
 * Proof-order grading (design D9). `order` is the student's sequence of step ids.
 * Correct iff `order` is a VALID TOPOLOGICAL ORDER of the dependency DAG: it is a
 * permutation of all steps, and every step's `deps` appear strictly before it.
 * This accepts every valid ordering, so commutable steps never get marked wrong.
 */
export function isValidTopoOrder(steps: ProofOrderStep[], order: string[]): boolean {
  const ids = steps.map((s) => s.id);

  // Must be a permutation of all step ids (right length, no dups, same members).
  if (order.length !== ids.length) return false;
  const seen = new Set(order);
  if (seen.size !== order.length) return false;
  if (!ids.every((id) => seen.has(id))) return false;

  const pos = new Map(order.map((id, i) => [id, i] as const));
  for (const step of steps) {
    for (const dep of step.deps) {
      const depPos = pos.get(dep);
      const stepPos = pos.get(step.id);
      // Malformed data (dep id not in the set) -> not gradeable as correct.
      if (depPos === undefined || stepPos === undefined) return false;
      if (depPos >= stepPos) return false; // dependency must come strictly before
    }
  }
  return true;
}

export function gradeProofOrder(q: ProofOrderQuestion, order: string[]): boolean {
  return isValidTopoOrder(q.steps, order);
}
