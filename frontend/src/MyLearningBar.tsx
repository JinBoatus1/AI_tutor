import { useCallback, useEffect, useMemo, useState } from "react";
import "./MyLearningBar.css";
import focsTreeBundled from "./data/focsTree.json";
import { getOrCreateStudentId } from "./utils/studentId";
import {
  loadLocalLearningBar,
  saveLocalLearningBar,
  tryHydrateLearnedFromServer,
  trySyncLearnedToServer,
} from "./utils/learningBarLocalStorage";

type FocsNode = Record<string, unknown>;

const FOCS_TREE = focsTreeBundled as FocsNode;

function firstSectionToken(title: string): string | null {
  const w = title.trim().split(/\s+/)[0] ?? "";
  return /^\d+(?:\.\d+)*$/.test(w) ? w : null;
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

function childEntries(node: FocsNode): [string, FocsNode][] {
  return Object.entries(node).filter(
    ([k, v]) =>
      k !== "_range" &&
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v)
  ) as [string, FocsNode][];
}

/** All section tokens under this node (children only; does not include the parent row's own token). */
function collectDescendantSectionTokens(n: FocsNode): string[] {
  const out: string[] = [];
  for (const [childTitle, childNode] of childEntries(n)) {
    const t = firstSectionToken(childTitle);
    if (t) out.push(t);
    out.push(...collectDescendantSectionTokens(childNode));
  }
  return out;
}

function sortSectionTokens(tokens: string[]): string[] {
  return [...tokens].sort((a, b) => {
    const pa = a.split(".").map((x) => parseInt(x, 10));
    const pb = b.split(".").map((x) => parseInt(x, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  });
}

function FocsTreeBranch({
  title,
  node,
  learnedSet,
  onToggleToken,
  expanded,
  onToggleExpand,
  path,
}: {
  title: string;
  node: FocsNode;
  learnedSet: Set<string>;
  onToggleToken: (token: string, subtreeRoot?: FocsNode) => void;
  expanded: Record<string, boolean>;
  onToggleExpand: (path: string) => void;
  path: string;
}) {
  const token = firstSectionToken(title);
  const rangeStr = formatRange(node);
  const children = childEntries(node);
  const hasKids = children.length > 0;
  const isOpen = expanded[path] !== false;
  const learned = token ? learnedSet.has(token) : false;

  return (
    <li className="focs-node">
      <div
        className={`focs-node__row ${token ? "focs-node__row--toggle" : ""}`}
      >
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
        <button
          type="button"
          className={`focs-node__label ${
            token
              ? learned
                ? "focs-node__label--learned focs-node__label--toggle"
                : "focs-node__label--not focs-node__label--toggle"
              : "focs-node__label--not"
          }`}
          disabled={!token}
          onClick={() => token && onToggleToken(token, hasKids ? node : undefined)}
          title={
            token
              ? learned
                ? hasKids
                  ? "Mark this chapter and all subsections as not learned"
                  : "Mark as not yet learned"
                : hasKids
                  ? "Mark this chapter and all subsections as learned"
                  : "Mark as learned"
              : undefined
          }
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
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function MyLearningBar() {
  const [studentId] = useState(() => getOrCreateStudentId());
  const [learned, setLearned] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const learnedSet = useMemo(() => new Set(learned), [learned]);

  /** Tree is bundled JSON; no network required to render. */
  useEffect(() => {
    const local = loadLocalLearningBar(studentId);
    setLearned(local.learned_sections);
    setHydrated(true);
  }, [studentId]);

  /** If local progress is empty, try once to pull from the server (when API is available). */
  useEffect(() => {
    if (!hydrated) return;
    if (learned.length > 0) return;
    let cancelled = false;
    void (async () => {
      const fromServer = await tryHydrateLearnedFromServer(studentId);
      if (cancelled || !fromServer?.length) return;
      setLearned(fromServer);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, learned.length, studentId]);

  const persistLearned = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setError(null);
      setSyncHint(null);
      try {
        saveLocalLearningBar(studentId, next);
        setLearned(next);
        const ok = await trySyncLearnedToServer(studentId, next);
        setSyncHint(
          ok
            ? "Synced to server (Learning Mode will use the same progress)."
            : "Saved on this device; could not reach the server—Learning Mode may be out of sync."
        );
      } catch (e) {
        const msg = (e as Error).message || "Save failed.";
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [studentId]
  );

  const onToggleToken = useCallback(
    (token: string, subtreeRoot?: FocsNode) => {
      const batch =
        subtreeRoot != null
          ? Array.from(
              new Set([token, ...collectDescendantSectionTokens(subtreeRoot)])
            )
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

  const rootEntries = useMemo(() => childEntries(FOCS_TREE), []);

  if (!hydrated) {
    return (
      <div className="my-learning-bar-page">
        <p className="my-learning-bar-status">Loading local progress…</p>
      </div>
    );
  }

  return (
    <div className="my-learning-bar-page">
      <header className="my-learning-bar-header">
        <h1 className="my-learning-bar-title">My Learning bar</h1>
        <p className="my-learning-bar-meta">
          The syllabus is built into the app—expand it without a network. Teal = learned; gray = not learned.
          Click a <strong>chapter</strong> to mark or clear the whole chapter (all subsections). Click a leaf
          subsection to toggle only that item.
          Progress is stored in this browser (localStorage), separate from the syllabus data.
          <br />
          Student ID (same as Learning Mode):{" "}
          <code style={{ fontSize: "0.85em" }}>{studentId}</code>
          {saving ? " · Saving…" : ""}
        </p>
        {error ? (
          <p className="my-learning-bar-status my-learning-bar-status--error">{error}</p>
        ) : null}
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
        <ul className="focs-node">
          {rootEntries.map(([k, v]) => (
            <FocsTreeBranch
              key={k}
              title={k}
              node={v}
              learnedSet={learnedSet}
              onToggleToken={onToggleToken}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              path={k}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
