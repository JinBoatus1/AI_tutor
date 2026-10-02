// @vitest-environment jsdom
// The sign-in modal as a browser resolves it once every stylesheet competes (test/cssCascade.ts).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();
const RING = "0 0 0 3px var(--teal-tint)";

afterEach(() => document.body.replaceChildren());

describe("sign-in modal", () => {
  it("shows one focus ring on its inputs, their own", () => {
    // The markup mirrors SignInModal.tsx's email form.
    document.body.innerHTML = '<div class="signin-modal"><form class="signin-form"><input type="email" class="signin-input"></form></div>';
    const input = document.querySelector(".signin-input")!;
    expect(resolveInBothOrders(input, "outline", sheets, { states: ["focus-visible"] })).toEqual(["none", "none"]);
    expect(resolveInBothOrders(input, "box-shadow", sheets, { states: ["focus-visible"] })).toEqual([RING, RING]);
  });
});
