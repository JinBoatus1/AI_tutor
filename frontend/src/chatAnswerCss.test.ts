// @vitest-environment jsdom
// The chat panel as a browser resolves it once every stylesheet competes (test/cssCascade.ts).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("tutor answer", () => {
  it("keeps the decorative Σ seal away from screen readers (empty alt text)", () => {
    document.body.innerHTML = '<div class="msg-ai"></div>';
    expect(resolveInBothOrders(document.querySelector(".msg-ai")!, "content", sheets, { pseudo: "::before" })).toEqual([
      '"Σ" / ""',
      '"Σ" / ""',
    ]);
  });
});

describe("chat title row", () => {
  it("wraps when the panel is narrow, as it did before the redesign", () => {
    document.body.innerHTML = '<div class="chat-panel-titlebar"></div>';
    expect(resolveInBothOrders(document.querySelector(".chat-panel-titlebar")!, "flex-wrap", sheets, { width: 390 })).toEqual([
      "wrap",
      "wrap",
    ]);
  });
});
