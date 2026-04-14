/**
 * My Learning Bar：进度与内置目录树分离，存在本机 localStorage。
 * 联网时尽力同步到后端 /api/student_bar，供 Learning Mode 聊天侧使用同一 student_id。
 */

import { API_BASE } from "../apiBase";

const STORAGE_PREFIX = "aiTutorLearningBarV1:";

export type LocalLearningBarState = {
  learned_sections: string[];
  updated_at?: string;
};

function key(studentId: string): string {
  return STORAGE_PREFIX + studentId;
}

export function loadLocalLearningBar(studentId: string): LocalLearningBarState {
  try {
    const raw = localStorage.getItem(key(studentId));
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

export function saveLocalLearningBar(studentId: string, learned: string[]): void {
  const payload: LocalLearningBarState = {
    learned_sections: learned,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(key(studentId), JSON.stringify(payload));
}

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs = 12_000, ...rest } = init;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: ac.signal }).finally(() => clearTimeout(t));
}

/** 本机无记录时，尝试从服务器拉一次已学列表并写入本机（静默失败）。 */
export async function tryHydrateLearnedFromServer(studentId: string): Promise<string[] | null> {
  try {
    const r = await fetchWithTimeout(
      `${API_BASE}/api/student_bar?student_id=${encodeURIComponent(studentId)}`,
      { method: "GET", timeoutMs: 12_000 }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { learned_sections?: unknown };
    const learned = Array.isArray(j.learned_sections)
      ? j.learned_sections.filter((x): x is string => typeof x === "string")
      : [];
    if (learned.length > 0) {
      saveLocalLearningBar(studentId, learned);
      return learned;
    }
  } catch {
    /* 离线或 CORS 等 */
  }
  return null;
}

/** 尽力把当前已学列表同步到后端（静默失败，本机数据已先写入）。 */
export async function trySyncLearnedToServer(studentId: string, learned: string[]): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(`${API_BASE}/api/student_bar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, learned_sections: learned }),
      timeoutMs: 12_000,
    });
    return r.ok;
  } catch {
    return false;
  }
}
