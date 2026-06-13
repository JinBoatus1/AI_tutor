// Data shapes for Chapter Practice / Quiz Mode (v1). See the design spec:
// docs/superpowers/specs/2026-06-12-chapter-1-practice-mode-design.md

export type Tier = "not_started" | "familiar" | "proficient" | "mastered";
export type Stage = "warmup" | "practice" | "challenge";

/** Warm-up recall card. */
export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

/** Multiple-choice. `why` is the explain-on-wrong line (design D-1). */
export interface McqQuestion {
  kind: "mcq";
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  why: string;
}

/**
 * One step in a proof-ordering question. `deps` lists the ids of steps that must
 * appear BEFORE this one. Grading accepts any valid topological order (design D9),
 * so commutable steps with no dependency between them can appear in either order.
 */
export interface ProofOrderStep {
  id: string;
  text: string;
  deps: string[];
}

export interface ProofOrderQuestion {
  kind: "proof-order";
  id: string;
  prompt: string;
  steps: ProofOrderStep[];
  why: string;
}

export interface SpotFlawLine {
  id: string;
  text: string;
}

/** Click the invalid line. */
export interface SpotFlawQuestion {
  kind: "spot-flaw";
  id: string;
  prompt: string;
  lines: SpotFlawLine[];
  flawLineId: string;
  why: string;
}

/** Fill the blank between `before` and `after`. `accept` = acceptable answers (normalized at grade time). */
export interface FillBlankQuestion {
  kind: "fill-blank";
  id: string;
  prompt: string;
  before: string;
  after: string;
  accept: string[];
  why: string;
}

/** The four auto-graded practice formats. */
export type PracticeQuestion =
  | McqQuestion
  | ProofOrderQuestion
  | SpotFlawQuestion
  | FillBlankQuestion;

/** Free-response challenge. `solution` + `rubric` drive AI grading (and L4+ hints). */
export interface ChallengeProblem {
  id: string;
  prompt: string;
  solution: string;
  rubric: string;
  /** Optional near-identical twin shown after an answer reveal (pedagogy, design D8). */
  twinPromptId?: string;
}

export interface PracticeSet {
  chapter: string; // e.g. "4"
  title: string; // e.g. "Proofs"
  warmup: Flashcard[];
  practice: PracticeQuestion[];
  challenge: ChallengeProblem[];
}

/**
 * Per-chapter progress (persisted in localStorage). Upward-only in v1 (no demotion).
 * Note: we deliberately do NOT track "solved by own work vs reveal" — that integrity
 * gate is unenforceable client-side (answer keys ship in the bundle) and was dropped
 * in design D8. `challengeSolved` = challenge ids the AI judged correct, full stop.
 */
export interface PracticeProgress {
  warmupDone: boolean;
  practiceCorrect: Record<string, boolean>; // questionId -> answered correctly at least once
  practiceAttempted: Record<string, boolean>; // questionId -> submitted at least once
  challengeSolved: string[]; // challenge ids judged correct
}

export function emptyProgress(): PracticeProgress {
  return { warmupDone: false, practiceCorrect: {}, practiceAttempted: {}, challengeSolved: [] };
}
