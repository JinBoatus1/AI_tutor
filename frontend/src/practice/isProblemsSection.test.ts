import { describe, it, expect } from "vitest";
import { isProblemsSection, chapterOfProblems } from "./isProblemsSection";

describe("isProblemsSection", () => {
  it("matches real problem sets", () => {
    for (const t of ["4.6 Problems", "1.6 Problems", "11.6 Problems", "12.4 Problems", "18.6 Problems"]) {
      expect(isProblemsSection(t), t).toBe(true);
    }
  });

  it("rejects the decoys", () => {
    for (const t of [
      "11.5 Problem Solving with Graphs",
      "12.3 Whirlwind Tour of Graph Problems",
      "23.1 Decision Problems",
      "27 Unsolvable Problems",
      "4.1 Direct Proof",
      "4 Proofs",
    ]) {
      expect(isProblemsSection(t), t).toBe(false);
    }
  });

  it("trims surrounding whitespace; handles null/empty", () => {
    expect(isProblemsSection("  4.6 Problems  ")).toBe(true);
    expect(isProblemsSection("")).toBe(false);
    expect(isProblemsSection(null)).toBe(false);
  });

  it("chapterOfProblems extracts the chapter token", () => {
    expect(chapterOfProblems("4.6 Problems")).toBe("4");
    expect(chapterOfProblems("12.4 Problems")).toBe("12");
    expect(chapterOfProblems("11.5 Problem Solving with Graphs")).toBeNull();
    expect(chapterOfProblems(null)).toBeNull();
  });
});
