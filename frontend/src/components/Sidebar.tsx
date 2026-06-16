import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import SidebarHistory from "./SidebarHistory";
import LearningBarPanel, { type OutlineSectionPreviewDetail } from "../LearningBarPanel";
import { useSessionBridge } from "../context/SessionBridge";
import { getOrCreateStudentId } from "../utils/studentId";
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
  course: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M21 10v4.5" /><path d="M7 12v3.6c0 1.1 2.2 2.4 5 2.4s5-1.3 5-2.4V12" />
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

type Tab = { key: string; labelKey: "sidebar.learningMode" | "sidebar.grades" | "sidebar.autoGrader" | "sidebar.profile"; icon: ReactNode; path: string; gated?: boolean };

const TABS: Tab[] = [
  { key: "/learning", labelKey: "sidebar.learningMode", icon: I.learning, path: "/learning" },
  { key: "/grades", labelKey: "sidebar.grades", icon: I.course, path: "/grades" },
  { key: "/autograder", labelKey: "sidebar.autoGrader", icon: I.grader, path: "/autograder" },
  { key: "/profile", labelKey: "sidebar.profile", icon: I.profile, path: "/profile", gated: true },
];

const SIDEBAR_PROGRESS_OPEN_KEY = "sidebar-open-progress";
const SIDEBAR_HISTORY_OPEN_KEY = "sidebar-open-history";

function readSidebarSectionOpen(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSidebarSectionOpen(key: string, open: boolean): void {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export default function Sidebar() {
  const { user, loading, logout, setShowSignIn } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const bridge = useSessionBridge();
  const [studentId] = useState(() => getOrCreateStudentId());
  const onLearning = location.pathname.startsWith("/learning");

  const previewSection = (detail: OutlineSectionPreviewDetail) => {
    bridge.previewSection(detail);
    if (!onLearning) navigate("/learning");
  };

  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("sidebar-collapsed") === "1");
  const [openProgress, setOpenProgress] = useState(() => readSidebarSectionOpen(SIDEBAR_PROGRESS_OPEN_KEY));
  const [openHistory, setOpenHistory] = useState(() => readSidebarSectionOpen(SIDEBAR_HISTORY_OPEN_KEY));

  const toggleProgress = () => {
    setOpenProgress((o) => {
      const next = !o;
      writeSidebarSectionOpen(SIDEBAR_PROGRESS_OPEN_KEY, next);
      return next;
    });
  };

  const toggleHistory = () => {
    setOpenHistory((o) => {
      const next = !o;
      writeSidebarSectionOpen(SIDEBAR_HISTORY_OPEN_KEY, next);
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const activeKey = location.pathname.startsWith("/autograder")
    ? "/autograder"
    : location.pathname.startsWith("/grades")
      ? "/grades"
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
        <div className="sb-group-label">{t("sidebar.workspace")}</div>
        <nav className="sb-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`sb-link${activeKey === tab.key ? " is-active" : ""}`}
              onClick={() => go(tab)}
              title={t(tab.labelKey)}
            >
              <span className="sb-link-ic">{tab.icon}</span>
              <span className="sb-link-label">{t(tab.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="sb-group-label sb-group-label--gap">{t("sidebar.study")}</div>

        {/* Learning Progress (was Aquarius's "syllabus") — the real panel, bridged to Learning Mode */}
        <div className={`sb-section sb-section--progress${openProgress ? " is-open" : ""}`}>
          <button className="sb-section-head" onClick={toggleProgress} aria-expanded={openProgress}>
            <span className="sb-link-ic">{I.progress}</span>
            <span className="sb-link-label">{t("sidebar.learningProgress")}</span>
            <span className="sb-caret">{I.chevron}</span>
          </button>
          <div className="sb-section-body">
            <div className="sb-progress-embed">
              <LearningBarPanel variant="embed" studentId={studentId} onOutlineSectionPreview={previewSection} />
            </div>
          </div>
        </div>

        {/* History (our "recent") */}
        <div className={`sb-section sb-section--hist${openHistory ? " is-open" : ""}`}>
          <button className="sb-section-head" onClick={toggleHistory} aria-expanded={openHistory}>
            <span className="sb-link-ic">{I.history}</span>
            <span className="sb-link-label">{t("sidebar.history")}</span>
            <span className="sb-caret">{I.chevron}</span>
          </button>
          <div className="sb-section-body">
            {user ? <SidebarHistory /> : <div className="sb-empty">{t("sidebar.signInHistory")}</div>}
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
            <span className="sb-user-name">{user.isAnonymous ? t("sidebar.guest") : user.displayName || user.email}</span>
            <button className="sb-signout" onClick={logout} title={t("sidebar.signOut")}>
              {t("sidebar.signOut")}
            </button>
          </div>
        ) : (
          <button className="sb-signin" onClick={() => setShowSignIn(true)}>
            <span className="sb-link-ic">{I.profile}</span>
            <span className="sb-link-label">{t("sidebar.signIn")}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
