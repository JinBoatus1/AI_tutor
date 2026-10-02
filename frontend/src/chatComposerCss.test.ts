// @vitest-environment jsdom
// The composer as a browser resolves it once every stylesheet competes (test/cssCascade.ts),
// in either load order. The markup mirrors LearningModel.tsx: the input sits in .learning-input-shell.
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders, type CascadeEnv } from "./test/cssCascade";

const sheets = loadAppStyleSheets();
const both = (el: Element, property: string, env?: CascadeEnv) => resolveInBothOrders(el, property, sheets, env);

function composer(): HTMLInputElement {
  document.body.innerHTML = '<div class="learning-input-shell"><input type="text" class="chat-input-text"></div>';
  return document.querySelector<HTMLInputElement>(".chat-input-text")!;
}

afterEach(() => document.body.replaceChildren());

describe("chat composer", () => {
  it.each([390, 1280])("keeps 16px text and 16px 20px padding at %ipx, so iOS does not zoom on focus", (width) => {
    const input = composer();
    expect(both(input, "font-size", { width })).toEqual(["16px", "16px"]);
    expect(both(input, "padding-top", { width })).toEqual(["16px", "16px"]);
    expect(both(input, "padding-left", { width })).toEqual(["20px", "20px"]);
  });

  it("dims while the tutor answers as before: opacity 0.6 and a not-allowed cursor", () => {
    const input = composer();
    input.disabled = true;
    expect(both(input, "opacity")).toEqual(["0.6", "0.6"]);
    expect(both(input, "cursor")).toEqual(["not-allowed", "not-allowed"]);
  });

  it("has the spec's --r2 corners (spec §5.4)", () => {
    const input = composer();
    expect(both(input.parentElement!, "border-radius")).toEqual(["var(--r2)", "var(--r2)"]);
  });

  it("shows one focus ring, the shell's, however the input is focused", () => {
    const input = composer();
    expect(both(input, "outline", { states: ["focus-visible"] })).toEqual(["none", "none"]);
    expect(both(input.parentElement!, "box-shadow", { states: ["focus-within"] })).toEqual([
      "0 0 0 3px var(--teal-tint)",
      "0 0 0 3px var(--teal-tint)",
    ]);
  });
});
