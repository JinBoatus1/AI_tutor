// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, parseStyleSheet, resolveInBothOrders, resolveStyle, specificity } from "./cssCascade";

function field(): Element {
  document.body.innerHTML = '<div class="box"><input type="text" class="field"></div>';
  return document.querySelector(".field")!;
}

afterEach(() => document.body.replaceChildren());

describe("specificity", () => {
  it.each([
    ["*", [0, 0, 0]],
    ["h1", [0, 0, 1]],
    ['input[type="text"]', [0, 1, 1]],
    [":focus-visible", [0, 1, 0]],
    [".sb:not(.sb--collapsed) .sb-link-label", [0, 3, 0]],
    [".content:not(:has(.learning-page-wrapper))", [0, 2, 0]],
    [":where(.gr-page) input:focus-visible", [0, 1, 1]],
    ["#root > .a::before", [1, 1, 1]],
  ])("%s", (selector, expected) => {
    expect(specificity(selector)).toEqual(expected);
  });
});

describe("resolveStyle", () => {
  it("lets specificity beat source order", () => {
    const sheet = parseStyleSheet('input[type="text"] { width: 10px; } .field { width: 20px; }');
    expect(resolveStyle(field(), "width", [sheet])).toBe("10px");
  });

  it("lets the later rule win a tie, across sheets too", () => {
    const first = parseStyleSheet(".field { width: 1px; } .box .field { width: 2px; }");
    const second = parseStyleSheet(".box .field { width: 3px; }");
    expect(resolveStyle(field(), "width", [first, second])).toBe("3px");
    expect(resolveInBothOrders(field(), "width", [first, second])).toEqual(["3px", "2px"]);
  });

  it("lets !important beat specificity", () => {
    const sheet = parseStyleSheet(".box .field { width: 1px; } .field { width: 2px !important; }");
    expect(resolveStyle(field(), "width", [sheet])).toBe("2px");
  });

  it("applies a max-width block only at or below that width", () => {
    const sheet = parseStyleSheet(".field { width: 1px; } @media (max-width: 760px) { .field { width: 2px; } }");
    expect(resolveStyle(field(), "width", [sheet], { width: 760 })).toBe("2px");
    expect(resolveStyle(field(), "width", [sheet], { width: 761 })).toBe("1px");
  });

  it("applies state rules only in that state, with focus reaching ancestors", () => {
    const sheet = parseStyleSheet(".field:focus-visible { width: 1px; } .box:focus-within { height: 2px; }");
    const el = field();
    expect(resolveStyle(el, "width", [sheet])).toBeUndefined();
    expect(resolveStyle(el, "width", [sheet], { states: ["focus-visible"] })).toBe("1px");
    expect(resolveStyle(el.parentElement!, "height", [sheet])).toBeUndefined();
    expect(resolveStyle(el.parentElement!, "height", [sheet], { states: ["focus-within"] })).toBe("2px");
    expect(el.hasAttribute("data-cascade-focus-visible")).toBe(false);
  });

  it("expands margin and padding into longhands", () => {
    const sheet = parseStyleSheet(".field { padding: 1px 2px; margin: 0 0 3px; }");
    expect(resolveStyle(field(), "padding-left", [sheet])).toBe("2px");
    expect(resolveStyle(field(), "margin-bottom", [sheet])).toBe("3px");
  });

  it("matches :has(), also inside :not()", () => {
    const sheet = parseStyleSheet(".box:has(.field) .field { width: 1px; } .box:not(:has(.missing)) .field { height: 2px; }");
    expect(resolveStyle(field(), "width", [sheet])).toBe("1px");
    expect(resolveStyle(field(), "height", [sheet])).toBe("2px");
    expect(document.querySelector("[data-cascade-has-0]")).toBeNull();
  });

  it("lets an inline style beat rules, and an !important rule beat the inline style", () => {
    const el = field();
    el.setAttribute("style", "width: 9px; height: 9px");
    const sheet = parseStyleSheet("#x, .box .field { width: 1px; } .field { height: 2px !important; }");
    expect(resolveStyle(el, "width", [sheet])).toBe("9px");
    expect(resolveStyle(el, "height", [sheet])).toBe("2px");
  });

  it("skips pseudo-element rules", () => {
    const sheet = parseStyleSheet(".field::placeholder { width: 9px; }");
    expect(resolveStyle(field(), "width", [sheet])).toBeUndefined();
  });

  it("resolves a pseudo-element's own rules when asked for one", () => {
    const sheet = parseStyleSheet('.box .field::after { content: "a"; } .field:after { content: "b"; } .field::before { content: "c"; }');
    expect(resolveStyle(field(), "content", [sheet], { pseudo: "::after" })).toBe('"a"');
    expect(resolveStyle(field(), "content", [sheet], { pseudo: "::before" })).toBe('"c"');
    expect(resolveStyle(field(), "content", [sheet])).toBeUndefined();
  });

  it("honors a legacy single-colon :after on its own", () => {
    const sheet = parseStyleSheet('.field:after { content: "b"; }');
    expect(resolveStyle(field(), "content", [sheet], { pseudo: "::after" })).toBe('"b"');
  });

  it.each([undefined, "::before", "::after"] as const)("evaluates every selector and media query in the app's stylesheets (pseudo %s)", (pseudo) => {
    const probe = field();
    expect(() => {
      for (const sheet of loadAppStyleSheets()) {
        for (const rule of sheet.rules) {
          const property = rule.declarations.keys().next().value;
          if (property) resolveStyle(probe, property, [{ file: sheet.file, rules: [rule] }], { width: 390, pseudo });
        }
      }
    }).not.toThrow();
  });
});
