// @vitest-environment jsdom
// KaTeX paints a formula it cannot parse with an inline color:#cc0000, which reads 2.85:1 on Night's
// paper. Spec §4.6: KaTeX inherits currentColor or tokens, so the app's rule must win in every variant.
import katex from "katex";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("KaTeX error text", () => {
  it("uses the danger token over KaTeX's inline red", () => {
    document.body.innerHTML = katex.renderToString("\\frac{1}{", { throwOnError: false });
    const error = document.querySelector(".katex-error")!;
    expect(error.getAttribute("style")).toMatch(/color:\s*#cc0000/);
    expect(resolveInBothOrders(error, "color", sheets)).toEqual(["var(--danger)", "var(--danger)"]);
  });
});
