/** Appearance: which Paper & Ink variant the app uses (spec §4.4). Stored only in this browser. */
export type ThemeId = "paper" | "bright" | "night";

/** Night ships in PR2. While false, it is neither offered nor applied. Keep index.html in sync. */
export const NIGHT_AVAILABLE = false;

export const STORAGE_KEY = "ai_tutor_profile_settings";

/** The six pre-Paper-&-Ink presets and their nearest variant (spec D4). Keep index.html in sync. */
export const LEGACY_THEME_MAP: Readonly<Record<string, ThemeId>> = {
  default: "paper",
  warm: "paper",
  mint: "paper",
  white: "bright",
  dark: "night",
  black: "night",
};

export const THEME_OPTIONS: readonly ThemeId[] = NIGHT_AVAILABLE
  ? ["paper", "bright", "night"]
  : ["paper", "bright"];

function isThemeId(value: unknown): value is ThemeId {
  return value === "paper" || value === "bright" || value === "night";
}

/** The variant to show for a parsed storage value. The inline script in index.html mirrors this. */
export function resolveTheme(stored: unknown): ThemeId {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return "paper";
  const record = stored as Record<string, unknown>;
  let id: ThemeId | undefined = isThemeId(record.theme) ? record.theme : undefined;
  const legacy = record.pageBackground;
  if (!id && typeof legacy === "string" && Object.prototype.hasOwnProperty.call(LEGACY_THEME_MAP, legacy)) {
    id = LEGACY_THEME_MAP[legacy];
  }
  if (!id || (id === "night" && !NIGHT_AVAILABLE)) return "paper";
  return id;
}

export function readTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return resolveTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return "paper";
  }
}

export function writeTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: id }));
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  if (id === "paper") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
}
