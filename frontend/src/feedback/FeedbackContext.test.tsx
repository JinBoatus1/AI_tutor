// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEffect } from "react";

type TestUser = { email: string; displayName: string | null; photoURL: string | null; uid: string; isAnonymous: boolean };

// The whole auth context, as AuthProvider supplies it; the tests change `user`.
const auth = vi.hoisted(() => ({
  user: null as TestUser | null,
  token: null as string | null,
  loading: false,
  loginWithProvider: vi.fn(),
  loginWithEmail: vi.fn(),
  logout: vi.fn(),
  showSignIn: false,
  setShowSignIn: vi.fn(),
  getFreshToken: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../i18n/LocaleContext", () => ({ useLocale: () => ({ locale: "zh" }) }));

import { FeedbackProvider, useFeedback } from "./FeedbackContext";
import { writeSelectedTextbookId } from "../learningTextbooks";
import type { FeedbackPageContext } from "./types";

const STUDENT: TestUser = {
  email: "student@example.com",
  displayName: "Student",
  photoURL: null,
  uid: "uid-1",
  isAnonymous: false,
};
const SECTION = "2.4 System Response to External Input: The Zero-State Response";

function Harness({ page }: { page?: FeedbackPageContext | null }) {
  const { openFeedback, closeFeedback, registerPageContext, isOpen, presetType, snapshot } = useFeedback();
  useEffect(() => {
    if (page !== undefined) registerPageContext(page);
  }, [page, registerPageContext]);
  return (
    <>
      <button onClick={() => openFeedback()}>open</button>
      <button onClick={() => openFeedback({ type: "content" })}>report</button>
      <button onClick={closeFeedback}>close</button>
      <output data-testid="state">{JSON.stringify({ isOpen, presetType, snapshot })}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "{}");

beforeEach(() => {
  auth.user = null;
  auth.setShowSignIn.mockReset();
  window.history.pushState({}, "", "/learning");
});

afterEach(cleanup);

describe("FeedbackProvider", () => {
  it("asks a signed-out visitor to sign in instead of opening", () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByText("open"));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(state().isOpen).toBe(false);
  });

  it("asks a guest to sign in instead of opening", () => {
    auth.user = { ...STUDENT, isAnonymous: true };
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByText("report"));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(state().isOpen).toBe(false);
  });

  it("opens for a signed-in student with a snapshot of the page on screen", () => {
    auth.user = STUDENT;
    render(
      <FeedbackProvider>
        <Harness page={{ bookId: "lathi", section: SECTION, page: 170 }} />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByText("report"));
    expect(state()).toEqual({
      isOpen: true,
      presetType: "content",
      snapshot: { book_id: "lathi", section: SECTION, page: 170, locale: "zh", route: "/learning" },
    });
    expect(auth.setShowSignIn).not.toHaveBeenCalled();
  });

  it("falls back to the selected book once Learning Mode has unregistered", () => {
    auth.user = STUDENT;
    writeSelectedTextbookId("lathi");
    window.history.pushState({}, "", "/grades");
    render(<FeedbackProvider><Harness page={null} /></FeedbackProvider>);
    fireEvent.click(screen.getByText("open"));
    expect(state()).toEqual({
      isOpen: true,
      presetType: null,
      snapshot: { book_id: "lathi", locale: "zh", route: "/grades" },
    });
  });

  it("returns focus to the element that opened it", () => {
    auth.user = STUDENT;
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    const opener = screen.getByText("open");
    opener.focus();
    fireEvent.click(opener);
    screen.getByText("close").focus();
    fireEvent.click(screen.getByText("close"));
    expect(state().isOpen).toBe(false);
    expect(opener).toHaveFocus();
  });
});
