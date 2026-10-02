import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Contrast and completeness guard for the Paper & Ink tokens (spec §4.7, §7.2).
const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

type Vars = Record<string, string>;

/** Custom properties declared in the first rule whose selector list matches `selector`. */
function block(selector: RegExp): Vars {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(m[1].trim())) continue;
    const vars: Vars = {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
    return vars;
  }
  throw new Error(`tokens.css has no block for ${selector}`);
}

const VARIANTS: Record<string, Vars> = {
  paper: block(/\[data-theme="paper"\]/),
  bright: block(/(^|,\s*)\[data-theme="bright"\]$/),
  night: block(/(^|,\s*)\[data-theme="night"\]$/),
};

function resolve(vars: Vars, name: string, depth = 0): string {
  const value = vars[name];
  if (value === undefined) throw new Error(`${name} is not defined`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref && depth < 5 ? resolve(vars, ref[1], depth + 1) : value;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["--desk", "--desk-hi", "--parch", "--paper", "--sheet", "--track"];
const LIGHT = ["--parch", "--paper", "--sheet"];
const PAIRS: { fg: string; bgs: string[]; min: number }[] = [
  ...["--ink", "--ink-body", "--ink-2", "--ink-3"].map((fg) => ({ fg, bgs: SURFACES, min: 4.5 })),
  { fg: "--teal", bgs: [...SURFACES, "--teal-tint"], min: 4.5 },
  { fg: "--on-teal", bgs: ["--teal-fill", "--teal-press"], min: 4.5 },
  { fg: "--teal-fill", bgs: ["--desk"], min: 3 },
  { fg: "--teal-edge", bgs: LIGHT, min: 3 },
  { fg: "--rule-input", bgs: LIGHT, min: 3 },
  { fg: "--ink-4", bgs: LIGHT, min: 3 },
  { fg: "--ribbon", bgs: ["--sheet", "--parch"], min: 3 },
  { fg: "--danger", bgs: ["--sheet", "--paper", "--danger-tint"], min: 4.5 },
  { fg: "--success", bgs: ["--sheet", "--paper", "--success-tint"], min: 4.5 },
  { fg: "--warning", bgs: ["--sheet", "--paper", "--warning-tint"], min: 4.5 },
];

describe("tokens.css", () => {
  for (const [variant, vars] of Object.entries(VARIANTS)) {
    describe(variant, () => {
      for (const { fg, bgs, min } of PAIRS) {
        for (const bg of bgs) {
          it(`${fg} on ${bg} is at least ${min}:1`, () => {
            expect(contrast(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(min);
          });
        }
      }
    });
  }

  it("every variant defines exactly the same tokens", () => {
    const names = Object.keys(VARIANTS.paper).sort();
    expect(Object.keys(VARIANTS.bright).sort()).toEqual(names);
    expect(Object.keys(VARIANTS.night).sort()).toEqual(names);
  });

  it("makes Paper the :root default", () => {
    expect(css).toMatch(/:root,\s*\[data-theme="paper"\]\s*\{/);
  });

  it.each([
    [/\[data-theme="paper"\]/, "light"],
    [/(^|,\s*)\[data-theme="bright"\]$/, "light"],
    [/(^|,\s*)\[data-theme="night"\]$/, "dark"],
  ])("tells the browser the scheme of %s, for native controls and scrollbars", (selector, scheme) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => selector.test(m[1].trim()));
    expect(/color-scheme:\s*(\w+);/.exec(rule?.[2] ?? "")?.[1]).toBe(scheme);
  });
});
