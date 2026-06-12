import type { FormulaEntry, SectionNote, VocabEntry } from "../utils/sectionNotes";

const v = (term: string, definition: string): VocabEntry => ({ term, definition });
const f = (expr: string, explanation: string): FormulaEntry => ({ expr, explanation });

/** Chapter-level study notes for FCOS (keyed by section number: "1", "5.1", …). */
export const FOCS_SECTION_NOTES: Record<string, SectionNote> = {
  "0": {
    objectives:
      "Understand how the course is organized, what discrete mathematics is for in CS, and habits for reading proofs and doing problems.",
    vocabulary: [
      v("discrete mathematics", "Math about countable, separate values (integers, graphs, logic)—not continuous calculus curves."),
      v("proof", "A logical argument that establishes a statement beyond doubt, given agreed axioms and definitions."),
      v("problem set", "Practice exercises that turn reading into skill; expect multiple attempts and revisions."),
      v("abstraction", "Ignoring irrelevant detail so one argument applies to many concrete situations."),
    ],
    formulas: [],
  },
  "1": {
    objectives:
      "See why discrete math matters through models (epidemics, matching, networks, computing) and get a first taste of what a proof is.",
    vocabulary: [
      v("model", "A simplified mathematical description of a real situation (e.g. who infects whom each day)."),
      v("discrete structure", "A finite or countable object such as a graph, list, or sequence of states."),
      v("graph (informal)", "Vertices (things) connected by edges (relationships); used for networks and matching."),
      v("proposition", "A statement that is either true or false—not a question or command."),
      v("proof", "A convincing chain of logical steps from known facts to the statement you claim."),
      v("counterexample", "One concrete instance showing a universal claim “for all …” is false."),
    ],
    formulas: [],
  },
  "1.1": {
    objectives:
      "Model epidemic spread on a grid: each person is infected or not; each day, you become infected if at least two neighbors were infected yesterday—then ask who ultimately gets infected and why modeling assumptions matter.",
    vocabulary: [
      v("discrete process", "Time moves in whole steps (days); each person is in one of finitely many states (here, infected or not)."),
      v("modeling assumption", "A deliberate simplification (grid layout, 2-neighbor rule) chosen before analyzing what happens next."),
      v("neighbor (grid)", "Another person in a square that shares a side with yours—not diagonal."),
    ],
    formulas: [
      f(
        "2-neighbor infection rule",
        "If at least two of your side-adjacent neighbors are infected today, you are infected tomorrow. The book calls this a 2-contact threshold on a grid—not $I_{t+1}=I_t\\cdot k$."
      ),
    ],
  },
  "1.2": {
    objectives:
      "Use bipartite matching to think about speed dating—who can be paired, not a page of formulas.",
    vocabulary: [],
    formulas: [],
  },
  "1.3": {
    objectives:
      "Represent friendship / ad reach with vertices and edges; focus on structure, not new equations.",
    vocabulary: [],
    formulas: [],
  },
  "1.4": {
    objectives:
      "Preview how discrete structures relate to computing—definitions and examples, not formal hardware formulas.",
    vocabulary: [],
    formulas: [],
  },
  "1.5": {
    objectives:
      "Know what counts as a proof and when a single counterexample disproves a “for all” claim.",
    vocabulary: [],
    formulas: [
      f(
        "To disprove $\\forall x\\, P(x)$, exhibit one $x$ with $\\neg P(x)$.",
        "The only core rule for this section: one valid counterexample is enough to refute a universal statement."
      ),
    ],
  },
  "1.6": {
    objectives: "Apply chapter 1 ideas on the problem set—practice, not new theory.",
    vocabulary: [],
    formulas: [],
  },
  "2": {
    objectives:
      "Work with sets, sequences, and graphs; start reading and writing short proofs, including the well-ordering principle.",
    vocabulary: [
      v("set", "A collection of distinct objects; order does not matter and duplicates are not counted twice."),
      v("element", "An object that belongs to a set, written $x \\in A$."),
      v("subset", "$A \\subseteq B$ means every element of $A$ is also in $B$."),
      v("sequence", "An ordered list of terms, often indexed $a_0,a_1,\\ldots$"),
      v("graph (vertices and edges)", "$G=(V,E)$: vertices are nodes, edges are pairs linking them."),
      v("axiom", "A starting assumption accepted without proof in a given theory."),
      v("well-ordering principle", "Every nonempty set of natural numbers has a smallest element."),
    ],
    formulas: [],
  },
  "2.1": {
    objectives: "Define subsets and membership; prove subset facts using element arguments.",
    vocabulary: [],
    formulas: [
      f(
        "$A \\subseteq B \\iff \\forall x\\,(x \\in A \\Rightarrow x \\in B)$",
        "The standard subset definition—use this when a proof reasons element-by-element."
      ),
    ],
  },
  "2.4.1": {
    objectives: "State the well-ordering principle and use it as an axiom in proofs on $\\mathbb{N}$.",
    vocabulary: [],
    formulas: [
      f(
        "Well-ordering: every nonempty $S \\subseteq \\mathbb{N}$ has a least element.",
        "Core axiom for this subsection; enables minimal-counterexample proofs."
      ),
    ],
  },
  "3": {
    objectives:
      "Translate statements into logic with connectives and quantifiers; use truth tables; distinguish deduction from induction.",
    vocabulary: [
      v("proposition", "Atomic true/false statement before quantifiers are added."),
      v("predicate", "A property $P(x)$ that becomes a proposition once $x$ is fixed."),
      v("implication", "$P \\Rightarrow Q$: if $P$ is true, then $Q$ must be true."),
      v("contrapositive", "$\\neg Q \\Rightarrow \\neg P$; equivalent to $P \\Rightarrow Q$."),
      v("quantifier ($\\forall$, $\\exists$)", "“For all” / “there exists”; specify the domain."),
      v("negation", "Flips truth; De Morgan and quantifier rules tell you how."),
      v("truth table", "Lists all combinations of inputs and the resulting truth of a formula."),
    ],
    formulas: [
      f(
        "$\\neg(P \\Rightarrow Q) \\equiv P \\land \\neg Q$",
        "The only way an implication fails is: hypothesis true, conclusion false."
      ),
      f(
        "$\\neg(\\forall x\\, P(x)) \\equiv \\exists x\\, \\neg P(x)$",
        "Not everyone satisfies $P$ iff someone violates $P$."
      ),
      f(
        "$\\neg(\\exists x\\, P(x)) \\equiv \\forall x\\, \\neg P(x)$",
        "Nobody has $P$ iff everyone lacks $P$."
      ),
    ],
  },
  "4": {
    objectives:
      "Prove implications directly, by contraposition, contradiction, and equivalence; prove facts about sets.",
    vocabulary: [
      v("direct proof", "Assume $P$; derive $Q$ step by step."),
      v("contraposition", "Prove $\\neg Q \\Rightarrow \\neg P$ instead of $P \\Rightarrow Q$."),
      v("contradiction", "Assume the negation of what you want; reach an impossible statement."),
      v("iff ($\\Leftrightarrow$)", "Prove both directions when showing equivalence."),
      v("set equality", "Often proved by mutual inclusion $A \\subseteq B$ and $B \\subseteq A$."),
    ],
    formulas: [
      f(
        "Direct: $P \\Rightarrow Q$",
        "Start with $P$ true; end with $Q$ established—most common proof shape."
      ),
      f(
        "$P \\Rightarrow Q \\equiv \\neg Q \\Rightarrow \\neg P$",
        "Contrapositive swaps and negates—useful when $\\neg Q$ is easier to work with."
      ),
      f(
        "$A = B$ via subsets",
        "Show every element of $A$ is in $B$ and vice versa; no need to list all elements."
      ),
    ],
  },
  "5": {
    objectives:
      "Use ordinary induction and well-ordering to prove $\\forall n\\, P(n)$, especially sums over integers.",
    vocabulary: [
      v("induction hypothesis", "Assumed property $P(k)$ in the inductive step."),
      v("base case", "Verify $P(0)$ or $P(1)$ where the ladder starts."),
      v("inductive step", "Show $P(k) \\Rightarrow P(k+1)$ (or similar)."),
      v("well-ordering", "Pick a minimal counterexample if induction is phrased that way."),
      v("strong vs ordinary (preview)", "Strong induction assumes all $P(0),\\ldots,P(k)$, not just $P(k)$."),
    ],
    formulas: [
      f(
        "Induction: $P(0)$ and $\\forall n\\,(P(n) \\Rightarrow P(n+1))$",
        "Together they prove $\\forall n\\, P(n)$—like climbing an infinite ladder rung by rung."
      ),
      f(
        "$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$",
        "Sum of first $n$ integers; classic first induction example."
      ),
      f(
        "$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$",
        "Squares sum; inductive step uses the previous line’s formula."
      ),
    ],
  },
  "6": {
    objectives:
      "Apply strong induction and variants when the step needs more than one prior case.",
    vocabulary: [
      v("strong induction", "Assume all $P(0),\\ldots,P(k)$ to prove $P(k+1)$."),
      v("leaping induction", "Step jumps by $m>1$; needs $m$ base cases."),
      v("well-founded induction (idea)", "Generalizes to orders where chains cannot descend forever."),
    ],
    formulas: [
      f(
        "Strong: $\\forall k\\,\\bigl((\\forall i \\le k\\, P(i)) \\Rightarrow P(k+1)\\bigr)$",
        "The hypothesis is the entire history, not only the previous term."
      ),
      f(
        "Many prior cases",
        "E.g. Fibonacci needs $F_k$ and $F_{k-1}$—strong induction fits naturally."
      ),
    ],
  },
  "7": {
    objectives:
      "Define functions recursively, solve recurrences, and connect recursion to induction.",
    vocabulary: [
      v("recursive definition", "Defines $f(n)$ in terms of smaller values plus bases."),
      v("recurrence", "An equation relating $a_n$ to earlier terms."),
      v("closed form", "A direct formula for $a_n$ without recursion."),
      v("base case", "Stopping values that anchor the recursion."),
    ],
    formulas: [
      f(
        "Fibonacci: $F_0=0$, $F_1=1$, $F_n = F_{n-1}+F_{n-2}$",
        "Each term is the sum of the two before; models rabbit pairs, tile counts, etc."
      ),
      f(
        "Hanoi: $T_n = 2T_{n-1}+1$, $T_1=1$ $\\Rightarrow$ $T_n = 2^n - 1$",
        "Moving $n$ disks needs roughly double the $(n-1)$-disk work plus one move."
      ),
    ],
  },
  "8": {
    objectives:
      "Prove properties of recursively defined structures (trees, lists) via structural induction.",
    vocabulary: [
      v("structural induction", "Induction on how an object was built from constructors."),
      v("recursive data type", "Defined by base cases and composition rules."),
      v("induction on structure", "Base: property on atoms; step: property preserved by each rule."),
    ],
    formulas: [
      f(
        "Structural induction template",
        "Prove for leaves/base, then show each constructor keeps the property—like DOM trees."
      ),
    ],
  },
  "9": {
    objectives:
      "Manipulate sums and describe growth with $O$, $\\Omega$, $\\Theta$ asymptotics.",
    vocabulary: [
      v("asymptotic notation", "Describes growth rate as $n \\to \\infty$, hiding constants."),
      v("big-O", "Upper bound up to constant factors."),
      v("geometric sum", "Terms multiply by a fixed ratio each step."),
      v("harmonic sum", "$H_n = \\sum_{i=1}^n 1/i$ grows like $\\ln n$."),
    ],
    formulas: [
      f(
        "$\\sum_{i=0}^{n} r^i = \\frac{r^{n+1}-1}{r-1}$ for $r \\ne 1$",
        "Finite geometric series; $r=2$ gives $2^{n+1}-1$."
      ),
      f(
        "$f(n) = O(g(n))$",
        "Eventually $f$ is bounded above by a constant times $g$—worst-case growth comparison."
      ),
    ],
  },
  "10": {
    objectives:
      "Use divisibility, gcd, modular arithmetic, and classic NT proofs.",
    vocabulary: [
      v("divides", "$a \\mid b$ means $b = ak$ for some integer $k$."),
      v("gcd", "Greatest common divisor—the largest $d$ dividing both $a$ and $b$."),
      v("modular arithmetic", "Work modulo $m$: two numbers equivalent if their difference is divisible by $m$."),
      v("prime", "Integer $p>1$ whose only positive divisors are $1$ and $p$."),
      v("congruent mod $m$", "$a \\equiv b \\pmod m$ means $m \\mid (a-b)$."),
    ],
    formulas: [
      f(
        "$a \\equiv b \\pmod{m} \\iff m \\mid (a-b)$",
        "Congruence is “same remainder”; addition and multiplication respect it."
      ),
      f(
        "Bézout identity",
        "$\\gcd(a,b)$ is the smallest positive integer expressible as $as+bt$ for integers $s,t$."
      ),
    ],
  },
  "11": {
    objectives:
      "Model problems with graphs; use degree, paths, trees, and planarity.",
    vocabulary: [
      v("vertex", "A node in a graph."),
      v("edge", "A link between two vertices (often unordered in simple graphs)."),
      v("path", "A sequence of vertices connected by edges, no repeated vertices."),
      v("cycle", "A closed path with at least three vertices."),
      v("tree", "Connected graph with no cycles—unique paths between vertices."),
      v("planar graph", "Can be drawn in the plane without edge crossings."),
      v("Eulerian", "Traverses every edge exactly once (conditions on degrees)."),
    ],
    formulas: [
      f(
        "Handshaking: $\\sum_{v} \\deg(v) = 2|E|$",
        "Each edge contributes $2$ to the total degree count."
      ),
      f(
        "Tree: $n$ vertices $\\Rightarrow$ $n-1$ edges",
        "Adding any edge to a tree creates exactly one cycle."
      ),
    ],
  },
  "12": {
    objectives:
      "Study matchings and colorings; apply Hall’s theorem.",
    vocabulary: [
      v("matching", "A set of edges with no shared vertices."),
      v("bipartite graph", "Vertices split into two sides; edges go across only."),
      v("chromatic number", "Minimum colors so adjacent vertices differ."),
      v("Hall’s condition", "Every subset $S$ on the left has $|N(S)| \\ge |S|$."),
    ],
    formulas: [
      f(
        "Hall’s theorem",
        "A perfect matching on the left exists iff every subset has enough neighbors on the right."
      ),
    ],
  },
  "13": {
    objectives:
      "Count with permutations, combinations, and product/sum rules.",
    vocabulary: [
      v("permutation", "Ordered arrangement of $k$ distinct objects from $n$."),
      v("combination", "Unordered subset of size $k$ from $n$."),
      v("binomial coefficient", "$\\binom{n}{k}$ counts $k$-subsets of an $n$-set."),
      v("pigeonhole principle", "More pigeons than holes forces a collision."),
    ],
    formulas: [
      f(
        "$P(n,k) = \\frac{n!}{(n-k)!}$",
        "Ordered choices: $n$ options for first, $n-1$ for second, etc."
      ),
      f(
        "$\\binom{n}{k} = \\frac{n!}{k!(n-k)!}$",
        "Divide by $k!$ to forget order among the chosen $k$ items."
      ),
      f(
        "Pigeonhole",
        "$n+1$ objects in $n$ boxes $\\Rightarrow$ some box has at least two."
      ),
    ],
  },
  "14": {
    objectives:
      "Use inclusion–exclusion and generating functions for harder counts.",
    vocabulary: [
      v("inclusion–exclusion", "Add singles, subtract pairs, add triples, … to avoid over/under-count."),
      v("generating function", "Encodes a sequence as coefficients of a power series."),
      v("recurrence counting", "Count objects by relating size-$n$ counts to smaller sizes."),
    ],
    formulas: [
      f(
        "$|A \\cup B| = |A| + |B| - |A \\cap B|$",
        "Elements in both were counted twice; subtract the overlap once."
      ),
      f(
        "General inclusion–exclusion",
        "Alternating sum over intersections fixes double-counting for many sets."
      ),
    ],
  },
  "15": {
    objectives:
      "Define probability on finite sample spaces and apply basic rules.",
    vocabulary: [
      v("sample space", "Set $\\Omega$ of all possible outcomes."),
      v("event", "A subset of $\\Omega$ whose probability we want."),
      v("probability measure", "Function $P$ with $P(\\Omega)=1$ and additivity on disjoint events."),
      v("independence (intro)", "Knowing one event does not change the other’s probability."),
    ],
    formulas: [
      f(
        "$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$",
        "Same inclusion–exclusion idea as counting, now for probabilities."
      ),
      f(
        "Disjoint events",
        "If $A \\cap B = \\emptyset$, then $P(A \\cup B) = P(A) + P(B)$."
      ),
    ],
  },
  "16": {
    objectives:
      "Use conditional probability and Bayes’ rule to update beliefs.",
    vocabulary: [
      v("conditional probability", "$P(A \\mid B)$: probability of $A$ given $B$ occurred."),
      v("Bayes’ theorem", "Reverses conditioning using $P(B \\mid A)$ and priors."),
      v("posterior", "Updated belief after observing evidence."),
      v("prior", "Belief before seeing evidence."),
    ],
    formulas: [
      f(
        "$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}$",
        "Restrict the sample space to outcomes where $B$ happened."
      ),
      f(
        "Bayes: $P(A \\mid B) = \\frac{P(B \\mid A)P(A)}{P(B)}$",
        "Turn “probability of evidence given cause” into “probability of cause given evidence.”"
      ),
    ],
  },
  "17": {
    objectives:
      "Understand independence and compute with product rules.",
    vocabulary: [
      v("independent events", "$P(A \\cap B) = P(A)P(B)$."),
      v("mutually exclusive", "$A \\cap B = \\emptyset$; cannot both happen."),
      v("product rule for independent events", "Multiply probabilities when independence holds."),
    ],
    formulas: [
      f(
        "Independence",
        "Knowing $B$ does not change $P(A)$—formalized by the product formula."
      ),
      f(
        "$P\\left(\\bigcap_i A_i\\right) = \\prod_i P(A_i)$",
        "For independent events, multiply individual probabilities."
      ),
    ],
  },
  "18": {
    objectives:
      "Define random variables, PMFs, and expectation.",
    vocabulary: [
      v("random variable", "A numeric function $X$ on outcomes $\\omega \\in \\Omega$."),
      v("PMF", "Probability mass function: $P(X=x)$ for discrete $X$."),
      v("expectation", "Weighted average $\\sum_x x\\,P(X=x)$."),
      v("linearity of expectation", "$E[X+Y]=E[X]+E[Y]$ always (even if dependent)."),
    ],
    formulas: [
      f(
        "$E[X] = \\sum_x x\\,P(X=x)$",
        "Long-run average if you repeat the experiment many times."
      ),
      f(
        "$E[aX+b] = aE[X]+b$",
        "Scaling and shifting expectations is straightforward."
      ),
    ],
  },
  "19": {
    objectives:
      "Compute expectations with indicators and common distributions.",
    vocabulary: [
      v("indicator variable", "$I_A=1$ if $A$ happens, else $0$."),
      v("variance (intro)", "Measures spread around the mean; $\\mathrm{Var}(X)=E[X^2]-E[X]^2$."),
      v("distribution", "How probability is spread over values of $X$."),
    ],
    formulas: [
      f(
        "$E[I_A] = P(A)$",
        "Indicators turn event probabilities into expectations—powerful for sums."
      ),
      f(
        "Independent product",
        "If $X,Y$ independent, then $E[XY]=E[X]E[Y]$."
      ),
    ],
  },
  "20": {
    objectives:
      "Apply linearity of expectation to tough counting problems.",
    vocabulary: [
      v("linearity of expectation", "Expectation of a sum equals sum of expectations."),
      v("coupon collector (example)", "Expected trials to see all types uses indicators."),
      v("sum of RVs", "Break $X$ into simple pieces whose expectations are easy."),
    ],
    formulas: [
      f(
        "$E\\left[\\sum_i X_i\\right] = \\sum_i E[X_i]$",
        "No independence required—often the key trick on homework."
      ),
    ],
  },
  "21": {
    objectives:
      "Bound tail probabilities with Markov and Chebyshev.",
    vocabulary: [
      v("variance", "Expected squared deviation from the mean."),
      v("Markov’s inequality", "Bounds $P(X \\ge a)$ for nonnegative $X$."),
      v("Chebyshev", "Bounds deviation from mean using variance."),
      v("concentration", "Probability that $X$ is near its mean."),
    ],
    formulas: [
      f(
        "Markov: $P(X \\ge a) \\le E[X]/a$ for $X \\ge 0$",
        "A large mean forces some probability mass in the upper tail."
      ),
      f(
        "Chebyshev: $P(|X-\\mu| \\ge k\\sigma) \\le 1/k^2$",
        "Far-from-mean events become unlikely if variance is controlled."
      ),
    ],
  },
  "22": {
    objectives:
      "Compare infinite sets; know countable vs uncountable.",
    vocabulary: [
      v("countable", "Can be listed $s_1,s_2,s_3,\\ldots$ (may be infinite)."),
      v("uncountable", "Too large to match with $\\mathbb{N}$ (e.g. $\\mathbb{R}$)."),
      v("bijection", "One-to-one correspondence; same “size” for counting purposes."),
      v("Cantor diagonalization", "Proves $\\mathbb{R}$ is uncountable by constructing a missing real."),
    ],
    formulas: [
      f(
        "Countable listing",
        "A set is countable iff there is a surjection from $\\mathbb{N}$ onto it."
      ),
      f(
        "$|\\mathbb{N}| < |\\mathbb{R}|$",
        "There is no bijection between naturals and reals—more reals than integers."
      ),
    ],
  },
  "23": {
    objectives:
      "View computation via formal languages and encodings.",
    vocabulary: [
      v("language", "A set of strings over an alphabet $\\Sigma$."),
      v("alphabet", "Finite set of symbols strings are built from."),
      v("string", "Finite sequence of symbols, including the empty string $\\varepsilon$."),
      v("decision problem", "Language membership: is $w \\in L$?"),
      v("encoding", "Represent instances as strings so machines can read them."),
    ],
    formulas: [],
  },
  "24": {
    objectives:
      "Define DFAs and regular languages; use pumping for non-regularity.",
    vocabulary: [
      v("DFA", "Deterministic finite automaton: finite states, one transition per symbol."),
      v("state", "Memory of “where” the machine is while reading input."),
      v("transition", "Rule $\\delta(q,a)$ telling the next state."),
      v("regular language", "Accepted by some DFA (or described by regex / NFA)."),
      v("pumping lemma", "Tool to prove a language is not regular."),
    ],
    formulas: [
      f(
        "DFA $M=(Q,\\Sigma,\\delta,q_0,F)$",
        "Accepts $w$ if $\\hat\\delta(q_0,w) \\in F$—read left to right, no extra memory."
      ),
    ],
  },
  "25": {
    objectives:
      "Use CFGs and PDAs for nested structure (e.g. balanced parentheses).",
    vocabulary: [
      v("CFG", "Context-free grammar: rewrite nonterminals with productions."),
      v("production", "Rule like $S \\to aSb \\mid \\varepsilon$ generating strings."),
      v("parse tree", "Shows how a string was derived from the start symbol."),
      v("PDA", "Pushdown automaton: DFA plus a stack."),
      v("context-free language", "Generated by some CFG / accepted by some PDA."),
    ],
    formulas: [],
  },
  "26": {
    objectives:
      "Define Turing machines as general models of computation.",
    vocabulary: [
      v("Turing machine", "Infinite tape + finite control; universal model of algorithms."),
      v("tape", "One-dimensional array cells read/written by the head."),
      v("decidable", "Language with an algorithm that always halts yes/no."),
      v("recognizable", "Accepted by a TM that halts on yes-instances (may loop on no)."),
      v("halting problem", "Undecidable: no program decides if arbitrary code halts."),
    ],
    formulas: [],
  },
  "27": {
    objectives:
      "Prove undecidability by reduction from known hard problems.",
    vocabulary: [
      v("undecidable", "No algorithm solves all instances correctly and always halts."),
      v("reduction", "Transform instance of $A$ into instance of $B$ preserving yes/no."),
      v("halting problem", "Canonical undecidable language about program behavior."),
      v("Rice’s theorem (if covered)", "Any nontrivial semantic property of programs is undecidable."),
    ],
    formulas: [],
  },
  "28": {
    objectives:
      "Define class P and polynomial-time reductions.",
    vocabulary: [
      v("polynomial time", "Runtime $O(n^k)$ for some fixed $k$."),
      v("class P", "Languages decidable in polynomial time."),
      v("polynomial reduction", "Transform instances in poly time, preserve answer."),
    ],
    formulas: [
      f(
        "$P = \\{L \\mid \\exists\\text{ poly-time TM deciding } L\\}$",
        "“Efficiently solvable” in theory—$k$ may be large but not exponential in $n$."
      ),
    ],
  },
  "29": {
    objectives:
      "Understand NP, verifiers, and NP-completeness.",
    vocabulary: [
      v("NP", "Languages with short certificates checkable in polynomial time."),
      v("verifier", "Poly-time algorithm checking a proposed proof/certificate."),
      v("NP-complete", "Hardest problems in NP; all NP problems reduce to them."),
      v("polynomial reduction", "Efficient transformation preserving yes/no answers."),
      v("SAT", "Boolean satisfiability; first known NP-complete problem."),
    ],
    formulas: [
      f(
        "$NP = \\{L \\mid \\exists\\text{ poly-time verifier for certificates}\\}$",
        "Think “guess + check”: if answer is yes, a short proof can be verified quickly."
      ),
      f(
        "NP-complete definition",
        "In NP and every NP problem reduces to it—solve one efficiently and solve all NP efficiently."
      ),
    ],
  },
};
