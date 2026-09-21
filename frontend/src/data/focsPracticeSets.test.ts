import { describe, it, expect, afterEach } from "vitest";
import { FOCS_PRACTICE_SETS } from "./practice/focsSets";
import { getPracticeSet, problemChaptersFor } from "./focsPracticeSets";
import { isValidTopoOrder } from "../practice/grading";
import { BOOKS } from "../books/registry";
import type { BookDef } from "../books/registry";
import type { PracticeSet } from "../practice/types";

describe("focsPracticeSets content integrity", () => {
  const sets = Object.values(FOCS_PRACTICE_SETS);

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

  it("every FOCS Problems chapter has a practice set", () => {
    const chapters = problemChaptersFor("focs");
    expect(chapters.length).toBeGreaterThan(1);
    for (const chapter of chapters) {
      expect(getPracticeSet("focs", chapter), `chapter ${chapter}`).not.toBeNull();
    }
  });

  it("getPracticeSet returns Chapter 4 and null for unknown", () => {
    expect(getPracticeSet("focs", "4")?.title).toBe("Proofs");
    expect(getPracticeSet("focs", "1")?.chapter).toBe("1");
    expect(getPracticeSet("focs", "1")?.warmup[0].front).not.toBe(
      getPracticeSet("focs", "4")?.warmup[0].front
    );
    expect(getPracticeSet("focs", "99")).toBeNull();
  });

  it("keys practice by book, so same-numbered chapters do not collide", () => {
    expect(getPracticeSet("focs", "4")?.title).toBe("Proofs");
    // Task 8 ruling 2: an unregistered book id gets null, NOT a silent fallback to
    // FOCS. (The brief's original assertion here was `.toBe("Proofs")` — inverted
    // deliberately; see LearningModel.tsx's practiceActive for the bug this avoids.)
    expect(getPracticeSet("no_such_book", "4")).toBeNull();
    expect(getPracticeSet("focs", "999")).toBeNull();
    expect(problemChaptersFor("no_such_book")).toEqual([]);
  });

  describe("a second builtin book (fixture, not shipped)", () => {
    // Throwaway second book, mirroring backend test_builtin_books.py's `tb` fixture
    // and frontend/src/learningTextbooks.test.ts's FAKE_BUILTIN (Task 8 ruling 4).
    // PR1 ships no second course — never add Lathi (or any real) content here.
    const FIXTURE_PROOFS: PracticeSet = {
      chapter: "4",
      title: "Fixture Proofs",
      warmup: [],
      practice: [],
      challenge: [],
    };
    const FIXTURE_BOOK: BookDef = {
      id: "fixture_book",
      shortLabel: "Fixture",
      practiceAnchor: { kind: "chapter" },
      tree: { "3 Foo": {}, "4 Bar": {}, "B Background": {}, "Answers to Selected Problems": {} },
      sectionNotes: {},
      practiceSets: { "4": FIXTURE_PROOFS },
    };

    afterEach(() => {
      delete BOOKS[FIXTURE_BOOK.id];
    });

    it("same chapter token in two books resolves to each book's own set", () => {
      BOOKS[FIXTURE_BOOK.id] = FIXTURE_BOOK;
      expect(getPracticeSet("focs", "4")?.title).toBe("Proofs");
      expect(getPracticeSet(FIXTURE_BOOK.id, "4")?.title).toBe("Fixture Proofs");
    });

    it("a `chapter` anchor yields top-level chapter tokens (no Problems-section scan)", () => {
      BOOKS[FIXTURE_BOOK.id] = FIXTURE_BOOK;
      expect(problemChaptersFor(FIXTURE_BOOK.id)).toEqual(["B", "3", "4"]);
    });

    it("FOCS keeps its `problems_section` anchor behaviour untouched", () => {
      const chapters = problemChaptersFor("focs");
      expect(chapters).toContain("4");
      expect(chapters).toEqual([...chapters].sort((a, b) => Number(a) - Number(b)));
    });
  });

  for (const set of sets) {
    describe(`chapter ${set.chapter}`, () => {
      it("has warm-up, practice, and challenge content", () => {
        expect(set.warmup.length).toBeGreaterThan(0);
        expect(set.practice.length).toBeGreaterThan(0);
        expect(set.challenge.length).toBeGreaterThan(0);
      });

      it("every auto-graded item has a non-empty explain-on-wrong `why`", () => {
        for (const q of set.practice) {
          expect(q.why.trim().length, `${q.id} missing why`).toBeGreaterThan(0);
        }
      });

      it("MCQ answerIndex is in range", () => {
        for (const q of set.practice) {
          if (q.kind === "mcq") {
            expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
            expect(q.answerIndex, q.id).toBeLessThan(q.choices.length);
          }
        }
      });

      it("spot-flaw flawLineId references a real line", () => {
        for (const q of set.practice) {
          if (q.kind === "spot-flaw") {
            expect(q.lines.map((l) => l.id), q.id).toContain(q.flawLineId);
          }
        }
      });

      it("fill-blank has at least one accepted answer", () => {
        for (const q of set.practice) {
          if (q.kind === "fill-blank") expect(q.accept.length, q.id).toBeGreaterThan(0);
        }
      });

      it("every proof-order DAG is solvable (its authored order is a valid topological order)", () => {
        for (const q of set.practice) {
          if (q.kind === "proof-order") {
            const stepIds = new Set(q.steps.map((s) => s.id));
            for (const s of q.steps) {
              for (const dep of s.deps) {
                expect(stepIds.has(dep), `${q.id}: dep ${dep} not a step`).toBe(true);
              }
            }
            const authoredOrder = q.steps.map((s) => s.id);
            expect(isValidTopoOrder(q.steps, authoredOrder), `${q.id} authored order invalid`).toBe(true);
          }
        }
      });

      it("challenge problems have solution + rubric; twin references resolve", () => {
        const ids = new Set(set.challenge.map((c) => c.id));
        for (const c of set.challenge) {
          expect(c.solution.trim().length, c.id).toBeGreaterThan(0);
          expect(c.rubric.trim().length, c.id).toBeGreaterThan(0);
          if (c.twinPromptId) expect(ids.has(c.twinPromptId), `${c.id} twin missing`).toBe(true);
        }
      });

      it("LaTeX $ delimiters balance and \\begin/\\end match", () => {
        for (const s of allStrings(set)) {
          const dollars = (s.match(/(?<!\\)\$/g) || []).length;
          expect(dollars % 2, `unbalanced $ in ch ${set.chapter}: "${s.slice(0, 70)}"`).toBe(0);
          const begins = (s.match(/\\begin\{/g) || []).length;
          const ends = (s.match(/\\end\{/g) || []).length;
          expect(begins, `\\begin/\\end mismatch in ch ${set.chapter}: "${s.slice(0, 70)}"`).toBe(ends);
        }
      });
    });
  }
});
