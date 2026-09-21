import { describe, it, expect, afterEach } from "vitest";
import { sectionTokensPreorder } from "./focsSectionOrder";
import { BOOKS } from "../books/registry";
import type { BookDef } from "../books/registry";

describe("sectionTokensPreorder", () => {
  it("returns focs tokens in reading order", () => {
    const tokens = sectionTokensPreorder("focs");
    expect(tokens.length).toBeGreaterThan(20);
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("1.2"));
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("2.1"));
  });

  it("falls back to the default book for an unknown id", () => {
    expect(sectionTokensPreorder("nope")).toEqual(sectionTokensPreorder("focs"));
  });

  it("memoizes per book (same array identity on repeat calls)", () => {
    expect(sectionTokensPreorder("focs")).toBe(sectionTokensPreorder("focs"));
  });
});

/** A throwaway second builtin, mirroring the pattern in learningTextbooks.test.ts —
 *  registered only for the duration of this suite, never shipped course content. */
const FAKE_BUILTIN: BookDef = {
  id: "tb",
  shortLabel: "TB",
  practiceAnchor: { kind: "chapter" },
  tree: {
    "B Background": {
      _range: { start: 1, end: 9 },
      "B.1 Complex Numbers": { start: 1, end: 5 },
      "B.2 Sets": { start: 6, end: 9 },
    },
  },
  sectionNotes: {},
  practiceSets: {},
};

describe("sectionTokensPreorder with a second builtin book (fixture, not shipped)", () => {
  afterEach(() => {
    delete BOOKS[FAKE_BUILTIN.id];
  });

  it("computes distinct tokens per book instead of always returning focs's tokens", () => {
    BOOKS[FAKE_BUILTIN.id] = FAKE_BUILTIN;
    const tbTokens = sectionTokensPreorder("tb");
    const focsTokens = sectionTokensPreorder("focs");
    expect(tbTokens).toEqual(["B.1", "B.2"]);
    expect(tbTokens).not.toEqual(focsTokens);
  });
});
