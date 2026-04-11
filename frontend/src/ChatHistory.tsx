import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
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

const API = import.meta.env.VITE_API_URL;

export default function ChatHistory({
  activeSessionId,
  onSelectSession,
  onNewChat,
  refreshTrigger,
}: ChatHistoryProps) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API}/api/sessions`, {
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
      await fetch(`${API}/api/sessions/${sessionId}`, {
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

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="chat-history-sidebar">
      <div className="chat-history-header">
        <span className="chat-history-title">History</span>
        <button className="chat-history-new-btn" onClick={onNewChat}>
          + New
        </button>
      </div>
      <div className="chat-history-list">
        {sessions.length === 0 ? (
          <div className="chat-history-empty">No conversations yet</div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`chat-history-item ${
                activeSessionId === s.id ? "chat-history-item--active" : ""
              }`}
              onClick={() => onSelectSession(s.id)}
            >
              <button
                className="chat-history-item-delete"
                onClick={(e) => handleDelete(e, s.id)}
                title="Delete"
              >
                x
              </button>
              <div className="chat-history-item-title">{s.title}</div>
              <div className="chat-history-item-date">
                {formatDate(s.updated_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
