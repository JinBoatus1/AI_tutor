// @vitest-environment jsdom
// Textbook panel controls as a browser resolves them once every stylesheet competes (test/cssCascade.ts).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();
const both = (el: Element, property: string) => resolveInBothOrders(el, property, sheets);

afterEach(() => document.body.replaceChildren());

describe("textbook zoom controls", () => {
  it("keep their own styles inside the pager", () => {
    // The markup mirrors LearningModel.tsx: the zoom group sits inside .section-pages-nav.
    document.body.innerHTML =
      '<div class="section-pages-nav"><div class="section-pages-zoom"><button class="section-pages-zoom-btn">−</button>' +
      '<button class="section-pages-zoom-label">100%</button><button class="section-pages-zoom-btn">+</button></div>' +
      '<div class="section-pages-paging"><button>Prev</button></div></div>';
    const label = document.querySelector(".section-pages-zoom-label")!;
    const zoomButton = document.querySelector(".section-pages-zoom-btn")!;
    expect(both(label, "font-family")).toEqual(["var(--mono)", "var(--mono)"]);
    expect(both(label, "color")).toEqual(["var(--ink-2)", "var(--ink-2)"]);
    expect(both(zoomButton, "border-radius")).toEqual(["50%", "50%"]);
    expect(both(zoomButton, "padding-left")).toEqual(["0", "0"]);
    expect(both(document.querySelector(".section-pages-paging button")!, "color")).toEqual(["var(--teal)", "var(--teal)"]);
  });
});

describe('"In the book" callout', () => {
  it("is an ink label on teal tint with a teal arrow (spec §5.3)", () => {
    document.body.innerHTML =
      '<div class="book-page-highlight-callout"><span class="book-page-highlight-arrow">↳</span>' +
      '<span class="book-page-highlight-label">In the book · p. 8</span></div>';
    const callout = document.querySelector(".book-page-highlight-callout")!;
    expect(both(callout, "background")).toEqual(["var(--teal-tint)", "var(--teal-tint)"]);
    expect(both(callout, "color")).toEqual(["var(--ink)", "var(--ink)"]);
    expect(both(document.querySelector(".book-page-highlight-arrow")!, "color")).toEqual(["var(--teal)", "var(--teal)"]);
  });
});
