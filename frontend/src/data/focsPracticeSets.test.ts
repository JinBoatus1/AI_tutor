import { describe, it, expect } from "vitest";
import { FOCS_PRACTICE_SETS, FOCS_PROBLEM_CHAPTERS, getPracticeSet } from "./focsPracticeSets";
import { isValidTopoOrder } from "../practice/grading";

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
    expect(FOCS_PROBLEM_CHAPTERS.length).toBeGreaterThan(1);
    for (const chapter of FOCS_PROBLEM_CHAPTERS) {
      expect(getPracticeSet(chapter), `chapter ${chapter}`).not.toBeNull();
    }
  });

  it("getPracticeSet returns Chapter 4 and null for unknown", () => {
    expect(getPracticeSet("4")?.title).toBe("Proofs");
    expect(getPracticeSet("1")?.chapter).toBe("1");
    expect(getPracticeSet("1")?.warmup[0].front).not.toBe(getPracticeSet("4")?.warmup[0].front);
    expect(getPracticeSet("99")).toBeNull();
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
