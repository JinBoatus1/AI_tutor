import { describe, it, expect } from "vitest";
import { BOOKS, DEFAULT_BOOK_ID, isBuiltinBook, getBook, builtinBookOptions } from "./registry";

describe("book registry", () => {
  it("has focs as the default builtin", () => {
    expect(DEFAULT_BOOK_ID).toBe("focs");
    expect(isBuiltinBook("focs")).toBe(true);
    expect(isBuiltinBook("user_abcd1234")).toBe(false);
    expect(isBuiltinBook("nope")).toBe(false);
  });

  it("spells the label FOCS", () => {
    expect(BOOKS.focs.shortLabel).toBe("FOCS");
    expect(builtinBookOptions()).toEqual([{ id: "focs", linkLabel: "FOCS" }]);
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
});
