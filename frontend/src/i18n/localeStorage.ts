import type { AppLocale } from "./types";

const STORAGE_KEY = "ai_tutor_system_locale";

export function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "zh" || raw === "es") return raw;
  } catch {
    /* ignore */
  }
  return "en";
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export const LOCALE_CHANGED_EVENT = "ai-tutor-locale-changed";
