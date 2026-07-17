# Gradebook Polish (Phase 2C round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make per-item max score editable in the gradebook and flag scores outside [0, maxScore], after extracting the `Gradebook` component out of `Grades.tsx` so it can be unit-tested.

**Architecture:** Pure frontend. `Gradebook` moves to its own file (`grades/Gradebook.tsx`) verbatim, then gains a `maxScore` `<input>` (mirroring the existing score input) and a non-blocking over/under-max warning driven by a pure `scoreWarning` helper. The server stays authoritative for grade math — `item.maxScore` already feeds the backend `Item.fraction`, so no backend change.

**Tech Stack:** React + TypeScript, vitest (jsdom for component tests, node for the pure helper).

**Spec:** `docs/superpowers/specs/2026-07-06-gradebook-polish-design.md`.

**Env:** `cd /Users/vnerald/ai_tutor/frontend`. Tests: `npx vitest run`. Typecheck: `npx tsc --noEmit`. Build: `npx vite build`.

---

## File Structure

- Create `frontend/src/grades/Gradebook.tsx` — the gradebook component (moved from `Grades.tsx`), then extended with max-score editing + warning.
- Modify `frontend/src/Grades.tsx` — delete the inline `Gradebook`, import it from the new file, drop the now-unused `addItemRow` import.
- Modify `frontend/src/grades/rubric.ts` — add the pure `scoreWarning` helper.
- Modify `frontend/src/grades/rubric.test.ts` — `scoreWarning` unit tests.
- Create `frontend/src/grades/Gradebook.test.tsx` — component tests (jsdom).
- Modify `frontend/src/Grades.css` — max-score input + warning styles.
- Modify `frontend/src/i18n/messages.ts` — `grades.scoreOverMax` in en/zh/es.

---

## Task 1: Extract `Gradebook` to its own file (pure move, zero behavior change)

**Files:**
- Create: `frontend/src/grades/Gradebook.tsx`
- Modify: `frontend/src/Grades.tsx`

- [ ] **Step 1: Create `frontend/src/grades/Gradebook.tsx`** with the component moved verbatim from `Grades.tsx` (currently lines ~343–400), plus its own imports:

```tsx
import type { Course } from "./types";
import { addItem as addItemRow } from "./rubric";
import { useLocale } from "../i18n/LocaleContext";

export default function Gradebook({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const { t } = useLocale();
  const setScore = (catId: string, itemId: string, raw: string) => {
    const score = raw.trim() === "" ? null : Number(raw);
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, score } : it)) },
      ),
    });
  };
  // Reuse the rubric row helper so a gradebook-added row also keeps the rule's slot count
  // in sync (and seeds a fixedWeights row with a weight) — no rule/row desync.
  const addItem = (catId: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) => (cat.id !== catId ? cat : addItemRow(cat))),
    });

  return (
    <section className="gr-card gr-gradebook">
      <h2 className="gr-sec-label">{t("grades.gradebook")}</h2>
      {course.categories.map((cat) => (
        <div className="gr-gb-cat" key={cat.id}>
          <div className="gr-gb-cat-head">
            <span className="gr-gb-cat-name">{cat.name}</span>
            <span className="gr-gb-cat-weight">{cat.weight}%</span>
          </div>
          {cat.items.length === 0 && <div className="gr-gb-empty">{t("grades.noItems")}</div>}
          {cat.items.map((it) => (
            <div className="gr-gb-row" key={it.id}>
              <span className="gr-gb-name">{it.name}</span>
              <span className="gr-gb-leader" />
              {it.score == null && <span className="gr-gb-upcoming">{t("grades.upcoming")}</span>}
              <span className="gr-gb-score">
                <input
                  className="gr-gb-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={it.score ?? ""}
                  aria-label={`${it.name} score`}
                  onChange={(e) => setScore(cat.id, it.id, e.target.value)}
                />
                <span className="gr-gb-max">/ {it.maxScore}</span>
              </span>
            </div>
          ))}
          <button className="gr-linkbtn gr-gb-add" onClick={() => addItem(cat.id)}>
            {t("grades.addGrade")}
          </button>
        </div>
      ))}
    </section>
  );
}
```
(This is the CURRENT component verbatim — max-score editing + warning come in Task 3. If the live `Grades.tsx` differs from the above, copy the live version, not this snippet.)

- [ ] **Step 2: Edit `frontend/src/Grades.tsx`** — remove the inline component and import the new one.
  - Delete the entire `function Gradebook({ course, onChange }: ...) { ... }` block (the ~343–400 region).
  - Change the rubric import (line ~14) from:
    ```ts
    import { addItem as addItemRow, materializeCourse } from "./grades/rubric";
    ```
    to:
    ```ts
    import { materializeCourse } from "./grades/rubric";
    ```
    (Grades.tsx uses `addItemRow` ONLY inside the now-moved Gradebook — grep to confirm `addItemRow` no longer appears in Grades.tsx after the delete.)
  - Add near the other component imports (next to `import RubricEditor from "./grades/RubricEditor";`):
    ```ts
    import Gradebook from "./grades/Gradebook";
    ```
  - Leave the `<Gradebook course={course} onChange={onChange} />` usage in `ReadyView` unchanged.

- [ ] **Step 3: Verify zero behavior change**

Run: `cd /Users/vnerald/ai_tutor/frontend && npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc clean (no unused-import error for `addItemRow`), all existing vitest pass, build succeeds. This is a pure move — nothing should change.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/grades/Gradebook.tsx frontend/src/Grades.tsx
git commit -m "refactor(grades): extract Gradebook to grades/Gradebook.tsx"
```

---

## Task 2: `scoreWarning` pure helper + unit tests

**Files:**
- Modify: `frontend/src/grades/rubric.ts`
- Test: `frontend/src/grades/rubric.test.ts`

- [ ] **Step 1: Write failing tests** — append to `frontend/src/grades/rubric.test.ts`:

```typescript
import { scoreWarning } from "./rubric";

describe("scoreWarning", () => {
  it("null score never warns", () => {
    expect(scoreWarning({ score: null, maxScore: 100 })).toBe(false);
  });
  it("in-range score does not warn (incl. the boundary == maxScore)", () => {
    expect(scoreWarning({ score: 88, maxScore: 100 })).toBe(false);
    expect(scoreWarning({ score: 100, maxScore: 100 })).toBe(false);
    expect(scoreWarning({ score: 0, maxScore: 100 })).toBe(false);
  });
  it("score above the max warns", () => {
    expect(scoreWarning({ score: 120, maxScore: 100 })).toBe(true);
  });
  it("negative score warns", () => {
    expect(scoreWarning({ score: -5, maxScore: 100 })).toBe(true);
  });
});
```
(Add `scoreWarning` to the existing `./rubric` import at the top of the test file rather than duplicating imports.)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/grades/rubric.test.ts`
Expected: FAIL — `scoreWarning` is not exported.

- [ ] **Step 3: Implement in `frontend/src/grades/rubric.ts`** — add near the item helpers (after `newItem`). `Item` is already imported at the top of the file:

```ts
/** True when an entered score is outside [0, maxScore] — a likely typo. Non-blocking:
 *  callers only surface it; the value is still saved. */
export const scoreWarning = (it: Pick<Item, "score" | "maxScore">): boolean =>
  it.score != null && (it.score < 0 || it.score > it.maxScore);
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/grades/rubric.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/grades/rubric.ts frontend/src/grades/rubric.test.ts
git commit -m "feat(grades): scoreWarning helper (score outside [0,max])"
```

---

## Task 3: Editable max score + over-max warning in the Gradebook

**Files:**
- Modify: `frontend/src/grades/Gradebook.tsx`, `frontend/src/Grades.css`, `frontend/src/i18n/messages.ts`
- Test: `frontend/src/grades/Gradebook.test.tsx`

- [ ] **Step 1: Add i18n string (en/zh/es)** — in `frontend/src/i18n/messages.ts`, add `grades.scoreOverMax` to EACH of the EN, ZH, ES objects (near `grades.upcoming`):
  - EN: `"grades.scoreOverMax": "over the max"`
  - ZH: `"grades.scoreOverMax": "超过满分"`
  - ES: `"grades.scoreOverMax": "por encima del máximo"`

- [ ] **Step 2: Write the failing component test** — create `frontend/src/grades/Gradebook.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Gradebook from "./Gradebook";
import { LocaleProvider } from "../i18n/LocaleContext";
import type { Course } from "./types";

afterEach(cleanup);

const course = (score: number | null = 95): Course => ({
  name: "C",
  term: "",
  categories: [
    {
      id: "c1",
      name: "Exams",
      weight: 100,
      rule: { kind: "uniform", nSlots: 1 },
      items: [{ id: "i1", name: "Exam 1", score, maxScore: 100 }],
    },
  ],
  cutoffs: [],
});

function renderGb(c: Course, onChange = vi.fn()) {
  render(
    <LocaleProvider>
      <Gradebook course={c} onChange={onChange} />
    </LocaleProvider>,
  );
  return onChange;
}

describe("Gradebook — editable max score + over-max warning", () => {
  it("editing the max score calls onChange with the new maxScore", () => {
    const onChange = renderGb(course());
    fireEvent.change(screen.getByLabelText("Exam 1 max score"), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as Course;
    expect(next.categories[0].items[0].maxScore).toBe(50);
  });
  it("a score above the max shows the warning", () => {
    renderGb(course(120));
    expect(screen.getByText(/over the max/i)).toBeTruthy();
  });
  it("an in-range score shows no warning", () => {
    renderGb(course(95));
    expect(screen.queryByText(/over the max/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run src/grades/Gradebook.test.tsx`
Expected: FAIL — no `Exam 1 max score` input (it's static text) and no warning.

- [ ] **Step 4: Edit `frontend/src/grades/Gradebook.tsx`.**
  (a) Add the `scoreWarning` import:
  ```ts
  import { addItem as addItemRow, scoreWarning } from "./rubric";
  ```
  (b) Add `setMaxScore` next to `setScore`:
  ```ts
  const setMaxScore = (catId: string, itemId: string, raw: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, maxScore: Number(raw) || 100 } : it)) },
      ),
    });
  ```
  (c) Replace the item-row render. Change the row body so it computes `warn`, renders the warning, and turns the static max into an input:
  ```tsx
          {cat.items.map((it) => {
            const warn = scoreWarning(it);
            return (
              <div className="gr-gb-row" key={it.id}>
                <span className="gr-gb-name">{it.name}</span>
                <span className="gr-gb-leader" />
                {it.score == null && <span className="gr-gb-upcoming">{t("grades.upcoming")}</span>}
                {warn && <span className="gr-gb-overmax">{t("grades.scoreOverMax")}</span>}
                <span className={`gr-gb-score${warn ? " is-warn" : ""}`}>
                  <input
                    className="gr-gb-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={it.score ?? ""}
                    aria-label={`${it.name} score`}
                    onChange={(e) => setScore(cat.id, it.id, e.target.value)}
                  />
                  <span className="gr-gb-max">
                    /
                    <input
                      className="gr-gb-maxinput"
                      type="number"
                      inputMode="numeric"
                      value={it.maxScore}
                      aria-label={`${it.name} max score`}
                      onChange={(e) => setMaxScore(cat.id, it.id, e.target.value)}
                    />
                  </span>
                </span>
              </div>
            );
          })}
  ```
  (Read the file to place this cleanly — it replaces the existing `cat.items.map((it) => (<div className="gr-gb-row">...))` block; the surrounding category loop, empty state, and add button are unchanged.)

- [ ] **Step 5: Add CSS** — in `frontend/src/Grades.css`, near the existing `.gr-gb-max` rule, add:
  ```css
  .gr-gb-maxinput { width: 46px; min-height: 28px; text-align: center; font-family: var(--mono); font-size: 13.5px; border: 1px solid var(--rule); border-radius: 6px; padding: 2px 4px; margin-left: 4px; background: var(--paper-card); color: var(--ink-soft); }
  .gr-gb-overmax { font-family: var(--sans); font-size: 11.5px; color: #9a5b3b; margin-right: 8px; }
  .gr-gb-score.is-warn .gr-gb-input { border-color: #9a5b3b; }
  ```
  (If `.gr-gb-input` has no border by default, the `.is-warn` rule still applies a warn border — verify the base `.gr-gb-input` style and keep the warn override consistent with it.)

- [ ] **Step 6: Run to confirm pass**

Run: `npx vitest run src/grades/Gradebook.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Full frontend gate**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc clean; all vitest pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/grades/Gradebook.tsx frontend/src/Grades.css frontend/src/i18n/messages.ts frontend/src/grades/Gradebook.test.tsx
git commit -m "feat(grades): editable per-item max score + over-max warning"
```

---

## Final verification

- [ ] `cd /Users/vnerald/ai_tutor/frontend && npx tsc --noEmit && npx vitest run && npx vite build` → all green.
- [ ] Manual sanity (optional, needs the dev fake-auth shim): /grades → gradebook → change an item's `/100` to `/20`; enter a score > 20 → the "over the max" hint appears; standing recomputes on the new max.

## NOT covered (deferred, per spec)

- Per-category subtotal, "which weighting scheme wins" caption, what-if projection, editing maxScore in the RubricEditor.
