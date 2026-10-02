// Text colors must come from tokens that pass as text in every variant (spec §4.7). Fill, edge and
// rule tokens are meant for surfaces and lines; --teal-press reads 2.1–2.6:1 as text in Night.
import { describe, expect, it } from "vitest";
import { loadAppStyleSheets } from "../test/cssCascade";

const NOT_TEXT = /var\(--(teal-press|teal-fill|teal-edge|rule|rule-2|rule-input)\)/;
const TEXT_PROPERTIES = ["color", "-webkit-text-fill-color", "caret-color"];

describe("text color tokens", () => {
  it("never colors text with a fill, edge or rule token, in any state", () => {
    const offenders: string[] = [];
    for (const sheet of loadAppStyleSheets()) {
      if (sheet.file === "styles/tokens.css") continue;
      for (const rule of sheet.rules) {
        for (const property of TEXT_PROPERTIES) {
          const value = rule.declarations.get(property)?.value;
          if (value && NOT_TEXT.test(value)) offenders.push(`${sheet.file}: ${rule.selectors.join(", ")} → ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
