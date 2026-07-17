# Grade Tracker Backend — Implementation Plan (eng-review locked 2026-07-02)

Branch: `feat/grade-backend` · Repo: `JinBoatus1/AI_tutor` (`function` = prod, PR-only)
Reviewed via `/plan-eng-review` (Claude) + outside-voice (Claude subagent). This is **PR 1 of 2**;
the Quiz/Practice backend is the deferred fast-follow (see NOT in scope).

> Read this LOCKED DECISIONS block first — it supersedes any contradicting prose below.

## LOCKED DECISIONS (2026-07-02)

- **D1 — Data model = FIXED single course_id for v1.** The live `Grades.tsx` UI is single-course
  (one `course` state, no id, no switcher, "New course" replaces). Persist one rich course doc per
  user, stored under a fixed `course_id` slot (e.g. `"default"`) so multi-course is a later ADDITIVE
  change with no migration. (Reversed from an initial multi-course pick after the outside voice read
  the frontend.)
- **D2 — serde lives in its own module `grades_serde.py`.** `grades_math.py` stays PURE.
- **D3 — Auth = server-only.** Grades require login (`verify_token` → email). Logged-out users get a
  "sign in to track grades" state. PLUS a one-time **import-on-login** of any existing localStorage
  course so live local data is not stranded (P2, not P3 — it's a real regression otherwise).
- **D4 — Clone, don't refactor.** `grade_store.py` clones `student_bar_store.py`'s Mongo-primary +
  file-fallback + safe-id pattern. Do NOT refactor Jin's shared `student_bar_store.py`.
- **D5 — Defer the Mongo index.** `init_db` has no try/except (a transient Atlas hiccup would crash
  boot); `learning_bars` runs fine index-free; fixed course_id ⇒ one grade doc per user. Add the index
  only when data volume justifies it (NOT in scope).
- **D6 — Two-model serde with null-strip (outside-voice gap fix).** The stored/wire doc is the RICH
  frontend shape (ids, `term`, `score:null`, camelCase). serde PROJECTS it down to `grades_math`
  dataclasses only at compute time, **stripping null-score items** (a null placeholder Final must not
  be counted as 0). Storage preserves ids/term/nulls verbatim.
- **D7 — goal_seek endpoint is batched + item-id-keyed (outside-voice gap fix).** One call returns
  standing + the FULL letter ladder for a given unknown item id, not one letter per request. Keyed by
  `unknownItemId` (a category can have 2+ ungraded items). Translate statuses
  `already_met→locked` / `infeasible→unreachable`, and catch `goal_seek`'s `ValueError`
  (bad cutoff/category) → 4xx, never 500.
- **D8 — Chat injection is guarded + split into its own step.** Inject a compact one-line standing
  ONLY inside the existing `if not silent … try/except` block (`api_routes.py:634-645`), for the
  single fixed course. A throwing/slow `grades()` read must leave chat + the student_bar injection
  intact. Land injection as a separate guarded commit/PR after the additive core is proven.

---

## Problem

`backend/grades_math.py` (the deterministic rank-weight/goal-seek moat, 334 lines, 245 lines of tests)
is built but wired to nothing. The live Grades UI computes standing CLIENT-SIDE in `mockEngine.ts`
(explicitly a temporary mock — "never ship client math"). Goal: make the server authoritative for
grade math, persist per-user, and let the tutor SEE the student's standing.

## What already exists (reuse, do not rebuild)

| Need | Existing code to reuse |
|------|------------------------|
| Grade math (standing, goal-seek, validate) | `grades_math.py` — done + tested |
| Mongo-primary + file-fallback persistence | `student_bar_store.py` (`load_bar_mongo`/`save_bar_mongo` + file `load_bar`/`save_bar`) — CLONE the pattern |
| Graceful DB disable (None when no URI) | `database.py:get_db()` |
| Email sanitization for file paths | `student_bar_store._safe_student_id`, `user_textbook_store._safe_email_segment` |
| Identity from request | `auth.verify_token(authorization)` → email; `authorization: Optional[str] = Header(None)` |
| Prompt-injection point | `api_routes.py:634-645` — `sbs.load_bar_mongo` + `sbs.build_bar_prompt` |
| Route shape (GET/PUT per user) | `/api/student_bar` `:1192-1221` |
| Client compute reference (to port, then delete) | `mockEngine.ts` (`computeStanding`, `goalSeek`) |

## Architecture

```
                         REQUEST (Authorization: Bearer <firebase id token>)
                                        │
                                  verify_token(auth) ──► email  (None ⇒ 401)
                                        │
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  api_routes.py  (new routes)                                             │
  │   GET  /api/grades              → load rich course doc (or null)         │
  │   PUT  /api/grades              → save rich course doc (validate_rubric) │
  │   DELETE /api/grades            → clear                                  │
  │   POST /api/grades/standing     → { standing, ladder[] } (batched D7)    │
  └───────────────┬───────────────────────────────┬─────────────────────────┘
                  │                                │
         grade_store.py (D4)              grades_serde.py (D2/D6)
     Mongo `grades`  ─┐                  rich JSON ──project──► grades_math.Course
     file fallback  ─┘  keyed {email}      (strip null-score items)
     (fixed course_id "default", D1)                │
                                            grades_math.py (PURE)
                                       compute_standing / goal_seek / validate_rubric
                                                    │
  /api/chat (D8, guarded)  ── load standing ──► one-line string appended to system prompt
        inside  `if not silent and not is_simple_def:  try: … except: pass`
```

### Two-model serde (D6)

```
STORED / WIRE (rich, verbatim)                 COMPUTE (grades_math dataclasses)
Course{ name, term,                            Course(name, categories, cutoffs)
        categories:[                    ──►       │  (term dropped; ids dropped;
          Category{ id, name, weight,   project   │   null-score items STRIPPED)
            rule{kind,nSlots,k|weights},          Category(name, weight, rule)
            items:[Item{id,name,                  Item(name, score:float, max_score)
              score:number|null,maxScore}]}]      Rule: Uniform|DropLowest|RankWeights
        cutoffs:[{letter,min}] }                  Cutoff(letter, min_pct)
   kind→type map:  uniform→Uniform, dropLowest→DropLowest, rankWeights→RankWeights
   camelCase → snake_case;  min → min_pct;  null score ⇒ item omitted from compute
```

### goal_seek ladder (D7) — one call, not one-per-letter

`POST /api/grades/standing  { unknownItemId, unknownCategory }` →

```json
{ "standing": { "percent": 87.4, "letter": "B+" },
  "ladder": [ {"letter":"A","status":"ok","needed":92.0},
              {"letter":"A-","status":"locked","needed":0},
              {"letter":"B+","status":"locked","needed":0},
              {"letter":"B","status":"unreachable","needed":null} ] }
```
Server loops the course's cutoff letters, calls `goal_seek` per letter for the ONE unknown item,
maps status (`already_met→locked`, `infeasible→unreachable`), and returns `needed` on the item's own
max scale. `unknownItemId` optional — omit for standing-only.

## Failure modes

| Codepath | Realistic failure | Test? | Handled? | User sees |
|----------|-------------------|-------|----------|-----------|
| serde project | null-score Final counted as 0 | **new test** | strip nulls (D6) | correct standing |
| serde project | unknown rule `kind` / malformed JSON | **new test** | raise → 400 | clear 400 |
| goal_seek route | bad cutoff letter / category → `ValueError` | **new test** | catch → 400 | clear 400, not 500 |
| grade_store | `MONGODB_URI` unset (`get_db()`=None) | **new test** | file fallback | works locally |
| /api/chat inject | `grades()` slow/throws | **CRITICAL new test** | inside try/except (D8) | chat + bar intact |
| routes | no/expired token → `verify_token`=None | **new test** | 401 | "sign in to track grades" |

**Critical gap guard:** the `/api/chat` grade read is the only change to a hot shared path. The
mandatory regression test asserts that when `grade_store` raises, `/api/chat` still returns the reply
AND still injects the `student_bar` prompt.

## Test plan (pytest backend + vitest frontend)

```
grades_serde.test        round-trip each Rule kind; term/id preserved in storage;
                         null-score stripped at compute; unknown kind / malformed → error
grade_store.test         save→load (mongo mock); db None → file fallback; missing → null;
                         _safe_email on file path
api_routes (TestClient)  401 no token; GET/PUT/DELETE happy; PUT runs validate_rubric warnings;
                         POST standing → ladder; goal_seek ValueError → 400
  └─ CRITICAL regression grade_store raises ⇒ /api/chat still replies + student_bar still injected
gradesStorage.test       fetch success → course; 401 → signed-out state; import-on-login merge
```
Local env note: `pytest` is not installed here (`test_grades_math.py` can't run locally) —
`pip install pytest` + FastAPI `TestClient` before running backend tests.

## Implementation Tasks

- [ ] **T1 (P1, human ~2h / CC ~20m)** — `grades_serde.py` — rich JSON ↔ `grades_math` with null-strip (D6)
  - Files: `backend/grades_serde.py`, `backend/test_grades_serde.py`
  - Verify: `pytest test_grades_serde.py` — round-trip + null-strip + malformed
- [ ] **T2 (P1, human ~2h / CC ~20m)** — `grade_store.py` — clone student_bar Mongo+file pattern, fixed course_id (D1/D4)
  - Files: `backend/grade_store.py`, `backend/database.py` (+`grades()` accessor), `backend/test_grade_store.py`
  - Verify: `pytest test_grade_store.py` — save/load, db-None fallback
- [ ] **T3 (P1, human ~3h / CC ~30m)** — grade routes GET/PUT/DELETE + POST standing ladder (D7)
  - Files: `backend/api_routes.py`
  - Verify: `pytest` TestClient — 401 / happy / ladder / ValueError→400
- [ ] **T4 (P1, human ~1h / CC ~15m)** — CRITICAL regression: throwing grade_store leaves /api/chat + student_bar intact
  - Files: `backend/test_api_grades.py`
  - Verify: monkeypatch grade_store to raise; assert chat reply + bar prompt present
- [ ] **T5 (P2, human ~2h / CC ~20m)** — chat injection: compact one-line standing, guarded (D8) — separate commit
  - Files: `backend/api_routes.py:634-645` region
  - Verify: integration — standing present when course exists; absent + no error when none/throws
- [ ] **T6 (P1, human ~3h / CC ~30m)** — frontend `gradesStorage.ts` → API client; delete `mockEngine` math; server-authoritative
  - Files: `frontend/src/grades/gradesStorage.ts`, `frontend/src/Grades.tsx`, `frontend/src/grades/*.test.ts`
  - Verify: `vitest` — fetch success / 401 signed-out
- [ ] **T7 (P2, human ~1h / CC ~15m)** — import-on-login: one-time push of localStorage course to server (D3)
  - Files: `frontend/src/grades/gradesStorage.ts` (+ auth hook)
  - Verify: `vitest` — local course present + login ⇒ PUT once, then read server

## NOT in scope (deferred, with rationale)

- **Quiz/Practice backend (PR 2)** — server rung-lock + hidden answer keys + anti-farming + progress
  persistence. Bigger integrity lift; localStorage is fine for a single-user tool today. Same
  `grade_store`/`student_bar_store` persistence pattern will apply. Own review + PR.
- **Multi-course** — backend keeps a fixed `course_id` slot so this is a later additive change; needs a
  UI course list/switcher first (D1).
- **Mongo index on `grades`** — deferred until volume justifies it; avoid new boot-failure surface (D5).
- **Refactor `student_bar_store` into a shared store base** — collision risk on Jin's shared code (D4).

## Worktree parallelization

```
Lane A (backend):  T1 → T2 → T3 → T4  (sequential, all touch backend/ + api_routes.py)
Lane B (frontend): T6 → T7            (independent of A until endpoints exist; can stub)
Then:              T5 (chat injection) LAST, after T3/T4 green — guarded, own commit.
```
Lane A and Lane B touch disjoint dirs (`backend/` vs `frontend/src/grades/`) → parallel-safe. T5 waits
on T3. Conflict flag: T3 + T5 both edit `api_routes.py` → keep T5 a later separate commit.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (optional) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 7 issues raised, 0 unresolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run (backend-only PR) |
| Outside Voice | Claude subagent | Independent 2nd opinion | 1 | issues_found | 7 findings; 2 flipped prior decisions |

- **OUTSIDE VOICE:** read the frontend (which the primary review had not) and correctly caught: two-model
  serde + null-strip (folded in as D6), goal_seek must be item-id-keyed + batched ladder (D7), server-only
  strands localStorage users → import-on-login (D3), multi-course is dead weight vs the single-course UI, and
  index-in-init_db adds boot fragility.
- **CROSS-MODEL TENSION (resolved):** (1) data model — review picked multi-course, outside voice argued fixed
  course_id; user chose **fixed course_id** (D1). (2) Mongo index — review picked build-now, outside voice
  argued defer; user chose **defer** (D5).
- **UNRESOLVED:** 0.
- **KNOWN TOOLING:** `gstack-review-log` binary is broken on this install (v1.40 vs v1.58.5), so the /ship
  Review Readiness Dashboard will not show this review until gstack is upgraded. The review itself is complete.
- **VERDICT:** ENG CLEARED — ready to implement. Grade Tracker backend only; Quiz backend is the deferred PR 2.
