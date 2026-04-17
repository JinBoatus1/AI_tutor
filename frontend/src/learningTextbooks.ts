import focsTreeBundled from "./data/focsTree.json";
import { apiUrl } from "./apiBase";

/** Bundled outline roots (same shape as FOCS tree JSON). */
export type TextbookTreeRoot = Record<string, unknown>;

const STORAGE_KEY = "ai_tutor_selected_textbook_id";
const TREE_PREFIX = "ai_tutor_textbook_tree_";
const CATALOG_KEY = "ai_tutor_textbook_catalog_v1";

/** Bumped to abandon in-flight syncTextbookCatalogFromServer (e.g. user deletes a book while sync still running). */
let textbookCatalogSyncGeneration = 0;

export function invalidateTextbookCatalogSync(): void {
  textbookCatalogSyncGeneration++;
}

export const BUILTIN_TEXTBOOK_OPTIONS: { id: string; linkLabel: string }[] = [
  { id: "focs", linkLabel: "FCOS" },
];

/** 与后端 user_textbook_store.is_valid_user_book_id 一致；仅此类 id 会请求 /api/user_textbooks/{id}/tree */
const USER_BOOK_ID_RE = /^user_[A-Za-z0-9_-]{4,64}$/;

export function isValidUploadedTextbookId(id: string): boolean {
  return USER_BOOK_ID_RE.test(id);
}

/** Same id may appear twice in corrupted localStorage; keep last label. */
function dedupeCatalogById(items: { id: string; linkLabel: string }[]): { id: string; linkLabel: string }[] {
  const map = new Map<string, string>();
  for (const row of items) {
    if (!row.id || row.id === "focs" || !isValidUploadedTextbookId(row.id)) continue;
    map.set(row.id, row.linkLabel || row.id);
  }
  return Array.from(map.entries()).map(([id, linkLabel]) => ({ id, linkLabel }));
}

function safeParseCatalog(): { id: string; linkLabel: string }[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(j?.items)) return [];
    const rows = j.items
      .filter((x): x is { id: string; linkLabel: string } => {
        const o = x as { id?: unknown; linkLabel?: unknown };
        return typeof o?.id === "string" && typeof o?.linkLabel === "string";
      })
      .filter((x) => x.id !== "focs" && isValidUploadedTextbookId(x.id));
    return dedupeCatalogById(rows);
  } catch {
    return [];
  }
}

/** Built-in + uploaded (catalog) options for pickers. */
export function readTextbookOptionList(): { id: string; linkLabel: string }[] {
  const custom = safeParseCatalog();
  const seen = new Set<string>();
  const out: { id: string; linkLabel: string }[] = [];
  for (const o of [...BUILTIN_TEXTBOOK_OPTIONS, ...custom]) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

export function writeCatalogAndTree(id: string, linkLabel: string, tree: TextbookTreeRoot): void {
  if (!isValidUploadedTextbookId(id)) return;
  const cur = dedupeCatalogById([
    ...safeParseCatalog().filter((x) => x.id !== id),
    { id, linkLabel: linkLabel || id },
  ]);
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ items: cur }));
    localStorage.setItem(TREE_PREFIX + id, JSON.stringify(tree));
  } catch {
    /* ignore */
  }
}

export function readSelectedTextbookId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length === 0) return "focs";
    if (raw === "focs") return "focs";
    if (!isValidUploadedTextbookId(raw)) {
      localStorage.removeItem(STORAGE_KEY);
      return "focs";
    }
    if (!safeParseCatalog().some((x) => x.id === raw)) {
      localStorage.setItem(STORAGE_KEY, "focs");
      queueMicrotask(() =>
        window.dispatchEvent(new CustomEvent("ai-tutor-textbook-changed", { detail: { id: "focs" } }))
      );
      return "focs";
    }
    return raw;
  } catch {
    /* ignore */
  }
  return "focs";
}

export function writeSelectedTextbookId(id: string): void {
  const safe = id === "focs" || isValidUploadedTextbookId(id) ? id : "focs";
  try {
    localStorage.setItem(STORAGE_KEY, safe);
    window.dispatchEvent(new CustomEvent("ai-tutor-textbook-changed", { detail: { id: safe } }));
  } catch {
    /* ignore */
  }
}

/** If selected id is no longer in the catalog, reset to FCOS and notify listeners. */
export function reconcileSelectedTextbookWithCatalog(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "focs") return;
    if (!isValidUploadedTextbookId(raw)) {
      writeSelectedTextbookId("focs");
      return;
    }
    if (!safeParseCatalog().some((x) => x.id === raw)) {
      writeSelectedTextbookId("focs");
    }
  } catch {
    /* ignore */
  }
}

function pruneOrphanTextbookTrees(validUploadedIds: Set<string>): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(TREE_PREFIX)) continue;
      const bookId = k.slice(TREE_PREFIX.length);
      if (isValidUploadedTextbookId(bookId) && !validUploadedIds.has(bookId)) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** After server DELETE: drop catalog + cached tree; reset selection if it pointed at this book. */
export function removeUploadedTextbookFromLocal(id: string): void {
  if (!isValidUploadedTextbookId(id)) return;
  const cur = safeParseCatalog().filter((x) => x.id !== id);
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ items: cur }));
    localStorage.removeItem(TREE_PREFIX + id);
  } catch {
    /* ignore */
  }
  reconcileSelectedTextbookWithCatalog();
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
}

/** Wipe all user-uploaded entries from this browser only (catalog + cached trees). Does not call the server. */
export function clearAllUploadedTextbooksFromBrowser(): void {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ items: [] }));
  } catch {
    /* ignore */
  }
  pruneOrphanTextbookTrees(new Set());
  reconcileSelectedTextbookWithCatalog();
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
}

export function getTextbookTree(id: string): TextbookTreeRoot {
  if (id === "focs") return focsTreeBundled as TextbookTreeRoot;
  try {
    const raw = localStorage.getItem(TREE_PREFIX + id);
    if (raw) return JSON.parse(raw) as TextbookTreeRoot;
  } catch {
    /* ignore */
  }
  return {};
}

export function getTextbookLinkLabel(id: string): string {
  return readTextbookOptionList().find((t) => t.id === id)?.linkLabel ?? id;
}

/** 将 FOCS 形目录转为 CurriculumContext 使用的 topics/chapters 结构（供 Learning Mode 侧栏匹配）。 */
export function focsOutlineToCurriculum(tree: TextbookTreeRoot): {
  topics: { topic: string; chapters: { chapter: string; key_points: string[] }[] }[];
} {
  const chapters: { chapter: string; key_points: string[] }[] = [];

  const walk = (node: TextbookTreeRoot) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === "_range" || typeof v !== "object" || v === null || Array.isArray(v)) continue;
      const child = v as TextbookTreeRoot;
      const rng = child._range as { start?: number; end?: number } | undefined;
      const s = (child.start as number | undefined) ?? rng?.start;
      const e = (child.end as number | undefined) ?? rng?.end;
      if (s != null && e != null) {
        chapters.push({ chapter: k, key_points: [] });
      }
      walk(child);
    }
  };
  walk(tree);
  return { topics: [{ topic: "Textbook", chapters }] };
}

/**
 * Fetch textbook list + trees from server into localStorage.
 * Returns false if the list request failed, was aborted, or went offline.
 */
export async function syncTextbookCatalogFromServer(token: string): Promise<boolean> {
  const myGen = ++textbookCatalogSyncGeneration;
  try {
    const r = await fetch(apiUrl("/api/user_textbooks"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (myGen !== textbookCatalogSyncGeneration) return false;
    if (!r.ok) return false;
    const data = (await r.json()) as { textbooks?: { id: string; label?: string }[] };
    if (myGen !== textbookCatalogSyncGeneration) return false;
    const items = dedupeCatalogById(
      (Array.isArray(data?.textbooks) ? data.textbooks : [])
        .filter((x) => x?.id && x.id !== "focs" && isValidUploadedTextbookId(x.id))
        .map((x) => ({ id: x.id, linkLabel: x.label || x.id }))
    );
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ items: items }));
    for (const it of items) {
      if (myGen !== textbookCatalogSyncGeneration) return false;
      const tr = await fetch(apiUrl(`/api/user_textbooks/${encodeURIComponent(it.id)}/tree`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (myGen !== textbookCatalogSyncGeneration) return false;
      if (tr.ok) {
        const tree = await tr.json();
        if (myGen !== textbookCatalogSyncGeneration) return false;
        if (tree && typeof tree === "object") {
          localStorage.setItem(TREE_PREFIX + it.id, JSON.stringify(tree));
        }
      }
    }
    if (myGen !== textbookCatalogSyncGeneration) return false;
    pruneOrphanTextbookTrees(new Set(items.map((x) => x.id)));
    reconcileSelectedTextbookWithCatalog();
    window.dispatchEvent(
      new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
    );
    return true;
  } catch {
    return false;
  }
}
