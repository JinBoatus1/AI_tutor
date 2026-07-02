import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCourse,
  saveCourse,
  deleteCourse,
  fetchStanding,
  importLegacyCourseIfAny,
} from "./gradesStorage";
import type { Course } from "./types";

const LEGACY_KEY = "aiTutorGradesCourseV1";

function stubLocalStorage(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

const course: Course = {
  name: "Discrete Math",
  term: "Fall 2026",
  categories: [
    {
      id: "c1",
      name: "Exams",
      weight: 100,
      rule: { kind: "uniform", nSlots: 2 },
      items: [{ id: "e1", name: "E1", score: 90, maxScore: 100 }],
    },
  ],
  cutoffs: [{ letter: "A", min: 90 }],
};

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response,
  );
}

const lastInit = (spy: ReturnType<typeof mockFetch>): RequestInit =>
  spy.mock.calls[0][1] ?? {};

let fetchSpy: ReturnType<typeof mockFetch>;

beforeEach(() => {
  fetchSpy = mockFetch(200, {});
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

describe("gradesStorage API client", () => {
  it("fetchCourse attaches the bearer token and returns the course", async () => {
    fetchSpy = mockFetch(200, { course });
    vi.stubGlobal("fetch", fetchSpy);
    const got = await fetchCourse("tok123");
    expect(got?.name).toBe("Discrete Math");
    expect(lastInit(fetchSpy).headers).toMatchObject({ Authorization: "Bearer tok123" });
  });

  it("fetchCourse returns null when the server has no course", async () => {
    fetchSpy = mockFetch(200, { course: null });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchCourse("tok")).toBeNull();
  });

  it("fetchCourse throws on non-2xx", async () => {
    fetchSpy = mockFetch(401, {});
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchCourse("tok")).rejects.toThrow(/401/);
  });

  it("saveCourse PUTs { course } and returns warnings", async () => {
    fetchSpy = mockFetch(200, { course, warnings: ["Category weights sum to 50, not 100."] });
    vi.stubGlobal("fetch", fetchSpy);
    const warnings = await saveCourse("tok", course);
    expect(warnings).toHaveLength(1);
    expect(lastInit(fetchSpy).method).toBe("PUT");
    expect(JSON.parse(lastInit(fetchSpy).body as string)).toEqual({ course });
  });

  it("deleteCourse issues DELETE", async () => {
    await deleteCourse("tok");
    expect(lastInit(fetchSpy).method).toBe("DELETE");
  });

  it("fetchStanding POSTs course + unknownItemId and returns standing/ladder", async () => {
    fetchSpy = mockFetch(200, {
      standing: { percent: 87.5, letter: "B+" },
      ladder: [{ letter: "A", status: "ok", needed: 92 }],
    });
    vi.stubGlobal("fetch", fetchSpy);
    const resp = await fetchStanding("tok", course, "final");
    expect(resp.standing.letter).toBe("B+");
    expect(resp.ladder?.[0]).toMatchObject({ letter: "A", status: "ok", needed: 92 });
    expect(lastInit(fetchSpy).method).toBe("POST");
    expect(JSON.parse(lastInit(fetchSpy).body as string)).toEqual({ course, unknownItemId: "final" });
  });

  it("fetchStanding sends null unknownItemId when omitted", async () => {
    fetchSpy = mockFetch(200, { standing: { percent: null, letter: null }, ladder: null });
    vi.stubGlobal("fetch", fetchSpy);
    await fetchStanding("tok", course);
    expect(JSON.parse(lastInit(fetchSpy).body as string).unknownItemId).toBeNull();
  });
});

describe("importLegacyCourseIfAny (T7 one-time import-on-login)", () => {
  it("returns null and skips the network when there is no local course", async () => {
    stubLocalStorage();
    const imported = await importLegacyCourseIfAny("tok");
    expect(imported).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PUTs the local course then clears localStorage", async () => {
    const store = stubLocalStorage({ [LEGACY_KEY]: JSON.stringify(course) });
    const imported = await importLegacyCourseIfAny("tok");
    expect(imported?.name).toBe("Discrete Math");
    expect(lastInit(fetchSpy).method).toBe("PUT");
    expect(JSON.parse(lastInit(fetchSpy).body as string)).toEqual({ course });
    expect(store.get(LEGACY_KEY)).toBeUndefined(); // cleared after success
  });

  it("does NOT clear localStorage when the PUT fails (retries next login)", async () => {
    fetchSpy = mockFetch(500, {});
    vi.stubGlobal("fetch", fetchSpy);
    const store = stubLocalStorage({ [LEGACY_KEY]: JSON.stringify(course) });
    await expect(importLegacyCourseIfAny("tok")).rejects.toThrow(/500/);
    expect(store.get(LEGACY_KEY)).toBeDefined(); // preserved for retry
  });
});
