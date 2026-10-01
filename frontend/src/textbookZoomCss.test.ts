import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Read from disk: vitest hands CSS imports (even `?raw`) back as an empty string.
const css = readFileSync(fileURLToPath(new URL("./Chat.css", import.meta.url)), "utf8");

/** Declarations of the rule whose selector is exactly `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`no CSS rule for ${selector}`);
  return match[1];
}

// The test environment has no layout engine, so these pin the CSS contract that the browser
// check verified: 100% fits the page to the panel's width, and every other zoom level scales
// from that width. Sizing the wrapper from the image's natural width (max-content) made 100%
// mean "960 px whatever the panel" and left zoom-out shrinking the page inside an unchanged
// scroll area.
describe("textbook page zoom", () => {
  it("sizes the zoom wrapper from the panel width, never from the image's natural width", () => {
    const wrap = ruleBody(".reference-page-img-wrap--zoom");
    expect(wrap).toMatch(/(^|[;\s])width:\s*var\(--textbook-zoom-pct,\s*100%\)/);
    expect(wrap).not.toMatch(/max-content|min-width:\s*100%/);
  });

  it("makes the page image fill its zoom wrapper", () => {
    const img = ruleBody(".reference-page-sidebar .reference-page-img--zoomable");
    expect(img).toMatch(/(^|[;\s])width:\s*100%/);
    expect(img).not.toMatch(/--textbook-zoom-pct/);
  });
});
