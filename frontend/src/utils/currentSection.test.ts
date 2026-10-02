import { describe, expect, it } from "vitest";
import {
  currentOutlinePath,
  normalizeSectionTitle,
  sameSection,
  type CurrentSection,
  type OutlineNodeRef,
} from "./currentSection";

const s24: CurrentSection = {
  bookId: "lathi",
  title: "2.4 System Response to External Input: The Zero-State Response",
  startBook: 168,
  endBook: 195,
};
const leaf = (title: string, start: number, end: number): OutlineNodeRef => ({
  path: `2 Time-Domain Analysis/${title}`,
  title,
  range: { start, end },
  hasKids: false,
});

describe("currentOutlinePath", () => {
  it("picks the node with the same title in the same book", () => {
    expect(currentOutlinePath([leaf("2.3 Other", 160, 167), leaf(s24.title, 168, 195)], s24, "lathi")).toBe(
      `2 Time-Domain Analysis/${s24.title}`,
    );
  });

  it("ignores case and whitespace in titles", () => {
    const node = leaf("2.4  system response to external input:\nthe zero-state response", 1, 2);
    expect(currentOutlinePath([node], s24, "lathi")).toBe(node.path);
  });

  it("picks the title match over a sibling on the same page", () => {
    const focs: CurrentSection = { bookId: "focs", title: "1.2 Speed Dating", startBook: 8, endBook: 8 };
    const nodes = [leaf("1.2 Speed Dating", 8, 8), leaf("1.3 Friendship Networks and Ads", 8, 8)];
    expect(currentOutlinePath(nodes, focs, "focs")).toBe(nodes[0].path);
    expect(currentOutlinePath([...nodes].reverse(), focs, "focs")).toBe(nodes[0].path);
  });

  it("falls back to the only leaf with the same pages when no title matches", () => {
    expect(currentOutlinePath([leaf("2.3 Other", 160, 167), leaf("2.4 Zero-state response", 168, 195)], s24, "lathi")).toBe(
      "2 Time-Domain Analysis/2.4 Zero-state response",
    );
  });

  it("picks nothing when several leaves share the pages and no title matches", () => {
    expect(currentOutlinePath([leaf("2.4a", 168, 195), leaf("2.4b", 168, 195)], s24, "lathi")).toBeNull();
  });

  it("never picks a chapter only because it shares the pages", () => {
    const chapter: OutlineNodeRef = { path: "2 Time-Domain Analysis", title: "2 Time-Domain Analysis", range: { start: 168, end: 195 }, hasKids: true };
    expect(currentOutlinePath([chapter], s24, "lathi")).toBeNull();
  });

  it("needs the whole range, not just the start page", () => {
    expect(currentOutlinePath([leaf("2.4 Other", 168, 170)], s24, "lathi")).toBeNull();
  });

  it("never picks from another book's outline", () => {
    expect(currentOutlinePath([leaf(s24.title, 168, 195)], s24, "focs")).toBeNull();
  });

  it("picks nothing when no section is shown", () => {
    expect(currentOutlinePath([leaf(s24.title, 168, 195)], null, "lathi")).toBeNull();
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
