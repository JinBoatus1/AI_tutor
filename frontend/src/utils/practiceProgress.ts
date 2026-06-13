// T11 — localStorage persistence for per-chapter practice progress. Versioned +
// namespaced key, guarded parse with empty fallback (eng-review #9). Storage is
// injectable so the logic is unit-testable without a real browser.
import { emptyProgress, type PracticeProgress } from "../practice/types";

const VERSION = "v1";

function storageKey(textbookId: string, chapter: string): string {
  return `practice.${VERSION}.${textbookId}.${chapter}`;
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Coerce an untrusted parsed value into a valid PracticeProgress, dropping junk. */
export function sanitizeProgress(value: unknown): PracticeProgress {
  const base = emptyProgress();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    warmupDone: v.warmupDone === true,
    practiceCorrect: isStringBoolMap(v.practiceCorrect) ? (v.practiceCorrect as Record<string, boolean>) : {},
    practiceAttempted: isStringBoolMap(v.practiceAttempted) ? (v.practiceAttempted as Record<string, boolean>) : {},
    challengeSolved: Array.isArray(v.challengeSolved) ? v.challengeSolved.filter((x): x is string => typeof x === "string") : [],
  };
}

function isStringBoolMap(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every((x) => typeof x === "boolean");
}

export function loadProgress(
  textbookId: string,
  chapter: string,
  storage: Storage | null = defaultStorage(),
): PracticeProgress {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(storageKey(textbookId, chapter));
    if (!raw) return emptyProgress();
    return sanitizeProgress(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  textbookId: string,
  chapter: string,
  progress: PracticeProgress,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey(textbookId, chapter), JSON.stringify(progress));
  } catch {
    /* quota / private mode — non-fatal */
  }
}
