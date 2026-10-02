# Paper & Ink Theme: Design Spec

**Date:** 2026-10-01
**Status:** Draft for review. The design was approved section by section in conversation on 2026-10-01.
**Branch:** `feat/paper-ink-theme`, from `function` at `956eda9`.
**Design source:** mockup A, "Paper & Ink", chosen by the team from three directions. The mockup files stay outside the repo because one embeds a page of a copyrighted textbook. Every value this spec needs from them is copied into §4.

---

## 1. Goal

Re-skin the AI Tutor app in the Paper & Ink language:

- warm paper surfaces;
- a serif reading voice;
- one deep ink-teal accent for interactive and current elements;
- a red bookmark ribbon for the current section.

This is a visual change. Layout, behavior and data stay as they are, except for the four layout changes marked **Layout change** in §5.

**Success criteria**

1. Every route except Home renders in Paper & Ink. A reasonable person comparing before and after sees the same features in the same places, restyled.
2. The Appearance setting offers Paper & Ink variants: Paper and Bright in PR1, then Night in PR2. The saved choice applies before first paint and survives reloads.
3. All text meets WCAG 2.2 AA in every variant: 4.5:1 for body text, 3:1 for large text, component boundaries and meaningful icons. Automated tests prove it.
4. Outside `tokens.css`, no stylesheet or component hard-codes a color, except for the documented exceptions in §7.2. A test enforces this.
5. Every existing frontend test, the type check and the build pass. The backend is untouched.

## 2. Decisions

These were made with the user on 2026-10-01.

| # | Decision | Why |
|---|---|---|
| D1 | This round is a whole-app restyle, styles only. Features that need new data or logic come later, as small PRs (§9). | Mixing behavior changes into a restyle makes both hard to review and test. |
| D2 | Home is deferred and stays exactly as it is. Two Home mockups ("Editorial" and "Scrapbook, re-inked") are with the team. | Home's scrapbook look differs sharply from Paper & Ink, and the team wants time to choose. |
| D3 | The six Appearance presets become three Paper & Ink variants: Paper (default), Bright and Night. Night is a real dark theme and ships in PR2. | The old presets repaint only two surfaces, and they would clash with Paper & Ink. The old "Dark" and "Black" never made text light. |
| D4 | Old saved presets map on read: default, warm and mint become `paper`; white becomes `bright`; dark and black become `night`, or `paper` until PR2 ships. Storage is not rewritten on read. | Users keep their intent. Not rewriting storage lets dark/black users land in Night automatically once PR2 ships. |
| D5 | The top sign-in banner is removed. Its message becomes one line above the sidebar's Sign in button. | All three mockups dropped it to give the textbook and chat their height, and the prompt survives in the sidebar. |
| D6 | Approach: one semantic token layer (`styles/tokens.css`), with every in-scope stylesheet migrated to it. | One source of truth. Variants become token sets, and Night is only feasible this way. An override layer or a framework rewrite were rejected. |
| D7 | Delivery: PR1 is the token system, Paper, Bright and every surface. PR2 is Night. The team reviews each on a Vercel preview, and the user merges. | PR1 is already large. Night needs its own pass over every surface. |
| D8 | The unused components `ChatHistory`, `GooeyNav` and `IridescenceBackground` are deleted, with their stylesheets. The Outfit font link goes too; only `ChatHistory.css` used it. | Nothing renders them, and migrating dead CSS is waste. |
| D9 | Handwriting (Caveat) disappears from the app: four uses, in Chat, Grades (2) and Practice. Each becomes Newsreader italic. Home keeps its own. | The Paper & Ink voice is typeset, not handwritten. |

## 3. Scope

**In scope (PR1):**

- The stylesheets `App.css`, `Chat.css`, `AutoGrader.css`, `UserProfile.css`, `MyLearningBar.css`, `SignInModal.css`, `Grades.css`, `practice/Practice.css`, `feedback/FeedbackModal.css`, `components/Sidebar.css`, `components/OnboardingTour.css` and `index.css`. Together they hold about 630 hex and 220 `rgb()`/`rgba()` color literals today.
- The inline colors in `LearningModel.tsx` (2), `UserProfile.tsx` (1) and the decorative SVG in `SignInModal.tsx`.
- In `LearningModel.tsx`: the textbook header markup (§5.3), and the pager element's position if CSS alone cannot move it.
- `profile/profileSettings.ts`, `context/ProfileSettingsContext.tsx` and the Appearance card in `UserProfile.tsx`.
- `App.tsx`, to remove the banner, and `components/Sidebar.tsx`, for the sign-in line.
- `index.html`, for font links and the no-flash script.
- `i18n/messages.ts`, for the copy changes in §6.

**Out of scope:**

- Home (`Home.tsx`, `Home.css`).
- Backend.
- Any new UI data or behavior (§9).
- Renaming class names.

## 4. Design tokens

### 4.1 File and loading

- `frontend/src/styles/tokens.css` holds every color, font stack, type size, spacing step, radius and shadow. `main.tsx` imports it first, before any other stylesheet.
- `:root` carries the Paper values. `[data-theme="bright"]` and `[data-theme="night"]` on `<html>` override colors, shadows and the page-image filter only. Type, spacing and radii are shared by all variants.
- `index.html` adds one Google Fonts link with `display=swap`:
  - Newsreader: optical sizes 6–72, weights 400–700, italic 400–600;
  - Inter: 400, 500, 600;
  - IBM Plex Mono: 400, 500.
- The existing DM Serif Display, DM Sans, DM Mono and Caveat link stays until Home is redone. Browsers download a face only when rendered text uses it.

### 4.2 Color tokens

| Token | Role | Paper | Bright | Night |
|---|---|---|---|---|
| `--desk` | Recessed center work surface under the textbook page | `#e9e3d7` | `#ecebe8` | `#141210` |
| `--desk-hi` | Lamp-light falloff on the desk (gradient top) | `#efeae0` | `#f1f0ed` | `#191713` |
| `--parch` | Sidebar | `#f4efe6` | `#f6f5f2` | `#1c1916` |
| `--paper` | Chat panel, page backgrounds | `#faf7f1` | `#fcfbfa` | `#201d19` |
| `--sheet` | Raised objects: cards, active items, inputs | `#fffdf8` | `#ffffff` | `#2a2621` |
| `--track` | Recessed controls: segmented tracks, tags, code | `#ebe4d7` | `#ecebe7` | `#171512` |
| `--rule` | Decorative hairlines | `#e3dbcc` | `#e5e3de` | `#2e2a24` |
| `--rule-2` | Card edges | `#d9cfbe` | `#d9d6cf` | `#3a352e` |
| `--rule-input` | Input boundaries (at least 3:1) | `#918777` | `#8c887f` | `#857b6d` |
| `--ink` | Headings, primary text | `#1e1a15` | `#1e1a15` | `#efe9de` |
| `--ink-body` | Long-form reading text | `#2a251e` | `#2a251e` | `#e4ddd0` |
| `--ink-2` | Secondary text, labels | `#4a4338` | `#4a4338` | `#c4bbab` |
| `--ink-3` | Meta text: page numbers, eyebrows | `#6a6154` | `#68625a` | `#a69d8e` |
| `--ink-4` | Non-text marks only, never text | `#8a8070` | `#8a8479` | `#7e7568` |
| `--teal` | Interactive text, icons, links | `#0f5e57` | `#0f5e57` | `#6bbcae` |
| `--teal-fill` | Solid button background | `#0f5e57` | `#0f5e57` | `#21766b` |
| `--on-teal` | Text on `--teal-fill` | `#fffdf8` | `#ffffff` | `#f6f2ea` |
| `--teal-press` | Hover and pressed fill | `#0b4a45` | `#0b4a45` | `#1c665d` |
| `--teal-line` | The tutor's margin rule | `#1a7268` | `#1a7268` | `#4fa596` |
| `--teal-edge` | Outlined-control boundary (at least 3:1) | `#5f948b` | `#5f948b` | `#4f9488` |
| `--teal-tint` | Selected, chip and suggestion background | `#e5ebe5` | `#e6efec` | `#1d2f2b` |
| `--ribbon` | The current-section bookmark, nothing else | `#b4432b` | `#b4432b` | `#d9694f` |
| `--ribbon-fold` | The ribbon's fold shade | `#8c3220` | `#8c3220` | `#a84a35` |
| `--danger` / `--danger-tint` | Errors (always with an icon or text) | `#a3283a` / `#f7e4e4` | `#a3283a` / `#f8e6e7` | `#f0909b` / `#3a2125` |
| `--success` / `--success-tint` | Success, passed criteria | `#2e6b3c` / `#e4efe2` | `#2e6b3c` / `#e5f0e6` | `#86c595` / `#1e3324` |
| `--warning` / `--warning-tint` | Warnings | `#7f5208` / `#f5ead2` | `#7f5208` / `#f6edd8` | `#e2b763` / `#382d16` |
| `--focus` | Focus outline color | `var(--teal)` | `var(--teal)` | `var(--teal)` |
| `--scrim` | Modal overlay | `rgba(30,26,21,.45)` | `rgba(30,26,21,.40)` | `rgba(0,0,0,.60)` |
| `--selection` | Text selection background | `var(--teal-tint)` | `var(--teal-tint)` | `#2c4741` |
| `--page-image-filter` | Filter on scanned textbook page images | `none` | `none` | `brightness(.86) sepia(.06)` |

Paper equals mockup A's values. `--teal-fill`, `--on-teal`, the status colors, `--focus`, `--scrim`, `--selection` and `--page-image-filter` are new. Night needs a lighter teal for text but a darker teal for fills, which is why `--teal` and `--teal-fill` are separate.

### 4.3 Type, spacing, radii and shadows

- **Stacks:**
  - `--serif`: `"Newsreader","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`. Used for display, section titles, tutor answers and long-form text.
  - `--sans`: `"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif`. Used for UI.
  - `--mono`: `"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace`. Used for page numbers, counts and route tags.
  - `--math`: `"STIX Two Math","Cambria Math","Latin Modern Math",serif`. Used for operator glyphs outside KaTeX.
- **Sizes:** `--fs-xs` 11, `--fs-sm` 12, `--fs-ui` 13, `--fs-base` 14, `--fs-read` 16, `--fs-lead` 18, `--fs-title` 26, `--fs-display` 40 and `--fs-hero` 64, in px. Line heights sit on a 4px grid.
- **Spacing:** `--s1`–`--s8` are 4, 8, 12, 16, 20, 24 and 32px (there is no `--s7`). `--s10`, `--s12` and `--s16` are 40, 48 and 64px.
- **Radii:** `--r-paper` 2px (paper objects), `--r1` 6px, `--r2` 10px, `--r3` 16px and `--pill` 999px.
- **Shadows**, in three levels:
  - Paper uses warm umber, from mockup A:
    - `--sh-raised: 0 0 0 1px rgba(74,56,26,.08), 0 1px 2px rgba(74,56,26,.08)`
    - `--sh-float: 0 0 0 1px rgba(74,56,26,.09), 0 2px 4px rgba(74,56,26,.06), 0 14px 32px -10px rgba(74,56,26,.30)`
    - `--sh-sheet: 0 0 0 1px rgba(74,56,26,.07), 0 1px 1px rgba(74,56,26,.06), 0 4px 8px -2px rgba(74,56,26,.08), 0 16px 32px -12px rgba(74,56,26,.18), 0 40px 80px -32px rgba(74,56,26,.30)`
  - Bright uses the same geometry with `rgba(40,36,30,a)` and each alpha × 0.9.
  - Night uses the same geometry with `rgba(0,0,0,a)` and each alpha × 4, capped at .6.

### 4.4 Variant mechanism

- **Settings module:** `profileSettings.ts` exports `ThemeId = "paper" | "bright" | "night"`, `THEME_OPTIONS`, `readTheme()`, `writeTheme(id)` and `applyTheme(id)`.
  - `applyTheme` sets `document.documentElement.dataset.theme`. For Paper it removes the attribute.
  - The storage key stays `ai_tutor_profile_settings`. New writes store `{ "theme": id }`.
  - `readTheme()` accepts the legacy `{ "pageBackground": … }` and maps it per D4. A valid `theme` wins. Anything unreadable means `paper`.
- **Gating Night:** a constant `NIGHT_AVAILABLE` is `false` in PR1 and `true` in PR2. While it is false, Night is neither offered nor applied, and dark/black map to `paper`.
- **No flash:** a small inline script in the `<head>` of `index.html` runs before any CSS paints. It reads the same key, applies the same mapping and sets `data-theme`.
  - A test keeps its mapping table identical to `profileSettings.ts` (§7.2).
  - The old `--app-page-bg` and `--app-chat-panel-bg` variables are retired.

### 4.5 Usage rules

- Teal marks interactive and current elements only. Static information is ink, never teal.
- `--ribbon` appears in exactly one place: the current section in the sidebar outline.
- Status colors never carry meaning alone. Each comes with an icon or a word.
- Use `--ink-4` only for non-text marks.
- Components reference tokens only. Any new color starts in `tokens.css`.

### 4.6 Night specifics (PR2)

- Scanned textbook pages are never inverted, because inversion ruins figures. They get `--page-image-filter` and sit on the dark desk like a lit sheet.
- Shadows deepen (§4.3), and elevation reads through the lighter `--sheet`.
- KaTeX, markdown and SVG icons inherit `currentColor` or tokens.
- Charts and decorative SVG use tokens.
- The values in §4.2 are the starting point. PR2 may tune Night only within the contrast rules of §4.7.

### 4.7 Contrast requirements

These are the worst case across the listed surfaces, computed with the WCAG 2.2 formula:

| Pair | Surfaces | Minimum | Paper | Bright | Night |
|---|---|---|---|---|---|
| `--ink`, `--ink-body`, `--ink-2`, `--ink-3` text | desk, desk-hi, parch, paper, sheet, track | 4.5 | ink-3 4.76 | ink-3 5.05 | ink-3 5.61 |
| `--teal` text | the six surfaces and teal-tint | 4.5 | 5.96 | 6.38 | 6.31 |
| `--on-teal` on `--teal-fill` / on `--teal-press` | | 4.5 | 7.49 / 9.93 | 7.61 / 10.10 | 4.86 / 6.05 |
| `--teal-fill` against `--desk` | | 3.0 | 5.96 | 6.38 | 3.44 |
| `--teal-edge`, `--rule-input` | parch, paper, sheet | 3.0 | 3.01, 3.09 | 3.16, 3.24 | 4.24, 3.61 |
| `--ink-4` marks | parch, paper, sheet | 3.0 | 3.39 | 3.40 | 3.31 |
| `--ribbon` | sheet, parch | 3.0 | 4.85 | 5.10 | 4.35 |
| `--danger`, `--success`, `--warning` text | sheet, paper, own tint | 4.5 | ≥5.40 | ≥5.46 | ≥6.44 |

## 5. Surfaces

Each section names the restyle. Structure stays as it is unless a change is marked **Layout change**.

### 5.1 Global

- **Body:** text in `--ink` with `--sans`.
- **Focus:** `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`.
- **Other:** `::selection` uses `--selection`, modal overlays use `--scrim`, and scrollbars are thin and warm, on `--rule-2`.
- **Mixed-content banner:** the deploy-config warning (`.deploy-config-banner`) uses `--danger` on `--danger-tint`.
- **Layout change:** the top sign-in banner (`.auth-prompt` in `App.tsx`) is removed, with its `bannerDismissed` state and CSS (§5.2).

### 5.2 Sidebar (`Sidebar.css`, `MyLearningBar.css`)

- **Frame:** `--parch` with a right hairline in `--rule`, replacing the navy slab. The brand is a Σ tile in `--teal-fill` with `--on-teal`, plus "AI Tutor" in `--sans` 600.
- **Nav:** the active item is a `--sheet` card with `--sh-raised` and `--teal` text. The others are `--ink-2`. Group labels are 11px uppercase in `--ink-3`.
- **Learning progress outline:**
  - Chapter titles use `--serif`.
  - A learned section shows an ink check; an unlearned one shows a hollow `--ink-4` circle. The click toggles exactly as today.
  - The current section is a `--sheet` card with the `--ribbon` bookmark.
  - The Learned / Not learned legend stays.
- **History:** restyled to the same palette.
- **Footer:**
  - Feedback; then, when signed out, the new one-line prompt (§6) in `--ink-3` above the Sign in button, now outlined in `--teal-edge` with `--teal` text.
  - When signed in, the avatar and name as today.
- **Collapsed rail and Tour button:** restyled; the Tour button is outlined.
- **Layout change:** the sign-in prompt line in the footer.

### 5.3 Textbook panel (`App.css`, `Chat.css` panel rules, `LearningModel.tsx`)

- **Desk:** the background is `--desk` with a `--desk-hi` top falloff.
- **Page images:** `--r-paper` corners, `--sh-sheet` and `--page-image-filter`.
- **Layout change: header (`.left-panel-topic-bar`).** It changes from one inline line into a small stack, as in mockup A:
  - The existing "Textbook" prefix becomes a small uppercase label in `--ink-3`. That needs one new span around `t("learning.textbook")`.
  - The section name sits below it in `--serif` at `--fs-title` (26px / 32px), wrapping on narrow panels.
  - A meta line follows: the book's existing link label from `readTextbookOptionList()`, matched on `dataMatchedTopic.bookId`, in `--serif` italic; then `·` and the page range in `--mono`, all in `--ink-3`.
  - Report a problem, Note and Hide become icon + text ghost buttons in `--ink-2`, turning `--teal` on hover.
  - Class names are added, never renamed.
- **Layout change: floating pager.** The toolbar `.section-pages-nav`, which holds the zoom group and the paging group, becomes a pill centered at the bottom of the page box, on `--sheet` with `--sh-float`, as in mockup A.
  - Today it sticks to the top (`position: sticky; top: 0`) so it stays visible while a long page scrolls. It now sticks to the bottom edge instead, keeping that property.
  - Controls, their order, their handlers and `data-no-drag` stay the same.
  - It moves visually through CSS (`order` in the page box's flex column) if possible. Otherwise the same element moves after the page image in `LearningModel.tsx`.
  - The pill must never cover the last line of a page, so the page box gains bottom padding equal to the pill's height plus `--s4`.
- **Other parts:** the "In the book" callout becomes a `--teal-tint` label with a `--teal` arrow. The section-note split, resize handles, the image lightbox and the practice panel move to tokens. Practice's `--pr-*` variables are removed.

### 5.4 Chat panel (`Chat.css`)

- **Panel:** `--paper`.
- **Header:** a new "Tutor" title (§6) in `--serif` beside the existing "Start a new session" button, which keeps its label and becomes an outline button (`--teal-edge`, `--teal`).
- **Welcome:** the existing "Try an example" prompts become outlined `--teal` rows. They keep the same static content.
- **Student message:** a right-aligned `--sheet` card with a `--rule-2` edge, in `--sans` and `--ink-body`.
- **Tutor answer:**
  - Body text in `--serif` at `--fs-read` (16px / 24px) in `--ink-body`, with a 2px `--teal-line` margin rule and a small Σ seal.
  - Markdown headings render as `--fs-sm` (12px) uppercase labels in `--sans` 600, letter-spacing .08em, in `--ink-2`.
  - Lists use tabular numerals; code uses `--track` with `--mono`; tables use `--rule` hairlines; links use `--teal` with an underline.
  - KaTeX inherits ink.
- **Loading:** the skeleton lines and spinner use `--rule-2` and `--teal`.
- **Composer:** a `--sheet` input with `--rule-input` and `--r2` corners. The attach and screenshot icons are `--ink-3`, and send is a round `--teal-fill` button.

### 5.5 Grades (`Grades.css`)

- The report-card layout stays.
- The canvas and cards move to tokens. The standing mark uses `--serif` at `--fs-hero`, and figures use `--mono`.
- The two Caveat margin notes become `--serif` italic in `--teal-line`.
- Any chart or bar colors come from tokens.

### 5.6 Auto Grader (`AutoGrader.css`)

- The two drop zones are `--sheet` cards with a dashed `--rule-input` border. The primary action uses `--teal-fill`.
- Criterion results use `--success` and `--danger`, each with an icon and text.

### 5.7 Profile and Appearance (`UserProfile.css`, `UserProfile.tsx`)

- Each settings section is a `--sheet` card on `--paper`.
- The Appearance card shows one preview tile per available variant: two in PR1, three in PR2.
  - Each tile is a small sidebar, page and chat sketch scoped with its own `data-theme`, so it needs no hard-coded colors.
  - The tiles form a radiogroup, keep the existing ARIA and keyboard behavior, and use the new copy (§6).
- The textbook error message's inline `#c62828` becomes the `.profile-error` class in `--danger`.

### 5.8 Modals and onboarding

- **Sign-in modal:** the brand panel becomes `--parch`, with the Σ tile and the serif tagline. Its decorative SVG uses tokens at low alpha. The form sits on `--sheet`, with the primary action in `--teal-fill` and provider buttons outlined. The Google logo keeps its official colors.
- **Feedback modal:** its hard-coded `#0f766e` and grays become tokens.
- **Onboarding tooltip:** a `--sheet` card with `--sh-float`, a serif title and a `--teal-fill` Next button.

### 5.9 Mobile

The existing breakpoints and responsive behavior stay. Only paint properties change. The floating pager also fits phone widths.

## 6. Copy changes (en / zh / es)

| Key | en | zh | es |
|---|---|---|---|
| `sidebar.signInPrompt` (new) | Sign in to save chats & track progress | 登录后可保存对话、同步学习进度 | Inicia sesión para guardar tus chats y tu progreso |
| `chat.tutorTitle` (new) | Tutor | 导师 | Tutor |
| `theme.paper` (new) | Paper | 纸 | Papel |
| `theme.bright` (new) | Bright | 亮白 | Claro |
| `theme.night` (new, PR2) | Night | 夜读 | Noche |
| `profile.appearanceDesc` (changed) | Choose how AI Tutor looks. Every option keeps text easy to read. | 选择 AI Tutor 的外观。每个选项都保证文字清晰易读。 | Elige el aspecto de AI Tutor. Todas las opciones mantienen el texto fácil de leer. |
| `profile.appearanceGroup` (changed) | Theme | 主题 | Tema |

`theme.default`, `theme.mint`, `theme.dark`, `theme.warm`, `theme.white`, `theme.black` and `theme.titleSuffix` are removed. The banner's hard-coded English string goes with the banner.

## 7. Testing and verification

### 7.1 Change boundary

- Edits change paint properties: color, background, border color, shadow, font and radius.
- Structural properties stay as they are: `display`, `position`, sizes, `overflow`, `z-index` and breakpoints. The exceptions are the four changes marked **Layout change** in §5.1–5.3: the banner removal, the sidebar sign-in line, the textbook header and the floating pager.
- No class name is renamed.

### 7.2 New automated tests (vitest)

1. **`styles/tokens.test.ts`**
   - Parses `tokens.css` and computes every pair in §4.7 for every variant. It fails if a pair drops below its minimum.
   - It also fails if Night does not override every color token that `:root` defines, so a dark surface can never inherit a light value.
2. **`styles/noHardcodedColors.test.ts`**
   - Scans `frontend/src/**/*.css` and `*.tsx` for color literals: hex, `rgb()`, `rgba()`, `hsl()` and named colors in style positions.
   - It excludes `styles/tokens.css`, `Home.css`, `Home.tsx` and test files.
   - It allows `transparent`, `currentColor`, `inherit` and `none`. The Google logo paths in `SignInModal.tsx` are an explicit exception.
   - It starts with a pending-files list. Each migration step removes its file, and the final step asserts the list is empty.
3. **`profile/profileSettings.test.ts`**
   - The legacy mapping from D4, with Night gated by `NIGHT_AVAILABLE`.
   - A valid `theme` wins.
   - Garbage maps to `paper`.
   - `readTheme` does not write storage.
   - `applyTheme` sets and removes `data-theme`.
4. **`indexHtmlThemeScript.test.ts`:** extracts the inline script's mapping from `index.html` and asserts it equals `profileSettings.ts`'s.
5. **`UserProfile` Appearance:** renders the available variants as radios with the new labels, and selecting one applies and persists it.
6. **Sign-in prompt:**
   - Signed out: `App` renders no `.auth-prompt`, and the sidebar shows the prompt and Sign in.
   - Signed in: no prompt.

### 7.3 Visual and functional review

This is done with the gstack browser, against a local frontend and backend.

- **Screenshots:** before (`function`) and after (branch), at 1440×900 and 390×844, in Paper and Bright, plus Night in PR2. The states:
  - Learning on first visit (tour step 1);
  - a FOCS 1.1 and a Signals §2.4 section open;
  - an empty chat;
  - a chat with an answer;
  - the sidebar expanded and collapsed;
  - Grades, Auto Grader and Profile;
  - the sign-in modal.

  The results go into one side-by-side contact sheet for the user.
- **Chat answers:** come from a local fake OpenAI-compatible server returning a fixed markdown answer with headings, a list, code and math. No paid API calls.
- **Contrast:** axe's color-contrast rule runs on each screen, and the target is zero violations.
- **Click-through:** open a section, page through it, zoom, hide and show panels, drag the resize handles, toggle learned, step through the tour, open the sign-in modal, use both feedback entry points, and switch theme then reload.

### 7.4 Preview checklist (signed-in states)

Local runs have no Firebase config, so the PR includes a checklist for the user or team on the Vercel preview. Check each in Paper and Bright:

- the signed-in sidebar, with avatar and history;
- Grades with real data;
- Auto Grader results;
- the feedback form;
- the Appearance switch.

### 7.5 Existing suites

All 442 frontend tests, `tsc -b` and `npm run build` pass. `textbookZoomCss.test.ts` guards structural zoom rules in `Chat.css` that this change does not touch.

## 8. Delivery

**PR1**, as commits that each leave the app working:

1. Tokens, fonts and the two guard tests (with the pending list).
2. Global styles and the sidebar, including the sign-in prompt and the banner removal.
3. Textbook panel, including the floating pager.
4. Chat panel.
5. Grades, Auto Grader, Profile and the Appearance switch with Paper and Bright.
6. Modals and onboarding.
7. Deleting the dead components and the Outfit link. The pending list is now empty.

**PR2:** the Night tokens tuned, `NIGHT_AVAILABLE = true`, a per-surface Night pass, and Night screenshots.

The first implementation plan covers PR1 only. PR2 gets its own short plan once PR1 has merged.

**Process:**

- spec → plan → execution, with test-first for logic, and the guards plus screenshots for styles;
- a fresh-context final review;
- push, open the PR and get the Vercel preview;
- the team reviews, and the user merges.

**Rollback:** both PRs are frontend-only and store nothing server-side. Reverting the merge commit redeploys the previous look.

## 9. Follow-ups (not in this work)

- Home redesign, once the team picks "Editorial" or "Scrapbook, re-inked".
- Features from mockup A:
  - the FOCS / Signals segmented switcher in the sidebar;
  - chapter progress counts and "N sections left";
  - the "Reading along · §x" chat header;
  - section-aware follow-up suggestions;
  - citation chips on answers;
  - the composer's page chip.
- Possibly a "follow system" theme option once Night has proven itself.

## 10. Risks

| Risk | Mitigation |
|---|---|
| A paint-only edit still shifts layout (font metrics differ between DM Sans and Inter). | Screenshot review at two widths; structural properties stay untouched (§7.1). |
| The floating pager covers page content on short viewports. | Bottom padding rule (§5.3); checked at 390×844 and on a short window. |
| Users miss Mint or the old Dark. | D4 maps everyone to the nearest variant. Night arrives in PR2 for dark/black users. |
| Night's thin margins: `--teal-fill` against `--desk` is 3.44. | The tokens test enforces the minimums. PR2 tunes within them. |
| Google Fonts slow first paint. | `preconnect` plus `display=swap`; the fallback stacks are metrically close serif and sans faces. |
