// T4 — deterministic mastery + stage-unlock logic. No React, no I/O. This is the
// single source of truth the UI and (phase 2) the backend both read.
import type { PracticeSet, PracticeProgress, Tier, Stage } from "./types";

const TIER_ORDER: Tier[] = ["not_started", "familiar", "proficient", "mastered"];

/** Highest tier by TIER_ORDER among the eligible set. */
function maxTier(tiers: Tier[]): Tier {
  return tiers.reduce(
    (best, t) => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(best) ? t : best),
    "not_started" as Tier,
  );
}

/** Fraction of practice questions answered correctly at least once (0 when the set is empty). */
export function practiceCorrectFraction(set: PracticeSet, p: PracticeProgress): number {
  const total = set.practice.length;
  if (total === 0) return 0;
  const correct = set.practice.filter((q) => p.practiceCorrect[q.id]).length;
  return correct / total;
}

/**
 * Mastery tier for a chapter. Tiers are CUMULATIVE: each criterion is evaluated
 * independently and we return the highest reached by any path. So a student who
 * skips straight to the challenge and succeeds earns `mastered` directly, without
 * a separate practice pass (design: max-tier).
 *
 * - familiar:   warm-up done AND >= 50% of practice correct
 * - proficient: every practice question correct at least once
 * - mastered:   >= 1 challenge judged correct
 */
export function computeTier(set: PracticeSet, p: PracticeProgress): Tier {
  const frac = practiceCorrectFraction(set, p);
  const total = set.practice.length;
  const eligible: Tier[] = ["not_started"];

  if (p.warmupDone && total > 0 && frac >= 0.5) eligible.push("familiar");
  if (total > 0 && frac >= 1) eligible.push("proficient");
  if (p.challengeSolved.length >= 1) eligible.push("mastered");

  return maxTier(eligible);
}

/**
 * Which stages are unlocked. Stages open in order (warm-up -> practice -> challenge),
 * but `skipToChallenge` is the deliberate escape hatch for strong students and
 * force-unlocks everything.
 */
export function stageUnlock(
  set: PracticeSet,
  p: PracticeProgress,
  skipToChallenge = false,
): Record<Stage, boolean> {
  const frac = practiceCorrectFraction(set, p);
  const practiceUnlocked = p.warmupDone || skipToChallenge;
  const challengeUnlocked = skipToChallenge || (set.practice.length > 0 && frac >= 0.5);
  return { warmup: true, practice: practiceUnlocked, challenge: challengeUnlocked };
}
