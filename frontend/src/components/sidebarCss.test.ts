import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const sidebar = read("./Sidebar.css");
const app = read("../App.tsx");
const base = read("../index.css");

describe("sidebar and global CSS", () => {
  it("hides the sign-in prompt on the collapsed rail", () => {
    const collapsedHide = /([^{}]*)\{\s*display:\s*none;\s*\}/g;
    const lists = [...sidebar.matchAll(collapsedHide)].map((m) => m[1]);
    expect(lists.some((l) => l.includes(".sb--collapsed .sb-signin-prompt"))).toBe(true);
  });

  it("hides the sign-in prompt in the narrow (≤760px) rail", () => {
    const media = /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/.exec(sidebar);
    expect(media?.[1]).toContain(".sb:not(.sb--collapsed) .sb-signin-prompt");
  });

  it("no longer renders the top sign-in banner", () => {
    expect(app).not.toContain("auth-prompt");
    expect(app).not.toContain("bannerDismissed");
  });

  it("draws a visible focus outline everywhere", () => {
    expect(base).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--focus\);\s*outline-offset:\s*2px;/);
  });
});
