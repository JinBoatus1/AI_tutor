import { emptyGuideProgress, type GuideProgress } from "../guide/types";

const VERSION = "v1";

function storageKey(textbookId: string, chapter: string): string {
  return `guide.${VERSION}.${textbookId}.${chapter}`;
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function sanitizeGuideProgress(value: unknown): GuideProgress {
  const base = emptyGuideProgress();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    completedStepIds: Array.isArray(v.completedStepIds)
      ? v.completedStepIds.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function loadGuideProgress(
  textbookId: string,
  chapter: string,
  storage: Storage | null = defaultStorage(),
): GuideProgress {
  if (!storage) return emptyGuideProgress();
  try {
    const raw = storage.getItem(storageKey(textbookId, chapter));
    if (!raw) return emptyGuideProgress();
    return sanitizeGuideProgress(JSON.parse(raw));
  } catch {
    return emptyGuideProgress();
  }
}

export function saveGuideProgress(
  textbookId: string,
  chapter: string,
  progress: GuideProgress,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey(textbookId, chapter), JSON.stringify(progress));
  } catch {
    /* non-fatal */
  }
}
