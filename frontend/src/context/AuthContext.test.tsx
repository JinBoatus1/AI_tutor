// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

interface FakeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

// Firebase is replaced at the module boundary. The tests drive `auth.currentUser` and the
// onAuthStateChanged listener; everything inside AuthProvider runs for real.
const firebase = vi.hoisted(() => ({
  auth: { currentUser: null as FakeUser | null },
  listeners: [] as Array<(user: FakeUser | null) => unknown>,
}));

vi.mock("../firebase", () => ({ auth: firebase.auth, googleProvider: null }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: FakeUser | null) => unknown) => {
    firebase.listeners.push(listener);
    return () => {
      firebase.listeners = firebase.listeners.filter((l) => l !== listener);
    };
  },
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

import { AuthProvider, useAuth } from "./AuthContext";

function TokenProbe() {
  const { token } = useAuth();
  return <output data-testid="token">{token ?? "none"}</output>;
}

/** A signed-in user whose current ID token the test controls, the way Firebase's token cache does. */
function makeUser(firstToken: string) {
  let current = firstToken;
  const getIdToken = vi.fn(async (_forceRefresh?: boolean) => current);
  const user: FakeUser = {
    uid: "uid-1",
    email: "student@example.com",
    displayName: "Student",
    photoURL: null,
    isAnonymous: false,
    getIdToken,
  };
  return { user, getIdToken, rotate: (next: string) => { current = next; } };
}

async function firebaseReports(user: FakeUser | null) {
  firebase.auth.currentUser = user;
  await act(async () => {
    await Promise.all(firebase.listeners.map((listener) => listener(user)));
  });
}

async function dispatchAndSettle(target: EventTarget, type: string) {
  await act(async () => {
    target.dispatchEvent(new Event(type));
    await vi.advanceTimersByTimeAsync(0);
  });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

const shownToken = () => screen.getByTestId("token").textContent;

beforeEach(() => {
  vi.useFakeTimers();
  firebase.auth.currentUser = null;
  firebase.listeners = [];
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthProvider keeps the ID token fresh", () => {
  it("picks up the token Firebase refreshed, within Firebase's five-minute refresh window", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, rotate } = makeUser("token-1");
    await firebaseReports(user);
    expect(shownToken()).toBe("token-1");

    rotate("token-2");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
    });

    expect(shownToken()).toBe("token-2");
  });

  it("refreshes as soon as the tab becomes visible again", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, rotate } = makeUser("token-1");
    await firebaseReports(user);

    rotate("token-2");
    await dispatchAndSettle(document, "visibilitychange");

    expect(shownToken()).toBe("token-2");
  });

  it("refreshes when the browser comes back online", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, rotate } = makeUser("token-1");
    await firebaseReports(user);

    rotate("token-2");
    await dispatchAndSettle(window, "online");

    expect(shownToken()).toBe("token-2");
  });

  it("ignores a token that arrives after the student signed out", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, getIdToken } = makeUser("token-1");
    await firebaseReports(user);

    let deliverLateToken: (token: string) => void = () => {};
    getIdToken.mockImplementationOnce(
      () => new Promise<string>((resolve) => { deliverLateToken = resolve; }),
    );
    await dispatchAndSettle(window, "online");
    await firebaseReports(null);
    await act(async () => {
      deliverLateToken("late-token");
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(shownToken()).toBe("none");
  });

  it("keeps the current token when Firebase can't refresh it", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, getIdToken } = makeUser("token-1");
    await firebaseReports(user);

    getIdToken.mockRejectedValueOnce(new Error("auth/network-request-failed"));
    await dispatchAndSettle(window, "online");

    expect(shownToken()).toBe("token-1");
  });

  it("does nothing while nobody is signed in", async () => {
    render(<AuthProvider><TokenProbe /></AuthProvider>);
    await firebaseReports(null);

    await dispatchAndSettle(window, "online");
    await dispatchAndSettle(document, "visibilitychange");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });

    expect(shownToken()).toBe("none");
  });

  it("stops asking Firebase once the provider unmounts", async () => {
    const { unmount } = render(<AuthProvider><TokenProbe /></AuthProvider>);
    const { user, getIdToken } = makeUser("token-1");
    await firebaseReports(user);
    const callsWhileMounted = getIdToken.mock.calls.length;

    unmount();
    await dispatchAndSettle(window, "online");
    await dispatchAndSettle(document, "visibilitychange");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });

    expect(getIdToken.mock.calls.length).toBe(callsWhileMounted);
  });
});

describe("getFreshToken", () => {
  function captureAuth() {
    const captured: { auth?: ReturnType<typeof useAuth> } = {};
    function Capture() {
      captured.auth = useAuth();
      return null;
    }
    render(<AuthProvider><Capture /></AuthProvider>);
    return captured;
  }

  it("returns the token Firebase hands out right now", async () => {
    const captured = captureAuth();
    const { user, rotate } = makeUser("token-1");
    await firebaseReports(user);

    rotate("token-2");

    await expect(captured.auth!.getFreshToken()).resolves.toBe("token-2");
  });

  it("returns null when nobody is signed in", async () => {
    const captured = captureAuth();
    await firebaseReports(null);

    await expect(captured.auth!.getFreshToken()).resolves.toBeNull();
  });
});
