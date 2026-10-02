// @vitest-environment jsdom
// Which variant values an element actually gets once the cascade runs (test/cssCascade.ts).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, parseStyleSheet, resolveStyle } from "../test/cssCascade";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = parseStyleSheet(readFileSync(join(here, "tokens.css"), "utf8"), "styles/tokens.css");
const reversed = { file: tokens.file, rules: [...tokens.rules].reverse() };

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.body.replaceChildren();
});

describe("theme variants", () => {
  it.each([
    ["night", "#141210", "dark"],
    ["bright", "#ecebe8", "light"],
  ])("%s on <html> beats the :root Paper block in any rule order", (theme, desk, scheme) => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    for (const sheet of [tokens, reversed]) {
      expect(resolveStyle(html, "--desk", [sheet])).toBe(desk);
      expect(resolveStyle(html, "color-scheme", [sheet])).toBe(scheme);
    }
  });

  it("keeps each Appearance preview on its own variant whatever the page theme", () => {
    document.body.innerHTML = '<span data-theme="night"></span>';
    expect(resolveStyle(document.querySelector("span")!, "--parch", [tokens])).toBe("#1c1916");
    document.documentElement.setAttribute("data-theme", "night");
    document.body.innerHTML = '<span data-theme="paper"></span><span data-theme="bright"></span>';
    const [paper, bright] = document.body.querySelectorAll("span");
    expect(resolveStyle(paper, "--parch", [tokens])).toBe("#f4efe6");
    expect(resolveStyle(bright, "--parch", [tokens])).toBe("#f6f5f2");
  });
});

describe("Home under Night", () => {
  it("stays light: its own scheme, selection, focus and scrollbar colors", () => {
    document.documentElement.setAttribute("data-theme", "night");
    document.body.innerHTML = '<div class="home-scrap"></div>';
    const home = document.querySelector(".home-scrap")!;
    const sheets = loadAppStyleSheets();
    expect(resolveStyle(home, "color-scheme", sheets)).toBe("light");
    expect(resolveStyle(home, "--selection", sheets)).toBe("#e5ebe5");
    expect(resolveStyle(home, "--focus", sheets)).toBe("#0f5e57");
    expect(resolveStyle(home, "--rule-2", sheets)).toBe("#d9cfbe");
  });
});
