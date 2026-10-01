import { describe, it, expect, vi, afterEach } from "vitest";
import { submitFeedback, SUBMIT_TIMEOUT_MS } from "./feedbackApi";
import type { FeedbackPayload } from "./types";

const PAYLOAD: FeedbackPayload = {
  type: "content",
  description: "Page 170 shows the wrong figure.",
  contact_ok: false,
  context: { book_id: "lathi", page: 170 },
};

function respondWith(status: number, body?: string) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body ?? null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("submitFeedback", () => {
  it("POSTs the payload as JSON with the bearer token", async () => {
    const fetchMock = respondWith(200, JSON.stringify({ ok: true }));

    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith("/api/feedback")).toBe(true);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ Authorization: "Bearer tok-1", "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual(PAYLOAD);
  });

  it.each([401, 403])("treats %i as needing sign-in", async (status) => {
    respondWith(status, JSON.stringify({ detail: "x" }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "auth" });
  });

  it("treats 422 as an invalid form", async () => {
    respondWith(422, JSON.stringify({ detail: [] }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "invalid" });
  });

  it.each([
    [61, 2],
    [3600, 60],
    [1, 1],
  ])("turns retry_after_seconds=%i into %i minutes", async (seconds, minutes) => {
    respondWith(429, JSON.stringify({ detail: "Too many feedback submissions", retry_after_seconds: seconds }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({
      ok: false,
      kind: "rateLimited",
      retryAfterMinutes: minutes,
    });
  });

  it("assumes an hour when a 429 doesn't say how long", async () => {
    respondWith(429, "not json");
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({
      ok: false,
      kind: "rateLimited",
      retryAfterMinutes: 60,
    });
  });

  it.each([404, 500, 503])("treats %i as unavailable", async (status) => {
    respondWith(status, "{}");
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "unavailable" });
  });

  it("treats a network error as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(submitFeedback("tok-1", PAYLOAD)).resolves.toEqual({ ok: false, kind: "unavailable" });
  });

  it("gives up after 30 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );

    const pending = submitFeedback("tok-1", PAYLOAD);
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ ok: false, kind: "unavailable" });
  });
});
