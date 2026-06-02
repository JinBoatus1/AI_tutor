import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SidebarHistory from "./SidebarHistory";
import "./Sidebar.css";

/* ---- inline icons (no icon dependency) ---- */
const I = {
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
    </svg>
  ),
  learning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5A2 2 0 0 1 5 4h5v15H5a2 2 0 0 0-2 1.2z" /><path d="M21 5.5A2 2 0 0 0 19 4h-5v15h5a2 2 0 0 1 2 1.2z" />
    </svg>
  ),
  grader: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="m9.5 14 1.8 1.8L15 12" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 6 2 2 3-3" /><path d="m3 13 2 2 3-3" /><path d="M11 6h10" /><path d="M11 13h10" /><path d="M3 19h18" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
};

type Tab = { key: string; label: string; icon: ReactNode; path: string; gated?: boolean };

const TABS: Tab[] = [
  { key: "/learning", label: "Learning Mode", icon: I.learning, path: "/learning" },
  { key: "/autograder", label: "Auto Grader", icon: I.grader, path: "/autograder" },
  { key: "/profile", label: "My profile", icon: I.profile, path: "/profile", gated: true },
];

/* Placeholder learning-progress outline (Step 1 visual; real data wired in a follow-up). */
const PROGRESS = [
  { unit: "Logic & Proofs", topics: [{ t: "Propositions", s: "done" }, { t: "Implication & equivalence", s: "done" }, { t: "Proof techniques", s: "active" }] },
  { unit: "Sets & Relations", topics: [{ t: "Set operations", s: "done" }, { t: "Relations & functions", s: "todo" }] },
  { unit: "Combinatorics", topics: [{ t: "Counting rules", s: "todo" }, { t: "Binomial theorem", s: "todo" }] },
] as const;

export default function Sidebar() {
  const { user, loading, logout, setShowSignIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("sidebar-collapsed") === "1");
  const [openProgress, setOpenProgress] = useState(true);
  const [openHistory, setOpenHistory] = useState(true);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const activeKey = location.pathname.startsWith("/autograder")
    ? "/autograder"
    : location.pathname.startsWith("/learning")
      ? "/learning"
      : location.pathname.startsWith("/profile")
        ? "/profile"
        : "/";

  const go = (tab: Tab) => {
    if (tab.gated && !user && !loading) {
      setShowSignIn(true);
      return;
    }
    navigate(tab.path);
  };

  return (
    <aside className={`sb${collapsed ? " sb--collapsed" : ""}`} aria-label="Main navigation">
      <div className="sb-top">
        <button className="sb-toggle" onClick={toggleCollapsed} title="Toggle sidebar" aria-label="Toggle sidebar">
          {I.menu}
        </button>
        <button className="sb-brand" onClick={() => navigate("/")} title="AI Tutor">
          <span className="sb-brand-mark">∑</span>
          <span className="sb-brand-name">AI Tutor</span>
        </button>
      </div>

      <div className="sb-shell">
        <div className="sb-group-label">Workspace</div>
        <nav className="sb-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`sb-link${activeKey === tab.key ? " is-active" : ""}`}
              onClick={() => go(tab)}
              title={tab.label}
            >
              <span className="sb-link-ic">{tab.icon}</span>
              <span className="sb-link-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sb-group-label sb-group-label--gap">Study</div>

        {/* Learning Progress (our "syllabus") */}
        <div className={`sb-section${openProgress ? " is-open" : ""}`}>
          <button className="sb-section-head" onClick={() => setOpenProgress((o) => !o)}>
            <span className="sb-link-ic">{I.progress}</span>
            <span className="sb-link-label">Learning Progress</span>
            <span className="sb-caret">{I.chevron}</span>
          </button>
          <div className="sb-section-body">
            {PROGRESS.map((u) => (
              <div className="sb-unit" key={u.unit}>
                <div className="sb-unit-name">{u.unit}</div>
                {u.topics.map((tp) => (
                  <div className={`sb-topic sb-topic--${tp.s}`} key={tp.t}>
                    <span className="sb-dot" />
                    <span>{tp.t}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* History (our "recent") */}
        <div className={`sb-section sb-section--hist${openHistory ? " is-open" : ""}`}>
          <button className="sb-section-head" onClick={() => setOpenHistory((o) => !o)}>
            <span className="sb-link-ic">{I.history}</span>
            <span className="sb-link-label">History</span>
            <span className="sb-caret">{I.chevron}</span>
          </button>
          <div className="sb-section-body">
            {user ? <SidebarHistory /> : <div className="sb-empty">Sign in to keep your chat history.</div>}
          </div>
        </div>
      </div>

      <div className="sb-footer">
        {loading ? null : user ? (
          <div className="sb-user">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="sb-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="sb-avatar sb-avatar--empty">{(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}</span>
            )}
            <span className="sb-user-name">{user.isAnonymous ? "Guest" : user.displayName || user.email}</span>
            <button className="sb-signout" onClick={logout} title="Sign out">Sign out</button>
          </div>
        ) : (
          <button className="sb-signin" onClick={() => setShowSignIn(true)}>
            <span className="sb-link-ic">{I.profile}</span>
            <span className="sb-link-label">Sign in</span>
          </button>
        )}
      </div>
    </aside>
  );
}
