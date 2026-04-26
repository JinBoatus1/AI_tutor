import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import "./MyLearningBar.css";
import { getOrCreateStudentId } from "./utils/studentId";
import { useAuth } from "./context/AuthContext";
import {
  fetchTextbookOptionsFromServer,
  fetchTextbookTreeForId,
  getTextbookLinkLabel,
  getTextbookTree,
  isValidUploadedTextbookId,
  readSelectedTextbookId,
  readTextbookOptionList,
  reconcileSelectedTextbookWithCatalog,
  resetServerTextbookSessionForLogout,
  writeSelectedTextbookId,
} from "./learningTextbooks";
import {
  loadLocalLearningBar,
  saveLocalLearningBar,
  tryHydrateLearnedFromServer,
  trySyncLearnedToServer,
} from "./utils/learningBarLocalStorage";

type FocsNode = Record<string, unknown>;

export type LearningBarPanelVariant = "page" | "embed";

export type OutlineSectionPreviewDetail = {
  sectionTitle: string;
  path: string;
  startBook: number;
  endBook: number;
  /** 标题首段编号（如 8、8.1）；旧后端无 /api/textbook_pages 时用对话同款章节解析拉页 */
  sectionHint: string;
};

export type LearningBarPanelProps = {
  variant: LearningBarPanelVariant;
  /** When set (e.g. from Learning Mode), progress uses the same student id as the chat session. */
  studentId?: string;
  /** Shown on the same row as the title (e.g. collapse control in Learning Mode). */
  embedHeaderEnd?: ReactNode;
  /** Learning Mode: click a row with page numbers → open PDF pages in the textbook panel. */
  onOutlineSectionPreview?: (detail: OutlineSectionPreviewDetail) => void;
};

function firstSectionToken(title: string): string | null {
  const w = title.trim().split(/\s+/)[0] ?? "";
  return /^\d+(?:\.\d+)*$/.test(w) ? w : null;
}

/** 与 Python len(str) 对齐：Unicode 码位个数（非 UTF-16 长度） */
function pathStringLen(path: string): number {
  let n = 0;
  for (const _ of path) n++;
  return n;
}

/** 与 backend student_bar_store._path_section_token 一致：FNV-1a / UTF-8 */
function pathBasedToken(path: string): string {
  const bytes = new TextEncoder().encode(path);
  let h = 2166136261 >>> 0;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `p${pathStringLen(path)}_${h.toString(16)}`;
}

function sectionTokenForNode(title: string, path: string): string {
  return firstSectionToken(title) ?? pathBasedToken(path);
}

function formatRange(node: FocsNode): string {
  const r = node._range as { start?: number; end?: number } | undefined;
  if (r && r.start != null) {
    const e = r.end ?? r.start;
    return r.start === e ? `(p. ${r.start})` : `(pp. ${r.start}–${e})`;
  }
  const s = node.start as number | undefined;
  const e = node.end as number | undefined;
  if (s != null && e != null) {
    return s === e ? `(p. ${s})` : `(pp. ${s}–${e})`;
  }
  return "";
}

/** Outline book page range (printed / logical pages in JSON), same as backend chat uses before PDF offset. */
function bookPageRangeFromNode(node: FocsNode): { start: number; end: number } | null {
  const r = node._range as { start?: number; end?: number } | undefined;
  if (r && r.start != null) {
    const e = r.end ?? r.start;
    return { start: r.start, end: e };
  }
  const s = node.start as number | undefined;
  const e = node.end as number | undefined;
  if (s != null && e != null) return { start: s, end: e };
  return null;
}

function childEntries(node: FocsNode): [string, FocsNode][] {
  return Object.entries(node).filter(
    ([k, v]) =>
      k !== "_range" &&
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v)
  ) as [string, FocsNode][];
}

function collectDescendantSectionTokens(n: FocsNode, parentPath: string): string[] {
  const out: string[] = [];
  for (const [childTitle, childNode] of childEntries(n)) {
    const childPath = `${parentPath}/${childTitle}`;
    out.push(sectionTokenForNode(childTitle, childPath));
    out.push(...collectDescendantSectionTokens(childNode, childPath));
  }
  return out;
}

function sortSectionTokens(tokens: string[]): string[] {
  const numeric = (t: string) => /^\d+(?:\.\d+)*$/.test(t);
  return [...tokens].sort((a, b) => {
    const numA = numeric(a);
    const numB = numeric(b);
    if (numA !== numB) return numA ? -1 : 1;
    if (numA && numB) {
      const pa = a.split(".").map((x) => parseInt(x, 10));
      const pb = b.split(".").map((x) => parseInt(x, 10));
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
      }
      return 0;
    }
    return a.localeCompare(b);
  });
}

function collectExpandablePaths(tree: FocsNode): string[] {
  const out: string[] = [];
  function walk(path: string, node: FocsNode) {
    const kids = childEntries(node);
    if (kids.length === 0) return;
    out.push(path);
    for (const [childTitle, childNode] of kids) {
      walk(`${path}/${childTitle}`, childNode);
    }
  }
  for (const [title, node] of childEntries(tree)) {
    walk(title, node);
  }
  return out;
}

function FocsTreeBranch({
  title,
  node,
  learnedSet,
  onToggleToken,
  expanded,
  onToggleExpand,
  path,
  onOpenPages,
}: {
  title: string;
  node: FocsNode;
  learnedSet: Set<string>;
  onToggleToken: (token: string, subtreeRoot?: FocsNode, subtreePath?: string) => void;
  expanded: Record<string, boolean>;
  onToggleExpand: (path: string) => void;
  path: string;
  onOpenPages?: (detail: OutlineSectionPreviewDetail) => void;
}) {
  const token = sectionTokenForNode(title, path);
  const rangeStr = formatRange(node);
  const bookRange = bookPageRangeFromNode(node);
  const children = childEntries(node);
  const hasKids = children.length > 0;
  const isOpen = expanded[path] !== false;
  const learned = learnedSet.has(token);
  const splitLearnAndTitle = Boolean(onOpenPages);

  const toggleLearned = () =>
    onToggleToken(token, hasKids ? node : undefined, hasKids ? path : undefined);

  const titleClick = () => {
    if (onOpenPages && bookRange) {
      onOpenPages({
        sectionTitle: title,
        path,
        startBook: bookRange.start,
        endBook: bookRange.end,
        sectionHint: firstSectionToken(title) ?? "",
      });
    } else {
      toggleLearned();
    }
  };

  const learnDotTitle = learned
    ? hasKids
      ? "Mark this chapter and all subsections as not learned"
      : "Mark as not yet learned"
    : hasKids
      ? "Mark this chapter and all subsections as learned"
      : "Mark as learned";

  const titleBtnTitle = splitLearnAndTitle
    ? bookRange
      ? "Show these pages in the textbook panel"
      : learnDotTitle
    : learnDotTitle;

  return (
    <li className="focs-node">
      <div className="focs-node__row focs-node__row--toggle">
        {hasKids ? (
          <button
            type="button"
            className="focs-node__chevron"
            onClick={() => onToggleExpand(path)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? "▼" : "▶"}
          </button>
        ) : (
          <span className="focs-node__chevron focs-node__chevron--spacer">▶</span>
        )}
        {splitLearnAndTitle ? (
          <button
            type="button"
            className={`focs-node__learn-dot ${learned ? "focs-node__learn-dot--on" : "focs-node__learn-dot--off"}`}
            onClick={toggleLearned}
            aria-pressed={learned}
            aria-label={learnDotTitle}
          />
        ) : null}
        <button
          type="button"
          className={`focs-node__label ${
            learned
              ? "focs-node__label--learned focs-node__label--toggle"
              : "focs-node__label--not focs-node__label--toggle"
          }`}
          onClick={titleClick}
          title={titleBtnTitle}
        >
          {title}
          {rangeStr ? <span className="focs-node__range">{rangeStr}</span> : null}
        </button>
      </div>
      {hasKids && isOpen ? (
        <ul className="focs-node__children">
          {children.map(([k, v]) => (
            <FocsTreeBranch
              key={path + "/" + k}
              title={k}
              node={v}
              learnedSet={learnedSet}
              onToggleToken={onToggleToken}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              path={path + "/" + k}
              onOpenPages={onOpenPages}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function LearningBarPanel({
  variant,
  studentId: studentIdProp,
  embedHeaderEnd,
  onOutlineSectionPreview,
}: LearningBarPanelProps) {
  const { token } = useAuth();
  const location = useLocation();
  const [fallbackStudentId] = useState(() => getOrCreateStudentId());
  const studentId = studentIdProp ?? fallbackStudentId;
  const [learned, setLearned] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookOptions, setBookOptions] = useState(() => readTextbookOptionList());
  const [selectedTextbookId, setSelectedTextbookId] = useState<string>(() => readSelectedTextbookId());
  const [outlineTree, setOutlineTree] = useState<FocsNode>(() => getTextbookTree("focs") as FocsNode);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const bookBtnRef = useRef<HTMLButtonElement>(null);
  const bookPopoverRef = useRef<HTMLDivElement>(null);
  /** 换书前把当前内存里的 learned 写回「上一本书」的 key，避免未落盘的进度被丢掉 */
  const learnedRef = useRef<string[]>([]);
  const prevTextbookIdRef = useRef<string | null>(null);
  const prevStudentIdRef = useRef(studentId);

  const learnedSet = useMemo(() => new Set(learned), [learned]);

  useLayoutEffect(() => {
    reconcileSelectedTextbookWithCatalog();
    setSelectedTextbookId(readSelectedTextbookId());
    setBookOptions(readTextbookOptionList());
  }, []);

  useEffect(() => {
    reconcileSelectedTextbookWithCatalog();
    setSelectedTextbookId(readSelectedTextbookId());
    setBookOptions(readTextbookOptionList());
    if (token) {
      void fetchTextbookOptionsFromServer(token).catch(() => {});
    }
  }, [location.pathname, token]);

  useEffect(() => {
    if (!token) {
      resetServerTextbookSessionForLogout();
      if (isValidUploadedTextbookId(readSelectedTextbookId())) {
        writeSelectedTextbookId("focs");
      }
      setBookOptions(readTextbookOptionList());
      setSelectedTextbookId(readSelectedTextbookId());
      setOutlineTree(getTextbookTree("focs") as FocsNode);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await fetchTextbookOptionsFromServer(token);
        if (cancelled) return;
        reconcileSelectedTextbookWithCatalog();
        setBookOptions(readTextbookOptionList());
        setSelectedTextbookId(readSelectedTextbookId());
      } catch {
        if (!cancelled) {
          setBookOptions(readTextbookOptionList());
          setSelectedTextbookId(readSelectedTextbookId());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tree = (await fetchTextbookTreeForId(token, selectedTextbookId)) as FocsNode;
      if (!cancelled) {
        setOutlineTree(tree && typeof tree === "object" && Object.keys(tree).length > 0 ? tree : ({} as FocsNode));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTextbookId, token]);

  useEffect(() => {
    const onChange = () => {
      reconcileSelectedTextbookWithCatalog();
      setSelectedTextbookId(readSelectedTextbookId());
      setBookOptions(readTextbookOptionList());
    };
    window.addEventListener("ai-tutor-textbook-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ai-tutor-textbook-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    learnedRef.current = learned;
  }, [learned]);

  useEffect(() => {
    const sidChanged = prevStudentIdRef.current !== studentId;
    prevStudentIdRef.current = studentId;

    const prevBook = prevTextbookIdRef.current;
    if (!sidChanged && prevBook !== null && prevBook !== selectedTextbookId) {
      saveLocalLearningBar(studentId, learnedRef.current, prevBook);
      void trySyncLearnedToServer(studentId, learnedRef.current, prevBook, token);
    }
    prevTextbookIdRef.current = selectedTextbookId;
    const local = loadLocalLearningBar(studentId, selectedTextbookId);
    setLearned(local.learned_sections);
    setHydrated(true);
  }, [studentId, selectedTextbookId, token]);

  useEffect(() => {
    if (!hydrated) return;
    if (learned.length > 0) return;
    let cancelled = false;
    void (async () => {
      const fromServer = await tryHydrateLearnedFromServer(studentId, selectedTextbookId, token);
      if (cancelled || !fromServer?.length) return;
      setLearned(fromServer);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, learned.length, studentId, selectedTextbookId, token]);

  const persistLearned = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setError(null);
      setSyncHint(null);
      try {
        saveLocalLearningBar(studentId, next, selectedTextbookId);
        setLearned(next);
        const ok = await trySyncLearnedToServer(studentId, next, selectedTextbookId, token);
        setSyncHint(
          ok
            ? variant === "embed"
              ? "Synced to server."
              : "Synced to server (Learning Mode will use the same progress)."
            : variant === "embed"
              ? "Saved on this device; could not reach the server."
              : "Saved on this device; could not reach the server—Learning Mode may be out of sync."
        );
      } catch (e) {
        const msg = (e as Error).message || "Save failed.";
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [studentId, variant, selectedTextbookId, token]
  );

  const onToggleToken = useCallback(
    (token: string, subtreeRoot?: FocsNode, subtreePath?: string) => {
      const batch =
        subtreeRoot != null && subtreePath != null
          ? Array.from(new Set([token, ...collectDescendantSectionTokens(subtreeRoot, subtreePath)]))
          : [token];
      const next = new Set(learned);
      const allMarked = batch.every((t) => next.has(t));
      if (allMarked) {
        for (const t of batch) next.delete(t);
      } else {
        for (const t of batch) next.add(t);
      }
      void persistLearned(sortSectionTokens(Array.from(next)));
    },
    [learned, persistLearned]
  );

  const onToggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const open = prev[path] !== false;
      return { ...prev, [path]: !open };
    });
  }, []);

  const rootEntries = useMemo(() => childEntries(outlineTree), [outlineTree]);
  const expandablePaths = useMemo(() => collectExpandablePaths(outlineTree), [outlineTree]);

  useEffect(() => {
    setExpanded({});
  }, [selectedTextbookId]);

  useEffect(() => {
    if (!bookPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (bookPopoverRef.current?.contains(t)) return;
      if (bookBtnRef.current?.contains(t)) return;
      setBookPickerOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setBookPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [bookPickerOpen]);

  const expandAllSections = useCallback(() => setExpanded({}), []);
  const collapseAllSections = useCallback(() => {
    setExpanded(Object.fromEntries(expandablePaths.map((p) => [p, false] as const)));
  }, [expandablePaths]);

  const embedWrap = (body: ReactNode) => (
    <div
      className="learning-bar-embed"
      aria-label={`Learning progress for ${getTextbookLinkLabel(selectedTextbookId)}`}
    >
      <div className="learning-bar-embed-scroll">{body}</div>
    </div>
  );

  if (!hydrated) {
    const loading = <p className="my-learning-bar-status">Loading…</p>;
    return variant === "embed" ? embedWrap(loading) : <div className="my-learning-bar-page">{loading}</div>;
  }

  const titleWrapInner = (
    <>
      <h1 className="my-learning-bar-title">
        Learning progress for{" "}
        <button
          type="button"
          ref={bookBtnRef}
          className="my-learning-bar-book-link"
          onClick={() => setBookPickerOpen((o) => !o)}
          aria-expanded={bookPickerOpen}
          aria-haspopup="listbox"
          aria-controls="learning-textbook-picker"
        >
          {getTextbookLinkLabel(selectedTextbookId)}
        </button>
      </h1>
      {bookPickerOpen ? (
        <div
          id="learning-textbook-picker"
          ref={bookPopoverRef}
          className="my-learning-bar-book-popover"
          role="listbox"
          aria-label="Choose textbook"
        >
          <div className="my-learning-bar-book-popover-hint">Choose textbook</div>
          {bookOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={selectedTextbookId === opt.id}
              className={`my-learning-bar-book-option ${
                selectedTextbookId === opt.id ? "my-learning-bar-book-option--active" : ""
              }`}
              onClick={() => {
                setSelectedTextbookId(opt.id);
                writeSelectedTextbookId(opt.id);
                setBookPickerOpen(false);
              }}
            >
              <span>{opt.linkLabel}</span>
              {selectedTextbookId === opt.id ? (
                <span className="my-learning-bar-book-check" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );

  const main = (
    <>
      <header className="my-learning-bar-header">
        {variant === "embed" ? (
          <div className="my-learning-bar-top-row">
            <div className="my-learning-bar-title-wrap">{titleWrapInner}</div>
            {embedHeaderEnd ? <div className="my-learning-bar-top-row-actions">{embedHeaderEnd}</div> : null}
          </div>
        ) : (
          <div className="my-learning-bar-title-wrap">{titleWrapInner}</div>
        )}
        <p className="my-learning-bar-meta">
          {variant === "embed" ? (
            <>
              {
                "Click the dot to toggle learned / not learned. Click the section title (when it has page numbers) to open those pages in the textbook panel. Same data as on the My Learning bar page."
              }
              {saving ? <span className="my-learning-bar-saving"> · Saving…</span> : null}
            </>
          ) : (
            <>
              This page shows your progress against the textbook outline.
              <br />
              Click any topic to toggle learned / not learned.
              {saving ? <span className="my-learning-bar-saving"> · Saving…</span> : null}
            </>
          )}
        </p>
        {error ? <p className="my-learning-bar-status my-learning-bar-status--error">{error}</p> : null}
        {syncHint && !error ? (
          <p className="my-learning-bar-status" style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            {syncHint}
          </p>
        ) : null}
        <div className="my-learning-bar-legend">
          <span>
            <span className="my-learning-bar-dot my-learning-bar-dot--learned" aria-hidden />
            Learned
          </span>
          <span>
            <span className="my-learning-bar-dot my-learning-bar-dot--not" aria-hidden />
            Not learned
          </span>
        </div>
      </header>

      <div className="my-learning-bar-tree">
        {expandablePaths.length > 0 ? (
          <div className="my-learning-bar-expand-row">
            <button type="button" className="my-learning-bar-expand-btn" onClick={expandAllSections}>
              Expand all
            </button>
            <button type="button" className="my-learning-bar-expand-btn" onClick={collapseAllSections}>
              Collapse all
            </button>
          </div>
        ) : null}
        <ul className="focs-node">
          {rootEntries.map(([k, v]) => (
            <FocsTreeBranch
              key={`${selectedTextbookId}:${k}`}
              title={k}
              node={v}
              learnedSet={learnedSet}
              onToggleToken={onToggleToken}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              path={k}
              onOpenPages={variant === "embed" ? onOutlineSectionPreview : undefined}
            />
          ))}
        </ul>
      </div>
    </>
  );

  if (variant === "embed") {
    return embedWrap(main);
  }

  return <div className="my-learning-bar-page">{main}</div>;
}
