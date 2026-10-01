import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { readSelectedTextbookId } from "../learningTextbooks";
import type { FeedbackPageContext, FeedbackRequestContext, FeedbackType } from "./types";

interface FeedbackContextValue {
  /** Opens the dialog, or the sign-in modal for signed-out visitors and guests. */
  openFeedback: (opts?: { type?: FeedbackType }) => void;
  closeFeedback: () => void;
  /** Learning Mode calls this when the book, section or page changes, and with null on unmount. */
  registerPageContext: (ctx: FeedbackPageContext | null) => void;
  isOpen: boolean;
  presetType: FeedbackType | null;
  /** Where the student was when the dialog opened. It doesn't change while the dialog is open. */
  snapshot: FeedbackRequestContext;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { user, setShowSignIn } = useAuth();
  const { locale } = useLocale();
  // A ref, not state: turning a page must not re-render everything that reads this context.
  const pageContextRef = useRef<FeedbackPageContext | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [presetType, setPresetType] = useState<FeedbackType | null>(null);
  const [snapshot, setSnapshot] = useState<FeedbackRequestContext>({});

  const registerPageContext = useCallback((ctx: FeedbackPageContext | null) => {
    pageContextRef.current = ctx;
  }, []);

  const openFeedback = useCallback(
    (opts?: { type?: FeedbackType }) => {
      if (!user || user.isAnonymous) {
        setShowSignIn(true);
        return;
      }
      const page = pageContextRef.current;
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSnapshot({
        book_id: page?.bookId ?? readSelectedTextbookId(),
        section: page?.section,
        page: page?.page,
        locale,
        route: window.location.pathname,
      });
      setPresetType(opts?.type ?? null);
      setIsOpen(true);
    },
    [user, setShowSignIn, locale],
  );

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  const value = useMemo(
    () => ({ openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot }),
    [openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot],
  );
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
