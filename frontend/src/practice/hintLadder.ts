// T6 — hint-ladder rung logic + prompt construction. No React, no I/O.
// The challengeChat client (T7) sends buildHintPrompt() output to /api/chat.
import type { ChallengeProblem } from "./types";

export type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** L0 is the attempt gate; L1..L6 produce prompts. */
export interface LadderState {
  rung: Rung;
  attempted: boolean;
}

export function initialLadder(): LadderState {
  return { rung: 0, attempted: false };
}

/** The canonical solution is included in the prompt only at this rung and above. */
export const SOLUTION_VISIBLE_FROM: Rung = 4;

const RUNG_RULES: Record<Rung, string> = {
  0: "",
  1: "Give ONLY brief encouragement and one Socratic refocus question. Reveal no content.",
  2: "Name the proof technique or key concept to consider. Do NOT give steps, algebra, variables, or the answer.",
  3: "Point the student to the relevant FOCS textbook section by number. Do NOT give steps or the answer.",
  4: "Set up ONLY the first step, then hand it back and ask the student to continue. Do not finish the proof.",
  5: "Give the full step-by-step proof, pausing after each step to ask the student why that step works.",
  6: "Give the final, complete proof.",
};

/**
 * Record the student's attempt. This is the effort gate (L0): substantive hints
 * (L2+) do not unlock until the student has shown work. The first attempt moves
 * an un-started ladder from L0 to L1.
 */
export function recordAttempt(s: LadderState): LadderState {
  if (s.attempted) return s;
  return { rung: s.rung === 0 ? 1 : s.rung, attempted: true };
}

/**
 * "Still stuck" → advance exactly one rung. Rules:
 * - must have attempted first (effort gate),
 * - one rung per call (no skipping),
 * - cannot auto-advance into L6: the answer reveal requires an explicit confirm (see reveal()).
 */
export function advance(s: LadderState): LadderState {
  if (!s.attempted) return s;
  if (s.rung >= 5) return s;
  return { ...s, rung: (s.rung + 1) as Rung };
}

/** Explicit, confirmed answer reveal (L6). */
export function reveal(s: LadderState): LadderState {
  return { ...s, rung: 6 };
}

/**
 * Build the rung-constrained prompt for /api/chat. THE LEAK GUARD: the canonical
 * solution is withheld from the prompt for rungs below SOLUTION_VISIBLE_FROM (L4),
 * so the model literally cannot leak it early. Above L4 it is included so the model
 * coaches toward the real proof instead of re-deriving (and possibly hallucinating).
 * Also defensive: tells the server to ignore textbook matching / reference pages.
 */
export function buildHintPrompt(rung: Rung, problem: ChallengeProblem, attempt: string): string {
  const includeSolution = rung >= SOLUTION_VISIBLE_FROM;
  const lines = [
    `PRACTICE HINT MODE, rung L${rung} of 6. Ignore textbook page matching and do not return reference pages.`,
    `You are a practice tutor helping a stuck student. ${RUNG_RULES[rung]}`,
    `PROBLEM: ${problem.prompt}`,
    attempt.trim()
      ? `STUDENT'S WORK SO FAR: """${attempt.trim()}"""`
      : `The student has not shown work yet.`,
    includeSolution
      ? `CANONICAL SOLUTION (guide toward it; reveal only as this rung permits): ${problem.solution}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Build the free-response grading prompt. Returns a strict-verdict request the
 * caller parses for CORRECT / INCORRECT / INCOMPLETE (validated GO in T1 eval).
 */
export function buildGradePrompt(problem: ChallengeProblem, attempt: string): string {
  return [
    "GRADING MODE. Ignore textbook page matching; do not return reference pages.",
    "A student submitted a proof. Decide if it is an essentially correct, rigorous proof.",
    `PROBLEM: ${problem.prompt}`,
    `REFERENCE SOLUTION: ${problem.solution}`,
    `RUBRIC: ${problem.rubric}`,
    `STUDENT SUBMISSION: """${attempt.trim()}"""`,
    "Your FIRST line must be exactly one of: VERDICT: CORRECT | VERDICT: INCORRECT | VERDICT: INCOMPLETE.",
    "Then one short sentence explaining why.",
  ].join("\n");
}

export type GradeVerdict = "correct" | "incorrect" | "incomplete";

/** Parse the model's reply into a verdict. Defaults to "incomplete" when unclear. */
export function parseVerdict(reply: string): GradeVerdict {
  const m = reply.toUpperCase().match(/VERDICT:\s*(CORRECT|INCORRECT|INCOMPLETE)/);
  if (m) return m[1].toLowerCase() as GradeVerdict;
  return "incomplete";
}
