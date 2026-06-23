import { describe, it, expect } from "vitest";
import { gradeMcq, gradeSpotFlaw, gradeFillBlank, normalizeAnswer, gradeProofOrder, isValidTopoOrder } from "./grading";
import type { McqQuestion, SpotFlawQuestion, FillBlankQuestion, ProofOrderQuestion, ProofOrderStep } from "./types";

describe("gradeMcq", () => {
  const q: McqQuestion = { kind: "mcq", id: "m", prompt: "", choices: ["a", "b", "c"], answerIndex: 1, why: "" };
  it("correct index", () => expect(gradeMcq(q, 1)).toBe(true));
  it("wrong index", () => expect(gradeMcq(q, 0)).toBe(false));
});

describe("gradeSpotFlaw", () => {
  const q: SpotFlawQuestion = { kind: "spot-flaw", id: "s", prompt: "", lines: [{ id: "l1", text: "" }, { id: "l2", text: "" }], flawLineId: "l2", why: "" };
  it("clicks flaw line", () => expect(gradeSpotFlaw(q, "l2")).toBe(true));
  it("clicks valid line", () => expect(gradeSpotFlaw(q, "l1")).toBe(false));
});

describe("gradeFillBlank / normalizeAnswer", () => {
  const q: FillBlankQuestion = { kind: "fill-blank", id: "fb", prompt: "", before: "", after: "", accept: ["contradicts n being largest", "Contradiction"], why: "" };
  it("normalizes case + whitespace + $latex$", () => expect(normalizeAnswer("  $Contradiction$  ")).toBe("contradiction"));
  it("accepts with different case/spacing", () => expect(gradeFillBlank(q, "  CONTRADICTION ")).toBe(true));
  it("accepts an alternate answer", () => expect(gradeFillBlank(q, "contradicts   n being largest")).toBe(true));
  it("rejects a wrong answer", () => expect(gradeFillBlank(q, "it is fine")).toBe(false));
});

describe("isValidTopoOrder (proof-order DAG grading)", () => {
  // s1 -> s2 -> s3 strict chain, plus s4 commutable with s2 (both depend only on s1).
  const steps: ProofOrderStep[] = [
    { id: "s1", text: "assume n odd", deps: [] },
    { id: "s2", text: "n=2k+1", deps: ["s1"] },
    { id: "s4", text: "note n is an integer", deps: ["s1"] },
    { id: "s3", text: "so n^2 odd", deps: ["s2"] },
  ];

  it("accepts the canonical order", () => {
    expect(isValidTopoOrder(steps, ["s1", "s2", "s4", "s3"])).toBe(true);
  });
  it("accepts a DIFFERENT valid order (s4 before s2 — commutable)", () => {
    expect(isValidTopoOrder(steps, ["s1", "s4", "s2", "s3"])).toBe(true);
  });
  it("rejects when a dependency comes after its dependent", () => {
    expect(isValidTopoOrder(steps, ["s2", "s1", "s4", "s3"])).toBe(false); // s2 before s1
  });
  it("rejects s3 before s2", () => {
    expect(isValidTopoOrder(steps, ["s1", "s4", "s3", "s2"])).toBe(false);
  });
  it("rejects a non-permutation (missing a step)", () => {
    expect(isValidTopoOrder(steps, ["s1", "s2", "s3"])).toBe(false);
  });
  it("rejects duplicates", () => {
    expect(isValidTopoOrder(steps, ["s1", "s1", "s2", "s3"])).toBe(false);
  });

  it("gradeProofOrder delegates to the topo check", () => {
    const q: ProofOrderQuestion = { kind: "proof-order", id: "po", prompt: "", steps, why: "" };
    expect(gradeProofOrder(q, ["s1", "s2", "s4", "s3"])).toBe(true);
    expect(gradeProofOrder(q, ["s3", "s2", "s1", "s4"])).toBe(false);
  });
});
