import { describe, it, expect } from "vitest";
import { CHAPTER_TOKEN_RE, isChapterToken, compareChapterTokens } from "./chapterToken";

describe("chapter tokens", () => {
  it("accepts numeric and single-uppercase-letter chapters", () => {
    for (const t of ["4", "4.1", "24.2", "1.1.1", "B", "B.1", "B.7"]) {
      expect(isChapterToken(t), t).toBe(true);
    }
  });

  it("rejects back-matter first words", () => {
    for (const t of ["Answers", "Supplementary", "Index", "abc", "b", "4a", ""]) {
      expect(isChapterToken(t), t).toBe(false);
    }
  });

  it("is anchored so it cannot match inside a longer string", () => {
    expect(CHAPTER_TOKEN_RE.test("x4.1")).toBe(false);
    expect(CHAPTER_TOKEN_RE.test("4.1x")).toBe(false);
  });

  it("orders lettered chapters before numeric ones, numerics by value", () => {
    expect(["10", "2", "B", "1"].sort(compareChapterTokens)).toEqual(["B", "1", "2", "10"]);
  });

  it("orders multiple lettered chapters alphabetically", () => {
    expect(["C", "1", "A"].sort(compareChapterTokens)).toEqual(["A", "C", "1"]);
  });
});
