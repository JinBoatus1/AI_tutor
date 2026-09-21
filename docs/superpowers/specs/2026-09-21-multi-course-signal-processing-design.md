# Multi-Course Support + Signal Processing (Lathi) — Design Spec

**Date:** 2026-09-21
**Status:** Approved (brainstorming complete; implementation plan to follow)
**Textbook:** B. P. Lathi, *Signal Processing and Linear Systems* (scanned PDF, 432 sheets / 864 book pages)

---

## 1. Goal & Scope

Serve a second course — Signal Processing — from the same deployment that currently
serves FOCS, **without** regressing FOCS.

**In scope**

- A first-class "builtin course" abstraction replacing the hardcoded `focs` special cases.
- Lathi ingested as the second builtin course: outline tree, page-accurate PDF, OCR text layer.
- Learning Mode fully working for SP: per-section Q&A, textbook page images, per-topic memory,
  learning-progress bar.
- Practice mode working for SP: chapter practice sets produced by a build-time generation
  pipeline with automated correctness gates plus human review.

**Out of scope (YAGNI)**

- New practice question formats. The four auto-graded formats transfer as-is (see §3.4).
- Graphical questions ("pick the matching waveform / pole-zero plot"). `McqQuestion.choices`
  is `string[]`; image choices would be a format change. Defer until a real need appears.
- An SP equivalent of `inductionGuide.ts`. FOCS keeps its guide; Lathi ships none in v1.
- Cohort/roster management. Students pick their course from the existing textbook selector.

---

## 2. Current State — Verified Findings

All claims below were checked against the working tree at `8222117`.

### 2.1 Already multi-textbook ready

- `backend/learning_resources.py` carries an `ActiveTextbook` thread-local context
  (`get_effective_raw`, `effective_pdf_page_offset`, `get_effective_pdf_bytes`,
  `effective_memory_book_id`). Chat, PDF page rendering and memory addressing all route
  through it.
- `backend/student_bar_store.py` (617 lines) threads `textbook_id` through every function and
  namespaces paths by it. **The learning-progress bar needs no structural change.**
  One FOCS-specific assumption remains at `student_bar_store.py:239` ("skip chapter 0
  Background") — Lathi's background chapter is `B`, not `0`.
- `backend/api_routes.py:877` already contains an OCR → LLM → outline-JSON pipeline
  (`FOCS_STYLE_OUTLINE_PROMPT_HEAD`) used by the upload flow.

### 2.2 Blocking couplings

- `textbook_id` accepts only `"focs"` or `"user_<id>"`. Uploaded books are stored per user
  email (`backend/user_textbook_store.py`), so there is no notion of a course shared by a
  whole class.
- The tutor prompt hardcodes `"FOCS (Mathematics for Computer Science)"` at
  `api_routes.py:420`, `:556`, `:622`. Uploaded books get the generic
  `"the textbook the student selected"`.
- `GET /api/focs_tree` (`api_routes.py:868`) reads `lr.FOCS_JSON_PATH` directly.
- Practice is FOCS-only and has **no textbook dimension**: `FOCS_PRACTICE_SETS` is keyed by
  chapter token alone. FOCS ch.4 is "Proofs"; Lathi ch.4 is "The Fourier Transform" — they
  would collide.
- Practice attaches to sections literally named `"N.M Problems"`
  (`frontend/src/practice/isProblemsSection.ts:5`). Lathi has no such sections; its last
  section per chapter is `"N.M Summary"`.

### 2.3 The chapter-token assumption (4 sites)

Lathi's first chapter is lettered **B**, not numeric. Four sites assume numeric tokens:

| Site | Code | Behaviour on `"B.1"` |
|---|---|---|
| `frontend/src/utils/sectionNotes.ts:37` | `/^\d+(?:\.\d+)*$/` | returns `null` → notes, vocab and book anchors dead for that section |
| `frontend/src/practice/isProblemsSection.ts:5` | `/^(\d+)\.\d+\s+Problems$/` | rejected → practice cannot attach |
| `frontend/src/data/focsPracticeSets.ts:77` | `Number(a) - Number(b)` | `NaN` → chapter ordering breaks |
| `backend/learning_resources.py` `topic_name_to_memory_address` | `^\d+\.\d+` / `^\d+$` | falls through to a flat address → chapter/section hierarchy lost for all 7 sections of ch. B |

**Resolution:** widen all four to `/^(?:\d+|[A-Z])(?:\.\d+)*$/`.

A naive widening to `[A-Za-z0-9]+` was rejected: `sectionTokenFromTitle` reads the first word
of a title, and Lathi's back matter contains **"Answers to Selected Problems"** and
**"Supplementary Reading"** — `[A-Za-z0-9]+` would accept `Answers` and `Supplementary` as
chapter tokens. Restricting the non-numeric case to a single uppercase letter matches the real
convention for background/appendix chapters and rejects those.

**Safety argument for existing data:** memory addresses are persisted on disk under
`backend/data/memory/<book_id>/`. Every FOCS token is purely numeric, and
`(?:\d+|[A-Z])(?:\.\d+)*` produces byte-identical output for purely numeric input. The widening
therefore cannot move an existing FOCS address. §5 pins this with a test.

### 2.4 The source PDF

Measured, not assumed:

- 432 sheets, 31.5 MB, **zero extractable text on every page** — pure image scan. (Contrast:
  `backend/data/FOCS.pdf` has a text layer, 76 of the first 80 pages extract.)
- **Two book pages per sheet** (A4 landscape, one 2478x3509 image per sheet).
- Page mapping: `sheet = (book_page + 12) // 2`, `half = (book_page + 12) % 2` (0 = left).
  Verified at sheet 20 (pages 28|29) and sheet 380 (pages 748|749) — a 360-sheet span.
- **The gutter is not at the centre and drifts.** Over a 77-sheet sample, after cropping the
  top 10% (the scan carries a full-width black bar from the scanner lid, which defeats naive
  ink projection): detection succeeded on 76/77 sheets — the only failure is sheet 0, the
  cover, which is not a spread. Gutter position: **median 45.9% of width, range 40.0%–56.1%,
  std 3.4%**. Median gap width 36px @72dpi.
  A fixed centre split would cut into body text. **Per-sheet detection is required and works.**
- At least one page raises `overflow in 2d faxd` during render (non-fatal, corrupt CCITT
  image). The pipeline must surface such pages rather than skip them silently.
- Structure: B Background(1), 1 Introduction(51), 2 Time-Domain CT(104), 3 Fourier Series(171),
  4 Fourier Transform(235), 5 Sampling(319), 6 Laplace(361), 7 Frequency Response & Analog
  Filters(471), 8 DT Signals & Systems(540), 9 Time-Domain DT(573), 10 Fourier Analysis of
  DT(617), 11 z-Transform(668), 12 Frequency Response & Digital Filters(716), 13 State-Space(784).
  Back matter: Answers(837), Supplementary Reading(843), Index(844).
  **All 14 chapters are in scope.**

---

## 3. Architecture — Builtin Course Registry

Rejected alternatives: a second set of hardcoded `focs`/`lathi` branches (doubles ~30 special
cases; triples them for a third course), and shipping Lathi through the per-user upload path
(31.5 MB per student, blocked by the 14 MB upload limit, 2-up page images, and **no practice
support at all** — uploads have no practice sets).

### 3.1 Backend

Builtin books get the same three-file shape the upload store already uses, so builtin and
uploaded books become the same kind of object:

```
backend/data/books/
  focs/   meta.json  outline.json  book.pdf   # migrated from FOCS.json / FOCS.pdf
  lathi/  meta.json  outline.json  book.pdf   # split, OCR'd, text-layered
```

`meta.json`:

```json
{ "id": "lathi",
  "display_name": "Signal Processing and Linear Systems (Lathi)",
  "short_label": "Signals",
  "pdf_page_offset": 13,
  "practice_anchor": { "kind": "chapter" } }
```

`focs/meta.json` uses `{ "kind": "problems_section" }`, preserving current behaviour.

New `backend/builtin_books.py`, interface mirroring `user_textbook_store.py`:
`is_builtin`, `load_meta`, `load_outline`, `load_pdf_bytes`, `list_builtin`.

**The single seam** is `learning_resources.py:110` `resolve_textbook_for_request`, which today
branches on `if bid == "focs"`. It becomes: builtin registry → user upload → fall back to
`DEFAULT_BOOK_ID`. This removes the `FOCS_JSON_PATH` / `FOCS_PDF_PATH` / `PDF_PAGE_OFFSET` /
`_load_focs_json_from_disk` / `load_focs_pdf` globals.

Consequential changes:

- Add `GET /api/textbook_tree?id=`; keep `GET /api/focs_tree` as an alias returning the FOCS
  tree so no frontend change is forced and nothing breaks.
- `api_routes.py:420/:556/:622` read `meta.display_name`. This also fixes uploaded books being
  described to the model only as "the textbook the student selected".
- `student_bar_store.py:239` — generalize the "skip chapter 0" rule to "skip the book's
  background chapter", driven by `meta`.

### 3.2 Offline page splitting (not runtime clipping)

`learning_resources.py:638` already supports `get_pixmap(dpi=..., clip=r)`, so half-page
rendering at request time is possible — but it would require a 2-up branch in the renderer, the
page-range fetcher and the text extractor, which is the opposite of collapsing to one path.

**Decision: split offline** into 864 single pages and rebuild a normal PDF, so
`pdf_page_offset` has exactly the same meaning as for FOCS and the runtime gains no branches.

**Offset arithmetic.** The project-wide convention is `pdf_page (1-based) = book_page +
pdf_page_offset` (FOCS uses 15). Splitting **every** sheet uniformly into (left, right), sheet
`s` yields 1-based split pages `2s+1` and `2s+2`; book page `p` lives at sheet `(p+12)//2`,
half `(p+12)%2`, hence split page `2*((p+12)//2) + ((p+12)%2) + 1 = p + 13`. So
`pdf_page_offset = 13`, checked against page 748 -> 761 and 749 -> 762.

This identity holds **only if the cover is split too**, so S1 splits every sheet including
sheet 0 — the cover simply takes a fixed centre cut instead of a detected one. Special-casing
the cover would introduce an off-by-one for the whole book. S2 confirms the offset empirically.

**And embed the OCR output as a hidden text layer in that rebuilt PDF.** Then
`extract_pdf_pages_text()` (`learning_resources.py:649`) works for Lathi **unchanged** — the
backend needs no new text-extraction code, and all OCR complexity stays at build time.

### 3.3 Frontend

New `frontend/src/books/registry.ts`, mirroring the backend `meta.json`:

```ts
export interface BookDef {
  id: string;
  shortLabel: string;
  practiceAnchor: { kind: "problems_section" } | { kind: "chapter" };
  tree: TextbookTreeRoot;
  sectionNotes: Record<string, SectionNote>;
  practiceSets: Record<string, PracticeSet>;
  guides?: GuideScript[];
}
export const BOOKS: Record<string, BookDef>;
export const DEFAULT_BOOK_ID = "focs";
```

Both outline trees stay bundled (`focsTree.json` is 17 KB). This is required, not merely
convenient: `focsSectionOrder.ts` computes a module-level constant from the bundled tree.

`learningTextbooks.ts` — the ~8 `id === "focs"` checks become registry lookups. Two of them are
correctness bugs if missed: `dedupeCatalogById` and `fetchTextbookOptionsFromServer` filter on
`row.id !== "focs"`, so a server-returned `lathi` row would be treated as an upload, then
rejected by `isValidUploadedTextbookId` (which requires a `user_` prefix) and vanish from the
list.

`focsOutlineToCurriculum` is already generic (it only walks the tree) and is renamed
`outlineToCurriculum`.

Fix the user-visible typo **"FCOS" → "FOCS"** (`learningTextbooks.ts` `linkLabel`,
`api_routes.py:966`). Harmless while there is one book; conspicuous once two labels sit side
by side.

### 3.4 Practice gains a book dimension

The four auto-graded formats **transfer to Signal Processing unchanged**:

- `proof-order` is dependency-graph step ordering (`deps` + topological grading), not
  proof-specific — "order the steps of a convolution" or "of an inverse-Laplace partial
  fraction expansion" fits directly.
- `spot-flaw` ("click the invalid line") suits SP especially well: wrong ROC, a dropped
  `1/2pi`, a sign error in time-shift or time-reversal.
- `mcq` and `fill-blank` need no comment.

Changes:

- Split `data/focsPracticeSets.ts` into `data/practice/focs/index.ts` (existing 29 chapters,
  moved verbatim) and `data/practice/lathi/index.ts` (14 new chapters).
- `getPracticeSet(chapter)` becomes `getPracticeSet(bookId, chapter)`. Call sites:
  `LearningModel.tsx:448`, `PracticePanel.tsx:32` (the latter takes `bookId` as a prop).
- `FOCS_PROBLEM_CHAPTERS` becomes `problemChaptersFor(bookId)`, driven by `practiceAnchor`:
  `problems_section` runs the existing regex over the tree (FOCS unchanged); `chapter` takes
  every top-level chapter token (Lathi).
- Replace the `Number(a) - Number(b)` sort with a comparator placing non-numeric tokens before
  numeric ones (`B` before `1`), numeric ascending otherwise.
- `focsSectionNotes.ts` is reached through `BOOKS[id].sectionNotes` rather than imported directly.
  The file stays at its current path in PR1 — the registry indirection is what makes notes
  per-book, so renaming a 29 KB file buys nothing yet. Introduce `data/notes/` in PR4, when
  Lathi's generated notes (§4 S8) land beside it.
- `inductionGuide.ts` and `onboardingDemoSection.ts` become optional `BOOKS[id].guides`. Lathi
  ships none, so the guide entry point simply does not render for SP.

Frontend files touched: ~10, the largest being `LearningModel.tsx` (1780 lines, importing five
FOCS-specific modules).

---

## 4. Content Pipeline

Build-time only, under `scripts/books/lathi/`, reusing `deps.create_chat_completion`. Outputs
are static files committed to the repo. The frontier model is used throughout (decision:
quality first); every stage caches by input hash so reruns are cheap.

| Stage | Output | Gate |
|---|---|---|
| **S1 split** | 864 single pages | per-sheet gutter detection (crop top 10% first); require near-zero ink in the gap and gap width >= 14px; sheets failing either go to a manual queue, never a blind cut; **every sheet is split, including the cover** (fixed centre cut) so the offset identity in §3.2 holds with no exceptions; render errors (e.g. the `2d faxd` page) reported |
| **S2 pagination** | verified `pdf_page_offset` | OCR only the header/footer strip; assert printed page numbers increase by exactly 1 across the book |
| **S3 outline** | `outline.json` | vision over TOC sheets 5–6; assert starts strictly increasing, each section inside its chapter `_range`, last chapter ends at 836, chapter/section counts match the TOC; one human pass |
| **S4 text layer** | `book.pdf` with hidden text | per-page vision OCR to Markdown+LaTeX, cached by page hash; flag pages whose text length is wildly inconsistent with ink density |
| **S5 practice gen** | `data/practice/lathi/*.ts` | generated against `types.ts`, few-shot from existing FOCS sets |
| **S6 validation** | review queue | see below |
| **S7 human review** | committed sets | queue ordered by risk: flagged first, sympy-unverifiable next, clean last |
| **S8 notes gen** | `data/notes/lathi.ts` | same gate shape, lighter |

### S6 — the correctness gates

This is what "quality first" buys, and it is precisely what FOCS lacked: FOCS practice content
was hand-written and audited only afterwards
(`2026-07-14-practice-content-audit-design.md`), by which time real defects had shipped —
ambiguous options, two correct MCQ choices, a strong-induction off-by-one.

1. **Type gate** — `tsc --noEmit`.
2. **Structural gate** — `proof-order` `deps` form a DAG with all referenced ids present;
   `spot-flaw` `flawLineId` is in `lines`; `fill-blank` `accept` non-empty; `mcq`
   `answerIndex` in range **and all choices pairwise distinct**.
3. **Independent-solve gate** — a different model answers each `mcq` / `fill-blank` cold, with
   no answer key. Disagreement flags the item for human review. This targets exactly the class
   of defect the FOCS audit found.
4. **Symbolic gate (sympy)** — Signal Processing's structural advantage over FOCS: proof
   validity is not machine-checkable, but SP answers largely are (Laplace/z transforms,
   partial fractions, convolutions, pole locations, DTFT of standard signals). The generator
   must emit a machine-checkable `check` expression wherever the answer is computable; items
   failing sympy are rejected before any human sees them.
5. **Dedup** across chapters.

---

## 5. Testing

- FOCS regression: existing vitest and pytest suites stay green. `focsPracticeSets.test.ts`
  changes signature (`getPracticeSet("focs", "4")`) and gains a Lathi mirror.
- **Memory-address invariance test** — asserts `topic_name_to_memory_address` output is
  byte-identical before and after the regex widening for every FOCS topic. This is the only
  change that touches already-persisted data (§2.3).
- Token regex table test: accept `4`, `4.1`, `B`, `B.1`; reject `Answers`, `Supplementary`.
- Registry resolution tests, backend and frontend.
- Page-mapping golden test (book page -> PDF page, post-split).
- CI content lint: run the S6 gates over the committed Lathi sets.

---

## 6. Deliverables & Phasing

| PR | Contents | State on merge |
|---|---|---|
| **1** | registry both sides; FOCS migrated into `books/focs/`; 4 token sites widened; FCOS→FOCS; prompts de-hardcoded; `/api/textbook_tree` | Zero behaviour change **for FOCS**, proven byte-for-byte, plus two intentional changes affecting **uploaded** books only: (a) practice no longer falls back to FOCS's sets for a book that is not a registered builtin, and (b) the widened chapter token can re-address an uploaded book's memory for a lettered chapter (`"A Appendix"` / `"A.1 Foo"` moves from flat `A_1_Foo` to nested `A_Appendix/A_1_Foo`). Reviewable on its own; contains no Lathi content |
| **2** | S1–S4 → `books/lathi/` | **SP students can use it**: per-section Q&A, textbook pages, progress bar. Practice hidden for Lathi |
| **3** | S5–S7 scripts and gates + first reviewed chapters | Practice opens for SP |
| **4** | remaining chapters + notes | Rolling completion |

---

## 7. Acceptance Criteria

1. FOCS behaves identically before and after PR1 — all existing tests green, and no FOCS memory
   address changes by a single byte.
2. A student selecting Signals gets a tutor that names the right book, answers against Lathi
   content, and shows the correct single book page (not a 2-up spread) for any section.
3. `sheet = (book_page + 12) // 2` is verified by S2 across all 864 pages, or the deviations are
   enumerated and handled.
4. Every committed Lathi practice item passes all S6 gates, and every item that reached a
   student was seen by a human.
5. Adding a third course requires a `books/<id>/` directory and one registry entry on the
   backend. On the frontend it also needs three edits: a `TREE_FILE` entry in
   `frontend/scripts/sync-focs-tree.mjs`, a `BOOKS` entry, and a static JSON import — no new
   conditionals.

---

## 8. Open Risks

- **OCR fidelity on dense math.** A formula misread at S4 propagates into chat grounding,
  practice generation and notes. Mitigated by the sympy gate for practice, but chat grounding
  has no equivalent check. Spot-check formula-dense pages during S4 review.
- **API cost.** 864 vision OCR pages plus generation plus the independent-solve gate. Caching by
  page hash keeps reruns cheap, but the first full pass is a real spend on the lab's account.
- **Lathi content is lab-adjacent IP.** The scanned textbook is copyrighted; it is committed to
  a private repo exactly as `FOCS.pdf` already is. Confirm with the PI before any public
  distribution.
- **`LearningModel.tsx` is 1780 lines** and imports five FOCS-specific modules. Threading
  `bookId` through it is the highest-regression-risk edit in PR1.
