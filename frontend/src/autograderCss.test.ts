// @vitest-environment jsdom
// Auto Grader as a browser resolves it once every stylesheet competes (test/cssCascade.ts).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders, type CascadeEnv } from "./test/cssCascade";

const sheets = loadAppStyleSheets();
const both = (el: Element, property: string, env?: CascadeEnv) => resolveInBothOrders(el, property, sheets, env);
const RING = "0 0 0 3px var(--teal-tint)";

afterEach(() => document.body.replaceChildren());

// The markup mirrors AutoGrader.tsx: two file panels, then the criteria panel, then the submit button.
function card(): Element[] {
  document.body.innerHTML =
    '<div class="autograder-card"><div class="autograder-panel"></div><div class="autograder-panel"></div>' +
    '<div class="autograder-panel"><textarea class="autograder-textarea"></textarea></div><button class="autograder-submit"></button></div>';
  return [...document.querySelectorAll(".autograder-panel")];
}

describe("Auto Grader", () => {
  // A transparent outline, not none: forced-colors mode repaints it, so focus stays visible in High Contrast.
  it("shows one focus ring on the criteria textarea, its own", () => {
    card();
    const area = document.querySelector(".autograder-textarea")!;
    expect(both(area, "outline", { states: ["focus-visible"] })).toEqual(["2px solid transparent", "2px solid transparent"]);
    expect(both(area, "box-shadow", { states: ["focus-visible"] })).toEqual([RING, RING]);
  });

  it("draws the two drop zones as sheet cards with a dashed edge (spec §5.6)", () => {
    const [questionZone, answerZone] = card();
    for (const zone of [questionZone, answerZone]) {
      expect(both(zone, "background")).toEqual(["var(--sheet)", "var(--sheet)"]);
      expect(both(zone, "border-style")).toEqual(["dashed", "dashed"]);
    }
  });
});
