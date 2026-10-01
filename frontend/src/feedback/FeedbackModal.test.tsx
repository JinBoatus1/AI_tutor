// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { MessageKey } from "../i18n/messages";
import type { SubmitResult } from "./feedbackApi";

const auth = vi.hoisted(() => ({
  user: { email: "student@example.com", displayName: "Student", photoURL: null, uid: "uid-1", isAnonymous: false },
  token: "token-1",
  loading: false,
  loginWithProvider: vi.fn(),
  loginWithEmail: vi.fn(),
  logout: vi.fn(),
  showSignIn: false,
  setShowSignIn: vi.fn(),
  getFreshToken: vi.fn(async (): Promise<string | null> => "token-2"),
}));
const api = vi.hoisted(() => ({ submitFeedback: vi.fn() }));

vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});
vi.mock("./feedbackApi", () => ({ submitFeedback: api.submitFeedback }));

import FeedbackModal from "./FeedbackModal";
import { FeedbackProvider, useFeedback } from "./FeedbackContext";

function Opener({ type }: { type?: "content" }) {
  const { openFeedback } = useFeedback();
  return <button onClick={() => openFeedback(type ? { type } : undefined)}>open feedback</button>;
}

function renderDialog(type?: "content") {
  render(
    <FeedbackProvider>
      <Opener type={type} />
      <FeedbackModal />
    </FeedbackProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const sendButton = () => screen.getByRole("button", { name: "Send" });
const description = () => screen.getByLabelText("Description");

/** Lets the send chain (fresh token, then submit, then a state update) finish inside act.
 *  Microtasks only, so it also works under fake timers, where RTL's findBy* would hang. */
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function typeAndSend(text: string) {
  fireEvent.change(description(), { target: { value: text } });
  await act(async () => {
    fireEvent.click(sendButton());
    await settle();
  });
}

beforeEach(() => {
  auth.showSignIn = false;
  auth.setShowSignIn.mockReset();
  auth.getFreshToken.mockReset().mockResolvedValue("token-2");
  api.submitFeedback.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FeedbackModal", () => {
  it("enables Send only once a type is chosen and the description has text", () => {
    renderDialog();
    expect(sendButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Suggestion"));
    expect(sendButton()).toBeDisabled();
    fireEvent.change(description(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
    fireEvent.change(description(), { target: { value: "Add dark mode" } });
    expect(sendButton()).toBeEnabled();
  });

  it("counts characters against the 2000 limit", () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "hello" } });
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
    expect(description()).toHaveAttribute("maxlength", "2000");
  });

  it("offers to share the account's email, unticked", () => {
    renderDialog();
    expect(screen.getByLabelText("You can contact me at student@example.com")).not.toBeChecked();
  });

  it("preselects the content type and focuses the description when opened from the textbook", () => {
    renderDialog("content");
    expect(screen.getByLabelText("Wrong page or content")).toBeChecked();
    expect(description()).toHaveFocus();
  });

  it("focuses the first type when opened from the sidebar", () => {
    renderDialog();
    expect(screen.getByLabelText("Something is broken")).toHaveFocus();
  });

  it("sends the form with a fresh token and the snapshot", async () => {
    api.submitFeedback.mockResolvedValue({ ok: true });
    renderDialog("content");
    fireEvent.click(screen.getByLabelText("You can contact me at student@example.com"));
    await typeAndSend("Figure 2.3 is cut off");

    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    const [token, payload] = api.submitFeedback.mock.calls[0];
    expect(token).toBe("token-2");
    expect(payload).toMatchObject({ type: "content", description: "Figure 2.3 is cut off", contact_ok: true });
    expect(payload.context).toMatchObject({ locale: "en", route: window.location.pathname });
  });

  it("sends once when Send is clicked twice", async () => {
    const pending = deferred<SubmitResult>();
    api.submitFeedback.mockReturnValue(pending.promise);
    renderDialog("content");
    fireEvent.change(description(), { target: { value: "Twice" } });

    // Both clicks land in one act scope, so React hasn't re-rendered the disabled button in
    // between: only the in-flight guard can stop the second send.
    await act(async () => {
      fireEvent.click(sendButton());
      fireEvent.click(sendButton());
      await settle();
    });

    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve({ ok: true });
      await settle();
    });
  });

  it("locks the dialog while sending", async () => {
    const pending = deferred<SubmitResult>();
    api.submitFeedback.mockReturnValue(pending.promise);
    renderDialog("content");
    await typeAndSend("Slow network");

    expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();
    expect(description()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      pending.resolve({ ok: true });
      await settle();
    });
  });

  it("thanks the student, then closes itself after 2.5 s", async () => {
    vi.useFakeTimers();
    api.submitFeedback.mockResolvedValue({ ok: true });
    renderDialog("content");
    await typeAndSend("Thanks");

    expect(screen.getByRole("status")).toHaveTextContent("Thanks, we got it.");
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each<[SubmitResult, string]>([
    [{ ok: false, kind: "rateLimited", retryAfterMinutes: 42 }, "You're sending feedback too often. Try again in about 42 min."],
    [{ ok: false, kind: "invalid" }, "Please check the form and try again."],
    [{ ok: false, kind: "unavailable" }, "Couldn't send right now. Please try again in a moment."],
  ])("shows each failure and keeps the text: %o", async (result, message) => {
    api.submitFeedback.mockResolvedValue(result);
    renderDialog("content");
    await typeAndSend("Keep me");

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(description()).toHaveValue("Keep me");
    expect(sendButton()).toBeEnabled();
  });

  it("treats a token Firebase can't produce as unavailable", async () => {
    auth.getFreshToken.mockRejectedValue(new Error("auth/network-request-failed"));
    renderDialog("content");
    await typeAndSend("Offline");

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't send right now. Please try again in a moment.");
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it("asks to sign in again without losing the draft", async () => {
    api.submitFeedback.mockResolvedValue({ ok: false, kind: "auth" });
    renderDialog("content");
    await typeAndSend("Draft");

    expect(screen.getByRole("alert")).toHaveTextContent("You need to sign in again to send this.");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.setShowSignIn).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(description()).toHaveValue("Draft");
  });

  it("treats a missing token as needing sign-in", async () => {
    auth.getFreshToken.mockResolvedValue(null);
    renderDialog("content");
    await typeAndSend("No token");

    expect(screen.getByRole("alert")).toHaveTextContent("You need to sign in again to send this.");
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it("ignores Esc while the sign-in modal is open on top", () => {
    auth.showSignIn = true;
    renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on Esc, Cancel and ×, but not on a backdrop click", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts with an empty form every time it opens", () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "half-typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "open feedback" }));
    expect(description()).toHaveValue("");
  });
});
