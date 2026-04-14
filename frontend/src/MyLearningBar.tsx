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
  const [learned, setLearned] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const learnedSet = useMemo(() => new Set(learned), [learned]);

  /** 目录树始终来自打包的 JSON，不依赖网络。 */
  useEffect(() => {
    const local = loadLocalLearningBar(studentId);
    setLearned(local.learned_sections);
    setHydrated(true);
  }, [studentId]);

  /** 本机无进度时，尝试从服务器补一次（仅在有后端时有用）。 */
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
            ? "已同步到服务器（Learning Mode 将使用相同进度）。"
            : "已保存在本机；当前无法连接服务器，Learning Mode 侧进度可能不一致。"
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

  const rootEntries = useMemo(() => childEntries(FOCS_TREE), []);

  if (!hydrated) {
    return (
      <div className="my-learning-bar-page">
        <p className="my-learning-bar-status">正在加载本地进度…</p>
      </div>
    );
  }

  return (
    <div className="my-learning-bar-page">
      <header className="my-learning-bar-header">
        <h1 className="my-learning-bar-title">My Learning bar</h1>
        <p className="my-learning-bar-meta">
          教材目录已内置在前端，无需联网即可展开查看。青绿色 = 已勾选为已学；灰色 = 未学。点击带节号的条目可切换。
          学习进度保存在本机浏览器（localStorage），与目录数据分离。
          <br />
          学生 ID（与 Learning Mode 一致）：<code style={{ fontSize: "0.85em" }}>{studentId}</code>
          {saving ? " · 保存中…" : ""}
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
            已学
          </span>
          <span>
            <span className="my-learning-bar-dot my-learning-bar-dot--not" aria-hidden />
            未学
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
