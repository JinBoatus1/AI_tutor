// @vitest-environment jsdom
// Grades as a browser resolves it once every stylesheet competes (test/cssCascade.ts), in either load order.
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("Grades", () => {
  it.each([390, 1280])("keeps 10px under the course title at %ipx (the old global h1 rule gave it)", (width) => {
    // The markup mirrors Grades.tsx.
    document.body.innerHTML =
      '<div class="gr-page"><header class="gr-head"><div class="gr-masthead"><h1 class="gr-course">Course</h1></div></header></div>';
    expect(resolveInBothOrders(document.querySelector(".gr-course")!, "margin-bottom", sheets, { width })).toEqual([
      "10px",
      "10px",
    ]);
  });
});
