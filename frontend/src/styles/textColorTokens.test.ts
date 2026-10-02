// Text colors must come from tokens that pass as text in every variant (spec §4.7). Fill, edge, rule,
// surface and tint tokens are meant for surfaces and lines, and --ink-4 marks only (§4.5); as text they
// can fail in a variant (--teal-press reads 2.1–2.6:1 in Night).
import { describe, expect, it } from "vitest";
import { loadAppStyleSheets } from "../test/cssCascade";

const NOT_TEXT =
  /var\(--(teal-press|teal-fill|teal-edge|rule|rule-2|rule-input|ink-4|desk|desk-hi|parch|paper|sheet|track|teal-tint|danger-tint|success-tint|warning-tint|selection|scrim)\)/;
// Deliberate inverse pairs: light text on a dark fill in Paper and Bright, dark text on a light fill in
// Night. Both flip together, so they read 6.5:1 or better in every variant.
// Keyed on the value too, so another token on these rules is still caught; tokens.test.ts checks both pairs.
const INVERSE_PAIRS = new Set(["Grades.css: .gr-del-yes → var(--sheet)", "Chat.css: .attached-img-remove → var(--sheet)"]);
const TEXT_PROPERTIES = ["color", "-webkit-text-fill-color", "caret-color"];

describe("text color tokens", () => {
  it("never colors text with a non-text token, in any state", () => {
    const offenders: string[] = [];
    for (const sheet of loadAppStyleSheets()) {
      if (sheet.file === "styles/tokens.css") continue;
      for (const rule of sheet.rules) {
        for (const property of TEXT_PROPERTIES) {
          const value = rule.declarations.get(property)?.value;
          const where = `${sheet.file}: ${rule.selectors.join(", ")}`;
          if (value && NOT_TEXT.test(value) && !INVERSE_PAIRS.has(`${where} → ${value}`)) offenders.push(`${where} → ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
