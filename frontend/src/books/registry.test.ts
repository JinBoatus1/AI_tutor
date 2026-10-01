import { describe, it, expect } from "vitest";
import { BOOKS, DEFAULT_BOOK_ID, isBuiltinBook, getBook, tryGetBook, builtinBookOptions } from "./registry";
import { getPracticeSet } from "../data/focsPracticeSets";

describe("book registry", () => {
  it("has focs as the default builtin", () => {
    expect(DEFAULT_BOOK_ID).toBe("focs");
    expect(isBuiltinBook("focs")).toBe(true);
    expect(isBuiltinBook("user_abcd1234")).toBe(false);
    expect(isBuiltinBook("nope")).toBe(false);
  });

  it("spells the label FOCS", () => {
    expect(BOOKS.focs.shortLabel).toBe("FOCS");
    expect(builtinBookOptions()[0]).toEqual({ id: "focs", linkLabel: "FOCS" });
  });

  it("carries focs content through the registry", () => {
    const b = getBook("focs");
    expect(Object.keys(b.tree).length).toBeGreaterThan(5);
    expect(b.practiceSets["4"]?.title).toBe("Proofs");
    expect(Object.keys(b.sectionNotes).length).toBeGreaterThan(0);
    expect(b.practiceAnchor).toEqual({ kind: "problems_section" });
    expect(b.guides?.length).toBeGreaterThan(0);
    expect(b.onboarding?.noteSection.sectionTitle).toBe("1.2 Speed Dating");
    expect(b.onboarding?.problemsSection.sectionTitle).toBe("5.3 Problems");
  });

  it("falls back to the default book for an unknown id", () => {
    expect(getBook("nope").id).toBe("focs");
  });

  it("tryGetBook does not fall back — an uploaded book id is not the default book", () => {
    expect(tryGetBook("focs")?.id).toBe("focs");
    expect(tryGetBook("user_abcd1234")).toBeNull();
    expect(tryGetBook("nope")).toBeNull();
    // getBook keeps its documented fallback; the two must differ for an unregistered id.
    expect(getBook("user_abcd1234").id).toBe("focs");
  });

  it("registers Lathi as the second builtin with no practice, notes or tour yet", () => {
    const lathi = BOOKS.lathi;
    expect(lathi.shortLabel).toBe("Signals");
    expect(lathi.practiceAnchor).toEqual({ kind: "chapter" });
    expect(Object.keys(lathi.practiceSets)).toEqual([]);
    expect(Object.keys(lathi.sectionNotes)).toEqual([]);
    expect(lathi.guides).toBeUndefined();
    expect(lathi.onboarding).toBeUndefined();
    expect(Object.keys(lathi.tree)[0]).toBe("B Background");
    expect(getPracticeSet("lathi", "4")).toBeNull();
  });

  it("offers the builtins default-first", () => {
    expect(builtinBookOptions()).toEqual([
      { id: "focs", linkLabel: "FOCS" },
      { id: "lathi", linkLabel: "Signals" },
    ]);
  });
});
