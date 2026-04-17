import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "./context/AuthContext";
import { API_BASE } from "./apiBase";
import "./ChatHistory.css";

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshTrigger: number;
}

function groupByDate(sessions: Session[]): { label: string; items: Session[] }[] {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(sod);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(sod);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(sod);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const buckets: { label: string; items: Session[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "This Month", items: [] },
    { label: "Earlier", items: [] },
  ];

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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatHistory({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshTrigger,
}: ChatHistoryProps) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState("");

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        onNewChat();
      }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <aside className="ch-sidebar">
      <div className="ch-header">
        <div className="ch-header-row">
          <span className="ch-title">Conversations</span>
          <button className="ch-new-btn" onClick={onNewChat} title="New conversation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
        {sessions.length > 3 && (
          <div className="ch-search">
            <svg className="ch-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="ch-search-input"
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="ch-list">
        {groups.length === 0 ? (
          <div className="ch-empty">
            <div className="ch-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </div>
            <div className="ch-empty-text">
              <strong>No conversations yet</strong>
              Start a new chat to begin learning
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="ch-group">
              <div className="ch-group-label">{group.label}</div>
              {group.items.map((s) => (
                <div
                  key={s.id}
                  className={`ch-item ${activeSessionId === s.id ? "ch-item--active" : ""}`}
                  onClick={() => onSelectSession(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelectSession(s.id)}
                >
                  <div className="ch-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="ch-item-body">
                    <div className="ch-item-title">{s.title}</div>
                    <div className="ch-item-time">{timeAgo(s.updated_at)}</div>
                  </div>
                  <button
                    className="ch-item-delete"
                    onClick={(e) => handleDelete(e, s.id)}
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
