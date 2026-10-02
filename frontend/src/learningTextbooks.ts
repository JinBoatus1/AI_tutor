import { apiUrl } from "./apiBase";
import { DEFAULT_BOOK_ID, builtinBookOptions, getBook, isBuiltinBook } from "./books/registry";
import type { TextbookTreeRoot } from "./books/registry";

/** Bundled outline roots (same shape as FOCS tree JSON). */
export type { TextbookTreeRoot };

/** Only the last-selected id is persisted in the browser; lists and trees come from the API (server data dir). */
const STORAGE_KEY = "ai_tutor_selected_textbook_id";
/** Legacy keys — removed on first successful server fetch. */
const TREE_PREFIX = "ai_tutor_textbook_tree_";
const CATALOG_KEY = "ai_tutor_textbook_catalog_v1";

let textbookCatalogSyncGeneration = 0;

export function invalidateTextbookCatalogSync(): void {
  textbookCatalogSyncGeneration++;
}

const USER_BOOK_ID_RE = /^user_[A-Za-z0-9_-]{4,64}$/;

export function isValidUploadedTextbookId(id: string): boolean {
  return USER_BOOK_ID_RE.test(id);
}

/** Membership tests here, and in fetchTextbookOptionsFromServer and
 *  resetServerTextbookSessionForLogout, are AND-gated with isValidUploadedTextbookId, which
 *  already rejects any id lacking a `user_` prefix. They are therefore equivalent to the old
 *  `id === "focs"` literal for every realistic builtin id, and are kept for consistency with
 *  the registry idiom rather than because they change behaviour today. The checks that DO
 *  carry weight are in readSelectedTextbookId and reconcileSelectedTextbookWithCatalog, both
 *  pinned by the second-builtin fixture tests. */
function dedupeCatalogById(items: { id: string; linkLabel: string }[]): { id: string; linkLabel: string }[] {
  const map = new Map<string, string>();
  for (const row of items) {
    if (!row.id || isBuiltinBook(row.id) || !isValidUploadedTextbookId(row.id)) continue;
    map.set(row.id, row.linkLabel || row.id);
  }
  return Array.from(map.entries()).map(([id, linkLabel]) => ({ id, linkLabel }));
}

/** Last successful GET /api/user_textbooks (upload rows only). */
let lastServerUploads: { id: string; linkLabel: string }[] = [];
const lastServerIdSet = new Set<string>();
/** After at least one successful list fetch (or explicit clear), selection can be validated against lastServerIdSet. */
let serverUploadsLoaded = false;

const sessionTreeCache = new Map<string, TextbookTreeRoot>();

function setServerUploadCatalog(items: { id: string; linkLabel: string }[]): void {
  lastServerUploads = dedupeCatalogById(items);
  lastServerIdSet.clear();
  for (const x of lastServerUploads) {
    lastServerIdSet.add(x.id);
  }
  serverUploadsLoaded = true;
}

function purgeLegacyTextbookLocalStorage(): void {
  try {
    localStorage.removeItem(CATALOG_KEY);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TREE_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** FOCS + last server list (in-memory). Not persisted to localStorage.
 *  Calls builtinBookOptions() live rather than caching it, so a builtin registered after
 *  module load — the only way tests can simulate a second builtin book today — is still
 *  served, matching the backend's live bb.list_builtin(). */
export function readTextbookOptionList(): { id: string; linkLabel: string }[] {
  const seen = new Set<string>();
  const out: { id: string; linkLabel: string }[] = [];
  for (const o of [...builtinBookOptions(), ...lastServerUploads]) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

/** Fetch textbook rows from server, refresh in-memory catalog, strip legacy web cache, reconcile selection. */
export async function fetchTextbookOptionsFromServer(token: string): Promise<{ id: string; linkLabel: string }[]> {
  const myGen = ++textbookCatalogSyncGeneration;
  const r = await fetch(apiUrl("/api/user_textbooks"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (myGen !== textbookCatalogSyncGeneration) throw new Error("aborted");
  if (!r.ok) throw new Error(`list ${r.status}`);
  const data = (await r.json()) as { textbooks?: { id: string; label?: string }[] };
  if (myGen !== textbookCatalogSyncGeneration) throw new Error("aborted");
  const items = dedupeCatalogById(
    (Array.isArray(data?.textbooks) ? data.textbooks : [])
      .filter((x) => x?.id && !isBuiltinBook(x.id) && isValidUploadedTextbookId(x.id))
      .map((x) => ({ id: x.id, linkLabel: x.label || x.id }))
  );
  purgeLegacyTextbookLocalStorage();
  setServerUploadCatalog(items);
  sessionTreeCache.clear();
  reconcileSelectedTextbookWithCatalog();
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
  return readTextbookOptionList();
}

/** After upload: put tree in session + append row (no localStorage catalog). */
export function writeCatalogAndTree(id: string, linkLabel: string, tree: TextbookTreeRoot): void {
  if (!isValidUploadedTextbookId(id)) return;
  sessionTreeCache.set(id, tree);
  const others = lastServerUploads.filter((x) => x.id !== id);
  setServerUploadCatalog([...others, { id, linkLabel: linkLabel || id }]);
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
}

export function readSelectedTextbookId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length === 0) return DEFAULT_BOOK_ID;
    if (isBuiltinBook(raw)) return raw;
    if (!isValidUploadedTextbookId(raw)) {
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_BOOK_ID;
    }
    if (serverUploadsLoaded && !lastServerIdSet.has(raw)) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_BOOK_ID);
      queueMicrotask(() =>
        window.dispatchEvent(new CustomEvent("ai-tutor-textbook-changed", { detail: { id: DEFAULT_BOOK_ID } }))
      );
      return DEFAULT_BOOK_ID;
    }
    return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_BOOK_ID;
}

export function writeSelectedTextbookId(id: string): void {
  const safe = isBuiltinBook(id) || isValidUploadedTextbookId(id) ? id : DEFAULT_BOOK_ID;
  try {
    localStorage.setItem(STORAGE_KEY, safe);
    window.dispatchEvent(new CustomEvent("ai-tutor-textbook-changed", { detail: { id: safe } }));
  } catch {
    /* ignore */
  }
}

export function reconcileSelectedTextbookWithCatalog(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || isBuiltinBook(raw)) return;
    if (!isValidUploadedTextbookId(raw)) {
      writeSelectedTextbookId(DEFAULT_BOOK_ID);
      return;
    }
    if (serverUploadsLoaded && !lastServerIdSet.has(raw)) {
      writeSelectedTextbookId(DEFAULT_BOOK_ID);
    }
  } catch {
    /* ignore */
  }
}

export function removeUploadedTextbookFromLocal(id: string): void {
  if (!isValidUploadedTextbookId(id)) return;
  sessionTreeCache.delete(id);
  lastServerUploads = lastServerUploads.filter((x) => x.id !== id);
  lastServerIdSet.delete(id);
  try {
    localStorage.removeItem(TREE_PREFIX + id);
  } catch {
    /* ignore */
  }
  reconcileSelectedTextbookWithCatalog();
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
}

export function clearAllUploadedTextbooksFromBrowser(): void {
  sessionTreeCache.clear();
  lastServerUploads = [];
  lastServerIdSet.clear();
  serverUploadsLoaded = true;
  purgeLegacyTextbookLocalStorage();
  writeSelectedTextbookId(DEFAULT_BOOK_ID);
  window.dispatchEvent(
    new CustomEvent("ai-tutor-textbook-changed", { detail: { id: readSelectedTextbookId() } })
  );
}

/** FOCS from bundle; user books from session cache (filled by fetchTree / writeCatalogAndTree). */
export function getTextbookTree(id: string): TextbookTreeRoot {
  if (isBuiltinBook(id)) return getBook(id).tree;
  return sessionTreeCache.get(id) ?? {};
}

/** Load outline for one book; uses session cache. */
export async function fetchTextbookTreeForId(
  token: string | null | undefined,
  id: string
): Promise<TextbookTreeRoot> {
  if (isBuiltinBook(id)) return getBook(id).tree;
  if (!isValidUploadedTextbookId(id)) return {};
  if (sessionTreeCache.has(id)) return sessionTreeCache.get(id)!;
  if (!token) return {};
  const myGen = textbookCatalogSyncGeneration;
  const tr = await fetch(apiUrl(`/api/user_textbooks/${encodeURIComponent(id)}/tree`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (myGen !== textbookCatalogSyncGeneration) return sessionTreeCache.get(id) ?? {};
  if (!tr.ok) {
    sessionTreeCache.set(id, {});
    return {};
  }
  const tree = (await tr.json()) as TextbookTreeRoot;
  if (tree && typeof tree === "object") {
    sessionTreeCache.set(id, tree);
    return tree;
  }
  return {};
}

export function getTextbookLinkLabel(id: string): string {
  return readTextbookOptionList().find((t) => t.id === id)?.linkLabel ?? id;
}

export function outlineToCurriculum(tree: TextbookTreeRoot): {
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

/** Refreshes in-memory catalog from server (same as opening Learning / Profile with token). */
export async function syncTextbookCatalogFromServer(token: string): Promise<boolean> {
  try {
    await fetchTextbookOptionsFromServer(token);
    return true;
  } catch {
    return false;
  }
}

/** Call on logout so the next user does not inherit the previous account’s in-memory list. */
export function resetServerTextbookSessionForLogout(): void {
  lastServerUploads = [];
  lastServerIdSet.clear();
  serverUploadsLoaded = false;
  sessionTreeCache.clear();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && !isBuiltinBook(raw) && isValidUploadedTextbookId(raw)) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_BOOK_ID);
      queueMicrotask(() =>
        window.dispatchEvent(new CustomEvent("ai-tutor-textbook-changed", { detail: { id: DEFAULT_BOOK_ID } }))
      );
    }
  } catch {
    /* ignore */
  }
}

/** Short label of a textbook (e.g. "FOCS", "Signals") for headers; null when the id is unknown. */
export function textbookLinkLabel(bookId: string): string | null {
  return readTextbookOptionList().find((o) => o.id === bookId)?.linkLabel ?? null;
}
