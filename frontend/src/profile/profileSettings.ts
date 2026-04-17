export type PageBackgroundId = "default" | "mint" | "dark" | "warm" | "white" | "black";

const STORAGE_KEY = "ai_tutor_profile_settings";

/** Outer page chrome + Learning Mode chat panel (dialog) surface — paired for readability. */
const THEME: Record<PageBackgroundId, { page: string; chat: string }> = {
  default: { page: "#e6eaf2", chat: "#ffffff" },
  mint: { page: "#e0f2f0", chat: "#f5fdfb" },
  dark: { page: "#1e293b", chat: "#fefefe" },
  warm: { page: "#f5f0e8", chat: "#fffdf9" },
  white: { page: "#ffffff", chat: "#fafafa" },
  black: { page: "#0a0a0a", chat: "#f3f4f6" },
};

const LABELS: Record<PageBackgroundId, string> = {
  default: "Default",
  mint: "Mint",
  dark: "Dark",
  warm: "Warm",
  white: "White",
  black: "Black",
};

export const PAGE_BACKGROUND_OPTIONS: {
  id: PageBackgroundId;
  label: string;
  /** Swatch: page + chat split preview */
  page: string;
  chat: string;
}[] = (Object.keys(THEME) as PageBackgroundId[]).map((id) => ({
  id,
  label: LABELS[id],
  page: THEME[id].page,
  chat: THEME[id].chat,
}));

export function applyPageBackground(id: PageBackgroundId): void {
  const t = THEME[id] ?? THEME.default;
  document.documentElement.style.setProperty("--app-page-bg", t.page);
  document.documentElement.style.setProperty("--app-chat-panel-bg", t.chat);
}

export function readPageBackground(): PageBackgroundId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "default";
    const j = JSON.parse(raw) as { pageBackground?: string };
    const id = j.pageBackground as PageBackgroundId | undefined;
    if (id && id in THEME) return id;
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
