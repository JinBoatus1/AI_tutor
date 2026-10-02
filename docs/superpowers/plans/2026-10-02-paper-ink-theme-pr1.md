# Paper & Ink Theme (PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin every AI Tutor route except Home in Paper & Ink: semantic color tokens, Paper and Bright variants in the Appearance setting, the sidebar's current-section ribbon, and six named layout changes.

**Architecture:**
- One `styles/tokens.css` defines every color, font, size, spacing step, radius and shadow. Paper sits on `:root`, and Bright and Night are `[data-theme]` overrides. Night is defined but stays switched off until PR2.
- Every in-scope stylesheet is migrated onto the tokens.
- Two guard tests keep it that way: contrast pairs per variant, and no color literal outside `tokens.css`.
- A small `SessionBridge` addition tells the sidebar outline which section the textbook panel shows.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8, plain CSS, vitest 3 with jsdom and Testing Library, and the `typescript` compiler API (already a devDependency) inside one test.

**Spec:** `docs/superpowers/specs/2026-10-01-paper-ink-theme-design.md`. It was approved on 2026-10-02. Read §2 (decisions), §4 (tokens), §5 (surfaces) and §7 (testing) before Task 1.

## Global Constraints

**Scope and setup**
- Frontend only. No backend change, no new npm dependency, no `.env` file anywhere. Tests run offline.
- Run every command from `/Users/vnerald/ai_tutor/.worktrees/paper-ink-theme/frontend` unless a step says otherwise.
- Home stays untouched: `Home.tsx`, `Home.css`, and the DM Serif Display / DM Sans / DM Mono / Caveat font link in `index.html`, which Home still uses (spec D2).

**Tokens and colors**
- Token names and values are exactly those in spec §4.2–4.3. They are copied into Task 1; do not "improve" them.
- Teal marks interactive and current elements only. `--ribbon` appears only on the current outline section. Status colors never carry meaning alone. `--ink-4` is never used for text (spec §4.5).
- Outside `styles/tokens.css`, no stylesheet or component holds a color literal (hex, `rgb()`, `rgba()`, `hsl()`, or a named color in CSS). The only exceptions are Home and the four Google logo colors in `SignInModal.tsx`.
- No stylesheet other than `tokens.css` defines a custom property with a token's name.

**Structure and copy**
- **Paint, not structure (spec §7.1).** Change only paint properties. The exceptions are the steps labelled **LAYOUT CHANGE**: the banner removal, the sidebar sign-in line, the textbook header, the floating pager, the chat title row, and the tutor-answer margin.
- Never rename a class. New classes may be added.
- Copy changes are exactly spec §6, in all three locales (en, zh, es). `tsc` enforces key parity, because `ZH` and `ES` are typed `Record<MessageKey, string>`.

**Commits**
- Every commit message ends with the trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  ```
- Never commit `backend/data/books/*/book.pdf`, anything under `.superpowers/`, or screenshots.

## Migration Rules (Tasks 4–8 apply these to every declaration they touch)

**R1. Paint vs structure.**
- You may change:
  - color, `background` / `background-color` / `background-image`;
  - border color (keep each border's width and style; use `transparent` to hide one without changing the box);
  - outline color, `box-shadow`, `text-shadow`;
  - `fill`, `stroke`;
  - `font-family`, `font-style`, `font-weight`, `letter-spacing`, `text-transform`;
  - `border-radius`;
  - `filter` on page images.
- Do not change `display`, `position`, insets, sizes, margins, paddings, flex or grid properties, `gap`, `overflow`, `z-index` or media conditions, unless the step says **LAYOUT CHANGE**.
- Two narrow exceptions draw new marks without moving anything else:
  - `position: relative` on the current outline row, to anchor the ribbon;
  - `display: inline-grid; place-items: center` on the 14×14 learned toggle, to center its ✓.
- Adding a 1px border with a token color is allowed where a step's CSS shows it. With the global `box-sizing: border-box`, the outer size stays the same.

**R2. Dead rules.**
- Delete a rule only when *every* selector in its selector list names at least one class from the task's dead-class list.
- Rules for live classes stay, even when they duplicate another file. For example, `App.css` loads after `Chat.css`, so its live `.learning-layout`, `.msg-user`, `.msg-ai`, `.input-row` and `.right-panel` rules win today, and deleting them would move the layout.

**R3. Local variables.** Delete local custom properties that hold colors or fonts, and rename their uses to tokens with the task's rename table.

**R4. Color mapping by role.** Pick the row by the property and by what the element *is*. The listed literals are the ones present today.

- **Text:**
  - Headings, titles and emphasised labels in near-black (`#0c1222`, `#0f172a`, `#111827`, `#1c2530`, `#1e293b`, `#1f2937`, `#0f1729`, `#222`, `#2c3e50`, `#333`) → `--ink`.
  - The same family in running text (paragraphs, message bodies, list items) → `--ink-body`.
  - `#334155`, `#374151`, `#475569`, `#4b5563`, `#444`, `#555`, `#1e3a3a`, `#1e3a34` → `--ink-2`.
  - `#5b6672`, `#5a6c7d`, `#64748b`, `#6b7280`, `#94a3b8`, `#9ca3af`, `#888`, `#999`, `#a1a7b3`, `#9aa3ac`, `#aab2bb`, `#8c98aa`, `#7c8aa0`, `rgba(100,116,139,…)`, `rgba(148,163,184,…)`, `rgba(28,37,48,.35)` → `--ink-3`.
  - Any teal (`#0f766e`, `#0d9488`, `#14b8a6`, `#115e59`, `#134e4a`, `#2dd4bf`, `#5eead4`, `#99f6e4`, `#06302b`) → `--teal` if the element is interactive (a link, button, input or chip) or the current/selected item; otherwise `--ink-2`.
  - White text on a teal fill → `--on-teal`.
  - Light text on a formerly dark surface (the sidebar, the sign-in brand panel, the tour tooltip, the "In the book" callout): `#f1f5f9`, `#e2e8f0`, `#eaf3ef`, `#eef2f7`, `#cdd6e4`, `#aab4c4`, `rgba(203,213,225,…)` → the brightest becomes `--ink`, mid-tones `--ink-2`, dim ones `--ink-3`.
  - Reds (`#b91c1c`, `#991b1b`, `#dc2626`, `#c62828`, `#ef4444`, `#e24c4c`, `#fb7185`) → `--danger`.
  - Greens (`#166534`, `#15803d`, `#16a34a`, `#22c55e`) → `--success`.
  - Browns and ambers (`#9a5b3b`, `#b45309`, `#92400e`, `#78350f`, `#d97706`, `#f59e0b`) → `--warning`, unless the element reports an error, which takes `--danger`.
  - Purples, blues and indigos (`#667eea`, `#764ba2`, `#6a5af9`, `#7b66fa`, `#9965f4`) → `--teal` if interactive, else `--ink-2`.
- **Background:**
  - White and near-white (`#fff`, `white`, `#fefefe`, `#fafafa`, `#fdfdfd`, `#fffdf8`, `#fafbfc`, `rgba(255,255,255,≥.7)`) on cards, inputs, popovers, menus, active items and buttons → `--sheet`.
  - Canvases (`#f8fafc`, `#f7f3ea`, `#fbf8f0`, `#f5f5f5`, `#f9fafb`, `#f8f9fa`, `#e6eaf2`, `#eef2f7`, `#e8edf4`) → `--paper` for pages, chat and notes; `--desk` for the textbook area; `--parch` for the sidebar.
  - Light-gray fills for chips, tags, code, toolbars, hover states and disabled inputs (`#f1f5f9`, `#f0f4f8`, `#f3f4f6`, `#e5e7eb`, `#e2e8f0`, `#f0f0f0`, `#f4f4f4`, `rgba(28,37,48,.06)`, `rgba(255,255,255,.04–.1)`) → `--track`.
  - Dark navy surfaces (`#0c1222`, `#0f172a`, `#0f1729`, `#1e293b`, `#0a1a2e`, `#0c2828`, `rgba(12,18,34,…)`):
    - the sidebar → `--parch`;
    - the sign-in brand panel → `--parch`;
    - tooltips and callouts → `--sheet` with `--sh-float`;
    - avatar placeholders → `--track`.
  - Teal solids → `--teal-fill`, and their `:hover` / `:active` → `--teal-press`.
  - Teal tints (`#f0fdfa`, `#ccfbf1`, `#ecfdf5`, `#e7f6f2`, `#effaf6`, `#d8f5f0`, `rgba(20,184,166,…)`, `rgba(13,148,136,…)`, `rgba(94,234,212,…)`) → `--teal-tint`.
  - Red, green and amber tints (`#fef2f2`, `#fee2e2`, `#fff5f5` / `#f0fdf4`, `#dcfce7` / `#fef3c7`, `#fffbeb`) → `--danger-tint` / `--success-tint` / `--warning-tint`.
  - Full-screen overlays (`rgba(0,0,0,…)`, `rgba(8,12,24,…)`, `rgba(15,23,42,…)`) → `--scrim`.
  - Gradients flatten to the token of their dominant stop. Two exceptions: the desk falloff `linear-gradient(var(--desk-hi), var(--desk))`, and loading shimmers, which use `--rule` and `--track` stops.
- **Borders and outlines:**
  - Light grays (`#e2e8f0`, `#e5e7eb`, `#eef0f4`, `#e9ecef`, `#dce0e8`, `#dce4ee`, `#ddd`, `#ccc`, `#eee`, `#d6d6d6`, `#e0e0e0`, `#e0e6ed`, `rgba(28,37,48,.08–.2)`, and white or teal alphas on formerly dark surfaces) → `--rule` for dividers, `--rule-2` for card and control edges.
  - Input, textarea, select and drop-zone borders (`#cbd5e1`, `rgba(28,37,48,.5)`, `#ddd` on inputs) → `--rule-input`.
  - Teal borders on outline buttons and chips → `--teal-edge`; on hover, selected, active or focus → `--teal`.
  - Status borders take the matching status token.
  - `outline: 2px solid <teal>` → `outline: 2px solid var(--focus)`.
- **Shadows:**
  - Cards, buttons, inputs and list items → `--sh-raised`.
  - Popovers, menus, tooltips, toasts, modals and the pager pill → `--sh-float`.
  - Page images and other large paper objects → `--sh-sheet`.
  - Focus rings drawn with `box-shadow` → remove them, and rely on the global `:focus-visible` outline. Inputs use `border-color: var(--teal)` plus `box-shadow: 0 0 0 3px var(--teal-tint)`.
  - Glows and `text-shadow` → `none`.
- **Fonts:**
  - `'DM Serif Display'` → `var(--serif)`.
  - `'DM Sans'`, `'Inter'`, `'Outfit'` and system stacks → `var(--sans)`.
  - `'DM Mono'` and monospace stacks → `var(--mono)`.
  - `'Caveat'` → `var(--serif)` plus `font-style: italic` (spec D9).
- **Other properties:**
  - `accent-color` and `caret-color` → `var(--teal)`.
  - `scrollbar-color` → `var(--rule-2) transparent`.
  - `::-webkit-scrollbar-thumb` → `var(--rule-2)`.
- **Translucent washes:** use `color-mix(in srgb, var(--token) N%, transparent)`.

## Review Focus

Each line names a condition the spec implies but no feature test would naturally hit, with the behavior a person expects. Each has a test in the task named.

1. **Saved legacy Dark/Black during PR1.** The user sees Paper, not a half-dark page, and storage still says `dark`, so PR2 can upgrade them to Night. Task 2: `profileSettings.test.ts`, "legacy dark maps to paper until Night ships and storage is untouched".
2. **Corrupt or odd storage.** Values like `{bad`, `[]`, `null`, `"x"` or `{"pageBackground":"__proto__"}` give Paper and never throw. The pre-paint script and `readTheme()` agree on every input. Task 2: `indexHtmlThemeScript.test.ts`, the parity table.
3. **Re-renders loop through the bridge.** The bridge object is recreated on every provider render. Publishing an equal current section must not re-render consumers, or Learning Mode loops. Task 3: `SessionBridge.test.tsx`, "an equal section is a no-op".
4. **The current section's title differs in case or spacing, or a chapter shares its start page.** The ribbon still finds the section, and never marks the chapter. Task 3: `currentSection.test.ts`.
5. **Collapsed rail or a ≤760px window.** The new sign-in prompt line is hidden, as every other label is in the 72px rail. Task 4: `sidebarCss.test.ts`.

---

### Task 1: Tokens, fonts and the guard tests

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/tokens.test.ts`
- Create: `frontend/src/styles/noHardcodedColors.test.ts`
- Modify: `frontend/src/main.tsx` (first import)
- Modify: `frontend/index.html` (font link)

**Interfaces:**
- Produces:
  - every token named in spec §4.2–4.3, available globally;
  - `[data-theme="paper" | "bright" | "night"]` blocks that pin a variant on any element;
  - the `PENDING` set in `noHardcodedColors.test.ts`, which later tasks shrink.

- [ ] **Step 1: Write the failing contrast test**

Create `frontend/src/styles/tokens.test.ts`:

```ts
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
  bright: block(/^\[data-theme="bright"\]$/),
  night: block(/^\[data-theme="night"\]$/),
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/styles/tokens.test.ts`
Expected: FAIL. The suite fails to load with `ENOENT: no such file or directory` for `tokens.css`.

- [ ] **Step 3: Write `tokens.css`**

Create `frontend/src/styles/tokens.css`:

```css
/* Paper & Ink design tokens: the only file allowed to define colors.
   Spec: docs/superpowers/specs/2026-10-01-paper-ink-theme-design.md §4.
   Shared scales sit on :root. Each [data-theme] block is complete, so any element can pin
   a variant (the Appearance previews do). Night is defined here but enabled only in PR2. */

:root {
  --serif: "Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --math: "STIX Two Math", "Cambria Math", "Latin Modern Math", serif;

  --fs-xs: 11px;
  --fs-sm: 12px;
  --fs-ui: 13px;
  --fs-base: 14px;
  --fs-read: 16px;
  --fs-lead: 18px;
  --fs-title: 26px;
  --fs-display: 40px;
  --fs-hero: 64px;

  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 20px;
  --s6: 24px;
  --s8: 32px;
  --s10: 40px;
  --s12: 48px;
  --s16: 64px;

  --r-paper: 2px;
  --r1: 6px;
  --r2: 10px;
  --r3: 16px;
  --pill: 999px;
}

/* Paper: the default look, mockup A's values. */
:root,
[data-theme="paper"] {
  --desk: #e9e3d7;
  --desk-hi: #efeae0;
  --parch: #f4efe6;
  --paper: #faf7f1;
  --sheet: #fffdf8;
  --track: #ebe4d7;
  --rule: #e3dbcc;
  --rule-2: #d9cfbe;
  --rule-input: #918777;
  --ink: #1e1a15;
  --ink-body: #2a251e;
  --ink-2: #4a4338;
  --ink-3: #6a6154;
  --ink-4: #8a8070;
  --teal: #0f5e57;
  --teal-fill: #0f5e57;
  --on-teal: #fffdf8;
  --teal-press: #0b4a45;
  --teal-line: #1a7268;
  --teal-edge: #5f948b;
  --teal-tint: #e5ebe5;
  --ribbon: #b4432b;
  --ribbon-fold: #8c3220;
  --danger: #a3283a;
  --danger-tint: #f7e4e4;
  --success: #2e6b3c;
  --success-tint: #e4efe2;
  --warning: #7f5208;
  --warning-tint: #f5ead2;
  --focus: var(--teal);
  --scrim: rgba(30, 26, 21, 0.45);
  --selection: var(--teal-tint);
  --page-image-filter: none;
  --sh-raised: 0 0 0 1px rgba(74, 56, 26, 0.08), 0 1px 2px rgba(74, 56, 26, 0.08);
  --sh-float: 0 0 0 1px rgba(74, 56, 26, 0.09), 0 2px 4px rgba(74, 56, 26, 0.06),
    0 14px 32px -10px rgba(74, 56, 26, 0.3);
  --sh-sheet: 0 0 0 1px rgba(74, 56, 26, 0.07), 0 1px 1px rgba(74, 56, 26, 0.06),
    0 4px 8px -2px rgba(74, 56, 26, 0.08), 0 16px 32px -12px rgba(74, 56, 26, 0.18),
    0 40px 80px -32px rgba(74, 56, 26, 0.3);
}

/* Bright: whiter, less warm surfaces; the same ink and teal. */
[data-theme="bright"] {
  --desk: #ecebe8;
  --desk-hi: #f1f0ed;
  --parch: #f6f5f2;
  --paper: #fcfbfa;
  --sheet: #ffffff;
  --track: #ecebe7;
  --rule: #e5e3de;
  --rule-2: #d9d6cf;
  --rule-input: #8c887f;
  --ink: #1e1a15;
  --ink-body: #2a251e;
  --ink-2: #4a4338;
  --ink-3: #68625a;
  --ink-4: #8a8479;
  --teal: #0f5e57;
  --teal-fill: #0f5e57;
  --on-teal: #ffffff;
  --teal-press: #0b4a45;
  --teal-line: #1a7268;
  --teal-edge: #5f948b;
  --teal-tint: #e6efec;
  --ribbon: #b4432b;
  --ribbon-fold: #8c3220;
  --danger: #a3283a;
  --danger-tint: #f8e6e7;
  --success: #2e6b3c;
  --success-tint: #e5f0e6;
  --warning: #7f5208;
  --warning-tint: #f6edd8;
  --focus: var(--teal);
  --scrim: rgba(30, 26, 21, 0.4);
  --selection: var(--teal-tint);
  --page-image-filter: none;
  --sh-raised: 0 0 0 1px rgba(40, 36, 30, 0.072), 0 1px 2px rgba(40, 36, 30, 0.072);
  --sh-float: 0 0 0 1px rgba(40, 36, 30, 0.081), 0 2px 4px rgba(40, 36, 30, 0.054),
    0 14px 32px -10px rgba(40, 36, 30, 0.27);
  --sh-sheet: 0 0 0 1px rgba(40, 36, 30, 0.063), 0 1px 1px rgba(40, 36, 30, 0.054),
    0 4px 8px -2px rgba(40, 36, 30, 0.072), 0 16px 32px -12px rgba(40, 36, 30, 0.162),
    0 40px 80px -32px rgba(40, 36, 30, 0.27);
}

/* Night: a real dark theme. Defined now, switched on in PR2 (NIGHT_AVAILABLE). */
[data-theme="night"] {
  --desk: #141210;
  --desk-hi: #191713;
  --parch: #1c1916;
  --paper: #201d19;
  --sheet: #2a2621;
  --track: #171512;
  --rule: #2e2a24;
  --rule-2: #3a352e;
  --rule-input: #857b6d;
  --ink: #efe9de;
  --ink-body: #e4ddd0;
  --ink-2: #c4bbab;
  --ink-3: #a69d8e;
  --ink-4: #7e7568;
  --teal: #6bbcae;
  --teal-fill: #21766b;
  --on-teal: #f6f2ea;
  --teal-press: #1c665d;
  --teal-line: #4fa596;
  --teal-edge: #4f9488;
  --teal-tint: #1d2f2b;
  --ribbon: #d9694f;
  --ribbon-fold: #a84a35;
  --danger: #f0909b;
  --danger-tint: #3a2125;
  --success: #86c595;
  --success-tint: #1e3324;
  --warning: #e2b763;
  --warning-tint: #382d16;
  --focus: var(--teal);
  --scrim: rgba(0, 0, 0, 0.6);
  --selection: #2c4741;
  --page-image-filter: brightness(0.86) sepia(0.06);
  --sh-raised: 0 0 0 1px rgba(0, 0, 0, 0.32), 0 1px 2px rgba(0, 0, 0, 0.32);
  --sh-float: 0 0 0 1px rgba(0, 0, 0, 0.36), 0 2px 4px rgba(0, 0, 0, 0.24),
    0 14px 32px -10px rgba(0, 0, 0, 0.6);
  --sh-sheet: 0 0 0 1px rgba(0, 0, 0, 0.28), 0 1px 1px rgba(0, 0, 0, 0.24),
    0 4px 8px -2px rgba(0, 0, 0, 0.32), 0 16px 32px -12px rgba(0, 0, 0, 0.6),
    0 40px 80px -32px rgba(0, 0, 0, 0.6);
}
```

- [ ] **Step 4: Run the contrast test**

Run: `npx vitest run src/styles/tokens.test.ts`
Expected: PASS, 164 tests: 54 pairs × 3 variants, plus 2.

- [ ] **Step 5: Write the color guard**

Create `frontend/src/styles/noHardcodedColors.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the guard, then prove it bites**

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: PASS, 3 tests. All 17 PENDING files have literals, and no other file does.

Then temporarily delete the `"App.css",` line from `PENDING` and run the same command.
Expected: FAIL. "migrated files contain no color literals" lists `App.css: background: var(--app-page-bg, #e6eaf2) | …`.

Restore the line and run it again. Expected: PASS.

- [ ] **Step 7: Load the tokens first, and add the fonts**

In `frontend/src/main.tsx`, add this as the very first line, above `import { StrictMode } from "react";`:

```ts
import "./styles/tokens.css";
```

In `frontend/index.html`, add this right after the existing `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` line:

```html
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&display=swap" rel="stylesheet" />
```

- [ ] **Step 8: Full checks**

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc prints nothing. Vitest shows `Test Files  29 passed (29)` and `Tests  609 passed (609)`. Build prints the `dist/` asset lines and `✓ built in …`.

- [ ] **Step 9: Commit**

```bash
git add src/styles/tokens.css src/styles/tokens.test.ts src/styles/noHardcodedColors.test.ts src/main.tsx index.html
git commit -m "feat(theme): Paper & Ink tokens, fonts and color guards

tokens.css holds every color, font, size, space, radius and shadow, with
complete Paper, Bright and Night blocks. Two tests guard it: WCAG pairs
per variant, and no color literal outside tokens.css (17 files pending).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Appearance variants and the pre-paint script

**Files:**
- Modify (rewrite): `frontend/src/profile/profileSettings.ts`
- Create: `frontend/src/profile/profileSettings.test.ts`
- Modify (rewrite): `frontend/src/context/ProfileSettingsContext.tsx`
- Create: `frontend/src/profile/AppearancePicker.tsx`, `frontend/src/profile/AppearancePicker.css`, `frontend/src/profile/AppearancePicker.test.tsx`
- Modify: `frontend/src/UserProfile.tsx` (the Appearance card body)
- Modify: `frontend/src/i18n/messages.ts` (theme keys in EN, ZH and ES)
- Modify: `frontend/index.html` (inline script)
- Create: `frontend/src/indexHtmlThemeScript.test.ts`
- Modify: `frontend/src/App.css:9`, `frontend/src/Chat.css:26` (retire the old variables)
- Modify: `frontend/src/styles/noHardcodedColors.test.ts` (remove `"profile/profileSettings.ts"` from `PENDING`)

**Interfaces:**
- Consumes: the `[data-theme]` blocks from Task 1.
- Produces:
  - `ThemeId = "paper" | "bright" | "night"`;
  - `NIGHT_AVAILABLE: boolean` (false);
  - `STORAGE_KEY`;
  - `LEGACY_THEME_MAP: Record<string, ThemeId>`;
  - `THEME_OPTIONS: readonly ThemeId[]`;
  - `resolveTheme(stored: unknown): ThemeId`, `readTheme(): ThemeId`, `writeTheme(id): void`, `applyTheme(id): void`;
  - the context value `{ theme: ThemeId; setTheme(id: ThemeId): void }`;
  - the default export `AppearancePicker`.

- [ ] **Step 1: Write the failing settings test**

Create `frontend/src/profile/profileSettings.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  NIGHT_AVAILABLE,
  STORAGE_KEY,
  THEME_OPTIONS,
  applyTheme,
  readTheme,
  resolveTheme,
  writeTheme,
} from "./profileSettings";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("resolveTheme", () => {
  it.each([
    ["default", "paper"],
    ["warm", "paper"],
    ["mint", "paper"],
    ["white", "bright"],
  ])("maps the legacy %s preset to %s", (legacy, expected) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe(expected);
  });

  it.each(["dark", "black"])("maps legacy %s to night only once Night ships", (legacy) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe(NIGHT_AVAILABLE ? "night" : "paper");
  });

  it("lets a valid theme win over a legacy value", () => {
    expect(resolveTheme({ theme: "bright", pageBackground: "dark" })).toBe("bright");
  });

  it.each([null, undefined, "x", 42, [], {}, { theme: "neon" }, { pageBackground: "__proto__" }, { pageBackground: "toString" }])(
    "falls back to paper for %j",
    (stored) => {
      expect(resolveTheme(stored)).toBe("paper");
    },
  );
});

describe("storage", () => {
  it("legacy dark maps to paper until Night ships and storage is untouched", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageBackground: "dark" }));
    expect(readTheme()).toBe(NIGHT_AVAILABLE ? "night" : "paper");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"pageBackground":"dark"}');
  });

  it("reads corrupt JSON as paper", () => {
    localStorage.setItem(STORAGE_KEY, "{bad");
    expect(readTheme()).toBe("paper");
  });

  it("round-trips a written theme", () => {
    writeTheme("bright");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"theme":"bright"}');
    expect(readTheme()).toBe("bright");
  });
});

describe("applyTheme", () => {
  it("sets data-theme for Bright and removes it for Paper", () => {
    applyTheme("bright");
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright");
    applyTheme("paper");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

it("offers Night only once it ships", () => {
  expect(THEME_OPTIONS.includes("night")).toBe(NIGHT_AVAILABLE);
  expect(THEME_OPTIONS.slice(0, 2)).toEqual(["paper", "bright"]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/profile/profileSettings.test.ts`
Expected: FAIL with a SyntaxError or import error saying `NIGHT_AVAILABLE` (or `resolveTheme`) is not exported by `./profileSettings`.

- [ ] **Step 3: Rewrite `profileSettings.ts`**

Replace the whole of `frontend/src/profile/profileSettings.ts` with:

```ts
/** Appearance: which Paper & Ink variant the app uses (spec §4.4). Stored only in this browser. */
export type ThemeId = "paper" | "bright" | "night";

/** Night ships in PR2. While false, it is neither offered nor applied. Keep index.html in sync. */
export const NIGHT_AVAILABLE = false;

export const STORAGE_KEY = "ai_tutor_profile_settings";

/** The six pre-Paper-&-Ink presets and their nearest variant (spec D4). Keep index.html in sync. */
export const LEGACY_THEME_MAP: Readonly<Record<string, ThemeId>> = {
  default: "paper",
  warm: "paper",
  mint: "paper",
  white: "bright",
  dark: "night",
  black: "night",
};

export const THEME_OPTIONS: readonly ThemeId[] = NIGHT_AVAILABLE
  ? ["paper", "bright", "night"]
  : ["paper", "bright"];

function isThemeId(value: unknown): value is ThemeId {
  return value === "paper" || value === "bright" || value === "night";
}

/** The variant to show for a parsed storage value. The inline script in index.html mirrors this. */
export function resolveTheme(stored: unknown): ThemeId {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return "paper";
  const record = stored as Record<string, unknown>;
  let id: ThemeId | undefined = isThemeId(record.theme) ? record.theme : undefined;
  const legacy = record.pageBackground;
  if (!id && typeof legacy === "string" && Object.prototype.hasOwnProperty.call(LEGACY_THEME_MAP, legacy)) {
    id = LEGACY_THEME_MAP[legacy];
  }
  if (!id || (id === "night" && !NIGHT_AVAILABLE)) return "paper";
  return id;
}

export function readTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return resolveTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return "paper";
  }
}

export function writeTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: id }));
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  if (id === "paper") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
}
```

- [ ] **Step 4: Run the settings test**

Run: `npx vitest run src/profile/profileSettings.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Write the failing pre-paint script test**

Create `frontend/src/indexHtmlThemeScript.test.ts`:

```ts
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
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/indexHtmlThemeScript.test.ts`
Expected: FAIL. The first test sees `null` instead of the legacy table, and the parity cases throw `index.html has no theme script`.

- [ ] **Step 7: Add the inline script to `index.html`**

In `frontend/index.html`, insert this right after the `<meta name="viewport" … />` line:

```html
    <script>
      /* Apply the saved Appearance variant before first paint (spec §4.4).
         Mirrors resolveTheme() in src/profile/profileSettings.ts; indexHtmlThemeScript.test.ts keeps them in sync. */
      (function () {
        var NIGHT_AVAILABLE = false;
        var LEGACY = {"default":"paper","warm":"paper","mint":"paper","white":"bright","dark":"night","black":"night"};
        try {
          var raw = localStorage.getItem("ai_tutor_profile_settings");
          var o = raw ? JSON.parse(raw) : null;
          var id = null;
          if (o && typeof o === "object" && !Array.isArray(o)) {
            if (o.theme === "paper" || o.theme === "bright" || o.theme === "night") id = o.theme;
            else if (typeof o.pageBackground === "string" && Object.prototype.hasOwnProperty.call(LEGACY, o.pageBackground)) id = LEGACY[o.pageBackground];
          }
          if (id === "night" && !NIGHT_AVAILABLE) id = "paper";
          if (id === "bright" || id === "night") document.documentElement.setAttribute("data-theme", id);
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 8: Run the script test**

Run: `npx vitest run src/indexHtmlThemeScript.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 9: Rewrite the context**

Replace the whole of `frontend/src/context/ProfileSettingsContext.tsx` with:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyTheme, readTheme, writeTheme, type ThemeId } from "../profile/profileSettings";

type ProfileSettingsContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ProfileSettingsContext = createContext<ProfileSettingsContextValue | null>(null);

export function ProfileSettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    writeTheme(id);
    applyTheme(id);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ProfileSettingsContext.Provider value={value}>{children}</ProfileSettingsContext.Provider>;
}

export function useProfileSettings(): ProfileSettingsContextValue {
  const ctx = useContext(ProfileSettingsContext);
  if (!ctx) {
    throw new Error("useProfileSettings must be used within ProfileSettingsProvider");
  }
  return ctx;
}
```

- [ ] **Step 10: Write the failing picker test**

Create `frontend/src/profile/AppearancePicker.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MessageKey } from "../i18n/messages";

vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});

import AppearancePicker from "./AppearancePicker";
import { ProfileSettingsProvider } from "../context/ProfileSettingsContext";
import { STORAGE_KEY } from "./profileSettings";

function renderPicker() {
  return render(
    <ProfileSettingsProvider>
      <AppearancePicker />
    </ProfileSettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("AppearancePicker", () => {
  it("offers Paper and Bright as radios and checks the saved one", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "bright" }));
    renderPicker();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Paper", "Bright"]);
    expect(screen.getByRole("radio", { name: "Bright" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
  });

  it("applies and stores a choice", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Bright" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"theme":"bright"}');
    fireEvent.click(screen.getByRole("radio", { name: "Paper" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("pins each preview to its own variant", () => {
    const { container } = renderPicker();
    const previews = [...container.querySelectorAll(".theme-tile-preview")];
    expect(previews.map((p) => p.getAttribute("data-theme"))).toEqual(["paper", "bright"]);
  });
});
```

- [ ] **Step 11: Run it and watch it fail**

Run: `npx vitest run src/profile/AppearancePicker.test.tsx`
Expected: FAIL with `Failed to resolve import "./AppearancePicker"`.

- [ ] **Step 12: Add the copy**

In `frontend/src/i18n/messages.ts`, make these edits in each dictionary (`EN`, `ZH`, `ES`). Leave every other key alone.

- **Remove** the keys `theme.default`, `theme.mint`, `theme.dark`, `theme.warm`, `theme.white`, `theme.black` and `theme.titleSuffix`.
- **Add** two keys where `theme.default` was:

  | Key | EN | ZH | ES |
  |---|---|---|---|
  | `theme.paper` | `Paper` | `纸` | `Papel` |
  | `theme.bright` | `Bright` | `亮白` | `Claro` |

- **Change** two values:

  | Key | EN | ZH | ES |
  |---|---|---|---|
  | `profile.appearanceDesc` | `Choose how AI Tutor looks. Every option keeps text easy to read.` | `选择 AI Tutor 的外观。每个选项都保证文字清晰易读。` | `Elige el aspecto de AI Tutor. Todas las opciones mantienen el texto fácil de leer.` |
  | `profile.appearanceGroup` | `Theme` | `主题` | `Tema` |

- [ ] **Step 13: Write the picker**

Create `frontend/src/profile/AppearancePicker.tsx`:

```tsx
import type { MessageKey } from "../i18n/messages";
import { useLocale } from "../i18n/LocaleContext";
import { useProfileSettings } from "../context/ProfileSettingsContext";
import { THEME_OPTIONS } from "./profileSettings";
import "./AppearancePicker.css";

/** The Appearance card body: one preview tile per available Paper & Ink variant (spec §5.7). */
export default function AppearancePicker() {
  const { t } = useLocale();
  const { theme, setTheme } = useProfileSettings();
  return (
    <div className="profile-bg-grid" role="radiogroup" aria-label={t("profile.appearanceGroup")}>
      {THEME_OPTIONS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          className={`profile-bg-swatch theme-tile${theme === id ? " profile-bg-swatch--active" : ""}`}
          onClick={() => setTheme(id)}
        >
          <span className="theme-tile-preview" data-theme={id} aria-hidden>
            <span className="theme-tile-side" />
            <span className="theme-tile-page" />
            <span className="theme-tile-chat">
              <span className="theme-tile-line" />
              <span className="theme-tile-dot" />
            </span>
          </span>
          <span className="profile-bg-swatch-label">{t(`theme.${id}` as MessageKey)}</span>
        </button>
      ))}
    </div>
  );
}
```

Create `frontend/src/profile/AppearancePicker.css`:

```css
/* Appearance tiles. Each preview pins its own variant through data-theme, so it needs no colors of its own. */
.theme-tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--s2);
}
.theme-tile-preview {
  display: grid;
  grid-template-columns: 28% 1fr 34%;
  height: 64px;
  border-radius: var(--r1);
  overflow: hidden;
  background: var(--desk);
  box-shadow: var(--sh-raised);
}
.theme-tile-side {
  background: var(--parch);
  border-right: 1px solid var(--rule);
}
.theme-tile-page {
  margin: 10px 8px;
  background: var(--sheet);
  border-radius: var(--r-paper);
  box-shadow: var(--sh-raised);
}
.theme-tile-chat {
  position: relative;
  background: var(--paper);
  border-left: 1px solid var(--rule);
}
.theme-tile-line {
  position: absolute;
  left: 6px;
  right: 6px;
  top: 12px;
  height: 4px;
  border-left: 2px solid var(--teal-line);
  background: var(--rule-2);
}
.theme-tile-dot {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--teal-fill);
}
```

- [ ] **Step 14: Use the picker in the profile page**

In `frontend/src/UserProfile.tsx`:

- Replace the whole `<div className="profile-bg-grid" role="radiogroup" …>…</div>` element inside the Appearance `<section>` with:

  ```tsx
  <AppearancePicker />
  ```

  Keep the section, its `<h2>` and its description `<p>`.
- Add `import AppearancePicker from "./profile/AppearancePicker";` to the imports.
- Delete `import { PAGE_BACKGROUND_OPTIONS, type PageBackgroundId } from "./profile/profileSettings";`.
- Delete the `useProfileSettings` import and the `const { pageBackground, setPageBackground } = useProfileSettings();` line. Only the Appearance card used them; `tsc` will name any leftover.
- Delete `import type { MessageKey } from "./i18n/messages";` if no other use remains.

- [ ] **Step 15: Retire the old background variables**

- In `frontend/src/App.css`, line 9: replace `background: var(--app-page-bg, #e6eaf2);` with `background: var(--desk);`, and delete the comment on line 8.
- In `frontend/src/Chat.css`, line 26: replace `background: var(--app-chat-panel-bg, #f7f3ea); /* ivory Report Card canvas */` with `background: var(--paper);`.

- [ ] **Step 16: Shrink PENDING**

In `frontend/src/styles/noHardcodedColors.test.ts`, delete the `"profile/profileSettings.ts",` line from `PENDING`.

- [ ] **Step 17: Run the new tests, then everything**

Run: `npx vitest run src/profile src/indexHtmlThemeScript.test.ts src/styles`
Expected: PASS. That covers `AppearancePicker` (3), `profileSettings` (21), the script (13), tokens (164) and the guard (3).

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  32 passed (32)`, and the build ends with `✓ built in …`.

- [ ] **Step 18: Commit**

```bash
git add index.html src/profile src/context/ProfileSettingsContext.tsx src/UserProfile.tsx src/i18n/messages.ts src/indexHtmlThemeScript.test.ts src/App.css src/Chat.css src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): Paper and Bright appearance variants

The six page-color presets become Paper & Ink variants on <html data-theme>.
Old choices map on read (default/warm/mint to paper, white to bright,
dark/black to night once it ships) without rewriting storage. An inline
script applies the saved variant before first paint, and a test keeps it
identical to resolveTheme().

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The current-section marker (spec D10)

**Files:**
- Create: `frontend/src/utils/currentSection.ts`, `frontend/src/utils/currentSection.test.ts`
- Modify: `frontend/src/context/SessionBridge.tsx`
- Create: `frontend/src/context/SessionBridge.test.tsx`
- Modify: `frontend/src/LearningModel.tsx` (publish effect)
- Modify: `frontend/src/components/Sidebar.tsx` (pass the section to the outline)
- Create: `frontend/src/components/Sidebar.test.tsx`
- Modify: `frontend/src/LearningBarPanel.tsx` (prop, matching, named export of `FocsTreeBranch`)
- Create: `frontend/src/LearningBarPanel.test.tsx`

**Interfaces:**
- Produces:
  - `type CurrentSection = { bookId: string; title: string; startBook: number; endBook: number }`;
  - `normalizeSectionTitle(title: string): string`;
  - `sameSection(a: CurrentSection | null, b: CurrentSection | null): boolean`;
  - `type OutlineNodeRef = { title: string; range: { start: number; end: number } | null; hasKids: boolean }`;
  - `isCurrentSection(node: OutlineNodeRef, current: CurrentSection | null | undefined, selectedBookId: string): boolean`;
  - bridge fields `currentSection: CurrentSection | null` and `publishSection(s: CurrentSection | null): void`;
  - the `LearningBarPanel` prop `currentSection?: CurrentSection | null`;
  - the row class `focs-node__row--current` plus `aria-current="true"` on its title button (Task 4 styles it).

- [ ] **Step 1: Write the failing matcher test**

Create `frontend/src/utils/currentSection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isCurrentSection, normalizeSectionTitle, sameSection, type CurrentSection } from "./currentSection";

const s24: CurrentSection = {
  bookId: "lathi",
  title: "2.4 System Response to External Input: The Zero-State Response",
  startBook: 168,
  endBook: 195,
};
const leaf = (title: string, start: number, end: number) => ({ title, range: { start, end }, hasKids: false });

describe("isCurrentSection", () => {
  it("matches the same title in the same book", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), s24, "lathi")).toBe(true);
  });

  it("ignores case and whitespace in titles", () => {
    expect(
      isCurrentSection(leaf("2.4  system response to external input:\nthe zero-state response", 1, 2), s24, "lathi"),
    ).toBe(true);
  });

  it("matches a leaf by its page range when the titles differ", () => {
    expect(isCurrentSection(leaf("2.4 Zero-state response", 168, 195), s24, "lathi")).toBe(true);
  });

  it("never matches a chapter only because it shares the pages", () => {
    const chapter = { title: "2 Time-Domain Analysis", range: { start: 168, end: 195 }, hasKids: true };
    expect(isCurrentSection(chapter, s24, "lathi")).toBe(false);
  });

  it("needs the whole range, not just the start page", () => {
    expect(isCurrentSection(leaf("2.4 Other", 168, 170), s24, "lathi")).toBe(false);
  });

  it("never matches another book's outline", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), s24, "focs")).toBe(false);
  });

  it("matches nothing when no section is shown", () => {
    expect(isCurrentSection(leaf(s24.title, 168, 195), null, "lathi")).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes titles", () => {
    expect(normalizeSectionTitle("  1.1  Modeling\tEpidemics ")).toBe("1.1 modeling epidemics");
  });

  it("compares sections by value", () => {
    expect(sameSection(s24, { ...s24 })).toBe(true);
    expect(sameSection(s24, { ...s24, endBook: 196 })).toBe(false);
    expect(sameSection(null, null)).toBe(true);
    expect(sameSection(s24, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/currentSection.test.ts`
Expected: FAIL with `Failed to resolve import "./currentSection"`.

- [ ] **Step 3: Write the matcher**

Create `frontend/src/utils/currentSection.ts`:

```ts
/** The section the textbook panel shows, as published to the sidebar outline (spec D10, §5.2). */
export type CurrentSection = {
  bookId: string;
  title: string;
  startBook: number;
  endBook: number;
};

export type OutlineNodeRef = {
  title: string;
  range: { start: number; end: number } | null;
  hasKids: boolean;
};

export function normalizeSectionTitle(title: string): string {
  return title.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sameSection(a: CurrentSection | null, b: CurrentSection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.bookId === b.bookId && a.title === b.title && a.startBook === b.startBook && a.endBook === b.endBook;
}

/** Same book, and the same title or (for a leaf) the same page range. A chapter never matches on range alone. */
export function isCurrentSection(
  node: OutlineNodeRef,
  current: CurrentSection | null | undefined,
  selectedBookId: string,
): boolean {
  if (!current || current.bookId !== selectedBookId) return false;
  if (normalizeSectionTitle(node.title) === normalizeSectionTitle(current.title)) return true;
  return (
    !node.hasKids &&
    node.range !== null &&
    node.range.start === current.startBook &&
    node.range.end === current.endBook
  );
}
```

- [ ] **Step 4: Run the matcher test**

Run: `npx vitest run src/utils/currentSection.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write the failing bridge test**

Create `frontend/src/context/SessionBridge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { SessionBridgeProvider, useSessionBridge } from "./SessionBridge";
import type { CurrentSection } from "../utils/currentSection";

const s24: CurrentSection = { bookId: "lathi", title: "2.4 Zero-State", startBook: 168, endBook: 195 };

function setup() {
  const seen: { renders: number; bridge: ReturnType<typeof useSessionBridge> | null } = { renders: 0, bridge: null };
  function Probe() {
    seen.bridge = useSessionBridge();
    seen.renders += 1;
    return null;
  }
  render(
    <SessionBridgeProvider>
      <Probe />
    </SessionBridgeProvider>,
  );
  return seen;
}

afterEach(cleanup);

describe("SessionBridge current section", () => {
  it("publishes and clears the section", () => {
    const seen = setup();
    expect(seen.bridge?.currentSection).toBeNull();
    act(() => seen.bridge?.publishSection(s24));
    expect(seen.bridge?.currentSection).toEqual(s24);
    act(() => seen.bridge?.publishSection(null));
    expect(seen.bridge?.currentSection).toBeNull();
  });

  it("an equal section is a no-op", () => {
    const seen = setup();
    act(() => seen.bridge?.publishSection(s24));
    const renders = seen.renders;
    act(() => seen.bridge?.publishSection({ ...s24 }));
    expect(seen.renders).toBe(renders);
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/context/SessionBridge.test.tsx`
Expected: FAIL. `seen.bridge?.publishSection is not a function`, and the first assertion receives `undefined` instead of `null`.

- [ ] **Step 7: Add the section to the bridge**

In `frontend/src/context/SessionBridge.tsx`:

- Add these imports below the existing type import:

  ```ts
  import { sameSection, type CurrentSection } from "../utils/currentSection";
  ```

- Add two members to `interface Bridge`, after `previewSection`:

  ```ts
    /** The section the textbook panel shows, for the sidebar's ribbon (spec D10). */
    currentSection: CurrentSection | null;
    publishSection: (s: CurrentSection | null) => void;
  ```

- Inside `SessionBridgeProvider`, after `const pendingRef = useRef<Pending>(null);`, add:

  ```ts
    const [currentSection, setCurrentSection] = useState<CurrentSection | null>(null);
    // An equal value keeps the old object, so consumers don't re-render (the value object is rebuilt each render).
    const publishSection = useCallback((s: CurrentSection | null) => {
      setCurrentSection((prev) => (sameSection(prev, s) ? prev : s));
    }, []);
  ```

- Change the provider's `value={{ … }}` to end with `…, takePending, currentSection, publishSection }}`.

- [ ] **Step 8: Run the bridge test**

Run: `npx vitest run src/context/SessionBridge.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 9: Publish from Learning Mode**

In `frontend/src/LearningModel.tsx`, immediately after the `useState` block that declares `dataMatchedTopic` (it ends `} | null>(null);` near line 178), add:

```ts
  // Tell the sidebar outline which section is on screen (spec D10). Depend on the stable
  // publishSection, never on `bridge`, whose identity changes every provider render.
  const { publishSection } = bridge;
  useEffect(() => {
    publishSection(
      dataMatchedTopic
        ? {
            bookId: dataMatchedTopic.bookId,
            title: dataMatchedTopic.name,
            startBook: dataMatchedTopic.startBook,
            endBook: dataMatchedTopic.endBook,
          }
        : null,
    );
  }, [dataMatchedTopic, publishSection]);
  useEffect(() => () => publishSection(null), [publishSection]);
```

`bridge` is already declared at line 132 (`const bridge = useSessionBridge();`), and `useEffect` is already imported.

- [ ] **Step 10: Write the failing outline test**

Create `frontend/src/LearningBarPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MessageKey } from "./i18n/messages";
import type { CurrentSection } from "./utils/currentSection";

vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ token: null, user: null, loading: false }) }));
vi.mock("./i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("./i18n/messages")>("./i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});

import { FocsTreeBranch } from "./LearningBarPanel";

const CHAPTER = "2 Time-Domain Analysis of Continuous-Time Systems";
const S23 = "2.3 The Unit Impulse Response h(t)";
const S24 = "2.4 System Response to External Input: The Zero-State Response";
const node = {
  _range: { start: 150, end: 236 },
  [S23]: { start: 163, end: 167 },
  [S24]: { start: 168, end: 195 },
};

function renderChapter(currentSection: CurrentSection | null) {
  return render(
    <MemoryRouter>
      <ul>
        <FocsTreeBranch
          title={CHAPTER}
          node={node}
          learnedSet={new Set()}
          onToggleToken={() => {}}
          expanded={{}}
          onToggleExpand={() => {}}
          path={CHAPTER}
          onOpenPages={() => {}}
          currentSection={currentSection}
          selectedBookId="lathi"
        />
      </ul>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("outline current section", () => {
  it("marks only the section on screen", () => {
    const { container } = renderChapter({ bookId: "lathi", title: S24, startBook: 168, endBook: 195 });
    const current = container.querySelectorAll(".focs-node__row--current");
    expect(current).toHaveLength(1);
    expect(screen.getByRole("button", { name: new RegExp(S24.slice(0, 20)) })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: new RegExp(S23.slice(0, 20)) })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing when no section is shown", () => {
    const { container } = renderChapter(null);
    expect(container.querySelectorAll(".focs-node__row--current")).toHaveLength(0);
  });
});
```

- [ ] **Step 11: Run it and watch it fail**

Run: `npx vitest run src/LearningBarPanel.test.tsx`
Expected: FAIL. `FocsTreeBranch` is not exported, so the element type is invalid (`Element type is invalid … got: undefined`).

- [ ] **Step 12: Mark the current row in the outline**

In `frontend/src/LearningBarPanel.tsx`:

1. **Imports.** Add `import { isCurrentSection, type CurrentSection } from "./utils/currentSection";`.
2. **Export.** Change `function FocsTreeBranch({` to `export function FocsTreeBranch({`.
3. **Props.** Add `currentSection` and `selectedBookId` to its destructured props (after `onOpenPages,`) and to its prop type (after `onOpenPages?: …;`):

   ```ts
     currentSection: CurrentSection | null;
     selectedBookId: string;
   ```

4. **Matching.** After `const splitLearnAndTitle = Boolean(onOpenPages);`, add:

   ```ts
     const isCurrent = isCurrentSection({ title, range: bookRange, hasKids }, currentSection, selectedBookId);
   ```

5. **Row class.** Change the row element `<div className="focs-node__row focs-node__row--toggle">` to:

   ```tsx
         <div className={`focs-node__row focs-node__row--toggle${isCurrent ? " focs-node__row--current" : ""}`}>
   ```

6. **Title button.** Add `aria-current={isCurrent ? "true" : undefined}` to the title `<button>`, the one with `className={\`focs-node__label …\`}`.
7. **Recursion.** In the recursive `<FocsTreeBranch …>` inside `focs-node__children`, add:

   ```tsx
                 currentSection={currentSection}
                 selectedBookId={selectedBookId}
   ```

8. **Panel prop.** In `LearningBarPanelProps`, add:

   ```ts
     /** Learning Mode: the section the textbook panel shows, marked with the ribbon (spec D10). */
     currentSection?: CurrentSection | null;
   ```

   Destructure `currentSection` in `export default function LearningBarPanel({ … })`.
9. **Root branches.** In the root `<FocsTreeBranch …>` (near line 641), add:

   ```tsx
                 currentSection={currentSection ?? null}
                 selectedBookId={selectedTextbookId}
   ```

- [ ] **Step 13: Run the outline test**

Run: `npx vitest run src/LearningBarPanel.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 14: Write the failing sidebar wiring test**

Create `frontend/src/components/Sidebar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MessageKey } from "../i18n/messages";
import type { CurrentSection } from "../utils/currentSection";

const state = vi.hoisted(() => ({
  user: null as null | { displayName: string; email: string; photoURL: null; isAnonymous: boolean },
  currentSection: null as CurrentSection | null,
  outlineProps: [] as Record<string, unknown>[],
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: state.user, loading: false, logout: vi.fn(), setShowSignIn: vi.fn() }),
}));
vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});
vi.mock("../feedback/FeedbackContext", () => ({ useFeedback: () => ({ openFeedback: vi.fn() }) }));
vi.mock("../context/SessionBridge", () => ({
  useSessionBridge: () => ({
    activeSessionId: null,
    refreshTrigger: 0,
    previewSection: vi.fn(),
    select: vi.fn(),
    newChat: vi.fn(),
    currentSection: state.currentSection,
  }),
}));
vi.mock("../context/OnboardingContext", () => ({ useOnboarding: () => ({ startOnboarding: vi.fn() }) }));
vi.mock("./SidebarHistory", () => ({ default: () => null }));
vi.mock("../LearningBarPanel", () => ({
  default: (props: Record<string, unknown>) => {
    state.outlineProps.push(props);
    return null;
  },
}));

import Sidebar from "./Sidebar";

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/learning"]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.user = null;
  state.currentSection = null;
  state.outlineProps = [];
});

describe("Sidebar", () => {
  it("passes the bridge's current section to the outline", () => {
    state.currentSection = { bookId: "focs", title: "1.1 Modeling Epidemics", startBook: 7, endBook: 7 };
    renderSidebar();
    expect(state.outlineProps[state.outlineProps.length - 1]?.currentSection).toEqual(state.currentSection);
  });
});
```

Task 4 adds more tests to this file and reuses `renderSidebar()`.

- [ ] **Step 15: Run it and watch it fail**

Run: `npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL with `expected undefined to deeply equal { bookId: 'focs', … }`.

- [ ] **Step 16: Pass the section from the sidebar**

In `frontend/src/components/Sidebar.tsx`, change line 345 to:

```tsx
              <LearningBarPanel
                variant="embed"
                studentId={studentId}
                onOutlineSectionPreview={previewSection}
                currentSection={bridge.currentSection}
              />
```

- [ ] **Step 17: Run the task's tests, then everything**

Run: `npx vitest run src/utils/currentSection.test.ts src/context/SessionBridge.test.tsx src/LearningBarPanel.test.tsx src/components/Sidebar.test.tsx`
Expected: PASS, 14 tests.

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  36 passed (36)`, and the build succeeds.

- [ ] **Step 18: Commit**

```bash
git add src/utils/currentSection.ts src/utils/currentSection.test.ts src/context/SessionBridge.tsx src/context/SessionBridge.test.tsx src/LearningModel.tsx src/LearningBarPanel.tsx src/LearningBarPanel.test.tsx src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "feat(theme): tell the sidebar outline which section is on screen

LearningModel publishes the textbook panel's section through SessionBridge.
The outline marks the matching row (same book, same title, or a leaf with
the same pages) with focs-node__row--current and aria-current. Publishing
an equal value is a no-op, so the bridge cannot loop.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Global styles, the sidebar, the outline and the banner

**Files:**
- Modify: `frontend/src/App.tsx` (**LAYOUT CHANGE:** remove the banner)
- Modify (rewrite): `frontend/src/App.css`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Sidebar.tsx` (**LAYOUT CHANGE:** sign-in prompt line)
- Modify (rewrite): `frontend/src/components/Sidebar.css`
- Modify (rewrite): `frontend/src/MyLearningBar.css`
- Modify: `frontend/src/i18n/messages.ts` (`sidebar.signInPrompt`)
- Create: `frontend/src/components/sidebarCss.test.ts`
- Modify: `frontend/src/components/Sidebar.test.tsx`, `frontend/src/styles/noHardcodedColors.test.ts`

**Interfaces:**
- Consumes:
  - the tokens;
  - `renderSidebar()` and the hoisted `state` from Task 3's `Sidebar.test.tsx`;
  - the classes `focs-node__row--current` and `aria-current` from Task 3.
- Produces:
  - the global `:focus-visible`, `::selection` and scrollbar rules;
  - the `.sb-signin-prompt` class;
  - the i18n key `sidebar.signInPrompt`.

- [ ] **Step 1: Write the failing prompt tests**

Append these tests inside the existing `describe("Sidebar", …)` block in `frontend/src/components/Sidebar.test.tsx`, and add `screen` to the Testing Library import:

```tsx
  it("shows the sign-in prompt above Sign in when signed out", () => {
    renderSidebar();
    const prompt = screen.getByText("Sign in to save chats & track progress");
    expect(prompt).toHaveClass("sb-signin-prompt");
    expect(prompt.nextElementSibling).toHaveClass("sb-signin");
  });

  it("hides the prompt when signed in", () => {
    state.user = { displayName: "Student", email: "s@example.com", photoURL: null, isAnonymous: false };
    renderSidebar();
    expect(screen.queryByText("Sign in to save chats & track progress")).toBeNull();
  });
```

Create `frontend/src/components/sidebarCss.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/Sidebar.test.tsx src/components/sidebarCss.test.ts`
Expected: FAIL.
- The two prompt tests fail with `Unable to find an element with the text: Sign in to save chats & track progress`.
- All four CSS tests fail, because the prompt rules, the App banner removal and the focus rule don't exist yet.

- [ ] **Step 3: Remove the banner from `App.tsx`**

In `frontend/src/App.tsx`:

- Delete the whole `{!isHome && !loading && !user && !bannerDismissed && ( <div className="auth-prompt"> … </div> )}` block.
- Delete the line `const [bannerDismissed, setBannerDismissed] = useState(false);`.
- Remove `useState` from `import { useState } from "react";`. Delete the line if nothing else is imported from `"react"`.
- From `const { user, loading, setShowSignIn } = useAuth();`, drop any names that are now unused. `tsc` (with `noUnusedLocals`) names them; if `useAuth()` is left with nothing used, delete the whole line and its import.

- [ ] **Step 4: Add the prompt line to the sidebar**

In `frontend/src/components/Sidebar.tsx`, replace the signed-out branch of the footer:

```tsx
        ) : (
          <button className="sb-signin" onClick={() => setShowSignIn(true)}>
            <span className="sb-link-ic">{I.profile}</span>
            <span className="sb-link-label">{t("sidebar.signIn")}</span>
          </button>
        )}
```

with:

```tsx
        ) : (
          <>
            {/* LAYOUT CHANGE (spec §5.2): the old top banner's message lives here now. */}
            <p className="sb-signin-prompt">{t("sidebar.signInPrompt")}</p>
            <button className="sb-signin" onClick={() => setShowSignIn(true)}>
              <span className="sb-link-ic">{I.profile}</span>
              <span className="sb-link-label">{t("sidebar.signIn")}</span>
            </button>
          </>
        )}
```

In `frontend/src/i18n/messages.ts`, add `sidebar.signInPrompt` right after `sidebar.signIn` in each dictionary:

| Dictionary | Value |
|---|---|
| EN | `Sign in to save chats & track progress` |
| ZH | `登录后可保存对话、同步学习进度` |
| ES | `Inicia sesión para guardar tus chats y tu progreso` |

- [ ] **Step 5: Rewrite `Sidebar.css`**

Replace the whole of `frontend/src/components/Sidebar.css` with the following. Structure is unchanged line for line; only paint changes, the dead `sb-unit` / `sb-unit-name` / `sb-topic*` / `sb-dot` rules are gone, and the prompt rules are new.

```css
/* Global left sidebar: Paper & Ink parchment, collapsible. Scoped under .sb */
.sb {
  --sb-w: 336px;
  --sb-w-collapsed: 72px;
  --sb-history-h: min(200px, 26vh);
  width: var(--sb-w);
  flex: 0 0 var(--sb-w);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--parch);
  border-right: 1px solid var(--rule);
  color: var(--ink-2);
  font-family: var(--sans);
  transition: width 0.24s cubic-bezier(0.2, 0, 0, 1), flex-basis 0.24s cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}
.sb--collapsed { width: var(--sb-w-collapsed); flex-basis: var(--sb-w-collapsed); }

/* top: toggle + brand */
.sb-top { display: flex; align-items: center; gap: 8px; padding: 14px 14px 10px; flex-shrink: 0; }
.sb-toggle {
  width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; cursor: pointer;
  background: transparent; border: 1px solid transparent; border-radius: 9px; color: var(--ink-2);
  transition: background 0.15s, color 0.15s;
}
.sb-toggle svg { width: 20px; height: 20px; }
.sb-toggle:hover { background: var(--track); color: var(--ink); }
.sb-brand {
  display: flex; align-items: center; gap: 10px; cursor: pointer; background: transparent; border: 0; padding: 0;
  min-width: 0; overflow: hidden;
}
.sb-brand-mark {
  width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; border-radius: 8px;
  background: var(--teal-fill); border: 1px solid var(--teal-fill);
  color: var(--on-teal); font-family: Georgia, var(--serif); font-size: 19px; line-height: 1;
}
.sb-brand-name {
  font-family: var(--sans); font-weight: 600; font-size: 1.12rem; color: var(--ink); white-space: nowrap;
}
.sb-brand { flex: 1 1 auto; }
.sb-tour-btn {
  margin-left: auto;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--teal-edge);
  background: transparent;
  color: var(--teal);
  cursor: pointer;
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sb-tour-btn:hover {
  background: var(--teal-tint);
  border-color: var(--teal);
  color: var(--teal);
}
.sb-tour-ic { width: 16px; height: 16px; flex: 0 0 16px; display: grid; place-items: center; }
.sb-tour-ic svg { width: 15px; height: 15px; }
.sb-tour-label { overflow: hidden; text-overflow: ellipsis; }

/* scroll shell: flex column; no outer scroll (progress/history scroll inside) */
.sb-shell {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px 12px 12px;
}

.sb-group-label {
  font-family: var(--sans); font-size: 0.66rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-3); padding: 6px 12px 8px; white-space: nowrap;
  flex-shrink: 0;
}
.sb-group-label--gap { margin-top: 10px; }

.sb-nav { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
.sb-link, .sb-section-head {
  position: relative; display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px 12px; border: 0; border-radius: 10px; background: transparent; cursor: pointer;
  color: var(--ink-2); font-family: var(--sans); font-size: 0.9rem; font-weight: 500;
  text-align: left; transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.sb-link:hover, .sb-section-head:hover { background: var(--track); color: var(--ink); }
.sb-link.is-active { background: var(--sheet); color: var(--teal); box-shadow: var(--sh-raised); }
.sb-link.is-active::before { content: none; }
.sb-link-ic { width: 22px; height: 22px; flex: 0 0 22px; display: grid; place-items: center; }
.sb-link-ic svg { width: 20px; height: 20px; }
.sb-link-label { white-space: nowrap; overflow: hidden; flex: 1 1 auto; }

/* collapsible sections */
.sb-caret { width: 18px; height: 18px; flex: 0 0 18px; display: grid; place-items: center; transition: transform 0.2s ease; opacity: 0.6; }
.sb-caret svg { width: 15px; height: 15px; }
.sb-section.is-open .sb-caret { transform: rotate(90deg); }
.sb-section-body {
  max-height: 0; overflow: hidden; transition: max-height 0.26s ease, opacity 0.2s ease; opacity: 0;
  padding-left: 6px;
}
.sb-section.is-open .sb-section-body { opacity: 1; margin-top: 2px; }

.sb-section--progress {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.sb-section--progress:not(.is-open) {
  flex: 0 0 auto;
}
.sb-section--progress.is-open .sb-section-body {
  flex: 1 1 0;
  min-height: 0;
  max-height: none;
  height: auto;
  overflow: hidden;
  padding-left: 0;
  display: flex;
  flex-direction: column;
}
.sb-section--progress.is-open.is-sized {
  flex: 0 1 auto;
}
.sb-section--progress.is-open.is-sized .sb-section-body {
  flex: 0 0 auto;
  height: var(--sb-progress-h);
  max-height: none;
}

.sb-section--hist {
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.sb-section--hist.is-open .sb-section-body {
  flex: 0 1 auto;
  min-height: 0;
  max-height: var(--sb-history-h);
  overflow-y: auto;
  overflow-x: hidden;
  padding-left: 0;
}
.sb-shell:has(.sb-section--progress.is-sized) .sb-section--hist.is-open {
  flex: 1 1 0;
}
.sb-shell:has(.sb-section--progress.is-sized) .sb-section--hist.is-open .sb-section-body {
  flex: 1 1 0;
  max-height: none;
}

.sb-empty { font-size: 0.82rem; color: var(--ink-3); padding: 8px 12px; }

/* Learning Progress: fills remaining sidebar height; tree scrolls inside */
.sb-progress-embed {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  background: transparent;
  color: var(--ink-2);
  border-radius: 10px;
  border: 1px solid transparent;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sb-progress-embed .learning-bar-embed {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
}
.sb-progress-resize {
  flex: 0 0 10px;
  height: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  border-top: 1px solid var(--rule);
  background: transparent;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
  position: relative;
}
.sb-progress-resize::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 36px;
  height: 3px;
  border-radius: 99px;
  background: var(--rule-2);
  transform: translate(-50%, -50%);
}
.sb-progress-resize:hover,
.sb-progress-resize:focus-visible {
  background: var(--track);
  outline: none;
}
.sb-progress-resize:hover::after,
.sb-progress-resize:focus-visible::after {
  background: var(--teal);
}
.sb-progress-embed .learning-bar-embed-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--rule-2) transparent;
}
.sb-progress-embed .learning-bar-embed-scroll::-webkit-scrollbar { width: 6px; }
.sb-progress-embed .learning-bar-embed-scroll::-webkit-scrollbar-thumb {
  background: var(--rule-2);
  border-radius: 999px;
}

/* history list */
.sb-section--hist .sb-section-body {
  scrollbar-width: thin;
  scrollbar-color: var(--rule-2) transparent;
}
.sb-section--hist .sb-section-body::-webkit-scrollbar { width: 6px; }
.sb-section--hist .sb-section-body::-webkit-scrollbar-thumb { background: var(--rule-2); border-radius: 999px; }
.sb-hist { display: flex; flex-direction: column; gap: 1px; padding: 2px 2px 4px; }
.sb-newchat {
  display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 6px; cursor: pointer;
  padding: 9px 11px; border-radius: 9px; background: transparent; border: 1px solid var(--teal-edge);
  color: var(--teal); font-family: var(--sans); font-size: 0.86rem; font-weight: 600; transition: background 0.15s;
}
.sb-newchat:hover { background: var(--teal-tint); }
.sb-newchat svg { width: 16px; height: 16px; flex: 0 0 16px; }
.sb-hist-group { margin-top: 6px; }
.sb-hist-label {
  font-family: var(--sans); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-3); padding: 4px 11px 5px;
}
.sb-hist-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-radius: 8px; cursor: pointer;
  color: var(--ink-2); transition: background 0.13s, color 0.13s;
}
.sb-hist-item:hover { background: var(--track); color: var(--ink); }
.sb-hist-item.is-active { background: var(--sheet); color: var(--teal); box-shadow: var(--sh-raised); }
.sb-hist-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; }
.sb-hist-time { flex: 0 0 auto; font-size: 0.68rem; color: var(--ink-3); font-family: var(--mono); }
.sb-hist-del {
  flex: 0 0 auto; width: 22px; height: 22px; display: grid; place-items: center; border: 0; background: transparent;
  color: var(--ink-3); border-radius: 6px; cursor: pointer; opacity: 0; transition: opacity 0.13s, color 0.13s, background 0.13s;
}
.sb-hist-item:hover .sb-hist-del { opacity: 1; }
.sb-hist-del:hover { background: var(--danger-tint); color: var(--danger); }
.sb-hist-del svg { width: 15px; height: 15px; }

/* footer */
.sb-footer { flex-shrink: 0; padding: 12px; border-top: 1px solid var(--rule); }
.sb-user { display: flex; align-items: center; gap: 10px; }
.sb-avatar-btn {
  flex: 0 0 32px; padding: 0; border: 0; background: transparent; border-radius: 50%; cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.sb-avatar-btn:hover { transform: scale(1.04); }
.sb-avatar-btn.is-active { box-shadow: 0 0 0 2px var(--teal); }
.sb-avatar { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; border: 1px solid var(--rule-2); object-fit: cover; display: block; }
.sb-avatar--empty { display: grid; place-items: center; background: var(--track); color: var(--ink-2); font-weight: 700; font-size: 0.9rem; }
.sb-user-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; color: var(--ink); }
.sb-signout {
  flex: 0 0 auto; background: transparent; border: 1px solid var(--rule-2); color: var(--ink-2);
  font-size: 0.72rem; font-weight: 600; padding: 5px 9px; border-radius: 7px; cursor: pointer; transition: 0.15s; white-space: nowrap;
}
.sb-signout:hover { border-color: var(--teal-edge); color: var(--teal); }
.sb-signin-prompt {
  margin: 0 0 8px;
  padding: 0 12px;
  font-size: var(--fs-sm);
  line-height: 16px;
  color: var(--ink-3);
}
.sb-signin {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 10px; cursor: pointer;
  background: transparent; border: 1px solid var(--teal-edge); color: var(--teal);
  font-family: var(--sans); font-size: 0.9rem; font-weight: 600; transition: background 0.15s;
}
.sb-signin:hover { background: var(--teal-tint); }
.sb-feedback { margin-bottom: 8px; }

/* ---- collapsed (icon rail) ---- */
.sb--collapsed .sb-brand-name,
.sb--collapsed .sb-group-label,
.sb--collapsed .sb-link-label,
.sb--collapsed .sb-caret,
.sb--collapsed .sb-section-body,
.sb--collapsed .sb-user-name,
.sb--collapsed .sb-signout,
.sb--collapsed .sb-signin-prompt,
.sb--collapsed .sb-tour-label { display: none; }
.sb--collapsed .sb-top { flex-direction: column; gap: 10px; padding: 14px 0 10px; }
.sb--collapsed .sb-brand { justify-content: center; flex: 0 0 auto; }
.sb--collapsed .sb-tour-btn { margin-left: 0; padding: 8px; }
.sb--collapsed .sb-shell { padding: 8px 10px; }
.sb--collapsed .sb-link, .sb--collapsed .sb-section-head, .sb--collapsed .sb-signin { justify-content: center; padding: 11px 0; gap: 0; }
.sb--collapsed .sb-footer { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.sb--collapsed .sb-feedback { margin-bottom: 0; }
.sb--collapsed .sb-user { justify-content: center; }
/* Collapsed rail: Learning Progress / History shrink to just their icon head. Their
   `.is-open` bodies use a more specific selector than the generic `.sb-section-body`
   hide above, so re-hide them here at higher specificity, and stop the progress
   section from stretching the rail, or the tree squishes into 72px (distorted). */
.sb--collapsed .sb-section--progress,
.sb--collapsed .sb-section--progress.is-open.is-sized { flex: 0 0 auto; }
.sb--collapsed .sb-section--progress.is-open .sb-section-body,
.sb--collapsed .sb-section--hist.is-open .sb-section-body { display: none; }

@media (max-width: 760px) {
  .sb { --sb-w: var(--sb-w-collapsed); }
  .sb:not(.sb--collapsed) .sb-brand-name,
  .sb:not(.sb--collapsed) .sb-group-label,
  .sb:not(.sb--collapsed) .sb-link-label,
  .sb:not(.sb--collapsed) .sb-caret,
  .sb:not(.sb--collapsed) .sb-section-body,
  .sb:not(.sb--collapsed) .sb-user-name,
  .sb:not(.sb--collapsed) .sb-signin-prompt,
  .sb:not(.sb--collapsed) .sb-signout { display: none; }
}
```

- [ ] **Step 6: Rewrite `MyLearningBar.css`**

Replace the whole of `frontend/src/MyLearningBar.css` with the following:
- The dead `.my-learning-bar-retry` rules are removed.
- The dark sidebar overrides are gone, since the sidebar is light now. Their structural declarations are kept.
- The current-section ribbon is added.

```css
.my-learning-bar-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 12px 8px 32px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  font-family: inherit;
}

.my-learning-bar-header {
  margin-bottom: 16px;
}

.my-learning-bar-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.my-learning-bar-top-row .my-learning-bar-title-wrap {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.my-learning-bar-top-row-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 1px;
}

.my-learning-bar-title-wrap {
  position: relative;
  margin-bottom: 6px;
}

.my-learning-bar-title {
  font-family: var(--serif);
  font-size: clamp(1.35rem, 3vw, 1.85rem);
  font-weight: 600;
  color: var(--ink);
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.my-learning-bar-book-link {
  font: inherit;
  font-weight: 600;
  color: var(--teal);
  background: none;
  border: none;
  padding: 0 2px;
  margin: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  border-radius: 4px;
}

.my-learning-bar-book-link:hover {
  color: var(--teal-press);
}

.my-learning-bar-book-link:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.my-learning-bar-book-popover {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 6px;
  z-index: 50;
  min-width: 220px;
  max-width: min(100%, 280px);
  padding: 6px 0;
  background: var(--sheet);
  border: 1px solid var(--rule-2);
  border-radius: 10px;
  box-shadow: var(--sh-float);
}

.my-learning-bar-book-popover-hint {
  padding: 6px 14px 8px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.my-learning-bar-book-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.12s ease;
}

.my-learning-bar-book-option:hover {
  background: var(--track);
}

.my-learning-bar-book-option--active {
  background: var(--teal-tint);
  color: var(--teal);
}

.my-learning-bar-book-check {
  color: var(--teal);
  font-weight: 700;
}

.my-learning-bar-meta {
  font-size: 0.88rem;
  color: var(--ink-3);
  margin: 0 0 12px;
  line-height: 1.45;
}

.my-learning-bar-saving {
  color: var(--ink-2);
  font-weight: 600;
}

.my-learning-bar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.82rem;
  margin-bottom: 14px;
  color: var(--ink-2);
}

.my-learning-bar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.my-learning-bar-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.my-learning-bar-dot--learned {
  background: var(--ink-2);
  box-shadow: 0 0 0 2px var(--track);
}

.my-learning-bar-dot--not {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ink-4);
}

.my-learning-bar-tree {
  background: var(--sheet);
  border: 1px solid var(--rule-2);
  border-radius: 14px;
  padding: 14px 16px 18px;
  box-shadow: var(--sh-raised);
}

.my-learning-bar-expand-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rule);
}

.my-learning-bar-expand-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--teal-edge);
  background: transparent;
  color: var(--teal);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.my-learning-bar-expand-btn:hover {
  background: var(--teal-tint);
}

.my-learning-bar-status {
  font-size: 0.85rem;
  color: var(--ink-3);
  padding: 12px;
  text-align: center;
}

.my-learning-bar-status--error {
  color: var(--danger);
}

.focs-node {
  margin: 0;
  padding: 0;
  list-style: none;
}

.focs-node__children {
  margin: 0;
  padding: 0 0 0 14px;
  list-style: none;
  border-left: 1px solid var(--rule);
}

.focs-node__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 6px;
  margin: 2px 0;
  border-radius: 8px;
  transition: background 0.12s;
}

.focs-node__row--toggle:hover {
  background: var(--track);
}

/* The section on screen (spec D10): a raised sheet with the bookmark ribbon. */
.focs-node__row--current,
.focs-node__row--current.focs-node__row--toggle:hover {
  position: relative;
  background: var(--sheet);
  box-shadow: var(--sh-raised);
}

.focs-node__row--current::before {
  content: "";
  position: absolute;
  left: -2px;
  top: -3px;
  width: 8px;
  height: 18px;
  background: var(--ribbon);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%);
}

.focs-node__row--current .focs-node__label {
  color: var(--ink);
  font-weight: 600;
}

.focs-node__chevron {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ink-3);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.65rem;
  line-height: 1;
  padding: 0;
}

.focs-node__chevron:hover {
  background: var(--track);
}

.focs-node__chevron--spacer {
  visibility: hidden;
  pointer-events: none;
}

/* Learned toggle: a hollow circle when not learned, an ink check when learned. */
.focs-node__learn-dot {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border-radius: 50%;
  border: 2px solid var(--ink-4);
  padding: 0;
  cursor: pointer;
  background: transparent;
  box-sizing: border-box;
  display: inline-grid;
  place-items: center;
}

.focs-node__learn-dot--on {
  border-color: transparent;
  background: transparent;
}

.focs-node__learn-dot--on::after {
  content: "✓";
  color: var(--ink-2);
  font: 700 12px/1 var(--sans);
}

.focs-node__learn-dot--off:hover {
  border-color: var(--ink-3);
  background: var(--sheet);
}

.focs-node__label {
  flex: 1;
  min-width: 0;
  font-family: var(--serif);
  font-size: 0.88rem;
  line-height: 1.4;
  text-align: left;
  border: none;
  background: transparent;
  cursor: default;
  padding: 2px 0;
}

/* Chapters (top-level rows) read as headings. */
.focs-node > .focs-node > .focs-node__row .focs-node__label {
  color: var(--ink);
  font-weight: 600;
}

.focs-node__label--learned {
  color: var(--ink-2);
  font-weight: 500;
}

.focs-node__label--not {
  color: var(--ink-2);
  font-weight: 400;
}

.focs-node__label--toggle {
  cursor: pointer;
  text-decoration: none;
}

.focs-node__label--toggle:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.focs-node__range {
  font-family: var(--mono);
  font-weight: 400;
  color: var(--ink-3);
  font-size: 0.82em;
  margin-left: 4px;
}

/* Embedded in the sidebar (width comes from the parent). The sidebar is light parchment now,
   so the embed only tightens spacing and lets the tree sit directly on the parchment. */
.learning-bar-embed {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--ink-2);
}

.learning-bar-embed-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 8px 14px;
  font-family: inherit;
}

.learning-bar-embed .my-learning-bar-header {
  margin-bottom: 10px;
}

.learning-bar-embed .my-learning-bar-top-row {
  margin-bottom: 4px;
}

.learning-bar-embed .my-learning-bar-title {
  font-size: 1.05rem;
}

.learning-bar-embed .my-learning-bar-meta {
  font-size: 0.76rem;
  margin-bottom: 8px;
}

.learning-bar-embed .my-learning-bar-legend {
  margin-bottom: 10px;
  gap: 12px;
  font-size: 0.75rem;
}

.learning-bar-embed .my-learning-bar-tree {
  padding: 10px 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  box-shadow: none;
}

.learning-bar-embed .focs-node__label {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.learning-bar-embed .focs-node__row {
  align-items: center;
  padding: 3px 4px;
  margin: 1px 0;
}

.learning-bar-embed .my-learning-bar-expand-btn {
  padding: 5px 10px;
  font-size: 0.75rem;
}

.learning-bar-embed .focs-node__children { padding-left: 10px; }
.learning-bar-embed .focs-node__learn-dot { margin-top: 0; }

/* The sidebar embed is tight on space and gets cramped when open. Drop the
   verbose instructions (the Learning Mode welcome already explains the dot +
   section-title interaction) and slim the header chrome so the section tree
   gets the room. The standalone /learning-bar page keeps the full header. */
.learning-bar-embed .my-learning-bar-meta { display: none; }
.learning-bar-embed .my-learning-bar-header { margin-bottom: 8px; }
.learning-bar-embed .my-learning-bar-legend { margin: 2px 0 9px; }
.learning-bar-embed .my-learning-bar-expand-row { margin-bottom: 9px; padding-bottom: 9px; }
```

- [ ] **Step 7: Global base styles**

In `frontend/src/index.css`, replace the `body { … }` rule with the following, and append the three rules after it:

```css
body {
    font-family: var(--sans);
    color: var(--ink);
    background: var(--desk);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
}

::selection {
    background: var(--selection);
}

:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
}

* {
    scrollbar-color: var(--rule-2) transparent;
}
```

- [ ] **Step 8: Rewrite `App.css`**

`App.css` now keeps only the rules for live classes (rule R2). The old navbar, chat card, Pólya, recommend, tree and auth-prompt rules are dead, and the font `@import` is gone. Replace the whole file with:

```css
/* Lock scroll to the viewport (new chat content must not grow the page). */
html, body, #root {
  overflow: hidden !important;
  height: 100vh;
  max-height: 100vh;
  background: var(--desk);
}

.app-container {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  background: transparent;
}

/* main column to the right of the global sidebar */
.app-main {
  flex: 1 1 auto;
  min-width: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Shown only when the API base URL is blocked as mixed content (spec §5.1). */
.deploy-config-banner {
  flex-shrink: 0;
  padding: 10px 14px;
  background: var(--danger-tint);
  border-bottom: 1px solid var(--danger);
  color: var(--danger);
  font-size: 0.875rem;
  line-height: 1.45;
}

.deploy-config-banner p {
  margin: 0;
}

.deploy-config-banner code {
  font-size: 0.8em;
  padding: 0 4px;
  background: var(--sheet);
  border-radius: 4px;
}

.app-container .content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  background: transparent;
}

/* Pages other than Learning Mode sit on notebook paper; Learning Mode keeps the desk. */
.app-container .content:not(:has(.learning-page-wrapper)) {
  background: var(--paper);
}

/* Learning Mode: tighter outer padding for textbook + chat */
.app-container .content:has(.learning-page-wrapper) {
  padding: 6px 10px;
}

@media (max-width: 768px) {
  .app-container {
    font-family: var(--sans);
    background: var(--desk);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
  }

  .app-container .content:has(.learning-page-wrapper) {
    padding: 6px 10px;
  }
}

/* These live rules load after Chat.css and win today; keep them so the layout does not move. */
.msg-user {
  text-align: right;
  margin-bottom: 20px;
}

.msg-ai {
  text-align: left;
  margin-bottom: 20px;
}

.input-row {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.learning-layout {
  display: flex;
  gap: 20px;
}

/* The textbook column is the desk itself (spec §5.3). */
.right-panel {
  width: 40%;
  background: linear-gradient(var(--desk-hi), var(--desk));
  border-radius: 0;
  padding: 16px;
  box-shadow: none;
  overflow: hidden;
}
```

This is the one rewrite that adds a rule: `.content:not(:has(.learning-page-wrapper))` gives non-Learning pages the `--paper` canvas from spec §5.7. It is paint only.

- [ ] **Step 9: Shrink PENDING and run the task's tests**

In `noHardcodedColors.test.ts`, delete the `"App.css"`, `"MyLearningBar.css"` and `"components/Sidebar.css"` lines from `PENDING`.

Run: `npx vitest run src/components src/styles`
Expected: PASS. That covers `Sidebar.test.tsx` (3), `sidebarCss.test.ts` (4), tokens (164) and the guard (3).

- [ ] **Step 10: Full checks and a look**

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  37 passed (37)`, and the build succeeds.

Start the app locally:

```bash
cd ../backend && OPENAI_API_KEY=sk-local-dummy-no-cost OPENAI_BASE_URL=http://127.0.0.1:9 /Users/vnerald/ai_tutor/backend/.venv/bin/python -m uvicorn main:app --port 8000
```

Run that in the background. Then start the frontend, also in the background, from `frontend/`:

```bash
DEV_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --port 5173 --strictPort
```

With gstack browse, run `$B viewport 1440x900`, then `$B goto http://localhost:5173/learning`. Click "Skip tour" in `.onboarding-tooltip`, open "1.1 Modeling Epidemics" in the outline, and `$B screenshot --viewport` into the plan's workspace.

Look for:
- a parchment sidebar with ink text;
- the active "Learning Mode" item as a raised sheet with teal text;
- section 1.1 marked with the red ribbon and in bold;
- learned sections showing ✓ and the others ○;
- "Sign in to save chats & track progress" above an outlined Sign in.

Also check that there is no top banner, and that the collapsed rail (`.sb-toggle`) hides the prompt. Leave both servers running for later tasks.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx src/App.css src/index.css src/components/Sidebar.tsx src/components/Sidebar.css src/components/Sidebar.test.tsx src/components/sidebarCss.test.ts src/MyLearningBar.css src/i18n/messages.ts src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): parchment sidebar, outline ribbon and global base

The sidebar and the learning-progress outline move to Paper & Ink: parchment
ground, ink text, teal only on the active item and controls, ink checks for
learned sections and the red ribbon on the section on screen. The top
sign-in banner is gone; its line sits above the sidebar's Sign in. Global
focus outline, selection and scrollbar use tokens; App.css keeps only
live rules.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The textbook panel, its header and the floating pager

**Files:**
- Modify: `frontend/src/learningTextbooks.ts` (`textbookLinkLabel`)
- Modify: `frontend/src/learningTextbooks.test.ts`
- Modify: `frontend/src/LearningModel.tsx` (**LAYOUT CHANGE:** header markup and icons; also the two inline "back to note" styles)
- Modify: `frontend/src/TextbookSectionNote.tsx` (Note button icon)
- Modify: `frontend/src/Chat.css` (the textbook selectors listed in Step 6)
- Modify: `frontend/src/practice/Practice.css`
- Modify: `frontend/src/i18n/messages.ts` (`learning.textbook` without the colon)
- Create: `frontend/src/textbookPagerCss.test.ts`
- Modify: `frontend/src/styles/noHardcodedColors.test.ts`

**Interfaces:**
- Consumes:
  - `dataMatchedTopic.bookId` / `.name` / `.startBook` / `.endBook`;
  - `readTextbookOptionList()`.
- Produces:
  - `textbookLinkLabel(bookId: string): string | null`;
  - the classes `left-panel-topic-bar-label`, `left-panel-topic-bar-meta`, `left-panel-topic-bar-book`, `left-panel-btn-icon` and `section-note-back-link`.

- [ ] **Step 1: Write the failing helper and pager tests**

Append to `frontend/src/learningTextbooks.test.ts`, and add `textbookLinkLabel` to its import from `"./learningTextbooks"`:

```ts
describe("textbookLinkLabel", () => {
  it("returns the short label of a known book", () => {
    expect(textbookLinkLabel("focs")).toBe("FOCS");
  });

  it("returns null for an unknown book", () => {
    expect(textbookLinkLabel("no-such-book")).toBeNull();
  });
});
```

If the file doesn't already import `describe`, `it` and `expect` from `"vitest"`, add them.

Create `frontend/src/textbookPagerCss.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec §5.3: the pager floats at the bottom and stays visible; page images are sheets on the desk.
const css = readFileSync(fileURLToPath(new URL("./Chat.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string): string {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const m = re.exec(css);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[2];
}

describe("textbook pager and pages", () => {
  it("sticks the pager to the bottom of the page box", () => {
    const nav = rule(".section-pages-nav");
    expect(nav).toMatch(/position:\s*sticky/);
    expect(nav).toMatch(/bottom:\s*var\(--s4\)/);
    expect(nav).toMatch(/order:\s*2/);
    expect(nav).toMatch(/margin:\s*auto 0 var\(--s4\)/);
    expect(nav).not.toMatch(/(^|[;\s])top:/);
  });

  it("draws page images as sheets on the desk", () => {
    const img = rule(".reference-page-img");
    expect(img).toMatch(/box-shadow:\s*var\(--sh-sheet\)/);
    expect(img).toMatch(/filter:\s*var\(--page-image-filter\)/);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/learningTextbooks.test.ts src/textbookPagerCss.test.ts`
Expected: FAIL.
- `textbookLinkLabel` is not exported, so its tests fail with "is not a function".
- The pager test fails on `position: sticky`… expecting `bottom: var(--s4)`.
- The image test fails because there is no `box-shadow: var(--sh-sheet)`.

- [ ] **Step 3: Add `textbookLinkLabel`**

Append to `frontend/src/learningTextbooks.ts`:

```ts
/** Short label of a textbook (e.g. "FOCS", "Signals") for headers; null when the id is unknown. */
export function textbookLinkLabel(bookId: string): string | null {
  return readTextbookOptionList().find((o) => o.id === bookId)?.linkLabel ?? null;
}
```

- [ ] **Step 4: LAYOUT CHANGE. Rebuild the textbook header markup**

In `frontend/src/LearningModel.tsx`:

1. **Import.** Add `textbookLinkLabel` to the existing `import { … } from "./learningTextbooks";` (line 11).

2. **Icons.** Above `export default function LearningModel`, add:

   ```tsx
   /* Header icons for the textbook bar (spec §5.3). */
   const FlagIcon = (
     <svg className="left-panel-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
       <path d="M5 21V4" />
       <path d="M5 4h11l-2 4 2 4H5" />
     </svg>
   );
   const EyeOffIcon = (
     <svg className="left-panel-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
       <path d="M3 3l18 18" />
       <path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-3.2 4.3" />
       <path d="M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7a9.8 9.8 0 0 0 4.4-1" />
       <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
     </svg>
   );
   ```

3. **Header text.** Replace the `<div className="left-panel-topic-bar-text" …>…</div>` element (lines ~1297–1314) with:

   ```tsx
                 <div
                   className="left-panel-topic-bar-text"
                   role="group"
                   aria-label={t("learning.currentSection")}
                 >
                   <span className="left-panel-topic-bar-label">{t("learning.textbook")}</span>
                   <span className="left-panel-topic-bar-title">{dataMatchedTopic.name}</span>
                   <span className="left-panel-topic-bar-meta">
                     {textbookLinkLabel(dataMatchedTopic.bookId) ? (
                       <>
                         <span className="left-panel-topic-bar-book">{textbookLinkLabel(dataMatchedTopic.bookId)}</span>
                         <span className="left-panel-topic-bar-sep" aria-hidden="true">
                           ·
                         </span>
                       </>
                     ) : null}
                     <span className="left-panel-topic-bar-pages">
                       {t("learning.pages", {
                         start: String(dataMatchedTopic.startBook),
                         end: String(dataMatchedTopic.endBook),
                       })}
                     </span>
                   </span>
                 </div>
   ```

4. **Button icons.** In the same bar, put `{FlagIcon}` before `{t("feedback.reportProblem")}` inside the Report button. Put `{EyeOffIcon}` before `{t("learning.hide")}` in both Hide buttons: the in-bar one, and the one in `.left-panel-hide-row`.

5. **Back-to-note buttons.** In the two buttons that call `setPracticeViewNote(false)` and `setGuideViewNote(false)`, replace each `style={{ background: "none", border: "none", color: "#0f766e", textDecoration: "underline", cursor: "pointer", padding: "6px 0", fontSize: "0.8rem" }}` with `className="section-note-back-link"`.

In `frontend/src/TextbookSectionNote.tsx`, change the Note button's children from `{t("note.button")}` to:

```tsx
      <svg className="left-panel-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20h4L19 9l-4-4L4 16z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
      {t("note.button")}
```

In `frontend/src/i18n/messages.ts`, change `learning.textbook` in all three dictionaries:

| Dictionary | Old | New |
|---|---|---|
| EN | `Textbook:` | `Textbook` |
| ZH | `教材：` | `教材` |
| ES | `Libro:` | `Libro` |

- [ ] **Step 5: LAYOUT CHANGE. Header, pager and desk CSS**

In `frontend/src/Chat.css`, replace these existing rules with the versions below:

- `.left-panel-topic-bar`
- `.left-panel-note-btn`, `.left-panel-note-btn:hover`, `.left-panel-note-btn--open`
- `.left-panel-topic-bar-text`, `.left-panel-topic-bar-title`, `.left-panel-topic-bar-sep`, `.left-panel-topic-bar-pages`
- `.left-panel-hide-btn`, `.left-panel-hide-btn:hover`
- `.reference-page-box`, `.reference-page-img`
- `.section-pages-nav`, `.section-pages-paging`
- `.section-pages-zoom-btn` (and its `:hover:not(:disabled)`), `.section-pages-zoom-label` (and its `:hover`)
- `.section-pages-nav button`, `.section-pages-info`

Add the new rules where noted.

```css
/* Current section title + page range; Note and Hide on the right */
.left-panel-topic-bar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  background: transparent;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
}

/* LAYOUT CHANGE (spec §5.3): label, serif title and meta line stack. */
.left-panel-topic-bar-text {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s1);
  line-height: 1.35;
}

.left-panel-topic-bar-label {
  font-family: var(--sans);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.left-panel-topic-bar-title {
  margin: 0;
  font-family: var(--serif);
  font-size: var(--fs-title);
  line-height: 32px;
  font-weight: 500;
  color: var(--ink);
}

.left-panel-topic-bar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--s2);
  color: var(--ink-3);
}

.left-panel-topic-bar-book {
  font-family: var(--serif);
  font-style: italic;
  font-size: var(--fs-base);
}

.left-panel-topic-bar-sep {
  color: var(--ink-4);
  font-size: var(--fs-ui);
  font-weight: 400;
  user-select: none;
}

.left-panel-topic-bar-pages {
  margin: 0;
  font-family: var(--mono);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--ink-3);
  white-space: nowrap;
}

/* Header actions: icon + text ghost buttons. */
.left-panel-note-btn,
.left-panel-hide-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-family: var(--sans);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ink-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r1);
  cursor: pointer;
  flex-shrink: 0;
}

.left-panel-note-btn {
  margin-top: 2px;
}

.left-panel-note-btn:hover,
.left-panel-hide-btn:hover {
  color: var(--teal);
  background: var(--teal-tint);
}

.left-panel-note-btn--open {
  color: var(--teal);
  background: var(--teal-tint);
  border-color: var(--teal-edge);
}

.left-panel-btn-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
}

/* NEW: replaces the inline styles on the two "back to note" buttons. */
.section-note-back-link {
  background: none;
  border: none;
  color: var(--teal);
  text-decoration: underline;
  cursor: pointer;
  padding: 6px 0;
  font-size: 0.8rem;
}

/* LAYOUT CHANGE (spec §5.3): a desk margin so the page's sheet shadow shows. */
.reference-page-box {
  margin-top: 0;
  padding: var(--s3) var(--s3) 0;
  background: transparent;
  border-radius: 0;
  border: 1px solid transparent;
}

.reference-page-img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--r-paper);
  box-shadow: var(--sh-sheet);
  filter: var(--page-image-filter);
}

/* LAYOUT CHANGE (spec §5.3): a floating pill that sticks to the bottom of the page box.
   order:2 moves it after the page; margin-top:auto pins it down when the page is short. */
.section-pages-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-shrink: 0;
  order: 2;
  position: sticky;
  bottom: var(--s4);
  z-index: 3;
  align-self: center;
  margin: auto 0 var(--s4);
  flex-wrap: wrap;
  max-width: calc(100% - var(--s4));
  padding: 6px 10px;
  background: var(--sheet);
  border: 1px solid var(--rule);
  border-radius: var(--pill);
  box-shadow: var(--sh-float);
}

.section-pages-paging {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
  padding-left: 12px;
  border-left: 1px solid var(--rule);
}

.section-pages-zoom-btn {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-2);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.section-pages-zoom-btn:hover:not(:disabled) {
  background: var(--teal-tint);
  border-color: transparent;
  color: var(--teal);
}

.section-pages-zoom-label {
  min-width: 3.25rem;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ink-2);
  font-family: var(--mono);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}

.section-pages-zoom-label:hover {
  background: var(--teal-tint);
  color: var(--teal);
}

.section-pages-nav button {
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: var(--pill);
  background: transparent;
  color: var(--teal);
  font-family: var(--sans);
  font-weight: 600;
  cursor: pointer;
}

.section-pages-info {
  font-size: 0.9rem;
  color: var(--ink-2);
}
```

Keep the existing `.section-pages-zoom-btn:disabled` and `.section-pages-nav button:disabled` rules as they are; they only set opacity and the cursor.

- [ ] **Step 6: Migrate the rest of the textbook selectors in `Chat.css`**

Apply the Migration Rules (R1–R4) to every remaining rule in `Chat.css` whose selector starts with one of these:

- `.btn-show-textbook-panel`
- `.left-panel-`
- `.right-panel`
- `.textbook-note-`
- `.textbook-pages-`
- `.section-note-` (also covers the `.section-note-card*`, `.section-note-entry*` and `.section-note-vocab/formula*` rules)
- `.reference-page-`, `.reference-img-`, `.reference-image-`, `.reference-snippet`
- `.book-page-` (with `@keyframes book-page-pulse`)
- `.outline-preview-`
- `.resize-handle`
- `.learning-bar-`

Also handle these rules:
- `.left-panel-section-note`: background `--paper`, text `--ink-body`.
- `.book-page-highlight-callout`: `--sheet` background, `--teal` text, `--sh-float`.
- `.reference-page-img-wrap--highlight .reference-page-img` and `@keyframes book-page-pulse`: the ring becomes `0 0 0 3px var(--teal-edge), 0 0 0 6px var(--teal-tint), var(--sh-sheet)`, and the 50% frame becomes `0 0 0 4px var(--teal), 0 0 0 10px var(--teal-tint), var(--sh-sheet)`.
- `.reference-image-lightbox`: background `--scrim`.
- `.reference-image-lightbox-close`: `--sheet` with `--ink-2`.
- `.resize-handle`: `--rule`, and `--teal` on hover.

Delete the dead rules (R2), whose classes are listed here:
- `learning-bar-column`, `learning-bar-column-body`, `learning-bar-hide-btn`, `learning-bar-resize-handle`, `learning-bar-reveal-btn`, `learning-bar-root--collapsed`;
- `reference-page-label`;
- `section-note-vocab-list`, `section-note-vocab-row`, `section-note-vocab-term`, `section-note-vocab-def`;
- `section-note-formula-list`, `section-note-formula-item`, `section-note-formula-expr`, `section-note-formula-explain`.

Leave the chat selectors for Task 6.

- [ ] **Step 7: Migrate `Practice.css`**

In `frontend/src/practice/Practice.css`:

1. **Local variables.** Delete the `--pr-*` declarations at the top of the `.practice` rule (lines 5–16).
2. **Renames.** Rename every `var(--pr-X)` in the file:

   | Old | New |
   |---|---|
   | `--pr-paper` | `--paper` |
   | `--pr-ink` | `--ink` |
   | `--pr-ink-soft` | `--ink-3` |
   | `--pr-rule` | `--rule-2` |
   | `--pr-teal` | `--teal` |
   | `--pr-teal-bright` | `--teal-line` |
   | `--pr-teal-deep` | `--teal-press` |
   | `--pr-bad` | `--warning` |
   | `--pr-serif` | `--serif` |
   | `--pr-sans` | `--sans` |
   | `--pr-mono` | `--mono` |
   | `--pr-hand` | `--serif`, and add `font-style: italic` in that rule (D9) |

3. **Mastery fill.** `.pr-mastery-fill` gets `background: var(--teal-fill);` instead of the gradient.
4. **Everything else.** Migrate the remaining literals with R4, and delete the dead `.pr-empty` / `.pr-empty-title` rules.

- [ ] **Step 8: Shrink PENDING and run the tests**

In `noHardcodedColors.test.ts`, delete the `"practice/Practice.css"` and `"LearningModel.tsx"` lines from `PENDING`. `Chat.css` stays until Task 6.

Run: `npx vitest run src/learningTextbooks.test.ts src/textbookPagerCss.test.ts src/textbookZoomCss.test.ts src/styles`
Expected: PASS. The zoom test still passes because Step 5 left its wrapper rules untouched.

- [ ] **Step 9: Full checks and a look**

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  38 passed (38)`, and the build succeeds.

Browse `/learning` at 1440×900 and open FOCS 1.1. Check:
- the header reads TEXTBOOK / "1.1 Modeling Epidemics" in large serif / "FOCS · Pages 7–7";
- Report, Note and Hide show icons;
- the page sits on the desk with a soft sheet shadow;
- the zoom and paging pill floats centered at the bottom and stays visible while you scroll a long section such as FOCS 1.4;
- at the end of the scroll it does not cover the page's last line.

Repeat at 390×844.

- [ ] **Step 10: Commit**

```bash
git add src/learningTextbooks.ts src/learningTextbooks.test.ts src/LearningModel.tsx src/TextbookSectionNote.tsx src/Chat.css src/practice/Practice.css src/i18n/messages.ts src/textbookPagerCss.test.ts src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): textbook on the desk, serif header, floating pager

The textbook column becomes the desk: pages are sheets with a soft paper
shadow, the header stacks a small label, the section name in serif and a
book + pages line, and the zoom/paging bar floats as a sticky pill at the
bottom. Practice styles move to tokens.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The chat panel and its title row

**Files:**
- Modify: `frontend/src/LearningModel.tsx` (**LAYOUT CHANGE:** chat title row)
- Modify: `frontend/src/Chat.css` (the chat selectors; **LAYOUT CHANGE:** the tutor-answer margin)
- Modify: `frontend/src/i18n/messages.ts` (`chat.tutorTitle`)
- Create: `frontend/src/chatCss.test.ts`
- Modify: `frontend/src/styles/noHardcodedColors.test.ts`

**Interfaces:**
- Consumes: the tokens and the `.reset-box` button (with `data-onboarding="new-session"`).
- Produces: the classes `chat-panel-titlebar` and `chat-panel-title`, and the i18n key `chat.tutorTitle`.

- [ ] **Step 1: Write the failing chat test**

Create `frontend/src/chatCss.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/chatCss.test.ts`
Expected: FAIL. Both tests fail, because neither the title row nor the margin rule exists yet.

- [ ] **Step 3: LAYOUT CHANGE. The title row**

In `frontend/src/LearningModel.tsx`, replace:

```tsx
        {/* Reset button */}
        <div className="reset-box" data-onboarding="new-session">
          <button type="button" onClick={reset} disabled={isAwaitingReply}>
            {t("chat.newQuestion")}
          </button>
        </div>
```

with:

```tsx
        {/* LAYOUT CHANGE (spec §5.4): title row; the tour still spotlights .reset-box. */}
        <div className="chat-panel-titlebar">
          <h2 className="chat-panel-title">{t("chat.tutorTitle")}</h2>
          <div className="reset-box" data-onboarding="new-session">
            <button type="button" onClick={reset} disabled={isAwaitingReply}>
              {t("chat.newQuestion")}
            </button>
          </div>
        </div>
```

In `frontend/src/i18n/messages.ts`, add `chat.tutorTitle` right after `chat.newQuestion` in each dictionary:

| Dictionary | Value |
|---|---|
| EN | `Tutor` |
| ZH | `导师` |
| ES | `Tutor` |

- [ ] **Step 4: The chat rules that change shape**

In `frontend/src/Chat.css`:

- Replace `.chat-panel`, `.reset-box`, `.reset-box button`, `:hover`, `:active` and `.reset-box button:disabled` with the versions below.
- Replace `.msg-ai`, `.markdown-message.markdown-message--user`, the `h1`–`h6` group, the ordered-list badge (`… ol > li::before`), `.chat-example-label`, `.chat-example-chip` with `:hover:not(:disabled)`, `.chat-example-num`, `.learning-input-shell`, `.input-icon-btn` with `:hover`, `.chat-input-text` with `::placeholder`, and `.learning-send-btn` with `:hover`.
- Add the new rules where noted.

```css
.chat-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  padding: 10px 16px;
  border-radius: var(--r2);
  background: var(--paper);
}

/* NEW. LAYOUT CHANGE (spec §5.4): "Tutor" on the left, New session on the right. */
.chat-panel-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin: 0 0 var(--s2);
  padding-bottom: var(--s2);
  border-bottom: 1px solid var(--rule);
}

.chat-panel-title {
  margin: 0;
  font-family: var(--serif);
  font-size: var(--fs-lead);
  line-height: 24px;
  font-weight: 600;
  color: var(--ink);
}

.reset-box {
  margin: 0;
  flex: 0 0 auto;
}

.reset-box button {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--teal-edge);
  border-radius: var(--r2);
  padding: 6px 12px;
  font-family: var(--sans);
  font-size: var(--fs-ui);
  font-weight: 600;
  line-height: 1.35;
  color: var(--teal);
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.reset-box button:hover {
  background: var(--teal-tint);
  border-color: var(--teal);
}

.reset-box button:active {
  background: var(--teal-tint);
}

.reset-box button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* LAYOUT CHANGE (spec §5.4): tutor answers are margin notes, a 30px gutter for the Σ seal and a teal rule. */
.msg-ai {
  position: relative;
  text-align: left;
  color: var(--ink-body);
  margin: 14px 0;
  padding-left: 30px;
}

.msg-ai::before {
  content: "Σ";
  position: absolute;
  left: 0;
  top: 2px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: var(--teal-fill);
  color: var(--on-teal);
  font: 600 12px/1 Georgia, var(--serif);
}

.msg-ai.msg-ai-loading-placeholder::before {
  content: none;
}

.msg-ai .markdown-message:not(.markdown-message--user) {
  border-left: 2px solid var(--teal-line);
  padding-left: var(--s3);
  font-family: var(--serif);
  font-size: var(--fs-read);
  line-height: 24px;
}

.markdown-message.markdown-message--user {
  display: inline-block;
  text-align: left;
  max-width: 80%;
  background: var(--sheet);
  color: var(--ink-body);
  border: 1px solid var(--rule-2);
  font-family: var(--sans);
  padding: 10px 15px;
  border-radius: 14px 14px 4px 14px;
}

.markdown-message h1,
.markdown-message h2,
.markdown-message h3,
.markdown-message h4,
.markdown-message h5,
.markdown-message h6 {
  margin: 1em 0 0.4em;
  font-family: var(--sans);
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 16px;
  color: var(--ink-2);
}

.markdown-message:not(.markdown-message--user) ol > li::before {
  content: counter(md-ol);
  position: absolute;
  left: 0;
  top: 0.05em;
  width: 1.7em;
  height: 1.7em;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 0.8em;
  font-weight: 500;
  color: var(--ink-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
}

.chat-example-label {
  margin: 0 0 8px;
  font-family: var(--sans);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.chat-example-chip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--teal-edge);
  border-radius: var(--r2);
  background: transparent;
  color: var(--teal);
  font-family: var(--sans);
  font-size: 0.86rem;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}

.chat-example-chip:hover:not(:disabled) {
  background: var(--teal-tint);
  border-color: var(--teal);
}

.chat-example-num {
  flex: 0 0 auto;
  font-family: var(--mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--teal);
  margin-top: 1px;
}

.learning-input-shell {
  width: 100%;
  max-width: 34rem;
  margin-left: auto;
  margin-right: auto;
  margin-top: 0;
  padding: 5px 6px 5px 12px;
  background: var(--sheet);
  border-radius: var(--r3);
  border: 1.5px solid var(--rule-input);
  box-shadow: var(--sh-raised);
}

/* NEW: the composer shows focus on its frame. */
.learning-input-shell:focus-within {
  border-color: var(--teal);
  box-shadow: 0 0 0 3px var(--teal-tint);
}

.input-icon-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.input-icon-btn:hover {
  background: var(--track);
  color: var(--ink-2);
}

.chat-input-text {
  flex: 1 1 0%;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.35;
  color: var(--ink-body);
}

.chat-input-text::placeholder {
  color: var(--ink-3);
  font-family: var(--serif);
  font-style: italic;
}

.learning-send-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--teal-fill);
  color: var(--on-teal);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.learning-send-btn:hover {
  background: var(--teal-press);
  color: var(--on-teal);
}
```

`.chat-input-text { outline: none }` is safe: its frame shows focus through `.learning-input-shell:focus-within`.

- [ ] **Step 5: Migrate the rest of the chat selectors**

Apply R1–R4 to every remaining rule in `Chat.css` whose selector starts with one of these:

- `.chat-panel` (with `-root--collapsed` and `-reveal-btn`)
- `.attached-`
- `.chat-box`, `.chat-example-`
- `.msg-`
- `.markdown-`
- `.learning-reply-`, `.learning-inline-spinner`
- `.chat-input-text:disabled` (background `--track`)

Notes:
- **Attachments:**
  - `.attached-pdf-chip`: `--track` background, `--ink-2` text, `--rule-2` border. It is a file-type tag, not an error.
  - `.attached-img-remove`: `--ink` background with `--sheet` text.
  - The thumbnail borders use `--rule-2`.
- **Loading shimmer:** `.msg-ai-loading-line` becomes `linear-gradient(90deg, var(--rule) 0%, var(--track) 45%, var(--rule) 90%)`. `.msg-ai-loading-inner` becomes `--sheet` with a `--rule` border.
- **Spinners:** `.learning-reply-status` becomes `--sheet` with a `--rule-2` border and `--ink-2` text. The spinner track uses `--rule-2`, and its moving top edge uses `--teal`.
- **Markdown details:**
  - blockquote: `--teal-line` border, `--teal-tint` background, `--ink-body` text;
  - `hr`: `--rule`;
  - `code`: `--track` and `--ink`;
  - `pre`: `--track` background with a `--rule` border;
  - `th` / `td`: `--rule` borders, with `th` on `--track`;
  - links: `--teal`, hover `--teal-press`;
  - pickable hits: `--teal-edge` underline, hover `--teal-tint` with a `--teal` underline, focus `--focus`.

Delete the dead rules (R2), whose classes are listed here:
- `chat-empty-hint`, `chat-empty-icon`, `chat-empty-text`;
- `lm-welcome`, `lm-welcome-av`, `lm-welcome-close`, `lm-welcome-hand`, `lm-welcome-lead`, `lm-welcome-steps`, `lm-welcome-who`;
- `polya-container`, `section-box`, `sidebar`.

Do **not** delete `.markdown-message .katex-display`: KaTeX adds that class at runtime.

- [ ] **Step 6: Shrink PENDING and run the tests**

In `noHardcodedColors.test.ts`, delete the `"Chat.css"` line from `PENDING`.

Run: `npx vitest run src/chatCss.test.ts src/textbookPagerCss.test.ts src/textbookZoomCss.test.ts src/styles`
Expected: PASS.

- [ ] **Step 7: Full checks and a look**

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  39 passed (39)`, and the build succeeds.

Browse `/learning` (Paper) and check:
- a "Tutor" title with an outlined "Start a new session" in one row;
- the example prompts as outlined teal rows;
- the composer as a white rounded box with a round teal send button.

Restart the tour from the sidebar's Tour button and check that its "new session" step still spotlights the button. Repeat at 390×844.

- [ ] **Step 8: Commit**

```bash
git add src/LearningModel.tsx src/Chat.css src/i18n/messages.ts src/chatCss.test.ts src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): chat panel as notebook paper

A Tutor title row holds the new-session button; tutor answers read as serif
margin notes with a teal rule and a Σ seal; student messages are quiet
sheet cards; examples and the composer use outlined teal and tokens.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Grades, Auto Grader and Profile

**Files:**
- Modify: `frontend/src/Grades.css`, `frontend/src/AutoGrader.css`, `frontend/src/UserProfile.css`
- Modify: `frontend/src/UserProfile.tsx` (the inline error color)
- Modify: `frontend/src/styles/noHardcodedColors.test.ts`

**Interfaces:**
- Consumes: the tokens, and Task 2's `AppearancePicker`, which sits inside the Profile page's Appearance card.
- Produces: the class `profile-error`.

- [ ] **Step 1: Prove the guard fails for these files**

Delete `"Grades.css"`, `"AutoGrader.css"`, `"UserProfile.css"` and `"UserProfile.tsx"` from `PENDING`.

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: FAIL. The output lists literals from each of the four files, including `UserProfile.tsx: #c62828` and `Grades.css: --paper: #f7f3ea`, and the shadow test lists `Grades.css defines --paper` and similar.

- [ ] **Step 2: Grades**

In `frontend/src/Grades.css`:

1. **Local tokens.** Delete the local token block at the top of the `.gr-page` rule (lines 7–19: `--paper` through `--mono`). The names `--paper`, `--ink`, `--teal`, `--rule`, `--serif`, `--sans` and `--mono` then resolve to the global tokens, so their uses stay as they are.
2. **Renames.** Rename the remaining local names:

   | Old | New |
   |---|---|
   | `--paper-card` | `--sheet` |
   | `--ink-soft` | `--ink-3` |
   | `--navy` | `--ink` |
   | `--teal-mid` | `--teal` |
   | `--teal-bright` | `--teal-line` |
   | `--rule-strong` | `--rule-input` |

3. **Handwriting.** The two `"Caveat"` margin notes become `font-family: var(--serif); font-style: italic; color: var(--teal-line);` (D9).
4. **Standing mark.** It keeps its size, set in `--serif`. Weight 400 becomes 500.
5. **Everything else.** Migrate the remaining literals with R4. Delete the dead `.gr-title` and `.gr-mockpill` rules.

- [ ] **Step 3: Auto Grader**

In `frontend/src/AutoGrader.css`, apply R1–R4:
- **Cards and inputs:**
  - `.autograder-card` / `-panel`: `--sheet` with `--rule-2` and `--sh-raised`;
  - `.autograder-file*` drop zones: `--sheet` with a dashed `--rule-input` border;
  - `.autograder-textarea`: `--rule-input`, with focus `--teal` plus `0 0 0 3px var(--teal-tint)`.
- **Submit button:** `.autograder-submit` uses `--teal-fill` / `--on-teal`, and `--teal-press` on hover.
- **Results:**
  - `.autograder-result`: `--paper` background, its `h3` in `--ink` and `--serif`;
  - `.autograder-error*`: `--danger` on `--danger-tint`.
- **Confidence badges** (each already carries a text label, so color is supplementary):
  - `.autograder-confidence--high`: `--success` / `--success-tint` / border `--success`;
  - `--medium`: `--warning` / `--warning-tint` / border `--warning`;
  - `--low`: `--danger` / `--danger-tint` / border `--danger`.
- **Score text:** `.autograder-score-item > .autograder-score-main strong` uses `--ink`. It is a number, not a control.

- [ ] **Step 4: Profile**

In `frontend/src/UserProfile.css`, apply R1–R4:
- **Page and cards:** `.profile-page` uses `--paper`, and each `.profile-card` uses `--sheet` with `--rule-2` and `--sh-raised`. Titles use `--serif` and `--ink`.
- **Avatar placeholder:** `.profile-avatar` drops its dark gradient (line ~80) for `--track`, with `--ink-2` initials.
- **Buttons:**
  - `.profile-google*` and `.profile-signout*`: outline buttons (`--rule-2` border, `--ink-2` text; hover `--teal-edge` / `--teal`);
  - `.profile-locale-apply-all` and other primaries: `--teal-fill` / `--on-teal`.
- **Textbook and file controls:** `.profile-textbook*` and `.profile-file*` follow R4. The file drop zone has a dashed `--rule-input` border; `.profile-file-choose-btn` uses `--teal`.
- **Appearance swatches:**
  - `.profile-bg-swatch`: `--sheet` with a `--rule-2` border;
  - `.profile-bg-swatch--active`: border `--teal` plus `box-shadow: 0 0 0 3px var(--teal-tint)`;
  - `.profile-bg-swatch-label`: `--ink-2`.
  - Delete the dead `.profile-bg-swatch-dot` rule; Task 2 removed its element.
- **Error class:** add

  ```css
  .profile-error {
    color: var(--danger);
    margin-top: 0.5rem;
  }
  ```

In `frontend/src/UserProfile.tsx`, change `<p className="profile-muted" style={{ color: "#c62828", marginTop: "0.5rem" }}>` to `<p className="profile-muted profile-error">`.

- [ ] **Step 5: Run the guard and everything**

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: PASS.

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  39 passed (39)` (Gradebook, RubricEditor, StandingHero and AutoGrader specs among them), and the build succeeds.

- [ ] **Step 6: A look**

Browse `/grades`, `/autograder` and `/profile` at 1440×900 and 390×844, in Paper and in Bright. Switch to Bright on `/profile`; it persists across reloads.

Check:
- warm paper canvases with sheet cards;
- no navy, purple or neon left;
- the Grades margin notes in serif italic;
- each Appearance tile previewing its own variant.

- [ ] **Step 7: Commit**

```bash
git add src/Grades.css src/AutoGrader.css src/UserProfile.css src/UserProfile.tsx src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): Grades, Auto Grader and Profile on Paper & Ink tokens

Grades drops its local tokens (which shadowed the global names) and its
handwriting; Auto Grader badges use the status tokens next to their labels;
Profile cards, buttons and Appearance tiles use tokens, and the textbook
error moves from an inline color to .profile-error.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Modals and onboarding

**Files:**
- Modify: `frontend/src/SignInModal.css`, `frontend/src/SignInModal.tsx` (decorative SVG)
- Modify: `frontend/src/feedback/FeedbackModal.css`
- Modify: `frontend/src/components/OnboardingTour.css`
- Modify: `frontend/src/styles/noHardcodedColors.test.ts`

**Interfaces:**
- Consumes: the tokens.
- Produces: no new names.

- [ ] **Step 1: Prove the guard fails for these files**

Delete `"SignInModal.css"`, `"SignInModal.tsx"`, `"feedback/FeedbackModal.css"` and `"components/OnboardingTour.css"` from `PENDING`.

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: FAIL. The output lists literals from all four files, including `SignInModal.tsx: rgba(255,255,255,0.03)`.

- [ ] **Step 2: The sign-in modal**

In `frontend/src/SignInModal.tsx`, change the five decorative shapes in `.signin-brand-deco`:

- The circles become `fill="currentColor"` with `fillOpacity` values `0.05`, `0.035` and `0.08`, in order.
- The lines become `stroke="currentColor"` with `strokeOpacity` values `0.1` and `0.07`.

Leave the Google logo `fill="#4285F4"` etc. untouched; the guard allows them.

In `frontend/src/SignInModal.css`, apply R1–R4:
- **Overlay:** `.signin-overlay` uses `--scrim` and keeps its `backdrop-filter`.
- **Modal and form:** `.signin-modal` uses `--sheet` with `--sh-float`. `.signin-form-panel` uses `--sheet`.
- **Brand panel:**
  - `.signin-brand` drops its navy gradient for `--parch`, with a right border of `1px solid var(--rule)`;
  - `.signin-brand-deco` gets `color: var(--teal-line)`;
  - `.signin-brand-icon` uses `--teal-fill` with `--on-teal`;
  - `.signin-brand-title` uses `--serif` and `--ink`;
  - `.signin-brand-tagline` uses `--ink-2`.
- **Text and close button:** `.signin-close` uses `--ink-3`, with hover `--track` and `--ink`. `.signin-title` uses `--serif` and `--ink`; `.signin-subtitle` uses `--ink-3`.
- **Error:** `.signin-error` uses `--danger` on `--danger-tint` instead of its gradient.
- **Providers:**
  - `.signin-provider*` buttons: `--sheet` with a `--rule-2` border and `--ink` text, hover `--track`;
  - `.signin-provider-icon--email`: `--teal`;
  - the provider stagger animations stay.
- **Divider and inputs:**
  - `.signin-divider` lines use `--rule` instead of the gradient;
  - `.signin-input` uses `--rule-input`, with focus `--teal` plus `0 0 0 3px var(--teal-tint)`.
- **Submit button:** `.signin-submit-btn` uses `--teal-fill` / `--on-teal`, and `--teal-press` on hover. Drop its gradient and the white sheen overlay (`.signin-submit-btn::before` / `::after` backgrounds become `none`).
- **Links:** `.signin-toggle-link` and `.signin-back` use `--teal`.

- [ ] **Step 3: The feedback modal and the tour**

In `frontend/src/feedback/FeedbackModal.css`, apply R1–R4:
- **Overlay:** `.feedback-overlay` uses `--scrim`.
- **Dialog:** `.feedback-modal` uses `--sheet` with `--sh-float`. `.feedback-title` uses `--serif` and `--ink`.
- **Type options:**
  - `.feedback-type`: `--rule-2` border and `--ink-2` text;
  - the selected type (its existing checked or active state): `--teal` border, `--teal-tint` background, `--teal` text.
- **Textarea:** `.feedback-textarea` uses `--rule-input`, with focus `--teal` plus `0 0 0 3px var(--teal-tint)`.
- **Errors:** `.feedback-error*` uses `--danger` on `--danger-tint`.
- **Buttons:** the primary `.feedback-btn` uses `--teal-fill` / `--on-teal`, hover `--teal-press`. The secondary uses an outline (`--rule-2`, `--ink-2`).
- **Spinner:** it uses `--rule-2` and `--teal`.

In `frontend/src/components/OnboardingTour.css`:
- **Spotlight:** `.onboarding-spotlight`'s dimming `box-shadow: 0 0 0 9999px …` becomes `0 0 0 9999px var(--scrim)`.
- **Tooltip:** `.onboarding-tooltip` (currently `#0f1729`) becomes `--sheet` with `--sh-float` and a `1px solid var(--rule)` border.
- **Text:** `.onboarding-step` uses `--ink-3`; `.onboarding-title` uses `--serif` and `--ink`; `.onboarding-body` uses `--ink-2`.
- **Buttons:** `.onboarding-next` uses `--teal-fill` / `--on-teal`, hover `--teal-press`. `.onboarding-skip` uses `--ink-3`, hover `--ink`.

- [ ] **Step 4: Run the guard and everything**

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: PASS.

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  39 passed (39)` (FeedbackModal and FeedbackContext specs among them), and the build succeeds.

- [ ] **Step 5: A look**

On `/learning` at 1440×900 in Paper and Bright, check three things:
- The sign-in modal (the sidebar's Sign in) has a parchment brand panel and a sheet form, and Google's colored logo is intact.
- The tour tooltip on a fresh visit is a sheet with a teal Next button.
- The feedback modal (the sidebar's Feedback) opens the sign-in modal when signed out, as before.

Repeat the sign-in modal at 390×844.

- [ ] **Step 6: Commit**

```bash
git add src/SignInModal.css src/SignInModal.tsx src/feedback/FeedbackModal.css src/components/OnboardingTour.css src/styles/noHardcodedColors.test.ts
git commit -m "feat(theme): sign-in, feedback and tour on Paper & Ink tokens

The sign-in brand panel becomes parchment with token-colored decoration;
modals and the tour tooltip are raised sheets over a warm scrim, with teal
primaries and status-token errors. Google's logo keeps its colors.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Delete the dead components and close the guard

**Files:**
- Delete:
  - `frontend/src/ChatHistory.tsx`, `frontend/src/ChatHistory.css`
  - `frontend/src/components/GooeyNav.tsx`, `frontend/src/components/GooeyNav.css`
  - `frontend/src/components/IridescenceBackground.tsx`, `frontend/src/components/IridescenceBackground.css`
- Modify: `frontend/index.html` (drop the Outfit link)
- Modify: `frontend/src/styles/noHardcodedColors.test.ts` (an empty `PENDING`, plus an explicit assertion)

**Interfaces:**
- Consumes: nothing.
- Produces: an empty `PENDING`.

- [ ] **Step 1: Confirm nothing imports them**

Run: `grep -rnE "ChatHistory|GooeyNav|IridescenceBackground" src index.html --include='*.ts' --include='*.tsx' --include='*.html' | grep -vE "^src/(ChatHistory|components/GooeyNav|components/IridescenceBackground)\.tsx"`
Expected: no output, and exit status 1.

- [ ] **Step 2: Write the failing "guard is closed" assertion**

In `noHardcodedColors.test.ts`, add this test inside the `describe` block:

```ts
  it("has no pending files left (spec success criterion 4)", () => {
    expect([...PENDING]).toEqual([]);
  });
```

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: FAIL with `expected [ 'ChatHistory.css', 'components/GooeyNav.css' ] to deeply equal []`.

- [ ] **Step 3: Delete them and close the guard**

```bash
git rm src/ChatHistory.tsx src/ChatHistory.css src/components/GooeyNav.tsx src/components/GooeyNav.css src/components/IridescenceBackground.tsx src/components/IridescenceBackground.css
```

In `frontend/index.html`, delete the line:

```html
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
```

In `noHardcodedColors.test.ts`, empty the set: `const PENDING = new Set<string>([]);`.

- [ ] **Step 4: Run the guard and everything**

Run: `npx vitest run src/styles/noHardcodedColors.test.ts`
Expected: PASS, 4 tests.

Run: `npx tsc -b && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc is silent, vitest shows `Test Files  39 passed (39)`, and the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A src/styles/noHardcodedColors.test.ts index.html
git commit -m "chore(theme): delete unused components; every color is a token

ChatHistory, GooeyNav and IridescenceBackground were rendered nowhere; the
Outfit font served only ChatHistory. The color guard's pending list is now
empty and asserted so.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Visual and functional review (spec §7.3)

This task verifies; it adds no repo code. Its artifacts live in the plan's workspace (`WS`, printed by `/Users/vnerald/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-02-paper-ink-theme-pr1.md`, run from the worktree root) and in `~/Desktop/ai-tutor-redesign/PR1-对比/`.

A fix that this review finds goes into the file that owns it, with its own commit (`fix(theme): …`), and the full suite runs again.

**Files:**
- Create (workspace only):
  - `$WS/fake_openai.py`
  - `$WS/shots/*.png`
  - `$WS/contact-sheet.html`
  - `$WS/preview-checklist.md`

**Interfaces:**
- Consumes: the whole branch, and the base commit `956eda9`.
- Produces: the contact sheet and the preview checklist that goes into the PR body.

- [ ] **Step 1: A base checkout for "before" shots**

From the worktree root:

```bash
WS=$(/Users/vnerald/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-02-paper-ink-theme-pr1.md)
git worktree add --detach "$WS/base" 956eda9
ln -s "$PWD/frontend/node_modules" "$WS/base/frontend/node_modules"
git diff --quiet 956eda9 HEAD -- frontend/package.json frontend/package-lock.json && echo "same deps"
```

Expected: `same deps`. If the deps differ, run `npm ci` in `$WS/base/frontend` instead of the symlink.

- [ ] **Step 2: A free, fixed tutor answer**

Create `$WS/fake_openai.py`:

```python
"""Offline stand-in for the OpenAI API: every chat completion returns one fixed markdown answer."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

ANSWER = (
    "The zero-state response is the *convolution* of the input with the impulse response.\n\n"
    "### Procedure\n"
    "1. **Write the integral** with $x(\\tau)$ and $h(t-\\tau)$.\n"
    "2. **Find the limits** where both factors are nonzero.\n"
    "3. **Integrate** over $\\tau$.\n\n"
    "$$y(t)=\\int_{-\\infty}^{\\infty} x(\\tau)\\,h(t-\\tau)\\,d\\tau$$\n\n"
    "> Causal inputs make the limits $0$ to $t$.\n\n"
    "Check it numerically with `conv(x, h)`.\n\n"
    "| step | idea |\n|---|---|\n| 1 | flip |\n| 2 | shift |\n"
)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        body = json.dumps({
            "id": "fake", "object": "chat.completion", "created": 0, "model": "fake",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": ANSWER}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
```

Then start four processes in the background:
- **The fake API:** `python3 "$WS/fake_openai.py"`.
- **The backend**, from `backend/` in the worktree (restart it if Task 4's is still running):
  ```bash
  OPENAI_API_KEY=sk-local-fake OPENAI_BASE_URL=http://127.0.0.1:8765/v1 /Users/vnerald/ai_tutor/backend/.venv/bin/python -m uvicorn main:app --port 8000
  ```
- **The branch frontend** on 5173, from `frontend/`:
  ```bash
  DEV_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --port 5173 --strictPort
  ```
- **The base frontend** on 5174, from `$WS/base/frontend`:
  ```bash
  DEV_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --port 5174 --strictPort
  ```

Signals pages need the private Lathi PDF, which isn't local. Signals is checked on the preview (Step 6); local shots use FOCS.

- [ ] **Step 3: Shoot before and after**

With gstack browse, from the scratchpad, take each state at 1440×900 and 390×844. Use `$B viewport WxH`, `$B goto`, `$B wait --networkidle`, then `$B screenshot --viewport "$WS/shots/<state>-<width>-<base|paper|bright>.png"`.

Shoot each state three times: on base (5174), and on the branch (5173) in Paper and in Bright. For Bright, run `$B js "localStorage.setItem('ai_tutor_profile_settings', JSON.stringify({theme:'bright'}))"`, then reload.

The states:
1. `/learning` on a first visit, showing tour step 1 (clear localStorage first).
2. `/learning` after "Skip tour", with FOCS "1.1 Modeling Epidemics" open from the outline.
3. The same, with the chat answer: type "What is the zero-state response?" and send.
4. The sidebar collapsed (`.sb-toggle`).
5. `/grades`.
6. `/autograder`.
7. `/profile`.
8. The sign-in modal (the sidebar's Sign in).

- [ ] **Step 4: Contrast and click-through on the branch**

**Contrast.** On each branch state, in Paper and in Bright, run axe's color-contrast rule:

```bash
$B js "new Promise(r=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js';s.onload=()=>axe.run(document,{runOnly:['color-contrast']}).then(x=>r(JSON.stringify(x.violations.map(v=>({id:v.id,n:v.nodes.length,first:v.nodes[0]?.target})))));document.head.appendChild(s);})"
```

Expected: `[]` on every state. A violation is a finding: fix it at its token use, commit, and re-run.

**Click-through on the branch at 1440×900.** Check each of these:
- open a section from the outline;
- Next and Prev on a multi-page section (FOCS 1.4);
- zoom −, 100% and +;
- Hide and then Show textbook;
- drag the textbook/chat handle;
- toggle a section's learned mark;
- step through the tour to the end;
- open and close the sign-in modal;
- both feedback entry points open the sign-in modal;
- switch to Bright on `/profile`, reload, and confirm the page is still Bright with no light-to-dark flash.

Each must behave exactly as on base.

- [ ] **Step 5: The contact sheet**

Write `$WS/contact-sheet.html`: one row per state and width, with base, Paper and Bright side by side, each as an `<img>` with a caption. Copy it and `$WS/shots/` into `~/Desktop/ai-tutor-redesign/PR1-对比/`, then open it with `open`. Tell the user where it is and what to compare.

- [ ] **Step 6: The preview checklist**

Write `$WS/preview-checklist.md` for the PR body. These are the states local runs cannot reach (spec §7.4); check each in Paper and in Bright on the Vercel preview, signed in:

```markdown
### Preview checklist (signed in, Paper and Bright)
- [ ] Sidebar: avatar and name, History list with an active item, Sign out
- [ ] Signals §2.4 open: header "TEXTBOOK / 2.4 … / Signals · Pages 168–195", ribbon on 2.4 in the outline, pager pill
- [ ] Ask a question that opens a section from chat: the outline's ribbon moves to that section
- [ ] Grades with real data
- [ ] Auto Grader: grade a small Question/Answer pair; confidence badges readable
- [ ] Feedback form opens (signed in), types and textarea readable
- [ ] Profile → Appearance: Paper ↔ Bright switch, survives reload, no flash
- [ ] Phone width (~390px): sidebar rail, textbook header and pager, chat composer
```

- [ ] **Step 7: Tear down**

Stop the four background processes, then remove the base checkout: `git worktree remove "$WS/base"`. Run `npx vitest run 2>&1 | tail -4` one final time.
Expected: `Test Files  39 passed (39)`.

Record the result in the ledger.
