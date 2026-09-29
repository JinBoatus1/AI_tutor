export type AppLocale = "en" | "zh" | "es";

export const APP_LOCALES: AppLocale[] = ["en", "zh", "es"];

export const LOCALE_NATIVE_LABELS: Record<AppLocale, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};
