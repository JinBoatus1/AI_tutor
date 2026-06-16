import { describe, it, expect } from "vitest";
import { computeTier, stageUnlock } from "./masteryEngine";
import { emptyProgress, type PracticeSet, type PracticeProgress } from "./types";

// Minimal set: 2 practice questions + 1 challenge.
const set: PracticeSet = {
  chapter: "4",
  title: "Proofs",
  warmup: [{ id: "f1", front: "a", back: "b" }],
  practice: [
    { kind: "mcq", id: "p1", prompt: "", choices: ["x"], answerIndex: 0, why: "" },
    { kind: "mcq", id: "p2", prompt: "", choices: ["x"], answerIndex: 0, why: "" },
  ],
  challenge: [{ id: "c1", prompt: "", solution: "", rubric: "" }],
};

function progress(over: Partial<PracticeProgress> = {}): PracticeProgress {
  return { ...emptyProgress(), ...over };
}

describe("computeTier", () => {
  it("not_started with empty progress", () => {
    expect(computeTier(set, progress())).toBe("not_started");
  });

  it("familiar: warm-up done + >=50% practice correct", () => {
    const p = progress({ warmupDone: true, practiceCorrect: { p1: true } }); // 1/2 = 50%
    expect(computeTier(set, p)).toBe("familiar");
  });

  it("NOT familiar if warm-up not done even at 50%", () => {
    const p = progress({ warmupDone: false, practiceCorrect: { p1: true } });
    expect(computeTier(set, p)).toBe("not_started");
  });

  it("proficient: every practice correct at least once", () => {
    const p = progress({ warmupDone: true, practiceCorrect: { p1: true, p2: true } });
    expect(computeTier(set, p)).toBe("proficient");
  });

  it("mastered: a challenge solved", () => {
    const p = progress({ warmupDone: true, practiceCorrect: { p1: true, p2: true }, challengeSolved: ["c1"] });
    expect(computeTier(set, p)).toBe("mastered");
  });

  it("EDGE skip-to-challenge: challenge solved => mastered without practice (cumulative max)", () => {
    const p = progress({ challengeSolved: ["c1"] }); // no warm-up, no practice
    expect(computeTier(set, p)).toBe("mastered");
  });

  it("EDGE no demotion / max-tier: mastered wins even when familiar criterion not met", () => {
    const p = progress({ warmupDone: false, practiceCorrect: {}, challengeSolved: ["c1"] });
    expect(computeTier(set, p)).toBe("mastered");
  });
});

describe("stageUnlock", () => {
  it("warm-up always open; practice + challenge locked initially", () => {
    expect(stageUnlock(set, progress())).toEqual({ warmup: true, practice: false, challenge: false });
  });

  it("practice unlocks after warm-up", () => {
    expect(stageUnlock(set, progress({ warmupDone: true })).practice).toBe(true);
  });

  it("challenge unlocks at >=50% practice correct", () => {
    const p = progress({ warmupDone: true, practiceCorrect: { p1: true } });
    expect(stageUnlock(set, p).challenge).toBe(true);
  });

  it("skipToChallenge force-unlocks practice + challenge", () => {
    expect(stageUnlock(set, progress(), true)).toEqual({ warmup: true, practice: true, challenge: true });
  });
});
