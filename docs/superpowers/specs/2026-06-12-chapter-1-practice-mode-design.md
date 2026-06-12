# Chapter Practice / Quiz Mode — Design Spec (v1)

- **Date:** 2026-06-12
- **Status:** Approved design → ready for implementation plan
- **Branch:** `feat/practice-mode` (off `origin/function`)
- **Owner:** Shijun / lius24
- **Surface:** Learning Mode, the left "notes" pane

## 1. Problem & motivation

AI Tutor today reads like *a chatbot you can read a book with*. We want it to feel like *a learning tool* — somewhere a student actively practices and demonstrably masters a chapter, not just reads.

Every FOCS chapter ends with a **"X.Y Problems"** section (`1.6 Problems`, `2.5 Problems`, … `18.6 Problems`). When a student opens a Problems section, the left notes pane should **transform into a practice/quiz experience** for mastering that chapter, with real help when they get stuck — the opposite of Chegg's "paste problem → get answer."

## 2. Goal & success criteria

A student opening **Chapter 1's Problems** section can:

1. Warm up on the chapter's key concepts,
2. Practice auto-graded questions (including proof-shaped ones),
3. Attempt a real proof problem and get **escalating AI help that never just hands over the answer**, and
4. Watch a **chapter mastery** indicator climb Familiar → Proficient → Mastered.

**Success =** the full vertical slice works end-to-end for Chapter 1 on the live frontend, with no backend dependency, and the deterministic logic (mastery, grading, rung rules) is unit-tested and matches hand calculation.

## 3. Scope

### v1 (this slice)
- **One chapter, end-to-end**: Chapter 1 of FOCS, hand-authored mock content.
- All **6 question formats** (below).
- **3-stage flow** (warm-up → practice → challenge), sequentially unlocked, with a "skip to challenge" escape hatch and a "view study note" affordance.
- **Chapter mastery** (upward-only) + a **mastery ring** on the chapter node in the Learning Progress tree.
- **Real AI hint ladder** via the existing `/api/chat` (frontend-orchestrated).
- **localStorage** persistence (anonymous OK).
- Editorial ivory + teal styling, consistent with the Report Card / Chat system.
- vitest coverage of the pure logic.

### Out of scope → phase 2 (explicitly deferred)
- Real textbook problem extraction (`extract_pdf_text_safe`).
- Backend hardening: server-side rung state, hidden answer key, separate anti-farming moderation classifier.
- LLM auto question-generation + QC stack.
- SymPy / code-execution grading.
- Demotion + cross-session spaced-repetition review.
- Sign-in-keyed server storage / cross-device sync.
- Other chapters (2–18) and uploaded textbooks.
- Extra gamification (streaks, XP, leaderboards).

> The data shape is general — extending to more chapters/problems is **adding content, not changing architecture**. The pure-logic modules are the spec for the phase-2 backend.

## 4. The experience & layout

**Trigger:** when the active section title is a problem set — `isProblemsSection(title)` = title ends with `"Problems"`, **excluding** the two decoys `11.5 Problem Solving with Graphs` and `12.3 Whirlwind Tour of Graph Problems`.

**Layout:** the left notes pane renders `<PracticePanel>` instead of `<SectionNotePanel>`. The right textbook-page pane is unchanged (reference). Practice panel, top to bottom:

1. **Mastery header** — chapter mastery bar (Familiar ▸ Proficient ▸ Mastered) + current tier.
2. **Stage stepper** — ① Warm-up · ② Practice · ③ Challenge, with lock/unlock state.
3. **Current stage body** — the active question.

**Affordances:**
- **View study note** — a toggle/link to bring back the section's existing study note (objectives/vocab/formulas) without leaving practice.
- **Skip to challenge** — strong students can jump straight to stage ③, bypassing sequential unlock.

**Stage gating:** stages unlock in order (mastery-gated, à la Khan/Duolingo) but completed stages are re-enterable. The "skip to challenge" link is the deliberate override.

## 5. Question formats (all 6 in v1)

| # | Format | Stage | Grading |
|---|--------|-------|---------|
| ① | **Flashcard** (term ⇄ definition) | Warm-up | self-rated (knew / didn't) |
| ② | **MCQ** (e.g. "which is the contrapositive of P→Q?") | Practice | deterministic (exact) |
| ③ | **Proof-step ordering** (drag scrambled steps into order) ⭐ | Practice | deterministic (sequence) |
| ④ | **Spot the flaw** (click the invalid line in a "proof") ⭐ | Practice | deterministic (line match) |
| ⑤ | **Proof fill-in-the-blank** (supply the missing justification) | Practice | deterministic if optioned; AI if free | 
| ⑥ | **Free-response + AI hint ladder** (real proof problem) ⭐ | Challenge | AI rubric judge |

③ ④ ⑤ are the bridge that makes *proof-heavy* content quizzable and auto-gradable. Warm-up flashcards can seed from the existing `focsSectionNotes` vocabulary/formulas.

## 6. Mastery model (chapter-level, upward-only in v1)

Mastery is **earned**, not toggled. It is a separate signal from the existing manual "learned" dot: the dot = *"I read it"*; mastery = *"I can do it."*

| Tier | Earned by |
|------|-----------|
| **Not started** | nothing practiced |
| **Familiar** | warm-up flashcards completed **and** practice attempted once (≥ 50% correct) |
| **Proficient** | every practice question answered correctly at least once (across all formats) |
| **Mastered** | ≥ 1 challenge problem judged correct by the AI **and reached through the student's own work** — if they used the answer-reveal rung, that problem does **not** count (a twin problem is offered instead) |

**Rules (learning-science backed):**
- **No penalty during practice** — practice mistakes never drop a tier; you only climb (Khan's anxiety-reducing model).
- **Revealing the answer ≠ mastery** — Mastered must be earned by genuine work; a reveal triggers a twin problem (retrieval practice).
- **No demotion in v1** — durable-mastery demotion needs cross-session spaced review → phase 2.
- **Tiers are cumulative; display the highest earned.** Each tier's criterion is evaluated independently, and the shown tier is the max reached by any path. So a student who uses **skip to challenge** and succeeds can earn **Mastered** directly without a separate practice pass — earning a higher tier implies the lower ones. `masteryEngine` returns `max(eligibleTiers)`.

**Tree integration:** the chapter node in the Learning Progress tree gains an earned-mastery ring (Familiar/Proficient/Mastered); the existing manual learned dots are untouched; the `X.Y Problems` node is the practice entry point.

## 7. Hint ladder (the differentiator)

**Iron rule:** *one rung up per request, and every escalation requires a new student action* (another attempt / answering the tutor's question / an explicit "still stuck"). This rule is simultaneously the pedagogy (productive struggle) and the v1 anti-farming mechanism.

| Rung | May reveal |
|------|-----------|
| **L0 Attempt gate** | nothing — must show an attempt / say where stuck before L2+ unlocks |
| **L1 Encourage / Socratic nudge** | no content; a refocusing question |
| **L2 Conceptual hint** | names the idea/strategy ("this is pigeonhole") |
| **L3 Point to the textbook** | cites the relevant section ("see 1.5 Proof") |
| **L4 First step** | sets up the first step; student finishes |
| **L5 Full walkthrough** | full steps, interrupted by a self-explanation check |
| **L6 Answer reveal** | hard-gated: explicit confirm + logged → twin problem; does **not** count toward Mastered |

**v1 orchestration (existing `/api/chat`, frontend-driven):**
- The frontend holds `currentRung` per challenge problem; "still stuck" advances it one rung.
- Each help request builds a rung-constrained prompt: *"You are at rung L2. You may name the concept. You may NOT show steps or the answer."* The AI reacts to the student's **actual** latest attempt (this adaptivity is the value — not pre-scripted hints).
- **Leak guard:** the canonical solution is **withheld from the prompt below L4** and included at **L4+** so the model coaches toward it without hallucinating. The same solution/rubric grades the free response.

**v1 honest caveat:** rung state and answer are **not** server-isolated in v1, so a determined user could in principle bypass. The gates (L0 attempt + one-rung-per-turn + reveal-confirm) are enough to stop ordinary shortcutting. True hardening (server-side rung lock + hidden key + a separate farming classifier) is **phase 2** (needs Jin's backend).

## 8. Architecture

All new code under `frontend/src/practice/`. Three layers; pure logic kept free of React and I/O so it is unit-testable and doubles as the phase-2 backend spec (same approach as the grade-tracker's `grades_math`).

### Host integration
- `LearningModel.tsx` — when `isProblemsSection(activeTitle)`, render `<PracticePanel chapter=… />` in the left pane instead of `<SectionNotePanel>`; keep a "view study note" fallback; right textbook pane unchanged.

### Presentation layer
- `practice/PracticePanel.tsx` — orchestrator: stage state, unlock gating, "skip to challenge", reads the practice set, reads/writes mastery.
- `practice/MasteryHeader.tsx` — mastery bar + tier.
- `practice/StageStepper.tsx` — 3-stage stepper with lock state.
- `practice/formats/` — one component per format, uniform interface `{ question, onResult }`:
  - `Flashcard.tsx`, `McqQuestion.tsx`, `ProofOrderQuestion.tsx`, `SpotFlawQuestion.tsx`, `FillBlankQuestion.tsx`, `ChallengeProblem.tsx`
- `practice/HintLadder.tsx` — owns rung state for a challenge; renders the rung-by-rung exchange + reveal gate + twin problem.

### Pure logic layer (no React / no I/O — unit-tested) ⭐
- `practice/masteryEngine.ts` — results → tier + stage unlock (deterministic).
- `practice/grading.ts` — deterministic grading for MCQ / proof-order / spot-flaw / fill-blank.
- `practice/hintLadder.ts` — rung rules, prompt construction, advancement, answer-visibility policy.

### I/O boundary (only two)
- `practice/challengeChat.ts` — thin wrapper over existing `/api/chat` (via `apiBase.ts`): send rung-constrained prompt; grade free-response against rubric.
- `utils/practiceProgress.ts` — localStorage read/write (mirrors `learningBarLocalStorage`).

### Data
- `data/focsPracticeSets.ts` — mock problem bank, keyed by chapter (mirrors `focsSectionNotes` keyed by section). Chapter 1 hand-authored across all 6 formats with answer keys / rubrics.
- Types: `Flashcard`, `McqQuestion`, `ProofOrderQuestion`, `SpotFlawQuestion`, `FillBlankQuestion`, `ChallengeProblem`, `PracticeSet` (in `practice/types.ts` or extending `utils/sectionNotes`).

### Styling
- `practice/Practice.css` — scoped under `.practice`, reusing the editorial ivory + teal tokens (consistent with Report Card / Chat). No purple.

### Data flow
1. `LearningModel` detects a Problems section → mounts `PracticePanel(chapter)`.
2. `PracticePanel` loads the mock `PracticeSet` + mastery from localStorage.
3. Each question component reports a result → `masteryEngine` (pure) recomputes tier + unlocks → persisted to localStorage.
4. Challenge: `ChallengeProblem` + `HintLadder`; `hintLadder.ts` builds the rung prompt → `challengeChat.ts` → `/api/chat`; the free response is graded against the rubric; success by own work → `masteryEngine` awards Mastered.

## 9. Persistence

localStorage in v1, keyed by `textbookId + chapter` (mirrors the learning-bar storage), holding per-chapter mastery tier + stage progress + which practice items have been answered correctly. Anonymous use works. Sign-in-keyed server sync is phase 2.

## 10. Testing

Stand up a thin **vitest** setup (frontend has none today). Pure logic carries correctness:
- `masteryEngine.test.ts` — tier computation + stage unlock across representative sequences; the "reveal does not count toward Mastered" rule.
- `grading.test.ts` — each format: MCQ exact; proof-order full + partial; spot-flaw correct line; fill-blank with case/whitespace normalization.
- `hintLadder.test.ts` — advancement rules (one-per-turn, effort gate) and the **answer-visibility policy** (solution absent from the prompt below L4, present at L4+) — the leak-guard test.

The challenge/hint-ladder LLM round-trip is verified manually in the running app (signed in). We can unit-test the *prompt we build*, not the AI's reply.

## 11. Risks & mitigations

- **AI hallucinates math in hints** → withhold the answer below L4, supply the canonical solution at L4+ so the model coaches rather than re-derives; manual verification on Chapter 1's authored problems.
- **Free-response grading is fuzzy** → rubric-conditioned judging with partial credit; mastery requires a *correct* judgment, and a low-confidence judge can ask the student to confirm.
- **v1 leak (no server isolation)** → accepted, documented; gates stop ordinary shortcutting; hardening is phase 2.
- **Touching `LearningModel.tsx` (large, recently tuned by Jin)** → integration is additive (one conditional render branch + two small affordances); do not refactor unrelated parts.

## 12. Phasing

- **v1** — this spec: Chapter 1, mock content, frontend + existing `/api/chat`, localStorage.
- **Phase 2** — real problem extraction; server-side rung lock + hidden key + farming classifier; auto question-gen + QC; SymPy/code grading; demotion + spaced review; signed-in server persistence; all chapters + uploaded textbooks.
