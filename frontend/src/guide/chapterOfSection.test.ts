import { describe, it, expect } from "vitest";
import { chapterOfSectionTitle, isInductionGuideSection } from "./chapterOfSection";

describe("isInductionGuideSection", () => {
  it("matches Chapter 5 sections except Problems", () => {
    expect(isInductionGuideSection('5 Induction: Proving "FOR ALL ..." ')).toBe(true);
    expect(isInductionGuideSection("5.1 Ordinary Induction")).toBe(true);
    expect(isInductionGuideSection("5.2 Induction and Well-ordering")).toBe(true);
    expect(isInductionGuideSection("5.3 Problems")).toBe(false);
  });

  it("rejects other chapters", () => {
    expect(isInductionGuideSection("4.6 Problems")).toBe(false);
    expect(isInductionGuideSection("6.3 Strong Induction")).toBe(false);
    expect(isInductionGuideSection(null)).toBe(false);
  });

  it("chapterOfSectionTitle extracts chapter token", () => {
    expect(chapterOfSectionTitle("5.1 Ordinary Induction")).toBe("5");
    expect(chapterOfSectionTitle('5 Induction: Proving "FOR ALL ..." ')).toBe("5");
  });
});
