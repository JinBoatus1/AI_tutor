import { describe, it, expect } from "vitest";

// T2: proves the vitest harness runs green before any practice-mode logic depends
// on it. Replaced by real specs as masteryEngine / grading / hintLadder land.
describe("practice harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
