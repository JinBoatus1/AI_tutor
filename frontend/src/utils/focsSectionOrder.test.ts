import { describe, it, expect, afterEach } from "vitest";
import { sectionTokensPreorder } from "./focsSectionOrder";
import { BOOKS } from "../books/registry";
import type { BookDef } from "../books/registry";

describe("sectionTokensPreorder", () => {
  it("returns focs tokens in reading order", () => {
    const tokens = sectionTokensPreorder(BOOKS.focs);
    expect(tokens.length).toBeGreaterThan(20);
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("1.2"));
    expect(tokens.indexOf("1.1")).toBeLessThan(tokens.indexOf("2.1"));
  });

  it("takes the resolved BookDef, not a bookId — there is no id to silently fall back on", () => {
    // Same footgun a Critical fix removed from three other call sites: this function
    // used to call getBook(bookId) internally, so an unresolved id quietly aliased to
    // FOCS's ordering. Now the caller must already hold a real BookDef, so a book with
    // its own id and tree always computes its own tokens — never FOCS's by accident.
    const other: BookDef = {
      ...BOOKS.focs,
      id: "not_focs",
      tree: { "9 Other": { "9.1 Only Section": {} } },
    };
    const otherTokens = sectionTokensPreorder(other);
    expect(otherTokens).toEqual(["9.1"]);
    expect(otherTokens).not.toEqual(sectionTokensPreorder(BOOKS.focs));
  });

  it("memoizes per book (same array identity on repeat calls)", () => {
    expect(sectionTokensPreorder(BOOKS.focs)).toBe(sectionTokensPreorder(BOOKS.focs));
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
    const tbTokens = sectionTokensPreorder(FAKE_BUILTIN);
    const focsTokens = sectionTokensPreorder(BOOKS.focs);
    expect(tbTokens).toEqual(["B.1", "B.2"]);
    expect(tbTokens).not.toEqual(focsTokens);
  });
});
