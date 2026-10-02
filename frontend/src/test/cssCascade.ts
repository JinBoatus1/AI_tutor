// A small CSS cascade for tests. jsdom's getComputedStyle ignores specificity, and the CSS
// tests that read source text cannot see a rule losing to another file's rule, so this
// resolves which declaration an element gets: importance, then the inline style attribute,
// then specificity, then source order. It knows style rules, @media on max-width (px) and prefers-reduced-motion,
// @supports (assumed true), and the :hover / :focus / :focus-visible / :focus-within /
// :active states. Pseudo-element rules count only when env.pseudo asks for one; a selector
// or media query it cannot evaluate throws instead of being ignored.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

type Declaration = { value: string; important: boolean };
type StyleRule = { selectors: string[]; declarations: Map<string, Declaration>; media: string | null };
export type StyleSheet = { file: string; rules: StyleRule[] };
export type ElementState = "hover" | "focus" | "focus-visible" | "focus-within" | "active";
export type CascadeEnv = { width?: number; reducedMotion?: boolean; states?: ElementState[]; pseudo?: "::before" | "::after" };
type Specificity = [number, number, number];

// fileURLToPath on the string: under jsdom the global URL is not Node's.
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Index of the bracket that closes the one at `open`, skipping quoted strings. */
function closing(text: string, open: number): number {
  const close = text[open] === "{" ? "}" : ")";
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === text[open]) depth++;
    else if (ch === close && --depth === 0) return i;
  }
  throw new Error(`cssCascade: unbalanced "${text[open]}" at ${open}`);
}

/** Splits on `sep` (" " means any whitespace) outside brackets and quotes. */
function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && (sep === " " ? /\s/.test(ch) : ch === sep)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const BOX_SIDES = ["top", "right", "bottom", "left"];

/** margin and padding become their four longhands, so a longhand query sees both forms. */
function longhands(name: string, value: string): [string, string][] {
  const parts = splitTopLevel(value, " ");
  if ((name === "margin" || name === "padding") && parts.length >= 1 && parts.length <= 4) {
    const [top, right = top, bottom = top, left = right] = parts;
    return [top, right, bottom, left].map((v, i): [string, string] => [`${name}-${BOX_SIDES[i]}`, v]);
  }
  return [[name, value]];
}

function parseDeclarations(block: string): Map<string, Declaration> {
  const out = new Map<string, Declaration>();
  for (const decl of splitTopLevel(block, ";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const name = decl.slice(0, colon).trim();
    const raw = decl.slice(colon + 1).trim();
    const important = /!\s*important$/i.test(raw);
    const value = raw.replace(/!\s*important$/i, "").trim();
    for (const [prop, v] of longhands(name.startsWith("--") ? name : name.toLowerCase(), value)) {
      out.set(prop, { value: v, important });
    }
  }
  return out;
}

export function parseStyleSheet(css: string, file = "inline.css"): StyleSheet {
  const rules: StyleRule[] = [];
  const walk = (text: string, media: string | null) => {
    let i = 0;
    for (let open = text.indexOf("{"); open >= 0; open = text.indexOf("{", i)) {
      const prelude = text
        .slice(i, open)
        .replace(/@(?:import|charset|namespace)\b[^;]*;/g, "")
        .trim();
      const close = closing(text, open);
      const body = text.slice(open + 1, close);
      if (/^@media\b/i.test(prelude)) {
        const query = prelude.replace(/^@media\s*/i, "");
        walk(body, media ? `${media} and ${query}` : query);
      } else if (/^@supports\b/i.test(prelude)) {
        walk(body, media);
      } else if (!prelude.startsWith("@")) {
        rules.push({ selectors: splitTopLevel(prelude, ","), declarations: parseDeclarations(body), media });
      }
      i = close + 1;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), null);
  return { file, rules };
}

/** Every stylesheet under src/, in path order. The bundle order is not modeled; see resolveInBothOrders. */
export function loadAppStyleSheets(): StyleSheet[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".css")) files.push(path);
    }
  };
  walk(SRC);
  return files.sort().map((path) => parseStyleSheet(readFileSync(path, "utf8"), relative(SRC, path)));
}

function mediaMatches(query: string, env: CascadeEnv): boolean {
  return splitTopLevel(query, ",").some((alternative) =>
    alternative.split(/\s+and\s+/i).every((condition) => {
      const feature = /^\(\s*([\w-]+)\s*:\s*([^)]+?)\s*\)$/.exec(condition.trim());
      if (feature?.[1] === "max-width" && /^\d+(\.\d+)?px$/.test(feature[2])) {
        return (env.width ?? 1280) <= parseFloat(feature[2]);
      }
      if (feature?.[1] === "prefers-reduced-motion") return (feature[2] === "reduce") === Boolean(env.reducedMotion);
      throw new Error(`cssCascade: unsupported media query "${query}"`);
    }),
  );
}

const STATE_ATTRIBUTE: Record<ElementState, string> = {
  "focus-visible": "data-cascade-focus-visible",
  "focus-within": "data-cascade-focus-within",
  focus: "data-cascade-focus",
  hover: "data-cascade-hover",
  active: "data-cascade-active",
};
const STATE_PSEUDO_CLASS = /:(focus-visible|focus-within|focus|hover|active)(?![\w-])/g;
const PSEUDO_ELEMENT = /::|:(?:before|after|first-line|first-letter)(?![\w-])/i;

const withStateAttributes = (selector: string) =>
  selector.replace(STATE_PSEUDO_CLASS, (_, state: ElementState) => `[${STATE_ATTRIBUTE[state]}]`);

/** The selector without its trailing `pseudo` (double- or legacy single-colon), or null if it has none. */
function withoutPseudo(selector: string, pseudo: string): string | null {
  const trailing = new RegExp(`::?${pseudo.replace(/^::?/, "")}$`, "i").exec(selector);
  if (!trailing) return null;
  return selector.slice(0, trailing.index).trim() || "*";
}

/**
 * el.matches(), with states as attributes. jsdom cannot parse :has() inside :not(), so each
 * :has(descendant) becomes an attribute set on the elements that have such a descendant.
 */
function matches(el: Element, selector: string, file: string): boolean {
  const undo: (() => void)[] = [];
  let marks = 0;
  try {
    let testable = "";
    for (let i = 0; i < selector.length; ) {
      if (!selector.startsWith(":has(", i)) {
        testable += selector[i++];
        continue;
      }
      const close = closing(selector, i + 4);
      const arg = withStateAttributes(selector.slice(i + 5, close).trim());
      if (/^[>+~]/.test(arg) || arg.includes(":has(")) throw new Error(`unsupported :has() argument "${arg}"`);
      const attr = `data-cascade-has-${marks++}`;
      for (const node of el.ownerDocument.querySelectorAll("*")) {
        if (node.querySelector(arg)) {
          node.setAttribute(attr, "");
          undo.push(() => node.removeAttribute(attr));
        }
      }
      testable += `[${attr}]`;
      i = close + 1;
    }
    return el.matches(withStateAttributes(testable));
  } catch (error) {
    throw new Error(`cssCascade: ${file} has a selector jsdom cannot match: "${selector}" (${String(error)})`);
  } finally {
    for (const step of undo) step();
  }
}

/** Runs `run` with the states set the way a browser sets them: focus reaches ancestors as focus-within, hover reaches ancestors. */
function withStates<T>(el: Element, states: ElementState[], run: () => T): T {
  const marked: [Element, string][] = [];
  const mark = (state: ElementState, ancestors: boolean) => {
    for (let node: Element | null = el; node; node = ancestors ? node.parentElement : null) {
      const attr = STATE_ATTRIBUTE[state];
      if (!node.hasAttribute(attr)) {
        node.setAttribute(attr, "");
        marked.push([node, attr]);
      }
    }
  };
  for (const state of states) {
    if (state === "focus-visible") mark("focus-visible", false);
    if (state === "focus" || state === "focus-visible") {
      mark("focus", false);
      mark("focus-within", true);
    }
    if (state === "focus-within" || state === "hover" || state === "active") mark(state, true);
  }
  try {
    return run();
  } finally {
    for (const [node, attr] of marked) node.removeAttribute(attr);
  }
}

const add = (a: Specificity, b: Specificity): Specificity => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const compare = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Selectors Level 4 specificity: :where() adds nothing; :is(), :not() and :has() add their most specific argument. */
export function specificity(selector: string): Specificity {
  let total: Specificity = [0, 0, 0];
  let rest = "";
  for (let i = 0; i < selector.length; ) {
    const fn = /^:(where|is|not|has)\(/i.exec(selector.slice(i));
    if (!fn) {
      rest += selector[i++];
      continue;
    }
    const open = i + fn[0].length - 1;
    const close = closing(selector, open);
    if (fn[1].toLowerCase() !== "where") {
      const args = splitTopLevel(selector.slice(open + 1, close), ",").map(specificity);
      total = add(total, args.reduce((best, s) => (compare(s, best) > 0 ? s : best), [0, 0, 0] as Specificity));
    }
    rest += " ";
    i = close + 1;
  }
  const take = (pattern: RegExp) => {
    const n = rest.match(pattern)?.length ?? 0;
    rest = rest.replace(pattern, " ");
    return n;
  };
  const attributes = take(/\[[^\]]*\]/g);
  const pseudoElements = take(/::[\w-]+(\([^)]*\))?/g) + take(/:(?:before|after|first-line|first-letter)(?![\w-])/gi);
  const ids = take(/#[\w-]+/g);
  const classes = take(/\.[\w-]+/g);
  const pseudoClasses = take(/:[\w-]+(\([^)]*\))?/g);
  const types = rest.split(/[\s>+~]+/).filter((t) => t && t !== "*").length;
  return add(total, [ids, attributes + classes + pseudoClasses, pseudoElements + types]);
}

type Winner = { declaration: Declaration; specificity: Specificity; order: number };

function beats(declaration: Declaration, s: Specificity, order: number, winner: Winner): boolean {
  if (declaration.important !== winner.declaration.important) return declaration.important;
  const bySpecificity = compare(s, winner.specificity);
  return bySpecificity > 0 || (bySpecificity === 0 && order > winner.order);
}

/**
 * The declared value `property` gets on `el` from `sheets` (later sheets are later source) and
 * its style attribute, or undefined when nothing sets it and the element inherits or takes the
 * initial value. An inline style beats every normal rule; an !important rule beats it.
 */
export function resolveStyle(
  el: Element,
  property: string,
  sheets: StyleSheet[],
  env: CascadeEnv = {},
): string | undefined {
  return withStates(el, env.states ?? [], () => {
    let winner: Winner | undefined;
    let order = 0;
    for (const sheet of sheets) {
      for (const rule of sheet.rules) {
        order++;
        const declaration = rule.declarations.get(property);
        if (!declaration || (rule.media && !mediaMatches(rule.media, env))) continue;
        for (const selector of rule.selectors) {
          const target = env.pseudo ? withoutPseudo(selector, env.pseudo) : selector;
          if (target === null || PSEUDO_ELEMENT.test(target) || !matches(el, target, sheet.file)) continue;
          const s = specificity(selector);
          if (!winner || beats(declaration, s, order, winner)) winner = { declaration, specificity: s, order };
        }
      }
    }
    const inline = env.pseudo ? undefined : parseDeclarations(el.getAttribute("style") ?? "").get(property);
    if (inline && (inline.important || !winner?.declaration.important)) return inline.value;
    return winner?.declaration.value;
  });
}

/** The value with the sheets in path order and in reverse. A rule that wins both ways does not depend on which file loads last. */
export function resolveInBothOrders(
  el: Element,
  property: string,
  sheets: StyleSheet[],
  env: CascadeEnv = {},
): [string | undefined, string | undefined] {
  return [resolveStyle(el, property, sheets, env), resolveStyle(el, property, [...sheets].reverse(), env)];
}
