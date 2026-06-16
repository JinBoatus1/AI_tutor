import { describe, it, expect } from "vitest";
import { loadProgress, saveProgress, sanitizeProgress } from "./practiceProgress";
import { emptyProgress } from "../practice/types";

// Minimal in-memory Storage stand-in.
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(seed));
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
}

describe("practiceProgress persistence", () => {
  it("round-trips through the versioned key", () => {
    const s = fakeStorage();
    const p = { ...emptyProgress(), warmupDone: true, challengeSolved: ["c1"] };
    saveProgress("focs", "4", p, s);
    expect(s.getItem("practice.v1.focs.4")).toContain("c1");
    expect(loadProgress("focs", "4", s)).toEqual(p);
  });

  it("missing key -> empty progress", () => {
    expect(loadProgress("focs", "4", fakeStorage())).toEqual(emptyProgress());
  });

  it("corrupt JSON -> empty progress, no throw", () => {
    const s = fakeStorage({ "practice.v1.focs.4": "{not json" });
    expect(loadProgress("focs", "4", s)).toEqual(emptyProgress());
  });

  it("null storage (SSR / private mode) -> empty progress, save is a no-op", () => {
    expect(loadProgress("focs", "4", null)).toEqual(emptyProgress());
    expect(() => saveProgress("focs", "4", emptyProgress(), null)).not.toThrow();
  });
});

describe("sanitizeProgress", () => {
  it("drops junk fields and keeps valid ones", () => {
    expect(sanitizeProgress({ warmupDone: "yes", practiceCorrect: { p1: true }, challengeSolved: ["c1", 5] })).toEqual({
      warmupDone: false, // "yes" is not boolean true
      practiceCorrect: { p1: true },
      practiceAttempted: {},
      challengeSolved: ["c1"], // 5 dropped
    });
  });
  it("non-object -> empty", () => {
    expect(sanitizeProgress(42)).toEqual(emptyProgress());
  });
});
