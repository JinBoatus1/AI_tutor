// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  BUILTIN_TEXTBOOK_OPTIONS,
  readSelectedTextbookId,
  writeSelectedTextbookId,
  getTextbookTree,
  outlineToCurriculum,
} from "./learningTextbooks";

describe("learningTextbooks", () => {
  beforeEach(() => localStorage.clear());

  it("exposes builtins from the registry, spelled FOCS", () => {
    expect(BUILTIN_TEXTBOOK_OPTIONS).toEqual([{ id: "focs", linkLabel: "FOCS" }]);
  });

  it("defaults to focs and round-trips a builtin selection", () => {
    expect(readSelectedTextbookId()).toBe("focs");
    writeSelectedTextbookId("focs");
    expect(readSelectedTextbookId()).toBe("focs");
  });

  it("rejects a bogus stored id", () => {
    localStorage.setItem("ai_tutor_selected_textbook_id", "bogus");
    expect(readSelectedTextbookId()).toBe("focs");
  });

  it("serves a bundled tree for a builtin and an empty one otherwise", () => {
    expect(Object.keys(getTextbookTree("focs")).length).toBeGreaterThan(5);
    expect(getTextbookTree("user_unknown1234")).toEqual({});
  });

  it("outlineToCurriculum walks any outline shape", () => {
    const out = outlineToCurriculum({
      "B Background": { _range: { start: 1, end: 9 }, "B.1 Complex Numbers": { start: 1, end: 5 } },
    });
    const names = out.topics[0].chapters.map((c) => c.chapter);
    expect(names).toContain("B Background");
    expect(names).toContain("B.1 Complex Numbers");
  });
});
