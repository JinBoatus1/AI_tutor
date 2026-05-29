import type { SectionNote } from "../utils/sectionNotes";

/** Chapter-level study notes for FCOS (keyed by section number: "1", "5.1", …). */
export const FOCS_SECTION_NOTES: Record<string, SectionNote> = {
  "0": {
    objectives:
      "Understand how the course is organized, what discrete mathematics is for in CS, and habits for reading proofs and doing problems.",
    vocabulary: ["discrete mathematics", "proof", "problem set", "abstraction"],
    formulas: [],
  },
  "1": {
    objectives:
      "See why discrete math matters through models (epidemics, matching, networks, computing) and get a first taste of what a proof is.",
    vocabulary: [
      "model",
      "discrete structure",
      "graph (informal)",
      "proposition",
      "proof",
      "counterexample",
    ],
    formulas: [
      "Simple epidemic idea: each infected person infects $k$ others per step (discrete-time spread).",
      "To disprove a universal claim: find one counterexample.",
    ],
  },
  "2": {
    objectives:
      "Work with the basic objects—sets, sequences, graphs—and start reading and writing short proofs, including use of well-ordering.",
    vocabulary: [
      "set",
      "element",
      "subset",
      "sequence",
      "graph (vertices and edges)",
      "axiom",
      "well-ordering principle",
    ],
    formulas: [
      "$A \\subseteq B \\iff \\forall x\\,(x \\in A \\Rightarrow x \\in B)$",
      "Well-ordering: every nonempty set of natural numbers has a least element.",
    ],
  },
  "3": {
    objectives:
      "Translate English statements into precise logic with connectives and quantifiers; use truth tables and know deduction vs induction (informally).",
    vocabulary: [
      "proposition",
      "predicate",
      "implication",
      "contrapositive",
      "quantifier ($\\forall$, $\\exists$)",
      "negation",
      "truth table",
    ],
    formulas: [
      "$\\neg(P \\Rightarrow Q) \\equiv P \\land \\neg Q$",
      "$\\neg(\\forall x\\, P(x)) \\equiv \\exists x\\, \\neg P(x)$",
      "$\\neg(\\exists x\\, P(x)) \\equiv \\forall x\\, \\neg P(x)$",
    ],
  },
  "4": {
    objectives:
      "Prove implications directly, by contraposition, contradiction, and equivalence; prove facts about sets.",
    vocabulary: [
      "direct proof",
      "contraposition",
      "contradiction",
      "iff ($\\Leftrightarrow$)",
      "set equality",
    ],
    formulas: [
      "Prove $P \\Rightarrow Q$: assume $P$, derive $Q$.",
      "Contrapositive: $P \\Rightarrow Q \\equiv \\neg Q \\Rightarrow \\neg P$.",
      "$A = B$ often shown via $A \\subseteq B$ and $B \\subseteq A$.",
    ],
  },
  "5": {
    objectives:
      "Use ordinary induction and well-ordering to prove $\\forall n\\, P(n)$ statements, especially about integers and sums.",
    vocabulary: [
      "induction hypothesis",
      "base case",
      "inductive step",
      "well-ordering",
      "strong vs ordinary (preview)",
    ],
    formulas: [
      "Induction: prove $P(0)$ and $\\forall n\\,(P(n) \\Rightarrow P(n+1))$ to get $\\forall n\\, P(n)$.",
      "$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$",
      "$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$",
    ],
  },
  "6": {
    objectives:
      "Apply strong induction and variants when the inductive step needs more than $P(n)$; compare flavors of induction.",
    vocabulary: [
      "strong induction",
      "leaping induction",
      "well-founded induction (idea)",
    ],
    formulas: [
      "Strong induction: assume $P(0),\\ldots,P(n)$ to prove $P(n+1)$.",
      "Often used when $P(n+1)$ depends on many earlier cases.",
    ],
  },
  "7": {
    objectives:
      "Define functions recursively, solve simple recurrences, and connect recursion to induction.",
    vocabulary: ["recursive definition", "recurrence", "closed form", "base case"],
    formulas: [
      "Fibonacci: $F_0=0$, $F_1=1$, $F_n = F_{n-1}+F_{n-2}$ for $n \\ge 2$.",
      "Tower of Hanoi moves: $T_n = 2T_{n-1}+1$, $T_1=1$ gives $T_n = 2^n - 1$.",
    ],
  },
  "8": {
    objectives:
      "Prove properties of recursively defined objects (trees, lists, structural induction).",
    vocabulary: [
      "structural induction",
      "recursive data type",
      "induction on structure",
    ],
    formulas: [
      "Structural induction: prove for base constructors, then show the property is preserved by each recursive rule.",
    ],
  },
  "9": {
    objectives:
      "Manipulate sums, approximate growth with asymptotics ($O$, $\\Omega$, $\\Theta$).",
    vocabulary: ["asymptotic notation", "big-O", "geometric sum", "harmonic sum"],
    formulas: [
      "$\\sum_{i=0}^{n} r^i = \\frac{r^{n+1}-1}{r-1}$ for $r \\ne 1$",
      "$f(n) = O(g(n))$ if $\\exists c,n_0\\,\\forall n \\ge n_0\\, |f(n)| \\le c\\,g(n)$",
    ],
  },
  "10": {
    objectives:
      "Use divisibility, gcd, modular arithmetic, and classic number-theory proof techniques.",
    vocabulary: ["divides", "gcd", "modular arithmetic", "prime", "congruent mod $m$"],
    formulas: [
      "$a \\equiv b \\pmod{m} \\iff m \\mid (a-b)$",
      "Bézout: $\\gcd(a,b)$ is the least positive integer $as+bt$ for integers $s,t$.",
    ],
  },
  "11": {
    objectives:
      "Model problems with graphs; use degree, paths, trees, planarity, and basic graph reasoning.",
    vocabulary: ["vertex", "edge", "path", "cycle", "tree", "planar graph", "Eulerian"],
    formulas: [
      "Handshaking lemma: $\\sum_{v} \\deg(v) = 2|E|$",
      "Tree on $n$ vertices has $n-1$ edges.",
    ],
  },
  "12": {
    objectives:
      "Study matchings and graph colorings; apply Hall’s theorem and coloring arguments.",
    vocabulary: ["matching", "bipartite graph", "chromatic number", "Hall’s condition"],
    formulas: [
      "Hall: a bipartite graph has a matching covering left side $L$ iff $\\forall S \\subseteq L$, $|N(S)| \\ge |S|$.",
    ],
  },
  "13": {
    objectives:
      "Count with permutations, combinations, and the product/sum rules; solve basic counting problems.",
    vocabulary: ["permutation", "combination", "binomial coefficient", "pigeonhole principle"],
    formulas: [
      "$P(n,k) = \\frac{n!}{(n-k)!}$",
      "$\\binom{n}{k} = \\frac{n!}{k!(n-k)!}$",
      "Pigeonhole: $n+1$ objects into $n$ boxes $\\Rightarrow$ some box has at least two.",
    ],
  },
  "14": {
    objectives:
      "Use inclusion–exclusion, generating functions, and more advanced counting techniques.",
    vocabulary: ["inclusion–exclusion", "generating function", "recurrence counting"],
    formulas: [
      "$|A \\cup B| = |A| + |B| - |A \\cap B|$",
      "General I–E alternates sums over intersections of $k$ sets.",
    ],
  },
  "15": {
    objectives:
      "Define probability on finite sample spaces; compute probabilities of events and use basic rules.",
    vocabulary: ["sample space", "event", "probability measure", "independence (intro)"],
    formulas: [
      "$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$",
      "If $A,B$ disjoint: $P(A \\cup B) = P(A) + P(B)$",
    ],
  },
  "16": {
    objectives:
      "Work with conditional probability and Bayes’ rule; update beliefs with evidence.",
    vocabulary: ["conditional probability", "Bayes’ theorem", "posterior", "prior"],
    formulas: [
      "$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}$ when $P(B)>0$",
      "Bayes: $P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}$",
    ],
  },
  "17": {
    objectives:
      "Understand independence of events; compute probabilities for independent and mutually exclusive cases.",
    vocabulary: ["independent events", "mutually exclusive", "product rule for independent events"],
    formulas: [
      "Independence: $P(A \\cap B) = P(A)P(B)$",
      "For independent $A_1,\\ldots,A_k$: $P(\\bigcap_i A_i) = \\prod_i P(A_i)$",
    ],
  },
  "18": {
    objectives:
      "Define random variables, distributions, and expectation on discrete spaces.",
    vocabulary: ["random variable", "PMF", "expectation", "linearity of expectation"],
    formulas: [
      "$E[X] = \\sum_x x\\,P(X=x)$",
      "$E[aX+b] = aE[X]+b$; $E[X+Y]=E[X]+E[Y]$ (always, if expectations exist)",
    ],
  },
  "19": {
    objectives:
      "Compute expectations of sums and standard discrete distributions; use indicator variables.",
    vocabulary: ["indicator variable", "variance (intro)", "distribution"],
    formulas: [
      "Indicator: $E[I_A] = P(A)$",
      "If $X,Y$ independent: $E[XY]=E[X]E[Y]$",
    ],
  },
  "20": {
    objectives:
      "Apply linearity of expectation to hard counting problems; use sums of expectations.",
    vocabulary: ["linearity of expectation", "coupon collector (example)", "sum of RVs"],
    formulas: [
      "$E\\left[\\sum_i X_i\\right] = \\sum_i E[X_i]$ (no independence needed)",
    ],
  },
  "21": {
    objectives:
      "Bound deviations from the mean using Markov, Chebyshev, and Chernoff-style ideas (as covered).",
    vocabulary: ["variance", "Markov’s inequality", "Chebyshev", "concentration"],
    formulas: [
      "Markov: $P(X \\ge a) \\le E[X]/a$ for $X \\ge 0$",
      "Chebyshev: $P(|X-\\mu| \\ge k\\sigma) \\le 1/k^2$",
    ],
  },
  "22": {
    objectives:
      "Compare sizes of infinite sets; understand countable vs uncountable and diagonalization.",
    vocabulary: ["countable", "uncountable", "bijection", "Cantor diagonalization"],
    formulas: [
      "Countable: can list elements as $s_1,s_2,s_3,\\ldots$",
      "$|\\mathbb{N}| < |\\mathbb{R}|$ (reals are uncountable)",
    ],
  },
  "23": {
    objectives:
      "View computation through formal languages; distinguish decision problems and encodings.",
    vocabulary: ["language", "alphabet", "string", "decision problem", "encoding"],
    formulas: [],
  },
  "24": {
    objectives:
      "Define DFAs, regular languages, and prove some languages non-regular (e.g. pumping lemma).",
    vocabulary: ["DFA", "state", "transition", "regular language", "pumping lemma"],
    formulas: [
      "DFA $M=(Q,\\Sigma,\\delta,q_0,F)$ accepts $w$ if $\\hat\\delta(q_0,w) \\in F$.",
    ],
  },
  "25": {
    objectives:
      "Use context-free grammars and pushdown automata for structured languages (e.g. balanced parentheses).",
    vocabulary: ["CFG", "production", "parse tree", "PDA", "context-free language"],
    formulas: [],
  },
  "26": {
    objectives:
      "Define Turing machines as a general model of computation; simulate algorithms formally.",
    vocabulary: ["Turing machine", "tape", "decidable", "recognizable", "halting problem"],
    formulas: [],
  },
  "27": {
    objectives:
      "Prove undecidability via reduction; know classic unsolvable problems.",
    vocabulary: ["undecidable", "reduction", "halting problem", "Rice’s theorem (if covered)"],
    formulas: [],
  },
  "28": {
    objectives:
      "Define complexity class P; analyze polynomial-time algorithms and reductions between problems.",
    vocabulary: ["polynomial time", "class P", "polynomial reduction"],
    formulas: [
      "$P = \\{L \\mid \\exists\\text{ poly-time TM deciding } L\\}$",
    ],
  },
  "29": {
    objectives:
      "Understand NP, NP-completeness, and Cook–Levin style reductions; recognize classic NP-complete problems.",
    vocabulary: ["NP", "verifier", "NP-complete", "polynomial reduction", "SAT"],
    formulas: [
      "$NP = \\{L \\mid \\exists\\text{ poly-time verifier for certificates of } L\\}$",
      "NP-complete: in NP and every NP problem reduces to it in poly time.",
    ],
  },
};
