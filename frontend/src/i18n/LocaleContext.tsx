import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { chatLanguageSuffix, formatMessage, MESSAGES, type MessageKey } from "./messages";
import { LOCALE_CHANGED_EVENT, readStoredLocale, writeStoredLocale } from "./localeStorage";
import type { AppLocale } from "./types";
import { APP_LOCALES } from "./types";

type LocaleContextValue = {
  locale: AppLocale;
  /** One-click switch: updates UI strings, html lang, storage, and AI reply language. */
  applyLocale: (next: AppLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string>) => string;
  chatLanguageSuffix: () => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function htmlLangFor(locale: AppLocale): string {
  if (locale === "zh") return "zh-Hans";
  if (locale === "es") return "es";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => readStoredLocale());

  useLayoutEffect(() => {
    document.documentElement.lang = htmlLangFor(locale);
  }, [locale]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "ai_tutor_system_locale") return;
      const next = readStoredLocale();
      setLocale(next);
    };
    const onCustom = () => setLocale(readStoredLocale());
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCALE_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCALE_CHANGED_EVENT, onCustom);
    };
  }, []);

  const applyLocale = useCallback((next: AppLocale) => {
    if (!APP_LOCALES.includes(next)) return;
    writeStoredLocale(next);
    setLocale(next);
    document.documentElement.lang = htmlLangFor(next);
    window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string>) => {
      const template = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
      return formatMessage(template, vars);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      applyLocale,
      t,
      chatLanguageSuffix: () => chatLanguageSuffix(locale),
    }),
    [locale, applyLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
