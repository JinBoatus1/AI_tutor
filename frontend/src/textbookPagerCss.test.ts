import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec §5.3: the pager floats at the bottom and stays visible; page images are sheets on the desk.
const css = readFileSync(fileURLToPath(new URL("./Chat.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string): string {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const m = re.exec(css);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[2];
}

describe("textbook pager and pages", () => {
  it("sticks the pager to the bottom of the page box", () => {
    const nav = rule(".section-pages-nav");
    expect(nav).toMatch(/position:\s*sticky/);
    expect(nav).toMatch(/bottom:\s*var\(--s4\)/);
    expect(nav).toMatch(/order:\s*2/);
    expect(nav).toMatch(/margin:\s*auto 0 var\(--s4\)/);
    expect(nav).not.toMatch(/(^|[;\s])top:/);
  });

  it("draws page images as sheets on the desk", () => {
    const img = rule(".reference-page-img");
    expect(img).toMatch(/box-shadow:\s*var\(--sh-sheet\)/);
    expect(img).toMatch(/filter:\s*var\(--page-image-filter\)/);
  });
});
