// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BUILTIN_TEXTBOOK_OPTIONS,
  readSelectedTextbookId,
  writeSelectedTextbookId,
  getTextbookTree,
  outlineToCurriculum,
  readTextbookOptionList,
  fetchTextbookOptionsFromServer,
  reconcileSelectedTextbookWithCatalog,
  resetServerTextbookSessionForLogout,
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

/** The real backend returns builtin rows AND uploads from /api/user_textbooks. */
function mockServerTextbooks(rows: { id: string; label?: string }[]) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ textbooks: rows }),
  })) as unknown as typeof fetch);
}

describe("server catalog filtering", () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerTextbookSessionForLogout();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a builtin row from the server out of the upload list, without losing it from the picker", async () => {
    // This is exactly what backend list_my_textbooks returns.
    mockServerTextbooks([
      { id: "focs", label: "FOCS (built-in)" },
      { id: "user_abcd1234", label: "My Upload" },
    ]);
    await fetchTextbookOptionsFromServer("tok");

    const list = readTextbookOptionList();
    const ids = list.map((x) => x.id);
    expect(ids.filter((i) => i === "focs")).toHaveLength(1); // exactly once, not duplicated
    expect(ids).toContain("user_abcd1234");
    // The builtin's label comes from the registry, not the server's "(built-in)" text.
    expect(list.find((x) => x.id === "focs")!.linkLabel).toBe("FOCS");
  });

  it("drops server rows that are neither builtin nor valid uploads", async () => {
    mockServerTextbooks([
      { id: "focs" },
      { id: "bogus" },
      { id: "user_ab" },          // too short for the upload id pattern
      { id: "user_abcd1234" },
    ]);
    await fetchTextbookOptionsFromServer("tok");
    expect(readTextbookOptionList().map((x) => x.id)).toEqual(["focs", "user_abcd1234"]);
  });

  it("resets a selected upload that the server no longer lists", async () => {
    writeSelectedTextbookId("user_abcd1234");
    expect(readSelectedTextbookId()).toBe("user_abcd1234");
    mockServerTextbooks([{ id: "focs" }]);          // the upload is gone
    await fetchTextbookOptionsFromServer("tok");
    expect(readSelectedTextbookId()).toBe("focs");
  });

  it("never resets a selected builtin", async () => {
    writeSelectedTextbookId("focs");
    mockServerTextbooks([{ id: "focs" }]);
    await fetchTextbookOptionsFromServer("tok");
    reconcileSelectedTextbookWithCatalog();
    expect(readSelectedTextbookId()).toBe("focs");
  });
});

describe("logout", () => {
  beforeEach(() => localStorage.clear());

  it("drops a selected upload but leaves a selected builtin alone", () => {
    writeSelectedTextbookId("user_abcd1234");
    resetServerTextbookSessionForLogout();
    expect(readSelectedTextbookId()).toBe("focs");

    writeSelectedTextbookId("focs");
    resetServerTextbookSessionForLogout();
    expect(readSelectedTextbookId()).toBe("focs");
  });
});
