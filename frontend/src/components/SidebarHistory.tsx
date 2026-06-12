import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSessionBridge } from "../context/SessionBridge";
import { apiUrl } from "../apiBase";
import { useLocale } from "../i18n/LocaleContext";
import type { MessageKey } from "../i18n/messages";

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const BUCKET_KEYS: MessageKey[] = [
  "sidebar.today",
  "sidebar.yesterday",
  "sidebar.thisWeek",
  "sidebar.thisMonth",
  "sidebar.earlier",
];

function groupByDate(sessions: Session[], t: (key: MessageKey) => string) {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(sod);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(sod);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(sod);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const buckets: { label: string; items: Session[] }[] = BUCKET_KEYS.map((key) => ({
    label: t(key),
    items: [],
  }));
  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (d >= sod) buckets[0].items.push(s);
    else if (d >= yesterday) buckets[1].items.push(s);
    else if (d >= weekAgo) buckets[2].items.push(s);
    else if (d >= monthAgo) buckets[3].items.push(s);
    else buckets[4].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function timeAgo(iso: string, t: (key: MessageKey) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("sidebar.justNow");
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SidebarHistory() {
  const { t } = useLocale();
  const { token } = useAuth();
  const bridge = useSessionBridge();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<Session[]>([]);

  const onLearning = location.pathname.startsWith("/learning");

  const fetchSessions = useCallback(async () => {
    if (!token) {
      setSessions([]);
      return;
    }
    try {
      const resp = await fetch(apiUrl("/api/sessions"), { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) setSessions(await resp.json());
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, bridge.refreshTrigger]);

  const select = (sid: string) => {
    bridge.select(sid);
    if (!onLearning) navigate("/learning");
  };
  const newChat = () => {
    bridge.newChat();
    if (!onLearning) navigate("/learning");
  };
  const remove = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await fetch(apiUrl(`/api/sessions/${sid}`), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (bridge.activeSessionId === sid) bridge.newChat();
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const groups = useMemo(() => groupByDate(sessions, t), [sessions, t]);

  return (
    <div className="sb-hist">
      <button className="sb-newchat" onClick={newChat}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{t("sidebar.newChat")}</span>
      </button>

      {groups.length === 0 ? (
        <div className="sb-empty">{t("sidebar.noChats")}</div>
      ) : (
        groups.map((g) => (
          <div className="sb-hist-group" key={g.label}>
            <div className="sb-hist-label">{g.label}</div>
            {g.items.map((s) => (
              <div
                key={s.id}
                className={`sb-hist-item${bridge.activeSessionId === s.id ? " is-active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => select(s.id)}
                onKeyDown={(e) => e.key === "Enter" && select(s.id)}
                title={s.title}
              >
                <span className="sb-hist-title">{s.title}</span>
                <span className="sb-hist-time">{timeAgo(s.updated_at, t)}</span>
                <button
                  className="sb-hist-del"
                  onClick={(e) => remove(e, s.id)}
                  title={t("sidebar.deleteChat")}
                  aria-label={t("sidebar.deleteChat")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
