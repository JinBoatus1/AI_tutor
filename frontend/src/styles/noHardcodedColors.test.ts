import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Spec §7.2: colors live only in styles/tokens.css. Home is deferred (D2), so it is excluded.
const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Files that still hold legacy colors. Each migration task removes its files; Task 9 empties this. */
const PENDING = new Set<string>([
  "App.css",
  "AutoGrader.css",
  "Chat.css",
  "ChatHistory.css",
  "Grades.css",
  "LearningModel.tsx",
  "MyLearningBar.css",
  "SignInModal.css",
  "SignInModal.tsx",
  "UserProfile.css",
  "UserProfile.tsx",
  "components/GooeyNav.css",
  "components/OnboardingTour.css",
  "components/Sidebar.css",
  "feedback/FeedbackModal.css",
  "practice/Practice.css",
  "profile/profileSettings.ts",
]);

const EXCLUDED = new Set(["styles/tokens.css", "Home.css", "Home.tsx"]);

/** Google's logo keeps its official colors. */
const ALLOWED: Record<string, Set<string>> = {
  "SignInModal.tsx": new Set(["#4285F4", "#34A853", "#FBBC05", "#EA4335"]),
};

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC = /\b(?:rgba?|hsla?)\(/;
const NAMED =
  /(?<![\w-])(?:white|black|gray|grey|silver|red|maroon|orange|yellow|olive|lime|green|aqua|cyan|teal|blue|navy|fuchsia|magenta|purple|pink|brown|gold|beige|ivory|khaki|coral|salmon|tomato|crimson|indigo|violet|tan)(?![\w-])/i;

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) listFiles(path, out);
    else out.push(relative(SRC, path).split(sep).join("/"));
  }
  return out;
}

const SCANNED = listFiles(SRC).filter(
  (f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("test/") && !EXCLUDED.has(f),
);

function cssLiterals(text: string): string[] {
  const hits: string[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    const value = m[2]
      .replace(/url\([^)]*\)/g, "")
      .replace(/"[^"]*"|'[^']*'/g, "")
      .replace(/var\(--[\w-]+/g, "var(");
    if (HEX.test(value) || FUNC.test(value) || NAMED.test(value)) hits.push(`${m[1]}: ${m[2].trim()}`);
  }
  return hits;
}

function tsLiterals(file: string, text: string): string[] {
  const hits: string[] = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const s = node.text.trim();
      const isColor = /^#[0-9a-fA-F]{3,8}$/.test(s) || FUNC.test(s);
      if (isColor && !ALLOWED[file]?.has(s.toUpperCase())) hits.push(s);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

function literals(file: string): string[] {
  const text = readFileSync(join(SRC, file), "utf8");
  return file.endsWith(".css") ? cssLiterals(text) : tsLiterals(file, text);
}

const TOKEN_NAMES = new Set(
  [...readFileSync(join(SRC, "styles/tokens.css"), "utf8").matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
);

describe("colors live only in styles/tokens.css", () => {
  it("migrated files contain no color literals", () => {
    const offenders = SCANNED.filter((f) => !PENDING.has(f))
      .map((f) => ({ f, hits: literals(f) }))
      .filter((x) => x.hits.length > 0)
      .map((x) => `${x.f}: ${x.hits.slice(0, 3).join(" | ")}`);
    expect(offenders).toEqual([]);
  });

  it("every PENDING file still has a literal (remove it from PENDING once it is clean)", () => {
    const stale = [...PENDING].filter((f) => !SCANNED.includes(f) || literals(f).length === 0);
    expect(stale).toEqual([]);
  });

  it("no migrated stylesheet redefines a token name", () => {
    const shadows = SCANNED.filter((f) => f.endsWith(".css") && !PENDING.has(f)).flatMap((f) =>
      [...readFileSync(join(SRC, f), "utf8").matchAll(/(--[\w-]+)\s*:/g)]
        .map((m) => m[1])
        .filter((name) => TOKEN_NAMES.has(name))
        .map((name) => `${f} defines ${name}`),
    );
    expect(shadows).toEqual([]);
  });
});
