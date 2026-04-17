import focsTreeBundled from "./data/focsTree.json";

/** Bundled outline roots (same shape as FOCS tree JSON). */
export type TextbookTreeRoot = Record<string, unknown>;

export type TextbookId = "focs";

const STORAGE_KEY = "ai_tutor_selected_textbook_id";

export const TEXTBOOK_OPTIONS: { id: TextbookId; linkLabel: string }[] = [
  { id: "focs", linkLabel: "FCOS" },
];

export function readSelectedTextbookId(): TextbookId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "focs") return "focs";
  } catch {
    /* ignore */
  }
  return "focs";
}

export function writeSelectedTextbookId(id: TextbookId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getTextbookTree(id: TextbookId): TextbookTreeRoot {
  switch (id) {
    case "focs":
      return focsTreeBundled as TextbookTreeRoot;
    default:
      return focsTreeBundled as TextbookTreeRoot;
  }
}

export function getTextbookLinkLabel(id: TextbookId): string {
  return TEXTBOOK_OPTIONS.find((t) => t.id === id)?.linkLabel ?? "FCOS";
}
