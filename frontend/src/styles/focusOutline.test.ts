// Focus must stay visible in forced-colors mode (Windows High Contrast), which drops box-shadow and
// flattens backgrounds and border colors but repaints outlines. So a focus rule may hide its outline
// with a transparent color, never remove it. Home is outside the redesign (spec D2).
import { describe, expect, it } from "vitest";
import { loadAppStyleSheets } from "../test/cssCascade";

describe("focus outlines", () => {
  it("are made transparent, never removed, in every focus rule", () => {
    const offenders: string[] = [];
    for (const sheet of loadAppStyleSheets()) {
      if (sheet.file === "Home.css") continue;
      for (const rule of sheet.rules) {
        const outline = rule.declarations.get("outline")?.value ?? rule.declarations.get("outline-style")?.value;
        const focused = rule.selectors.filter((s) => s.includes(":focus"));
        if (outline && /^(none|0)$/.test(outline) && focused.length) offenders.push(`${sheet.file}: ${focused.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
