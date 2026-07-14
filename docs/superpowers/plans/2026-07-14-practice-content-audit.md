# 29-Chapter Practice Content Correctness Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find and fix mathematical and quality defects in the hand-authored practice content for all 29 FOCS chapters, backed by an adversarial multi-agent audit.

**Architecture:** Two layers. Layer 1 extends the existing structural vitest with the two mechanical checks it lacks (id-uniqueness, LaTeX balance) — a permanent regression guard. Layer 2 runs a `Workflow` pipeline (per-chapter audit → per-defect adversarial refute+fix-check) that returns a *verified defect ledger*; workflow agents read only. The main loop then applies the confirmed fixes chapter-by-chapter, re-running tests after each.

**Tech Stack:** TypeScript, React, vitest 3 (frontend), the `Workflow` multi-agent tool, `/browse` for smoke tests.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-14-practice-content-audit-design.md`.
- **Branch:** `feat/practice-content-audit` (already cut from `origin/function`; spec committed as `b4be6b8`).
- **Content files:** `frontend/src/data/practice/chapter04.ts` (ch 4) and `chapters01to10.ts` (ch 1,2,3,5,6,7,8,9,10), `chapters11to20.ts` (ch 11–20), `chapters21to29.ts` (ch 21–29). Item shapes: `frontend/src/practice/types.ts`.
- **Confidence bar for a fix:** apply a **hard** defect only when Stage-2 returned `verdict === "confirmed" && fixOk === true`; apply a **soft** defect only when `confirmed` AND the item is genuinely misleading (no style churn).
- **Non-goals:** no file-structure refactor; no new items; no proof-order gap-fill in ch 21,23–29; no textbook-edition wording fidelity — audit math correctness, internal consistency, and unambiguity only.
- **Workflow agents read and reason only — they never edit files.** All edits are applied sequentially by the main loop.
- **Test command:** run from `frontend/`. Single file: `npx vitest run src/data/focsPracticeSets.test.ts`. Full suite: `npx vitest run`. Build: `npm run build`.

---

### Task 1: Extend the structural test (id-uniqueness + LaTeX balance) and fix what it surfaces

The existing `frontend/src/data/focsPracticeSets.test.ts` already asserts 8 of the 10 structural checks in the spec (answerIndex range, flawLineId exists, accept non-empty, proof-order deps resolve + authored order is a valid topo order, challenge solution/rubric/twin resolve, every `why` non-empty). Only **id-uniqueness** and **LaTeX-delimiter balance** are missing. Extend the existing file rather than create a duplicate (DRY; the spec's proposed new `focsPracticeSets.audit.test.ts` is superseded by this — same checks, one home).

**Files:**
- Modify: `frontend/src/data/focsPracticeSets.test.ts`
- Possibly modify (only if the new checks fail): the content files listed in Global Constraints.

**Interfaces:**
- Consumes: `FOCS_PRACTICE_SETS` (from `./focsPracticeSets`), `PracticeSet` (from `../practice/types`).
- Produces: nothing consumed by later tasks — this is a standalone guard.

- [ ] **Step 1: Add the two failing checks to the test file.**

Add this helper and these two `it` blocks. Put the `allStrings` helper and the global-uniqueness `it` at the top level of the `describe("focsPracticeSets content integrity", …)` block (alongside `const sets = …`); put the LaTeX check inside the existing `for (const set of sets)` per-chapter loop.

```ts
// top of the describe block, after `const sets = Object.values(FOCS_PRACTICE_SETS);`
function allStrings(set: (typeof sets)[number]): string[] {
  const out: string[] = [];
  for (const w of set.warmup) out.push(w.front, w.back);
  for (const q of set.practice) {
    out.push(q.prompt, q.why);
    if (q.kind === "mcq") out.push(...q.choices);
    if (q.kind === "proof-order") out.push(...q.steps.map((s) => s.text));
    if (q.kind === "spot-flaw") out.push(...q.lines.map((l) => l.text));
    if (q.kind === "fill-blank") out.push(q.before, q.after, ...q.accept);
  }
  for (const c of set.challenge) out.push(c.prompt, c.solution, c.rubric);
  return out;
}

it("all top-level item ids are globally unique", () => {
  const seen = new Map<string, string>();
  for (const set of sets) {
    const ids = [
      ...set.warmup.map((w) => w.id),
      ...set.practice.map((q) => q.id),
      ...set.challenge.map((c) => c.id),
    ];
    for (const id of ids) {
      expect(seen.has(id), `duplicate id "${id}" (also in ${seen.get(id)})`).toBe(false);
      seen.set(id, `chapter ${set.chapter}`);
    }
  }
});

it("proof-order step ids and spot-flaw line ids are unique within their question", () => {
  for (const set of sets) {
    for (const q of set.practice) {
      if (q.kind === "proof-order") {
        const ids = q.steps.map((s) => s.id);
        expect(new Set(ids).size, `${q.id} has duplicate step ids`).toBe(ids.length);
      }
      if (q.kind === "spot-flaw") {
        const ids = q.lines.map((l) => l.id);
        expect(new Set(ids).size, `${q.id} has duplicate line ids`).toBe(ids.length);
      }
    }
  }
});
```

```ts
// inside `for (const set of sets) { describe(`chapter ${set.chapter}`, () => { … }) }`
it("LaTeX $ delimiters balance and \\begin/\\end match", () => {
  for (const s of allStrings(set)) {
    const dollars = (s.match(/(?<!\\)\$/g) || []).length;
    expect(dollars % 2, `unbalanced $ in ch ${set.chapter}: "${s.slice(0, 70)}"`).toBe(0);
    const begins = (s.match(/\\begin\{/g) || []).length;
    const ends = (s.match(/\\end\{/g) || []).length;
    expect(begins, `\\begin/\\end mismatch in ch ${set.chapter}: "${s.slice(0, 70)}"`).toBe(ends);
  }
});
```

- [ ] **Step 2: Run the test.**

Run: `cd frontend && npx vitest run src/data/focsPracticeSets.test.ts`
Expected: PASS if content is already structurally clean, or FAIL naming a specific duplicate id / unbalanced-`$` string. A failure here is a real defect to fix in Step 3.

- [ ] **Step 3: Fix any structural defects surfaced.**

For each failure, open the named chapter's file and correct it: rename a duplicate id, or balance the `$`/`\begin`/`\end` in the flagged string. These are unambiguous mechanical fixes; no audit needed. Re-run Step 2 until green.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/data/focsPracticeSets.test.ts frontend/src/data/practice
git commit -m "test(practice): guard id-uniqueness + LaTeX balance across all 29 sets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Author and run the adversarial audit workflow → verified defect ledger

Run one `Workflow` that audits all 29 chapters and adversarially verifies every flagged defect, returning a ledger. Workflow agents Read the content files (they never edit).

**Files:**
- Create: `docs/superpowers/artifacts/2026-07-14-practice-audit-ledger.json` (the workflow's returned ledger, saved for auditability).

**Interfaces:**
- Produces: `ledger` — an array of `{ chapter, itemId, format, severity, class, evidence, proposedFix, verify: { verdict, fixOk, note } }`. Task 3 consumes this.

- [ ] **Step 1: Invoke the Workflow with the chapter→file map as `args`.**

Pass this `args` value (chapter token → owning file):

```json
[
  {"chapter":"1","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"2","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"3","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"4","file":"frontend/src/data/practice/chapter04.ts"},
  {"chapter":"5","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"6","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"7","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"8","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"9","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"10","file":"frontend/src/data/practice/chapters01to10.ts"},
  {"chapter":"11","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"12","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"13","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"14","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"15","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"16","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"17","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"18","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"19","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"20","file":"frontend/src/data/practice/chapters11to20.ts"},
  {"chapter":"21","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"22","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"23","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"24","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"25","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"26","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"27","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"28","file":"frontend/src/data/practice/chapters21to29.ts"},
  {"chapter":"29","file":"frontend/src/data/practice/chapters21to29.ts"}
]
```

Use this exact `script`:

```javascript
export const meta = {
  name: 'practice-content-audit',
  description: 'Adversarially audit FOCS 29-chapter practice content for math/quality defects',
  phases: [{ title: 'Audit' }, { title: 'Verify' }],
}

const DEFECT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['chapter', 'defects'],
  properties: {
    chapter: { type: 'string' },
    defects: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['itemId', 'format', 'severity', 'class', 'evidence', 'proposedFix'],
        properties: {
          itemId: { type: 'string' },
          format: { type: 'string', enum: ['flashcard','mcq','proof-order','spot-flaw','fill-blank','challenge'] },
          severity: { type: 'string', enum: ['hard','soft'] },
          class: { type: 'string' },
          evidence: { type: 'string' },
          proposedFix: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'fixOk', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed','rejected'] },
    fixOk: { type: 'boolean' },
    note: { type: 'string' },
  },
}

const pad = (c) => 'chapter' + String(c).padStart(2, '0')

const CHECKLIST = `
Per-format checklist (report ONLY genuine defects; an empty defects array is a valid, expected result):
- mcq: answerIndex must point to the UNIQUELY correct choice; no distractor may also be correct.
- spot-flaw: flawLineId must be the actually-invalid step; every OTHER line must be valid; there must be exactly one flaw.
- proof-order: the deps graph must forbid every logically-nonsensical order (no missing dep) and permit every valid order (no spurious dep); the steps must compose into a correct proof.
- fill-blank: accept must include reasonable phrasings of the correct answer and must NOT admit a wrong answer (grading lowercases, strips $ and collapses whitespace).
- challenge: solution must be a correct, complete proof; rubric must match the solution's key steps and be gradeable; twinPromptId (if any) must be a genuinely analogous problem.
- flashcard: back must be factually correct and must actually answer front.
Severity: "hard" = a wrong answer key / wrong math. "soft" = weak-or-wrong 'why', ambiguous prompt, too-strict/too-loose accept, mis-rendering LaTeX. Only flag soft defects that genuinely mislead — never mere style.
For each defect give: itemId, format, severity, class (short label), evidence (why it is wrong, with the math), proposedFix (the concrete corrected value / text).`

const audit = (ch) => `You are auditing FOCS discrete-math practice content for correctness.
Read the file \`${ch.file}\` and locate the object \`export const ${pad(ch.chapter)}: PracticeSet\`. Audit ONLY chapter ${ch.chapter} (that object). Ignore all other chapters in the file.
Re-derive the mathematics of EVERY item (warmup, practice, challenge) from first principles and check it against this checklist.
${CHECKLIST}
Return { chapter: "${ch.chapter}", defects: [...] }.`

const verify = (ch, d) => `Adversarially verify ONE claimed defect in FOCS chapter ${ch.chapter} practice content.
Read \`${ch.file}\`, find item id "${d.itemId}" inside \`export const ${pad(ch.chapter)}\`, and read it in full.
Claimed defect (${d.severity}/${d.class}): ${d.evidence}
Proposed fix: ${d.proposedFix}
Your job is to REFUTE this if you can. Default to skepticism. Work the math yourself.
- verdict = "confirmed" ONLY if the item is genuinely wrong as claimed; otherwise "rejected".
- fixOk = true ONLY if the proposed fix is itself correct AND introduces no new error.
Return { verdict, fixOk, note }.`

const results = await pipeline(
  args,
  (ch) => agent(audit(ch), { label: `audit:ch${ch.chapter}`, phase: 'Audit', schema: DEFECT_SCHEMA }),
  (found, ch) => parallel((found?.defects ?? []).map((d) => () =>
    agent(verify(ch, d), { label: `verify:ch${ch.chapter}:${d.itemId}`, phase: 'Verify', schema: VERDICT_SCHEMA })
      .then((v) => ({ chapter: ch.chapter, ...d, verify: v }))
      .catch(() => null)
  )),
)

const ledger = results.flat().filter(Boolean)
const confirmed = ledger.filter((d) => d.verify?.verdict === 'confirmed' && d.verify?.fixOk)
log(`ledger: ${ledger.length} defects flagged, ${confirmed.length} confirmed+fixable`)
return { ledger, confirmed }
```

- [ ] **Step 2: Save the returned ledger to the artifact file.**

Write the workflow's `ledger` array to `docs/superpowers/artifacts/2026-07-14-practice-audit-ledger.json` (pretty-printed). Create the `docs/superpowers/artifacts/` directory if absent.

- [ ] **Step 3: Commit the ledger artifact.**

```bash
git add docs/superpowers/artifacts/2026-07-14-practice-audit-ledger.json
git commit -m "docs(practice): audit ledger — flagged + adversarially-verified defects

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Apply the confirmed fixes, chapter-by-chapter

Iterate the ledger's confirmed entries grouped by chapter. For each chapter, apply its fixes, re-run the structural test, and commit. Sequential — never edit two chapters' fixes before testing.

**Files:**
- Modify: whichever content files the confirmed defects name (per the Global Constraints map).

**Interfaces:**
- Consumes: `confirmed` from Task 2 (`verify.verdict === "confirmed" && verify.fixOk === true`; plus, for `severity === "soft"`, only entries whose evidence shows genuine misleading — skip pure style).

- [ ] **Step 1: Build the fix worklist.**

From the ledger, keep entries where `verify.verdict === "confirmed" && verify.fixOk === true`. Drop `soft` entries that are merely stylistic. Group the survivors by `chapter`. If the worklist is empty, skip to Task 4 (the content was already correct — a valid outcome; note it).

- [ ] **Step 2: For each chapter in the worklist, apply its fixes.**

Open the owning file. For each defect, Edit the exact field named by `itemId` + `format` to the `proposedFix` value (e.g. flip an `answerIndex`, correct a `flawLineId`, add/remove a dep, extend an `accept` array, rewrite a `solution`/`rubric`/`why`). Keep surrounding formatting identical.

- [ ] **Step 3: Re-run the structural test for that chapter.**

Run: `cd frontend && npx vitest run src/data/focsPracticeSets.test.ts`
Expected: PASS. A fix that flips an answer key must still satisfy the structural invariants (it's correcting to a valid value). If it fails, the fix was mis-applied — correct it before committing.

- [ ] **Step 4: Commit that chapter.**

```bash
git add frontend/src/data/practice
git commit -m "fix(practice): correct chapter <N> — <one-line summary of the fixes>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Repeat Steps 2–4 per chapter until the worklist is exhausted.

---

### Task 4: Final verification and PR preparation

**Files:**
- None modified (verification + summary only).

- [ ] **Step 1: Full test suite + build.**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all vitest specs green; `tsc -b && vite build` clean.

- [ ] **Step 2: Browser smoke two chapters.**

Start the dev server and use `/browse` to open Learning Mode → a proof chapter's "X.Y Problems" (e.g. 4.6) and a theory-of-computation chapter's problems (e.g. 24.x). Confirm prompts/LaTeX render and that a corrected item grades as expected. Screenshot both.

- [ ] **Step 3: Write the PR body with the ledger summary.**

Compose a PR body containing one row per applied fix: `chapter · itemId · class · old → new · verify note`. Include the count of flagged-vs-confirmed-vs-applied. Save it to `docs/superpowers/artifacts/2026-07-14-practice-audit-PR.md`.

- [ ] **Step 4: Hand off for push/PR.**

Do NOT push or open the PR automatically. Report the local state (branch, commits, test/build/smoke results, ledger summary) and let the user decide to push + open the PR into `function` (or run the `/ship` skill). Per repo policy `function` is PR-only.

---

## Self-Review

**Spec coverage:**
- §1 scope (all 29, hard+soft, in-place) → Tasks 2–3. Non-goals restated in Global Constraints. ✓
- §2 defect taxonomy → encoded in the workflow `CHECKLIST` (Task 2). ✓
- §3 Layer 1 structural test → Task 1 (extends existing; 8/10 checks pre-existed, 2 added). ✓
- §3 Layer 2 audit→verify pipeline, agents read-only → Task 2 script. ✓
- §4 fix application by main loop, confidence bar → Task 3 (worklist filter) + Global Constraints. ✓
- §5 branch, per-chapter commits, ledger in PR → Tasks 2–4. ✓
- §6 acceptance (structural green, vitest green, build clean, 2-chapter smoke, every fix confirmed) → Task 4 + Task 3 filter. ✓

**Placeholder scan:** `<N>` / `<one-line summary>` in commit messages and the PR row template are intentional fill-at-runtime values (data-dependent on the ledger), not code placeholders — every code and command step is concrete. No TBD/TODO. ✓

**Type consistency:** ledger shape produced in Task 2 (`{chapter,itemId,format,severity,class,evidence,proposedFix,verify:{verdict,fixOk,note}}`) matches the filter in Task 3 Step 1 and the schemas in the workflow script. `allStrings` helper types align with `PracticeSet`. ✓
