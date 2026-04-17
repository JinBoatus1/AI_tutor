/**
 * My Learning Bar: progress is separate from the bundled syllabus; stored in localStorage.
 * When online, best-effort sync to GET/PUT /api/student_bar so Learning Mode shares the same student_id.
 */

import { apiUrl } from "../apiBase";

const STORAGE_PREFIX = "aiTutorLearningBarV1:";

export type LocalLearningBarState = {
  learned_sections: string[];
  updated_at?: string;
};

function key(studentId: string, textbookId: string): string {
  const tid = textbookId && textbookId.length > 0 ? textbookId : "focs";
  return STORAGE_PREFIX + studentId + ":" + tid;
}

export function loadLocalLearningBar(studentId: string, textbookId: string = "focs"): LocalLearningBarState {
  try {
    const raw = localStorage.getItem(key(studentId, textbookId));
    if (!raw) return { learned_sections: [] };
    const o = JSON.parse(raw) as Record<string, unknown>;
    const learned = o.learned_sections;
    return {
      learned_sections: Array.isArray(learned)
        ? learned.filter((x): x is string => typeof x === "string")
        : [],
      updated_at: typeof o.updated_at === "string" ? o.updated_at : undefined,
    };
  } catch {
    return { learned_sections: [] };
  }
}

export function saveLocalLearningBar(studentId: string, learned: string[], textbookId: string = "focs"): void {
  const payload: LocalLearningBarState = {
    learned_sections: learned,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(key(studentId, textbookId), JSON.stringify(payload));
}

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs = 12_000, ...rest } = init;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: ac.signal }).finally(() => clearTimeout(t));
}

/** If local storage is empty, try once to GET learned list from server and save locally (fails silently). */
export async function tryHydrateLearnedFromServer(
  studentId: string,
  textbookId: string = "focs",
  token?: string | null
): Promise<string[] | null> {
  try {
    const q = new URLSearchParams({
      student_id: studentId,
      textbook_id: textbookId || "focs",
    });
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetchWithTimeout(`${apiUrl("/api/student_bar")}?${q.toString()}`, {
      method: "GET",
      headers,
      timeoutMs: 12_000,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { learned_sections?: unknown };
    const learned = Array.isArray(j.learned_sections)
      ? j.learned_sections.filter((x): x is string => typeof x === "string")
      : [];
    if (learned.length > 0) {
      saveLocalLearningBar(studentId, learned, textbookId);
      return learned;
    }
  } catch {
    /* offline, CORS, timeout, etc. */
  }
  return null;
}

/** Best-effort PUT learned list to server (fails silently; local save already done). */
export async function trySyncLearnedToServer(
  studentId: string,
  learned: string[],
  textbookId: string = "focs",
  token?: string | null
): Promise<boolean> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetchWithTimeout(apiUrl("/api/student_bar"), {
      method: "PUT",
      headers,
      body: JSON.stringify({
        student_id: studentId,
        learned_sections: learned,
        textbook_id: textbookId || "focs",
      }),
      timeoutMs: 12_000,
    });
    return r.ok;
  } catch {
    return false;
  }
}
