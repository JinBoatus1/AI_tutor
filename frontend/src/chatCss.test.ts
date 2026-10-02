import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("./Chat.css").replace(/\/\*[\s\S]*?\*\//g, "");
const tsx = read("./LearningModel.tsx");

describe("chat panel", () => {
  it("puts the Tutor title and the new-session button in one row, keeping the tour anchor", () => {
    expect(tsx).toMatch(
      /className="chat-panel-titlebar"[\s\S]{0,200}chat\.tutorTitle[\s\S]{0,200}className="reset-box" data-onboarding="new-session"/,
    );
  });

  it("sets tutor answers in serif with the teal margin rule", () => {
    expect(css).toMatch(/\.msg-ai \.markdown-message:not\(\.markdown-message--user\)\s*\{[^}]*border-left:\s*2px solid var\(--teal-line\)/);
    expect(css).toMatch(/\.msg-ai \.markdown-message:not\(\.markdown-message--user\)\s*\{[^}]*font-family:\s*var\(--serif\)/);
  });
  it("keeps tutor-answer headings as small labels (no per-level size overrides them)", () => {
    const perLevel = [...css.matchAll(/(?<=\})\s*\.markdown-message h([1-6])\s*\{([^}]*)\}/g)].filter((m) => /font-size/.test(m[2]));
    expect(perLevel.map((m) => `h${m[1]}`)).toEqual([]);
  });
});
