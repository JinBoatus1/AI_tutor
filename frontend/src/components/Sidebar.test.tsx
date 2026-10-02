// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MessageKey } from "../i18n/messages";
import type { CurrentSection } from "../utils/currentSection";

const state = vi.hoisted(() => ({
  user: null as null | { displayName: string; email: string; photoURL: null; isAnonymous: boolean },
  currentSection: null as CurrentSection | null,
  outlineProps: [] as Record<string, unknown>[],
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: state.user, loading: false, logout: vi.fn(), setShowSignIn: vi.fn() }),
}));
vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});
vi.mock("../feedback/FeedbackContext", () => ({ useFeedback: () => ({ openFeedback: vi.fn() }) }));
vi.mock("../context/SessionBridge", () => ({
  useSessionBridge: () => ({
    activeSessionId: null,
    refreshTrigger: 0,
    previewSection: vi.fn(),
    select: vi.fn(),
    newChat: vi.fn(),
    currentSection: state.currentSection,
  }),
}));
vi.mock("../context/OnboardingContext", () => ({ useOnboarding: () => ({ startOnboarding: vi.fn() }) }));
vi.mock("./SidebarHistory", () => ({ default: () => null }));
vi.mock("../LearningBarPanel", () => ({
  default: (props: Record<string, unknown>) => {
    state.outlineProps.push(props);
    return null;
  },
}));

import Sidebar from "./Sidebar";
import { loadAppStyleSheets, resolveInBothOrders } from "../test/cssCascade";

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/learning"]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.user = null;
  state.currentSection = null;
  state.outlineProps = [];
});

describe("Sidebar", () => {
  it("passes the bridge's current section to the outline", () => {
    state.currentSection = { bookId: "focs", title: "1.1 Modeling Epidemics", startBook: 7, endBook: 7 };
    renderSidebar();
    expect(state.outlineProps[state.outlineProps.length - 1]?.currentSection).toEqual(state.currentSection);
  });

  it("shows the sign-in prompt above Sign in when signed out", () => {
    renderSidebar();
    const prompt = screen.getByText("Sign in to save chats & track progress");
    expect(prompt).toHaveClass("sb-signin-prompt");
    expect(prompt.nextElementSibling).toHaveClass("sb-signin");
  });

  it("floats Sign in into the empty strip beside the phone's clipped sidebar box", () => {
    const { container } = renderSidebar();
    const sheets = loadAppStyleSheets();
    const button = container.querySelector(".sb-signin")!;
    expect(resolveInBothOrders(button, "position", sheets, { width: 390 })).toEqual(["fixed", "fixed"]);
    expect(resolveInBothOrders(button.querySelector(".sb-link-label")!, "display", sheets, { width: 390 })).toEqual([
      "inline",
      "inline",
    ]);
    expect(resolveInBothOrders(button, "position", sheets, { width: 1280 })).toEqual([undefined, undefined]);
  });

  it("hides the prompt when signed in", () => {
    state.user = { displayName: "Student", email: "s@example.com", photoURL: null, isAnonymous: false };
    renderSidebar();
    expect(screen.queryByText("Sign in to save chats & track progress")).toBeNull();
  });
});
