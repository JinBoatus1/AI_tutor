import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { OutlineSectionPreviewDetail } from "../LearningBarPanel";

/**
 * Bridges the global Sidebar (which shows conversation History) with Learning Mode,
 * which owns the chat session state + load logic. LearningModel publishes its active
 * session / refresh counter and registers its handlers; the sidebar reads those and
 * requests select/new. When Learning Mode isn't mounted, requests are stashed as
 * "pending" and applied once it mounts (the sidebar navigates there).
 */
type Handlers = {
  select: (sid: string) => void;
  newChat: () => void;
  previewSection: (d: OutlineSectionPreviewDetail) => void;
};
type Pending =
  | { kind: "select"; sid: string }
  | { kind: "new" }
  | { kind: "preview"; detail: OutlineSectionPreviewDetail }
  | null;

interface Bridge {
  activeSessionId: string | null;
  refreshTrigger: number;
  publishActive: (id: string | null) => void;
  publishRefresh: (n: number) => void;
  attach: (h: Handlers) => () => void;
  select: (sid: string) => void;
  newChat: () => void;
  previewSection: (d: OutlineSectionPreviewDetail) => void;
  takePending: () => Pending;
}

const Ctx = createContext<Bridge | null>(null);

export function SessionBridgeProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActive] = useState<string | null>(null);
  const [refreshTrigger, setRefresh] = useState(0);
  const handlersRef = useRef<Handlers | null>(null);
  const pendingRef = useRef<Pending>(null);

  const publishActive = useCallback((id: string | null) => setActive(id), []);
  const publishRefresh = useCallback((n: number) => setRefresh(n), []);

  const attach = useCallback((h: Handlers) => {
    handlersRef.current = h;
    return () => {
      if (handlersRef.current === h) handlersRef.current = null;
    };
  }, []);

  const select = useCallback((sid: string) => {
    if (handlersRef.current) handlersRef.current.select(sid);
    else pendingRef.current = { kind: "select", sid };
  }, []);

  const newChat = useCallback(() => {
    if (handlersRef.current) handlersRef.current.newChat();
    else pendingRef.current = { kind: "new" };
  }, []);

  const previewSection = useCallback((d: OutlineSectionPreviewDetail) => {
    if (handlersRef.current) handlersRef.current.previewSection(d);
    else pendingRef.current = { kind: "preview", detail: d };
  }, []);

  const takePending = useCallback(() => {
    const p = pendingRef.current;
    pendingRef.current = null;
    return p;
  }, []);

  return (
    <Ctx.Provider
      value={{ activeSessionId, refreshTrigger, publishActive, publishRefresh, attach, select, newChat, previewSection, takePending }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSessionBridge() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessionBridge must be used within SessionBridgeProvider");
  return c;
}
