import type { GuideScript } from "./types";

/** Demo guided walkthrough for FOCS Chapter 5 — ordinary induction. */
export const INDUCTION_GUIDE: GuideScript = {
  chapter: "5",
  title: "Induction walkthrough",
  steps: [
    {
      id: "g5-read",
      label: "Why",
      kind: "read",
      title: "Why not just check lots of examples?",
      body:
        "To prove “for every natural number $n$, …” you cannot verify infinitely many cases one by one. " +
        "Induction is the standard ladder argument: establish the first rung, then show each rung implies the next.",
      bookHint: "In the textbook below, read the domino / ladder analogy on the opening pages of Chapter 5.",
    },
    {
      id: "g5-mcq",
      label: "Idea",
      kind: "question",
      title: "Quick check",
      question: {
        kind: "mcq",
        id: "g5-mcq-q",
        prompt: "Why is checking $n = 1, 2, \\ldots, 100$ not enough to prove a $\\forall n\\in\\mathbb{N}$ statement?",
        choices: [
          "Because 100 is too small a number",
          "Because a universal claim ranges over infinitely many $n$",
          "Because examples are always wrong",
          "Because induction only works for sums",
        ],
        answerIndex: 1,
        why: "A $\\forall n$ statement quantifies over all naturals; any finite list of examples leaves infinitely many unchecked.",
      },
    },
    {
      id: "g5-card",
      label: "Template",
      kind: "flashcard",
      title: "The induction template",
      card: {
        id: "g5-card-ih",
        front: "Ordinary induction proves $\\forall n\\, P(n)$ by showing…",
        back:
          "**Base:** $P(0)$ or $P(1)$ (where the ladder starts). " +
          "**Step:** $P(k) \\Rightarrow P(k+1)$ for all $k$ in range. " +
          "Together these prove every rung.",
      },
    },
    {
      id: "g5-sum",
      label: "Walk-through",
      kind: "question",
      title: "Follow a classic sum proof",
      question: {
        kind: "proof-order",
        id: "g5-sum-q",
        prompt: "Order the steps for proving $1+2+\\cdots+n = \\frac{n(n+1)}{2}$ when $n\\ge 1$.",
        steps: [
          { id: "gs1", text: "Base $n=1$: both sides equal $1$.", deps: [] },
          { id: "gs2", text: "Induction hypothesis: assume the formula for $n=k$.", deps: ["gs1"] },
          { id: "gs3", text: "Add $(k+1)$ to both sides of the $k$-case.", deps: ["gs2"] },
          { id: "gs4", text: "Algebra simplifies to $\\frac{(k+1)(k+2)}{2}$.", deps: ["gs3"] },
          { id: "gs5", text: "So the formula holds for $k+1$; conclude for all $n\\ge 1$. $\\blacksquare$", deps: ["gs4"] },
        ],
        why: "Name the base case, state the hypothesis explicitly, then derive the $k+1$ case before concluding.",
      },
    },
    {
      id: "g5-flaw",
      label: "Pitfall",
      kind: "question",
      title: "When induction goes wrong",
      question: {
        kind: "spot-flaw",
        id: "g5-flaw-q",
        prompt: "This “proof” that all horses are the same color is invalid. Click the bad inference.",
        lines: [
          { id: "gf1", text: "Base $n=1$: one horse is one color." },
          { id: "gf2", text: "Assume any $k$ horses are one color." },
          { id: "gf3", text: "For $k+1$ horses, the first $k$ and last $k$ overlap, so all match." },
          { id: "gf4", text: "Therefore every finite set of horses is monochrome." },
        ],
        flawLineId: "gf3",
        why: "When $k=1$ and $k+1=2$, the two groups of $k$ horses need not overlap — the step fails at the first transition.",
      },
    },
    {
      id: "g5-done",
      label: "Next",
      kind: "done",
      title: "Walkthrough complete",
      body:
        "You have the template, a worked sum proof, and a classic pitfall. " +
        "Open **5.3 Problems** below to practice with mastery tracking.",
    },
  ],
};
