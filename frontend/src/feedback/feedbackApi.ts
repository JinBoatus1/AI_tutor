import { apiUrl } from "../apiBase";
import type { FeedbackPayload } from "./types";

/** The server answers within about 15 s; past 30 s, give up and let the student retry. */
export const SUBMIT_TIMEOUT_MS = 30_000;

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "auth" }
  | { ok: false; kind: "rateLimited"; retryAfterMinutes: number }
  | { ok: false; kind: "invalid" }
  | { ok: false; kind: "unavailable" };

export async function submitFeedback(
  token: string,
  payload: FeedbackPayload,
  timeoutMs = SUBMIT_TIMEOUT_MS,
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl("/api/feedback"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 422) return { ok: false, kind: "invalid" };
    if (res.status === 429) return { ok: false, kind: "rateLimited", retryAfterMinutes: await retryAfterMinutes(res) };
    return { ok: false, kind: "unavailable" };
  } catch {
    return { ok: false, kind: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Minutes to wait, from the 429 body. A cross-origin page can't read the Retry-After header. */
async function retryAfterMinutes(res: Response): Promise<number> {
  try {
    const body = (await res.json()) as { retry_after_seconds?: unknown };
    const seconds = body.retry_after_seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.max(1, Math.ceil(seconds / 60));
    }
  } catch {
    // Not JSON: fall through to the default.
  }
  return 60;
}
