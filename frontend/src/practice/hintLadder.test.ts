import { describe, it, expect } from "vitest";
import {
  initialLadder,
  recordAttempt,
  advance,
  reveal,
  buildHintPrompt,
  buildGradePrompt,
  parseVerdict,
  SOLUTION_VISIBLE_FROM,
  type Rung,
} from "./hintLadder";
import type { ChallengeProblem } from "./types";

const problem: ChallengeProblem = {
  id: "c1",
  prompt: "Prove that if n^2 is even then n is even.",
  solution: "Contrapositive: assume n=2k+1, then n^2=4k^2+4k+1 is odd. SECRET_SOLUTION_MARKER.",
  rubric: "Uses contraposition; algebra correct; concludes.",
};

describe("ladder advancement", () => {
  it("effort gate: cannot advance before an attempt", () => {
    const s = initialLadder();
    expect(advance(s)).toEqual(s); // no-op at L0 without attempt
    expect(s.rung).toBe(0);
  });

  it("first attempt moves L0 -> L1", () => {
    expect(recordAttempt(initialLadder())).toEqual({ rung: 1, attempted: true });
  });

  it("one rung per advance, no skipping", () => {
    let s = recordAttempt(initialLadder()); // L1
    s = advance(s);
    expect(s.rung).toBe(2);
    s = advance(s);
    expect(s.rung).toBe(3);
  });

  it("cannot auto-advance into L6 (reveal needs explicit confirm)", () => {
    let s: ReturnType<typeof initialLadder> = { rung: 5, attempted: true };
    expect(advance(s).rung).toBe(5); // capped
    s = reveal(s);
    expect(s.rung).toBe(6);
  });
});

describe("buildHintPrompt LEAK GUARD", () => {
  const attempt = "I tried assuming n is even but got stuck.";

  it("does NOT contain the solution below L4", () => {
    for (const rung of [1, 2, 3] as Rung[]) {
      const prompt = buildHintPrompt(rung, problem, attempt);
      expect(prompt).not.toContain("SECRET_SOLUTION_MARKER");
      expect(prompt).toContain(`rung L${rung}`);
    }
  });

  it("DOES contain the solution at L4 and above", () => {
    for (const rung of [4, 5, 6] as Rung[]) {
      expect(buildHintPrompt(rung, problem, attempt)).toContain("SECRET_SOLUTION_MARKER");
    }
  });

  it("SOLUTION_VISIBLE_FROM is the L4 boundary", () => {
    expect(SOLUTION_VISIBLE_FROM).toBe(4);
  });

  it("notes when the student has shown no work", () => {
    expect(buildHintPrompt(1, problem, "  ")).toContain("not shown work");
  });
});

describe("grading prompt + verdict parsing", () => {
  it("grade prompt includes solution + rubric + strict verdict instruction", () => {
    const p = buildGradePrompt(problem, "my attempt");
    expect(p).toContain("SECRET_SOLUTION_MARKER");
    expect(p).toContain("VERDICT: CORRECT");
  });

  it("parses each verdict", () => {
    expect(parseVerdict("VERDICT: CORRECT\nbecause...")).toBe("correct");
    expect(parseVerdict("verdict: incorrect — the sqrt step is invalid")).toBe("incorrect");
    expect(parseVerdict("VERDICT: INCOMPLETE")).toBe("incomplete");
  });

  it("defaults to incomplete when no verdict is present", () => {
    expect(parseVerdict("I think you're close!")).toBe("incomplete");
  });
});
