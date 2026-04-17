export type PageBackgroundId = "default" | "mint" | "dark" | "warm" | "white" | "black";

const STORAGE_KEY = "ai_tutor_profile_settings";

export const PAGE_BACKGROUND_OPTIONS: {
  id: PageBackgroundId;
  label: string;
  color: string;
}[] = [
  { id: "default", label: "Default", color: "#e6eaf2" },
  { id: "mint", label: "Mint", color: "#e0f2f0" },
  { id: "dark", label: "Dark", color: "#1e293b" },
  { id: "warm", label: "Warm", color: "#f5f0e8" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "black", label: "Black", color: "#0a0a0a" },
];

const BG_CSS: Record<PageBackgroundId, string> = {
  default: "#e6eaf2",
  mint: "#e0f2f0",
  dark: "#1e293b",
  warm: "#f5f0e8",
  white: "#ffffff",
  black: "#0a0a0a",
};

export function applyPageBackground(id: PageBackgroundId): void {
  const hex = BG_CSS[id] ?? BG_CSS.default;
  document.documentElement.style.setProperty("--app-page-bg", hex);
}

export function readPageBackground(): PageBackgroundId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "default";
    const j = JSON.parse(raw) as { pageBackground?: string };
    const id = j.pageBackground as PageBackgroundId | undefined;
    if (id && id in BG_CSS) return id;
  } catch {
    /* ignore */
  }
  return "default";
}

export function writePageBackground(id: PageBackgroundId): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageBackground: id }));
  } catch {
    /* ignore */
  }
}
