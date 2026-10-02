# Paper & Ink Night (PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Night, the real dark Paper & Ink variant. Users can pick it in Appearance, legacy dark/black users land in it, and every surface stays readable.

**Architecture:** PR1 (#36, merged as `54ac1fb`) already defines Night's tokens in `styles/tokens.css` behind `NIGHT_AVAILABLE = false`. This PR:
- flips the switch;
- makes the variant blocks win on `<html>` in any order, and declares `color-scheme`;
- fixes the four Night blockers from PR1's final review, plus Home's exposure to Night's global rules;
- passes every surface in Night through the browser, with axe.

**Tech Stack:** React 19, Vite 7, vitest 3 with jsdom 25, CSS custom properties, `src/test/cssCascade.ts` (PR1's cascade resolver), and gstack browse.

**Spec:** `docs/superpowers/specs/2026-10-01-paper-ink-theme-design.md`. The Night column is in §4.2 and §4.3. The mechanism is §4.4, the Night rules are §4.6 and the contrast floors are §4.7. Delivery is §8 ("PR2: the Night tokens tuned, `NIGHT_AVAILABLE = true`, a per-surface Night pass, and Night screenshots").

## Global Constraints

- "Components reference tokens only. Any new color starts in `tokens.css`." (§4.5). `Home.css` and `Home.tsx` are excluded from the color guard (§7.2).
- "Teal marks interactive and current elements only. Static information is ink, never teal." (§4.5)
- "Use `--ink-4` only for non-text marks." (§4.5)
- "Scanned textbook pages are never inverted … They get `--page-image-filter`." (§4.6)
- "PR2 may tune Night only within the contrast rules of §4.7." `styles/tokens.test.ts` enforces them for every variant.
- Edits change paint properties only. "Structural properties stay as they are." (§7.1)
- Home is not restyled (D2).
- No paid API calls: chat answers come from the local fake server (§7.3).
- No `.env` in the worktree.
- Never commit book PDFs, `.build/`, `.part` files or the mockups.
- Pushing, opening the PR and merging wait for the user's go-ahead.

## Review Focus

1. **A Night user opens Home (`/`).** Home keeps its light look. Selected text, focus rings and the scrollbar stay readable rather than going dark on light. *Pinned by Task 2's "Home under Night" test and Task 4's Home shots.*
2. **A saved Night choice, or a legacy `dark`/`black` preset.** The first paint is already Night, with no flash of Paper. *Pinned by Task 1's `index.html` cases.*
3. **Hover, focus and pressed states in Night.** Link and button text stays at or above 4.5:1. axe does not hover, so the guard covers declared text colors in every state. *Pinned by Task 3's text-color guard, and Task 4 Step 6 measures the five hovers.*
4. **Scanned pages in Night.** They are dimmed, never inverted, both in the panel and in the lightbox. The student's own screenshots are untouched. *Pinned by Task 3's image test.*
5. **Native controls in Night.** Checkboxes, number inputs, file pickers, autofill and scrollbars follow the dark scheme. *Pinned by Task 2's `color-scheme` tests, with Task 4's Grades, Auto Grader and sign-in shots.*

---

### Task 1: Night is available in Appearance

**Files:**
- Modify: `frontend/src/profile/profileSettings.ts:4-5`
- Modify: `frontend/index.html:11`
- Modify: `frontend/src/i18n/messages.ts`, after each `"theme.bright"` line (EN ~53, ZH ~444, ES ~827)
- Modify: `frontend/src/profile/AppearancePicker.tsx`
- Test: `frontend/src/profile/profileSettings.test.ts`, `frontend/src/indexHtmlThemeScript.test.ts`, `frontend/src/profile/AppearancePicker.test.tsx`

**Interfaces:**
- Consumes: `NIGHT_AVAILABLE`, `THEME_OPTIONS`, `resolveTheme`, `ThemeId` from `profileSettings.ts`, and `MessageKey` from `i18n/messages.ts`.
- Produces:
  - `NIGHT_AVAILABLE === true`;
  - `THEME_OPTIONS` deep-equals `["paper", "bright", "night"]`;
  - the message key `"theme.night"` in EN, ZH and ES;
  - three Appearance radios: Paper, Bright, Night.

- [ ] **Step 1: Write the failing tests**

In `profileSettings.test.ts`, replace the last test (`it("offers Night only once it ships", …)`) with the block below. The parameterized tests above it stay, and now exercise the Night-on branch.

```ts
describe("Night (PR2)", () => {
  it("is offered after Paper and Bright", () => {
    expect(NIGHT_AVAILABLE).toBe(true);
    expect(THEME_OPTIONS).toEqual(["paper", "bright", "night"]);
  });

  it("applies a saved Night choice", () => {
    expect(resolveTheme({ theme: "night" })).toBe("night");
  });

  it.each(["dark", "black"])("lands legacy %s users in Night", (legacy) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe("night");
  });
});
```

In `indexHtmlThemeScript.test.ts`, add this inside `describe("index.html theme script", …)`, after the existing `it.each`:

```ts
  it.each([
    ['{"theme":"night"}', "night"],
    ['{"pageBackground":"dark"}', "night"],
    ['{"pageBackground":"black"}', "night"],
  ])("applies Night before first paint for %s", (stored, expected) => {
    expect(runScript(stored)).toBe(expected);
  });
```

In `AppearancePicker.test.tsx`, make three changes:
- Rename the test `"offers Paper and Bright as radios and checks the saved one"` to `"offers Paper, Bright and Night as radios and checks the saved one"`, and change its label expectation to:
  ```ts
  expect(radios.map((r) => r.textContent)).toEqual(["Paper", "Bright", "Night"]);
  ```
- In `"pins each preview to its own variant"`, change the expectation to:
  ```ts
  expect(previews.map((p) => p.getAttribute("data-theme"))).toEqual(["paper", "bright", "night"]);
  ```
- Add this test after `"applies and stores a choice"`:
  ```tsx
  it("applies and stores Night", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Night" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("night");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"theme":"night"}');
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/profile src/indexHtmlThemeScript.test.ts`
Expected: FAIL in all of these:
- "is offered after Paper and Bright" (`NIGHT_AVAILABLE` is false);
- "applies a saved Night choice" and "lands legacy dark/black users in Night" (both get `"paper"`);
- the three "applies Night before first paint" cases (each gets `"paper"`);
- the radio labels (`["Paper", "Bright"]`) and the preview variants;
- "applies and stores Night" (there is no radio named Night).

- [ ] **Step 3: Implement**

In `profileSettings.ts`, replace lines 4–5:

```ts
/** Night shipped in PR2. The switch stays so index.html's copy can be checked against this one. */
export const NIGHT_AVAILABLE = true;
```

In `frontend/index.html`, change `var NIGHT_AVAILABLE = false;` to `var NIGHT_AVAILABLE = true;`.

In `messages.ts`, add one line after each `"theme.bright"` entry:
- EN: `"theme.night": "Night",`
- ZH: `"theme.night": "夜读",`
- ES: `"theme.night": "Noche",`

These are the spec §6 strings. ZH and ES are typed `Record<MessageKey, string>`, so a missing locale fails `tsc`.

In `AppearancePicker.tsx`:
- Replace the import `import { THEME_OPTIONS } from "./profileSettings";` with `import { THEME_OPTIONS, type ThemeId } from "./profileSettings";`.
- Add this after the imports:
  ```tsx
  /** Each variant's label. A missing entry is a type error, which a template-literal cast would hide. */
  const THEME_LABELS: Record<ThemeId, MessageKey> = {
    paper: "theme.paper",
    bright: "theme.bright",
    night: "theme.night",
  };
  ```
- Change the label span to:
  ```tsx
  <span className="profile-bg-swatch-label">{t(THEME_LABELS[id])}</span>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/profile src/indexHtmlThemeScript.test.ts`
Expected: PASS. The parity test `"uses the same legacy table and Night switch as profileSettings.ts"` also passes, because both copies now say `true`.

Then run: `npx vitest run && npx tsc -b`
Expected: every test file passes and `tsc` is clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/profile frontend/index.html frontend/src/i18n/messages.ts frontend/src/indexHtmlThemeScript.test.ts
git commit -m "feat(theme): Night is available in Appearance"
```

---

### Task 2: Night-ready tokens; Home keeps its own colors

**Files:**
- Modify: `frontend/src/styles/tokens.css`: the Paper block (~line 40), the Bright block (~85) and the Night block (~128)
- Modify: `frontend/src/Home.css:3`, the `.home-scrap` block
- Modify: `frontend/src/styles/tokens.test.ts:23-27`, plus one new test
- Create: `frontend/src/styles/themeCascade.test.ts`

**Interfaces:**
- Consumes: `parseStyleSheet`, `resolveStyle` and `loadAppStyleSheets` from `src/test/cssCascade.ts` (PR1).
- Produces:
  - variant selectors `:root[data-theme="bright"], [data-theme="bright"]` and `:root[data-theme="night"], [data-theme="night"]`;
  - `color-scheme` declared in each variant block: light, light, dark.

Why the change matters:
- **Block order:** on `<html>`, `:root` (the Paper block) and a bare `[data-theme="night"]` have equal specificity. Night therefore wins only because its block comes later; reorder the file and Night silently becomes Paper. `:root[data-theme="night"]` outranks `:root` in any order, and the bare selector still serves the Appearance previews, which pin a variant on a `<span>`.
- **`color-scheme`:** it turns native controls, autofill and scrollbars dark in Night.
- **Home:** Home defines its own palette but still inherits Night's `--selection`, `--focus` and `--rule-2` through the global `::selection`, `:focus-visible` and scrollbar rules. Selected Home text would turn dark on dark.

- [ ] **Step 1: Write the failing tests**

In `tokens.test.ts`, so the blocks are still found after the selector change, replace the `VARIANTS` constant with:

```ts
const VARIANTS: Record<string, Vars> = {
  paper: block(/\[data-theme="paper"\]/),
  bright: block(/(^|,\s*)\[data-theme="bright"\]$/),
  night: block(/(^|,\s*)\[data-theme="night"\]$/),
};
```

Then add this inside `describe("tokens.css", …)`, after `"makes Paper the :root default"`:

```ts
  it.each([
    [/\[data-theme="paper"\]/, "light"],
    [/(^|,\s*)\[data-theme="bright"\]$/, "light"],
    [/(^|,\s*)\[data-theme="night"\]$/, "dark"],
  ])("tells the browser the scheme of %s, for native controls and scrollbars", (selector, scheme) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => selector.test(m[1].trim()));
    expect(/color-scheme:\s*(\w+);/.exec(rule?.[2] ?? "")?.[1]).toBe(scheme);
  });
```

Create `frontend/src/styles/themeCascade.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/styles`
Expected: FAIL in these:
- the three `color-scheme` cases (undefined);
- "night on <html> beats the :root Paper block in any rule order" (the reversed order gives Paper's `#e9e3d7`);
- the same test for bright;
- "Home under Night" (`color-scheme` undefined).

"keeps each Appearance preview on its own variant" already passes. It guards the selector change in Step 3.

- [ ] **Step 3: Implement**

In `tokens.css`, add `color-scheme: light;` as the first declaration of the Paper block (`:root,\n[data-theme="paper"] {`).

Replace the Bright block's opening line `[data-theme="bright"] {` with:

```css
/* :root[…] outranks the Paper :root block on <html> in any order; the bare selector
   serves the Appearance previews, which pin a variant on a span. */
:root[data-theme="bright"],
[data-theme="bright"] {
  color-scheme: light;
```

Replace the Night block's opening line `[data-theme="night"] {` with:

```css
/* See Bright: the doubled selector makes block order irrelevant. */
:root[data-theme="night"],
[data-theme="night"] {
  color-scheme: dark;
```

In `Home.css`, add these lines at the top of the `.home-scrap { … }` block, before `--ink: #0c1222;`. The values are what Home rendered with in PR1's Paper, so Home looks the same in every variant:

```css
  /* Night must not reach Home, which keeps its own look (spec D2). The global
     selection, focus-ring and scrollbar rules read these instead of the theme's. */
  color-scheme: light;
  --selection: #e5ebe5;
  --focus: #0f5e57;
  --rule-2: #d9cfbe;
```

`noHardcodedColors.test.ts` excludes `Home.css` from both the literal check and the token-shadowing check, so these literals are allowed there.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/styles`
Expected: PASS. The contrast cases and `"every variant defines exactly the same tokens"` stay green.

Then run: `npx vitest run && npx tsc -b`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles frontend/src/Home.css
git commit -m "feat(theme): Night-ready tokens; Home keeps its own colors under Night"
```

---

### Task 3: Night-safe hover text and a filtered lightbox page

**Files:**
- Modify: `frontend/src/MyLearningBar.css:65-67`
- Modify: `frontend/src/Chat.css:396-399`, `:1031-1033` and `:1258-1266`
- Modify: `frontend/src/SignInModal.css:417-419` and `:435-437`
- Create: `frontend/src/styles/textColorTokens.test.ts`, `frontend/src/textbookImageCss.test.ts`

**Interfaces:**
- Consumes: `loadAppStyleSheets` and `resolveInBothOrders` from `src/test/cssCascade.ts`.
- Produces: no text color anywhere drawn from `--teal-press`, `--teal-fill`, `--teal-edge`, `--rule`, `--rule-2` or `--rule-input`, and `.reference-image-lightbox-img` filtered like the panel's page image.

The problems:
- **Hover text:** `--teal-press` is a fill token. Five hover rules use it as text, which reads 2.1–2.6:1 in Night. Hover keeps `--teal` and signals with the underline instead.
- **Lightbox:** it opens only textbook page images (the `openEnlargedIfNotDrag` callers in `LearningModel.tsx`), yet it skips `--page-image-filter`. In Night, the zoomed page would glare at full brightness.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/styles/textColorTokens.test.ts`:

```ts
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
```

Create `frontend/src/textbookImageCss.test.ts`:

```ts
// @vitest-environment jsdom
// Scanned pages get the variant's page filter wherever they show and are never inverted (spec §4.6).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("textbook page images", () => {
  it.each([
    ['<div class="reference-page-sidebar"><img class="reference-page-img"></div>', ".reference-page-img"],
    ['<div class="reference-image-lightbox"><img class="reference-image-lightbox-img"></div>', ".reference-image-lightbox-img"],
  ])("filter the scanned page in %s", (html, selector) => {
    document.body.innerHTML = html;
    expect(resolveInBothOrders(document.querySelector(selector)!, "filter", sheets)).toEqual([
      "var(--page-image-filter)",
      "var(--page-image-filter)",
    ]);
  });

  it("leave the student's own screenshots unfiltered", () => {
    document.body.innerHTML = '<img class="msg-user-thumb"><img class="attached-img-thumb">';
    for (const img of document.querySelectorAll("img")) {
      expect(resolveInBothOrders(img, "filter", sheets)).toEqual([undefined, undefined]);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/styles/textColorTokens.test.ts src/textbookImageCss.test.ts`
Expected: FAIL in two places:
- the guard lists five offenders: `MyLearningBar.css` `.my-learning-bar-book-link:hover`, `Chat.css` `.section-note-entry-toggle:hover` and `.markdown-message a:hover`, `SignInModal.css` `.signin-toggle-link:hover` and `.signin-back-link:hover`;
- the lightbox case gets `[undefined, undefined]`.

The panel image case and the screenshots case already pass.

- [ ] **Step 3: Implement**

In `MyLearningBar.css`, the link is already underlined at rest, so a thicker underline is the hover cue:

```css
.my-learning-bar-book-link:hover {
  color: var(--teal);
  text-decoration-thickness: 2px;
}
```

In `Chat.css`, replace the two hover rules:

```css
.section-note-entry-toggle:hover {
  color: var(--teal);
  text-decoration: underline;
}
```

```css
.markdown-message a:hover {
  color: var(--teal);
  text-decoration: underline;
  text-decoration-thickness: 2px;
}
```

Also in `Chat.css`, add one declaration to `.reference-image-lightbox-img`, after `box-shadow: var(--sh-float);`:

```css
  filter: var(--page-image-filter);
```

In `SignInModal.css`, change `color: var(--teal-press);` to `color: var(--teal);` in both `.signin-toggle-link:hover` and `.signin-back-link:hover`. Both rules already set `text-decoration: underline`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/styles/textColorTokens.test.ts src/textbookImageCss.test.ts`
Expected: PASS.

Then run: `npx vitest run && npx tsc -b`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/MyLearningBar.css frontend/src/Chat.css frontend/src/SignInModal.css frontend/src/styles/textColorTokens.test.ts frontend/src/textbookImageCss.test.ts
git commit -m "fix(theme): Night-safe hover text and a filtered lightbox page"
```

---

### Task 4: The Night pass in the browser

**Files:**
- Workspace only (git-ignored, under the plan's sdd workspace `$WS`): `fake_openai.py`, `axe.min.js`, `shots/`
- Desktop: `~/Desktop/ai-tutor-redesign/PR2-夜读/`, holding the screenshots and `contact-sheet.html`
- Modify, only if a defect is found: the CSS file that owns it, `styles/tokens.css` (Night values only), and the test named in Step 7

**Interfaces:**
- Consumes: everything Tasks 1–3 produce.
- Produces: Night screenshots, an axe result per state and the contact sheet. Any fix comes with its regression test.

- [ ] **Step 1: Start the local stack, with no paid calls**

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
    "See [the convolution page](https://en.wikipedia.org/wiki/Convolution) and check it with `conv(x, h)`.\n\n"
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


HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
```

Start three background processes:
- **Fake API:** `python3 "$WS/fake_openai.py"`
- **Backend**, from `backend/`:
  ```bash
  OPENAI_API_KEY=sk-local-fake OPENAI_BASE_URL=http://127.0.0.1:8765/v1 /Users/vnerald/ai_tutor/backend/.venv/bin/python -m uvicorn main:app --port 8000
  ```
- **Frontend**, from `frontend/`:
  ```bash
  DEV_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --port 5173 --strictPort
  ```

Run browse scripts with `export PATH="$HOME/.bun/bin:$PATH"`.

- [ ] **Step 2: Shoot every state in Paper and in Night**

Take each state at 1440×900 and 390×844. These are the spec §7.3 states:
- Learning, first visit (tour step 1);
- FOCS "1.1 Modeling Epidemics" open from the outline;
- an empty chat;
- a chat with the fake answer;
- the sidebar expanded and collapsed;
- Grades, Auto Grader and Profile (with the Appearance card in view);
- the sign-in modal;
- plus Home (`/`).

Set the theme with:

```bash
$B js "localStorage.setItem('ai_tutor_profile_settings', JSON.stringify({theme:'night'}))"
```

Use `{theme:'paper'}` for the Paper shots, then reload. Name each file `$WS/shots/<state>-<width>-<paper|night>.png`. Skip the tour through the `.onboarding-tooltip` "Skip tour" button. Open outline sections with a JS click on `button.focs-node__label`, then poll until `[aria-current="true"]` names that section. `$B js` does not print a promise's result.

- [ ] **Step 3: Run axe color-contrast on every Night state**

Download axe once:

```bash
curl -sL https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js -o "$WS/axe.min.js"
```

For each Night state:

```bash
$B js "$(cat "$WS/axe.min.js"); 'axe loaded'"
$B js "axe.run(document,{runOnly:['color-contrast']}).then(r=>{window.__axe=r}); 'started'"
$B js "window.__axe ? JSON.stringify(window.__axe.violations.map(v=>({id:v.id,n:v.nodes.length,first:v.nodes[0].target}))) : 'pending'"
```

Repeat the last command until it stops printing `pending`.

Expected: `[]` for every state. Also run it on Paper's tour state as a sanity check; PR1 measured 0 there.

- [ ] **Step 4: Check Home in Night**

With Night stored, open `/`. It must look like the Paper shot of `/`. Then:

```bash
$B js "(()=>{const h=document.querySelector('.hs-headline');const r=document.createRange();r.selectNodeContents(h);getSelection().removeAllRanges();getSelection().addRange(r);return getComputedStyle(h,'::selection').backgroundColor})()"
```

Expected: `rgb(229, 235, 229)`, the light `#e5ebe5`. Take a shot with the selection showing. If the browser reports no `::selection` style, judge the selection by that shot.

- [ ] **Step 5: Check native controls in Night**

| Where | What to do | What to check |
|---|---|---|
| Grades | Enter edit mode | The number inputs |
| Auto Grader | — | The file pickers |
| Sign-in modal | — | The email and password inputs |
| Any scrolling panel | — | The scrollbar |

```bash
$B js "getComputedStyle(document.documentElement).colorScheme"
```

Expected: `dark` in Night, and each control is drawn dark rather than as a white box.

- [ ] **Step 6: Measure the five hover states in Night**

Create `$WS/contrast.js`. It holds one function expression that returns an element's text contrast against its nearest opaque background:

```js
(selector) => {
  const el = document.querySelector(selector);
  const nums = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let bg = el;
  while (bg && bg !== document.documentElement) {
    const c = nums(getComputedStyle(bg).backgroundColor);
    if (c.length === 3 || c[3] === 1) break;
    bg = bg.parentElement;
  }
  const a = lum(nums(getComputedStyle(el).color));
  const b = lum(nums(getComputedStyle(bg || document.body).backgroundColor));
  return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
}
```

Open the surface that holds each link:
- the sidebar outline's book link: `.my-learning-bar-book-link`;
- a section note: `.section-note-entry-toggle`;
- the fake answer: `.markdown-message a`;
- the sign-in modal's two links: `.signin-toggle-link` and `.signin-back-link`.

For each, run:

```bash
$B hover "<selector>"
$B js "($(cat "$WS/contrast.js"))('<selector>')"
```

`$B hover` is a real pointer hover, so `:hover` rules apply.

Expected: each is at least 4.5. `--teal` on the Night surfaces is 6.31 at worst (§4.7).

- [ ] **Step 7: Fix what the pass finds**

For each defect, first decide which kind it is, then fix it that way:

| Kind | Fix |
|---|---|
| (a) A token used against its §4.2 role | Remap it by role, in the owning CSS file. |
| (b) A Night value that reads badly although the pair passes | Tune that Night value in `tokens.css`, within §4.7. `tokens.test.ts` must stay green. |
| (c) A structural problem | Do not fix it in this PR (§7.1). Ledger it as a ruling and list it in the PR's follow-ups. |

Every (a) or (b) fix gets a test that fails first:
- a CSS rule: a `resolveInBothOrders` assertion in the test file that already covers that surface (for example `chatComposerCss.test.ts`, `textbookImageCss.test.ts` or `components/Sidebar.test.tsx`);
- a contrast pair missing from §4.7: a new `PAIRS` entry in `tokens.test.ts`.

Commit each fix on its own, as `fix(theme): <what> in Night`.

- [ ] **Step 8: The contact sheet**

Copy `$WS/shots/*.png` to `~/Desktop/ai-tutor-redesign/PR2-夜读/`, then write `contact-sheet.html` there:

```bash
cd ~/Desktop/ai-tutor-redesign/PR2-夜读 && python3 - <<'EOF'
import glob, os, re
rows = {}
for f in sorted(glob.glob("*.png")):
    m = re.match(r"(.+)-(\d+)-(paper|night)\.png$", f)
    if m: rows.setdefault((m[1], int(m[2])), {})[m[3]] = f
cells = "".join(
    f"<tr><th>{s}<br>{w}px</th>" + "".join(f'<td><img src="{v.get(k, "")}" loading="lazy"></td>' for k in ("paper", "night")) + "</tr>"
    for (s, w), v in sorted(rows.items()))
open("contact-sheet.html", "w").write(
    "<!doctype html><meta charset=utf-8><title>PR2 Night</title><style>body{font:14px system-ui;margin:16px}"
    "td,th{vertical-align:top;padding:6px}img{max-width:46vw;border:1px solid #ccc}</style>"
    f"<table><tr><th></th><th>Paper</th><th>Night</th></tr>{cells}</table>")
print(len(rows), "rows")
EOF
```

Expected: one row per state and width, with Paper next to Night. Open the sheet for the user.

- [ ] **Step 9: Verify and stop the stack**

Run: `cd frontend && npx vitest run && npx tsc -b && npx vite build`
Expected: all green.

Stop the three processes. Run `git status`. Remove any `backend/data/student_bars/*` file the run created.

Delivery then follows spec §8: a fresh-context final review, then push, the PR and the Vercel preview with the user's go-ahead. The PR body carries a Night preview checklist:
- the signed-in sidebar;
- Grades with real data;
- Auto Grader results;
- the feedback form;
- the Appearance switch, Paper ↔ Bright ↔ Night across a reload.
