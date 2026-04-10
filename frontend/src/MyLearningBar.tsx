import { useCallback, useEffect, useMemo, useState } from "react";
import "./MyLearningBar.css";
import { API_BASE } from "./apiBase";
import { getOrCreateStudentId } from "./utils/studentId";

type FocsNode = Record<string, unknown>;

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
  onToggleToken: (token: string) => void;
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
          onClick={() => token && onToggleToken(token)}
          title={
            token
              ? learned
                ? "Mark as not yet learned"
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
  const [tree, setTree] = useState<FocsNode | null>(null);
  const [learned, setLearned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const learnedSet = useMemo(() => new Set(learned), [learned]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/api/focs_tree`),
        fetch(`${API_BASE}/api/student_bar?student_id=${encodeURIComponent(studentId)}`),
      ]);
      if (!tRes.ok) throw new Error("Failed to load FOCS tree.");
      if (!bRes.ok) throw new Error("Failed to load learning bar.");
      const tJson = (await tRes.json()) as FocsNode;
      const bJson = (await bRes.json()) as { learned_sections?: string[] };
      setTree(tJson);
      setLearned(Array.isArray(bJson.learned_sections) ? bJson.learned_sections : []);
    } catch (e) {
      const msg = (e as Error).message || "Network error.";
      setError(`${msg} · 当前 API 根地址：${API_BASE}`);
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const persistLearned = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const resp = await fetch(`${API_BASE}/api/student_bar`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            learned_sections: next,
          }),
        });
        if (!resp.ok) {
          const d = await resp.json().catch(() => ({}));
          throw new Error(d.detail || "Save failed.");
        }
        const data = (await resp.json()) as { learned_sections?: string[] };
        setLearned(Array.isArray(data.learned_sections) ? data.learned_sections : next);
      } catch (e) {
        const msg = (e as Error).message || "Save failed.";
        setError(`${msg} · 当前 API 根地址：${API_BASE}`);
      } finally {
        setSaving(false);
      }
    },
    [studentId]
  );

  const onToggleToken = useCallback(
    (token: string) => {
      const next = new Set(learned);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      const sorted = Array.from(next).sort((a, b) => {
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
      setLearned(sorted);
      void persistLearned(sorted);
    },
    [learned, persistLearned]
  );

  const onToggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const open = prev[path] !== false;
      return { ...prev, [path]: !open };
    });
  }, []);

  const rootEntries = useMemo(() => {
    if (!tree) return [];
    return childEntries(tree);
  }, [tree]);

  if (loading) {
    return (
      <div className="my-learning-bar-page">
        <p className="my-learning-bar-status">Loading FOCS tree and your bar…</p>
      </div>
    );
  }

  if (error && !tree) {
    return (
      <div className="my-learning-bar-page">
        <p className="my-learning-bar-status my-learning-bar-status--error">{error}</p>
        <p className="my-learning-bar-status">
          <button type="button" className="my-learning-bar-retry" onClick={() => load()}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="my-learning-bar-page">
      <header className="my-learning-bar-header">
        <h1 className="my-learning-bar-title">My Learning bar</h1>
        <p className="my-learning-bar-meta">
          FOCS textbook outline. Teal = marked learned; slate = not yet. Click a numbered
          section to toggle. Same progress syncs with Learning Mode (
          <code style={{ fontSize: "0.8em" }}>{studentId}</code>
          ).
          {saving ? " Saving…" : ""}
        </p>
        {error ? (
          <p className="my-learning-bar-status my-learning-bar-status--error">{error}</p>
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
