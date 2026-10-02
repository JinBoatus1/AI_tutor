import { describe, expect, it } from "vitest";
import { isCurrentSection, normalizeSectionTitle, sameSection, type CurrentSection } from "./currentSection";

const s24: CurrentSection = {
  bookId: "lathi",
  title: "2.4 System Response to External Input: The Zero-State Response",
  startBook: 168,
  endBook: 195,
};
const leaf = (title: string, start: number, end: number) => ({ title, range: { start, end }, hasKids: false });

describe("isCurrentSection", () => {
  it("matches the same title in the same book", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), s24, "lathi")).toBe(true);
  });

  it("ignores case and whitespace in titles", () => {
    expect(
      isCurrentSection(leaf("2.4  system response to external input:\nthe zero-state response", 1, 2), s24, "lathi"),
    ).toBe(true);
  });

  it("matches a leaf by its page range when the titles differ", () => {
    expect(isCurrentSection(leaf("2.4 Zero-state response", 168, 195), s24, "lathi")).toBe(true);
  });

  it("never matches a chapter only because it shares the pages", () => {
    const chapter = { title: "2 Time-Domain Analysis", range: { start: 168, end: 195 }, hasKids: true };
    expect(isCurrentSection(chapter, s24, "lathi")).toBe(false);
  });

  it("needs the whole range, not just the start page", () => {
    expect(isCurrentSection(leaf("2.4 Other", 168, 170), s24, "lathi")).toBe(false);
  });

  it("never matches another book's outline", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), s24, "focs")).toBe(false);
  });

  it("matches nothing when no section is shown", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), null, "lathi")).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes titles", () => {
    expect(normalizeSectionTitle("  1.1  Modeling\tEpidemics ")).toBe("1.1 modeling epidemics");
  });

  it("compares sections by value", () => {
    expect(sameSection(s24, { ...s24 })).toBe(true);
    expect(sameSection(s24, { ...s24, endBook: 196 })).toBe(false);
    expect(sameSection(null, null)).toBe(true);
    expect(sameSection(s24, null)).toBe(false);
  });
});
