import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEGACY_THEME_MAP, NIGHT_AVAILABLE, resolveTheme } from "./profile/profileSettings";

// index.html applies the saved variant before first paint (spec §4.4). It must agree with resolveTheme().
const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((body) => body.includes("ai_tutor_profile_settings"));

function runScript(stored: string | null): string {
  if (!script) throw new Error("index.html has no theme script");
  let applied: string | null = null;
  const localStorage = { getItem: () => stored };
  const document = { documentElement: { setAttribute: (_name: string, value: string) => (applied = value) } };
  new Function("localStorage", "document", script)(localStorage, document);
  return applied ?? "paper";
}

describe("index.html theme script", () => {
  it("uses the same legacy table and Night switch as profileSettings.ts", () => {
    const legacy = /var LEGACY = (\{[^}]*\});/.exec(script ?? "");
    const night = /var NIGHT_AVAILABLE = (true|false);/.exec(script ?? "");
    expect(legacy && JSON.parse(legacy[1])).toEqual(LEGACY_THEME_MAP);
    expect(night && night[1] === "true").toBe(NIGHT_AVAILABLE);
  });

  it.each([
    null,
    "{bad",
    "[]",
    "null",
    '"x"',
    "42",
    '{"theme":"bright"}',
    '{"theme":"night"}',
    '{"theme":"neon","pageBackground":"mint"}',
    '{"pageBackground":"white"}',
    '{"pageBackground":"dark"}',
    '{"pageBackground":"__proto__"}',
  ])("agrees with resolveTheme for %s", (stored) => {
    let expected = "paper";
    try {
      expected = resolveTheme(stored ? JSON.parse(stored) : null);
    } catch {
      expected = "paper";
    }
    expect(runScript(stored)).toBe(expected);
  });

  it.each([
    ['{"theme":"night"}', "night"],
    ['{"pageBackground":"dark"}', "night"],
    ['{"pageBackground":"black"}', "night"],
  ])("applies Night before first paint for %s", (stored, expected) => {
    expect(runScript(stored)).toBe(expected);
  });
});
