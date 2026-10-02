// @vitest-environment jsdom
// The chat panel as a browser resolves it once every stylesheet competes (test/cssCascade.ts).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("tutor answer", () => {
  it("shows no seal on the loading placeholder", () => {
    document.body.innerHTML = '<div class="msg-ai msg-ai-loading-placeholder"></div>';
    expect(resolveInBothOrders(document.querySelector(".msg-ai")!, "content", sheets, { pseudo: "::before" })).toEqual([
      "none",
      "none",
    ]);
  });

  it("keeps the decorative Σ seal away from screen readers (empty alt text)", () => {
    document.body.innerHTML = '<div class="msg-ai"></div>';
    expect(resolveInBothOrders(document.querySelector(".msg-ai")!, "content", sheets, { pseudo: "::before" })).toEqual([
      '"Σ" / ""',
      '"Σ" / ""',
    ]);
  });
});

describe("chat title row", () => {
  it("wraps on narrow panels, and the New session button shrinks instead of being clipped", () => {
    // The markup mirrors LearningModel.tsx: the title, then the tour-anchored .reset-box.
    document.body.innerHTML =
      '<div class="chat-panel-titlebar"><span>Tutor</span><div class="reset-box"><button>Start a new session</button></div></div>';
    const box = document.querySelector(".reset-box")!;
    expect(resolveInBothOrders(document.querySelector(".chat-panel-titlebar")!, "flex-wrap", sheets)).toEqual(["wrap", "wrap"]);
    expect(resolveInBothOrders(box, "flex", sheets)).toEqual(["0 1 auto", "0 1 auto"]);
    expect(resolveInBothOrders(box, "min-width", sheets)).toEqual(["0", "0"]);
  });
});
