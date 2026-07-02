// Server-authoritative grade API client (login required — D3).
// Replaces the old localStorage engine: the backend owns persistence AND all grade math.
// The legacy localStorage key is kept read-only for the one-time import-on-login (T7).

import { apiUrl } from "../apiBase";
import type { Course, StandingResp } from "./types";

const LEGACY_LOCAL_KEY = "aiTutorGradesCourseV1";

async function authFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/** GET /api/grades → the saved course, or null if the user has none yet. */
export async function fetchCourse(token: string): Promise<Course | null> {
  const r = await authFetch(token, "/api/grades");
  if (!r.ok) throw new Error(`GET /api/grades ${r.status}`);
  const data = await r.json();
  return (data.course as Course | null) ?? null;
}

/** PUT /api/grades → persist the rich course verbatim; returns rubric warnings. */
export async function saveCourse(token: string, course: Course): Promise<string[]> {
  const r = await authFetch(token, "/api/grades", {
    method: "PUT",
    body: JSON.stringify({ course }),
  });
  if (!r.ok) throw new Error(`PUT /api/grades ${r.status}`);
  const data = await r.json();
  return (data.warnings as string[]) ?? [];
}

/** DELETE /api/grades → clear the saved course. */
export async function deleteCourse(token: string): Promise<void> {
  const r = await authFetch(token, "/api/grades", { method: "DELETE" });
  if (!r.ok) throw new Error(`DELETE /api/grades ${r.status}`);
}

/**
 * POST /api/grades/standing → server-computed standing + (if unknownItemId given) the
 * full letter ladder for that one upcoming item, in ONE call (D7). Never compute this
 * on the client.
 */
export async function fetchStanding(
  token: string,
  course: Course,
  unknownItemId?: string,
): Promise<StandingResp> {
  const r = await authFetch(token, "/api/grades/standing", {
    method: "POST",
    body: JSON.stringify({ course, unknownItemId: unknownItemId ?? null }),
  });
  if (!r.ok) throw new Error(`POST /api/grades/standing ${r.status}`);
  return (await r.json()) as StandingResp;
}

// ---- legacy localStorage (read/clear only) — used by the one-time import-on-login (T7) ----
export function readLegacyLocalCourse(): Course | null {
  try {
    const raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Course) : null;
  } catch {
    return null;
  }
}

export function clearLegacyLocalCourse(): void {
  try {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
