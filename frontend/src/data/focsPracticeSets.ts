// T12 — hand-authored practice content for FOCS Chapter 4 "Proofs" (v1, mock).
// Grounded in the real chapter: 4.1 Direct, 4.2 Contraposition, 4.4 Contradiction,
// 4.3 Iff, 4.5 Proofs about Sets. Math is in $...$ (rendered by MathText/KaTeX).
// `why` = the explain-on-wrong line (design D-1). Proof-order `deps` drive the
// topological-sort grader (design D9); a commutable pair is included on purpose.
import type { PracticeSet } from "../practice/types";

const chapter4: PracticeSet = {
  chapter: "4",
  title: "Proofs",
  warmup: [
    { id: "f-direct", front: "Direct proof", back: "Assume $P$, then derive $Q$ step by step." },
    { id: "f-contra", front: "Proof by contraposition", back: "To prove $P \\Rightarrow Q$, instead prove $\\neg Q \\Rightarrow \\neg P$ — logically equivalent." },
    { id: "f-contradiction", front: "Proof by contradiction", back: "Assume the statement is false; derive an absurdity; conclude it must be true." },
    { id: "f-counter", front: "Counterexample", back: "One example making a $\\forall$-statement false. A single counterexample disproves it." },
    { id: "f-iff", front: "If and only if ($\\Leftrightarrow$)", back: "Prove both directions: $P \\Rightarrow Q$ and $Q \\Rightarrow P$." },
    { id: "f-rational", front: "Rational number", back: "A number $a/b$ with integers $a, b$ and $b \\neq 0$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "p-technique",
      prompt: "To prove “if $n^2$ is even then $n$ is even”, which technique is cleanest?",
      choices: ["Direct proof", "Proof by contraposition", "Counterexample", "Proof by contradiction"],
      answerIndex: 1,
      why: "A direct proof from “$n^2$ even” is awkward; the contrapositive “$n$ odd $\\Rightarrow n^2$ odd” is a clean direct argument.",
    },
    {
      kind: "mcq",
      id: "p-contrapositive",
      prompt: "What is the contrapositive of “if $x$ is rational then $x^2$ is rational”?",
      choices: [
        "If $x^2$ is irrational then $x$ is irrational",
        "If $x^2$ is rational then $x$ is rational",
        "If $x$ is irrational then $x^2$ is irrational",
        "$x^2$ is rational and $x$ is irrational",
      ],
      answerIndex: 0,
      why: "The contrapositive of $P \\Rightarrow Q$ is $\\neg Q \\Rightarrow \\neg P$: negate both parts and swap them.",
    },
    {
      kind: "proof-order",
      id: "p-order-rational-sum",
      prompt: "Arrange a direct proof: if $x$ and $y$ are rational, then $x+y$ is rational.",
      steps: [
        { id: "r1", text: "Let $x$ and $y$ be rational.", deps: [] },
        { id: "r2", text: "Write $x = a/b$ with integers $a,b$ and $b \\neq 0$.", deps: ["r1"] },
        { id: "r3", text: "Write $y = c/d$ with integers $c,d$ and $d \\neq 0$.", deps: ["r1"] },
        { id: "r4", text: "Then $x+y = (ad+bc)/(bd)$.", deps: ["r2", "r3"] },
        { id: "r5", text: "$ad+bc$ and $bd$ are integers with $bd \\neq 0$, so $x+y$ is rational. $\\blacksquare$", deps: ["r4"] },
      ],
      why: "Writing $x$ and $y$ as fractions can come in either order, but both must precede combining them into one fraction.",
    },
    {
      kind: "spot-flaw",
      id: "p-flaw-1eq2",
      prompt: "This “proof” that $2 = 1$ is wrong. Click the invalid step.",
      lines: [
        { id: "l1", text: "Let $a = b$." },
        { id: "l2", text: "Then $a^2 = ab$, so $a^2 - b^2 = ab - b^2$." },
        { id: "l3", text: "Factor: $(a-b)(a+b) = b(a-b)$." },
        { id: "l4", text: "Divide both sides by $(a-b)$: $a+b = b$." },
        { id: "l5", text: "Since $a=b$: $2b = b$, so $2 = 1$." },
      ],
      flawLineId: "l4",
      why: "Because $a = b$, the factor $a-b$ equals $0$. Dividing both sides by $0$ is not allowed.",
    },
    {
      kind: "fill-blank",
      id: "p-blank-no-largest",
      prompt: "Complete this proof by contradiction that there is no largest integer.",
      before: "Suppose for contradiction that $N$ is the largest integer. Consider $N+1$. Then $N+1 > N$, which",
      after: "Therefore no largest integer exists. $\\blacksquare$",
      accept: [
        "contradicts that N is the largest integer",
        "contradicts N being the largest",
        "contradicts N being largest",
        "contradicts the assumption",
        "is a contradiction",
      ],
      why: "$N+1$ is an integer larger than $N$, contradicting the assumption that $N$ was the largest.",
    },
  ],
  challenge: [
    {
      id: "c-contrapositive-even",
      prompt: "Prove that for every integer $n$, if $n^2$ is even then $n$ is even.",
      solution:
        "Use contraposition: prove “if $n$ is odd then $n^2$ is odd.” Assume $n$ is odd, so $n = 2k+1$ for some integer $k$. " +
        "Then $n^2 = (2k+1)^2 = 4k^2 + 4k + 1 = 2(2k^2 + 2k) + 1$, which is odd. " +
        "So $n$ odd $\\Rightarrow n^2$ odd. By contraposition, if $n^2$ is even then $n$ is even. $\\blacksquare$",
      rubric:
        "Recognizes contraposition is appropriate; assumes $n$ odd and writes $n = 2k+1$; expands $n^2$ correctly to $2(\\cdot)+1$; concludes $n^2$ odd; states the contrapositive conclusion. A direct proof attempt that handles the square-root step rigorously is also acceptable.",
      twinPromptId: "c-twin-odd",
    },
    {
      id: "c-sqrt2-irrational",
      prompt: "Prove that $\\sqrt{2}$ is irrational.",
      solution:
        "By contradiction. Suppose $\\sqrt{2} = a/b$ in lowest terms (so $a,b$ share no common factor). " +
        "Then $2 = a^2/b^2$, so $a^2 = 2b^2$, meaning $a^2$ is even, hence $a$ is even, say $a = 2c$. " +
        "Then $4c^2 = 2b^2$, so $b^2 = 2c^2$, meaning $b^2$ is even, hence $b$ is even. " +
        "But then $a$ and $b$ share the factor $2$, contradicting lowest terms. So $\\sqrt{2}$ is irrational. $\\blacksquare$",
      rubric:
        "Assumes $\\sqrt2 = a/b$ in lowest terms; derives $a^2 = 2b^2$; concludes $a$ even; substitutes to show $b$ even; identifies the contradiction with the lowest-terms assumption. Must use the parity argument (or an equivalent rigorous step), not just assert it.",
    },
    {
      id: "c-twin-odd",
      prompt: "Prove that for every integer $n$, if $n^2$ is odd then $n$ is odd.",
      solution:
        "Contraposition: if $n$ is even, $n = 2k$, then $n^2 = 4k^2 = 2(2k^2)$ is even. " +
        "So $n$ even $\\Rightarrow n^2$ even; by contraposition $n^2$ odd $\\Rightarrow n$ odd. $\\blacksquare$",
      rubric: "Mirror of the even case via contraposition: assume $n$ even, write $n=2k$, show $n^2$ even, conclude.",
    },
  ],
};

export const FOCS_PRACTICE_SETS: Record<string, PracticeSet> = {
  "4": chapter4,
};

/** Practice set for a chapter token (e.g. "4"), or null if none is authored. */
export function getPracticeSet(chapter: string): PracticeSet | null {
  return FOCS_PRACTICE_SETS[chapter] ?? null;
}
