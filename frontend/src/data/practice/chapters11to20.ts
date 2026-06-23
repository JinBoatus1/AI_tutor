import type { PracticeSet } from "../../practice/types";

export const chapter11: PracticeSet = {
  chapter: "11",
  title: "Graphs",
  warmup: [
    { id: "ch11-v-e", front: "Graph basics", back: "A graph is $G=(V,E)$ with vertices $V$ and edges $E$." },
    { id: "ch11-degree", front: "Degree of a vertex", back: "The degree $\\deg(v)$ is the number of edges incident to $v$." },
    { id: "ch11-handshake", front: "Handshake Lemma", back: "In any finite undirected graph, $\\sum_{v\\in V}\\deg(v)=2|E|$." },
    { id: "ch11-path", front: "Path", back: "A path is a sequence of adjacent vertices with no repeated edge." },
    { id: "ch11-cycle", front: "Cycle", back: "A cycle is a closed path with no repeated vertices except start/end." },
    { id: "ch11-tree", front: "Tree", back: "A tree is a connected acyclic graph; if it has $n$ vertices, then it has $n-1$ edges." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch11-p1",
      prompt: "A simple undirected graph has vertex degrees $3,3,2,2,2$. How many edges does it have?",
      choices: ["5", "6", "7", "12"],
      answerIndex: 1,
      why: "By Handshake Lemma, the degree sum is $12$, so $2|E|=12$ and $|E|=6$.",
    },
    {
      kind: "mcq",
      id: "ch11-p2",
      prompt: "Which statement is always true for every tree with $n\\ge 1$ vertices?",
      choices: [
        "It has exactly $n$ edges",
        "It contains a cycle",
        "It has exactly $n-1$ edges",
        "All vertices have degree $2$",
      ],
      answerIndex: 2,
      why: "A tree is connected and acyclic; a standard theorem gives $|E|=n-1$.",
    },
    {
      kind: "proof-order",
      id: "ch11-p3",
      prompt: "Order the proof steps for: every tree with at least two vertices has a leaf.",
      steps: [
        { id: "s1", text: "Let $T$ be a tree with at least two vertices.", deps: [] },
        { id: "s2", text: "Choose a longest simple path in $T$: $v_0,v_1,\\dots,v_k$.", deps: ["s1"] },
        {
          id: "s3",
          text: "Suppose $v_0$ had a neighbor $u\\neq v_1$; then $u$ is not on the path (otherwise a cycle forms).",
          deps: ["s2"],
        },
        { id: "s4", text: "Then $u,v_0,v_1,\\dots,v_k$ would be a longer simple path, contradiction.", deps: ["s3"] },
        { id: "s5", text: "So $\\deg(v_0)=1$, hence $v_0$ is a leaf.", deps: ["s4"] },
      ],
      why: "The endpoint leaf argument depends on first selecting a longest path and then deriving the contradiction.",
    },
    {
      kind: "spot-flaw",
      id: "ch11-p4",
      prompt: "Find the invalid line in this argument: “Every connected graph is a tree.”",
      lines: [
        { id: "l1", text: "Let $G$ be connected." },
        { id: "l2", text: "Because $G$ is connected, there is a path between every pair of vertices." },
        { id: "l3", text: "A graph with a path between every pair cannot contain a cycle." },
        { id: "l4", text: "Therefore $G$ is connected and acyclic, so $G$ is a tree." },
      ],
      flawLineId: "l3",
      why: "Connected graphs can still contain cycles; connectivity alone does not imply acyclic.",
    },
    {
      kind: "fill-blank",
      id: "ch11-p5",
      prompt: "Complete the theorem: if all vertex degrees in an undirected graph are odd, then the number of vertices is ____.",
      before: "By Handshake Lemma, the sum of degrees is even. A sum of odd integers is even only when the count of summands is",
      after: ". Therefore the number of odd-degree vertices is even.",
      accept: ["even", "an even number"],
      why: "Odd + odd = even, but odd repeated an odd number of times gives odd; so the count must be even.",
    },
  ],
  challenge: [
    {
      id: "ch11-c1",
      prompt: "Prove that every connected graph has a spanning tree.",
      solution:
        "Start with any connected graph $G$. If $G$ has no cycle, it is already a tree. Otherwise remove one edge from a cycle. Removing a cycle edge does not disconnect the graph, because the cycle provides an alternate route. Repeat this process while cycles remain. Since the graph is finite, the process terminates. The final graph is connected and acyclic on the same vertex set, hence a spanning tree of $G$. $\\blacksquare$",
      rubric:
        "Must describe iterative cycle-edge deletion; justify connectivity is preserved when deleting an edge on a cycle; note finiteness/termination; conclude resulting graph is connected and acyclic on all original vertices, i.e., a spanning tree.",
    },
    {
      id: "ch11-c2",
      prompt: "Let $G$ be a simple graph on $n\\ge 2$ vertices. Show that if every vertex has degree at least $(n-1)/2$, then $G$ is connected.",
      solution:
        "Assume $G$ is disconnected. Let $C$ be a connected component of minimum size with $|C|=m\\le n/2$. Any vertex $v\\in C$ can only be adjacent to vertices of $C$, so $\\deg(v)\\le m-1\\le n/2-1 < (n-1)/2$ (for both parity cases this contradicts $\\deg(v)\\ge (n-1)/2$). Hence disconnectedness is impossible, so $G$ is connected. $\\blacksquare$",
      rubric:
        "Needs contradiction setup with a smallest component (or any component of size at most $n/2$); upper-bound internal degree by component size; compare to required minimum degree and derive contradiction; clearly conclude connectedness.",
    },
  ],
};

export const chapter12: PracticeSet = {
  chapter: "12",
  title: "Matching and Coloring",
  warmup: [
    { id: "ch12-matching", front: "Matching", back: "A matching is a set of pairwise vertex-disjoint edges." },
    { id: "ch12-perfect", front: "Perfect matching", back: "A perfect matching matches every vertex exactly once." },
    { id: "ch12-bipartite", front: "Bipartite graph", back: "A graph is bipartite if $V=L\\cup R$ and every edge goes between $L$ and $R$." },
    { id: "ch12-hall", front: "Hall's condition", back: "For all $S\\subseteq L$, $|N(S)|\\ge |S|$." },
    { id: "ch12-kcolor", front: "$k$-coloring", back: "A proper $k$-coloring assigns colors so adjacent vertices get different colors." },
    { id: "ch12-chromatic", front: "Chromatic number", back: "$\\chi(G)$ is the minimum number of colors in a proper coloring." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch12-p1",
      prompt: "In a bipartite graph with left side $L$, which condition guarantees a matching saturating $L$?",
      choices: [
        "$|L|=|R|$",
        "Every left vertex has degree at least $1$",
        "For all $S\\subseteq L$, $|N(S)|\\ge |S|$",
        "The graph has no cycles",
      ],
      answerIndex: 2,
      why: "This is exactly Hall's theorem criterion for a matching that covers all of $L$.",
    },
    {
      kind: "mcq",
      id: "ch12-p2",
      prompt: "What is $\\chi(K_5)$, the chromatic number of the complete graph on five vertices?",
      choices: ["2", "3", "4", "5"],
      answerIndex: 3,
      why: "In $K_5$, every pair is adjacent, so all 5 vertices need distinct colors.",
    },
    {
      kind: "proof-order",
      id: "ch12-p3",
      prompt: "Order the proof idea: every graph with maximum degree $\\Delta$ is $(\\Delta+1)$-colorable.",
      steps: [
        { id: "s1", text: "List the vertices in any order $v_1,\\dots,v_n$.", deps: [] },
        { id: "s2", text: "Color vertices greedily from $v_1$ to $v_n$.", deps: ["s1"] },
        {
          id: "s3",
          text: "When coloring $v_i$, at most $\\Delta$ neighbors are already colored, so at most $\\Delta$ colors are blocked.",
          deps: ["s2"],
        },
        { id: "s4", text: "Among $\\Delta+1$ colors, at least one remains available for $v_i$.", deps: ["s3"] },
        { id: "s5", text: "Proceeding through all vertices gives a proper $(\\Delta+1)$-coloring.", deps: ["s4"] },
      ],
      why: "The greedy argument requires local blocking-count first, then availability, then global conclusion.",
    },
    {
      kind: "spot-flaw",
      id: "ch12-p4",
      prompt: "Spot the flaw: “If every left vertex has degree at least 1, then Hall's condition holds.”",
      lines: [
        { id: "l1", text: "Take any subset $S\\subseteq L$." },
        { id: "l2", text: "Each $u\\in S$ has at least one neighbor in $R$." },
        { id: "l3", text: "So $N(S)$ has at least $|S|$ vertices." },
        { id: "l4", text: "Therefore Hall's condition is true." },
      ],
      flawLineId: "l3",
      why: "Different vertices in $S$ may share the same neighbor, so degree $\\ge1$ does not force $|N(S)|\\ge|S|$.",
    },
    {
      kind: "fill-blank",
      id: "ch12-p5",
      prompt: "Complete: Every bipartite graph has no odd ___.",
      before: "A graph is bipartite iff it has no odd",
      after: ".",
      accept: ["cycle", "cycles"],
      why: "Odd cycles are exactly the obstruction to bipartiteness.",
    },
  ],
  challenge: [
    {
      id: "ch12-c1",
      prompt: "Use Hall's theorem to prove that if $A_1,\\dots,A_n$ are subsets of a universe and for every $k$ sets their union has size at least $k$, then we can pick distinct representatives $x_i\\in A_i$.",
      solution:
        "Build a bipartite graph with left vertices $1,\\dots,n$ (set indices) and right vertices as universe elements. Put edge $(i,x)$ iff $x\\in A_i$. A system of distinct representatives is exactly a matching saturating the left side. For any $S\\subseteq\\{1,\\dots,n\\}$, $N(S)=\\bigcup_{i\\in S}A_i$, whose size is at least $|S|$ by hypothesis. Hall's condition holds, so there exists a matching saturating all left vertices. The matched right vertices are distinct representatives. $\\blacksquare$",
      rubric:
        "Needs correct bipartite encoding; explicit identification of SDR with left-saturating matching; verification that Hall's condition equals the union-size hypothesis for every subset; conclusion via Hall.",
    },
    {
      id: "ch12-c2",
      prompt: "Prove that every tree is 2-colorable.",
      solution:
        "Fix a root $r$. Partition vertices by parity of distance from $r$: even-distance set $E$ and odd-distance set $O$. In a tree, every edge joins vertices whose distances from $r$ differ by exactly 1, so every edge goes between $E$ and $O$. Thus assigning color 1 to $E$ and color 2 to $O$ gives a proper coloring. Therefore every tree is bipartite and 2-colorable. $\\blacksquare$",
      rubric:
        "Must define coloring by distance parity (or equivalent bipartition); justify adjacent vertices get opposite parity; conclude proper 2-coloring. Alternative induction proof is acceptable if complete.",
    },
  ],
};

export const chapter13: PracticeSet = {
  chapter: "13",
  title: "Counting",
  warmup: [
    { id: "ch13-rule-sum", front: "Sum rule", back: "If choices are disjoint with counts $a,b$, total is $a+b$." },
    { id: "ch13-rule-prod", front: "Product rule", back: "If a process has $a$ then $b$ choices, total is $ab$." },
    { id: "ch13-factorial", front: "Factorial", back: "$n!=n(n-1)\\cdots 1$ counts permutations of $n$ distinct objects." },
    { id: "ch13-perm", front: "Permutations", back: "Ordered selections of $k$ from $n$: $P(n,k)=\\frac{n!}{(n-k)!}$." },
    { id: "ch13-comb", front: "Combinations", back: "Unordered selections: $\\binom{n}{k}=\\frac{n!}{k!(n-k)!}$." },
    { id: "ch13-binom", front: "Binomial theorem", back: "$(x+y)^n=\\sum_{k=0}^n\\binom{n}{k}x^ky^{n-k}$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch13-p1",
      prompt: "How many 4-letter strings over 26 letters allow repetition?",
      choices: ["$26+4$", "$26\\cdot4$", "$26^4$", "$4!$"],
      answerIndex: 2,
      why: "Each of 4 positions has 26 choices independently, so by product rule: $26^4$.",
    },
    {
      kind: "mcq",
      id: "ch13-p2",
      prompt: "How many ways to choose 3 students from 10 (order irrelevant)?",
      choices: ["$10^3$", "$P(10,3)$", "$\\binom{10}{3}$", "$3^{10}$"],
      answerIndex: 2,
      why: "Choosing without order uses combinations: $\\binom{10}{3}$.",
    },
    {
      kind: "proof-order",
      id: "ch13-p3",
      prompt: "Order a counting proof of $\\binom{n}{k}=\\binom{n}{n-k}$.",
      steps: [
        { id: "s1", text: "Consider choosing a $k$-subset $S$ of an $n$-element set.", deps: [] },
        { id: "s2", text: "This can be done in $\\binom{n}{k}$ ways.", deps: ["s1"] },
        { id: "s3", text: "Choosing $S$ is equivalent to choosing its complement of size $n-k$.", deps: ["s1"] },
        { id: "s4", text: "Complement choices are counted by $\\binom{n}{n-k}$.", deps: ["s3"] },
        { id: "s5", text: "Both count the same objects, so $\\binom{n}{k}=\\binom{n}{n-k}$.", deps: ["s2", "s4"] },
      ],
      why: "The double-counting structure requires identifying one set of objects and two valid counts.",
    },
    {
      kind: "spot-flaw",
      id: "ch13-p4",
      prompt: "Find the incorrect step in this claim: “There are $n^2$ subsets of an $n$-element set.”",
      lines: [
        { id: "l1", text: "For each of the $n$ elements, either include it or exclude it." },
        { id: "l2", text: "So each element contributes 2 choices independently." },
        { id: "l3", text: "Therefore the number of subsets is $n\\cdot n=n^2$." },
      ],
      flawLineId: "l3",
      why: "Independent binary choices give $2^n$, not $n^2$.",
    },
    {
      kind: "fill-blank",
      id: "ch13-p5",
      prompt: "Complete the identity: $\\sum_{k=0}^{n}\\binom{n}{k}=\\,$ ____.",
      before: "Using $(1+1)^n$, we get",
      after: ".",
      accept: ["$2^n$", "2^n"],
      why: "Substituting $x=y=1$ in the binomial theorem gives total subsets of an $n$-set.",
    },
  ],
  challenge: [
    {
      id: "ch13-c1",
      prompt: "Prove combinatorially that $\\sum_{k=0}^{n}k\\binom{n}{k}=n2^{n-1}$.",
      solution:
        "Count pairs $(S,i)$ where $S\\subseteq[n]$ and $i\\in S$ in two ways. First by subset size: for each $k$, there are $\\binom{n}{k}$ subsets of size $k$, each contributes $k$ choices of $i$, giving $\\sum_{k=0}^n k\\binom{n}{k}$. Second by choosing $i$ first: $n$ choices for $i$, and then any subset of the remaining $n-1$ elements may be included/excluded, giving $2^{n-1}$ subsets containing $i$. Total is $n2^{n-1}$. Equate counts. $\\blacksquare$",
      rubric:
        "Must clearly define counted objects $(S,i)$; provide both counting methods correctly; include why second count is $n\\cdot2^{n-1}$; conclude by equating.",
    },
    {
      id: "ch13-c2",
      prompt: "How many permutations of the letters in BANANA are there? Give a proof.",
      solution:
        "The multiset has 6 letters with multiplicities: $A$ appears 3 times, $N$ appears 2 times, $B$ appears 1 time. If all were distinct we'd have $6!$ orders, but permutations among identical letters do not create new words: divide by $3!$ for the A's and by $2!$ for the N's. Count is $\\frac{6!}{3!2!}=60$. $\\blacksquare$",
      rubric:
        "Needs multiset-permutation reasoning; identifies repeated letters and corresponding divisors; computes $6!/(3!2!)$ correctly; explains why division is required.",
    },
  ],
};

export const chapter14: PracticeSet = {
  chapter: "14",
  title: "Advanced Counting",
  warmup: [
    { id: "ch14-inclusion", front: "Inclusion-Exclusion (2 sets)", back: "$|A\\cup B|=|A|+|B|-|A\\cap B|$." },
    { id: "ch14-pigeon", front: "Pigeonhole principle", back: "If $N$ objects go into $k$ boxes, some box has at least $\\lceil N/k\\rceil$ objects." },
    { id: "ch14-surj", front: "Surjection", back: "A function $f:A\\to B$ is surjective if every $b\\in B$ has a preimage." },
    { id: "ch14-derangement", front: "Derangement", back: "A permutation with no fixed points." },
    { id: "ch14-stars", front: "Stars and bars", back: "Number of nonnegative integer solutions to $x_1+\\cdots+x_k=n$ is $\\binom{n+k-1}{k-1}$." },
    { id: "ch14-ie3", front: "Inclusion-Exclusion (3 sets)", back: "$|A\\cup B\\cup C|=\\sum|A_i|-\\sum|A_i\\cap A_j|+|A\\cap B\\cap C|$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch14-p1",
      prompt: "How many positive integer solutions to $x_1+x_2+x_3=10$?",
      choices: ["$\\binom{9}{2}$", "$\\binom{10}{3}$", "$\\binom{12}{2}$", "$3^{10}$"],
      answerIndex: 0,
      why: "Positive solutions correspond to nonnegative solutions of $y_1+y_2+y_3=7$, giving $\\binom{7+3-1}{2}=\\binom{9}{2}$.",
    },
    {
      kind: "mcq",
      id: "ch14-p2",
      prompt: "At least how many people are needed to guarantee two share a birth month?",
      choices: ["12", "13", "24", "365"],
      answerIndex: 1,
      why: "There are 12 month boxes; by pigeonhole, 13 people force a collision.",
    },
    {
      kind: "proof-order",
      id: "ch14-p3",
      prompt: "Order a derivation of the two-set inclusion-exclusion formula.",
      steps: [
        { id: "s1", text: "Start with $|A|+|B|$.", deps: [] },
        { id: "s2", text: "Elements in $A\\setminus B$ and $B\\setminus A$ are counted once each.", deps: ["s1"] },
        { id: "s3", text: "Elements in $A\\cap B$ are counted twice in $|A|+|B|$.", deps: ["s1"] },
        { id: "s4", text: "Subtract $|A\\cap B|$ to correct the overcount.", deps: ["s2", "s3"] },
        { id: "s5", text: "So $|A\\cup B|=|A|+|B|-|A\\cap B|$.", deps: ["s4"] },
      ],
      why: "You must identify exact overcount before subtracting intersection.",
    },
    {
      kind: "spot-flaw",
      id: "ch14-p4",
      prompt: "Find the flaw: “From inclusion-exclusion, $|A\\cup B\\cup C|=|A|+|B|+|C|-|A\\cap B\\cap C|$.”",
      lines: [
        { id: "l1", text: "Add sizes of $A,B,C$." },
        { id: "l2", text: "Subtract $|A\\cap B\\cap C|$ to fix double-counting." },
        { id: "l3", text: "Done." },
      ],
      flawLineId: "l2",
      why: "Pairwise intersections must be subtracted; triple intersection is then added back, not merely subtracted once.",
    },
    {
      kind: "fill-blank",
      id: "ch14-p5",
      prompt: "Complete: number of nonnegative integer solutions to $x_1+x_2+x_3+x_4=8$ is ____.",
      before: "By stars and bars, the count is",
      after: ".",
      accept: ["$\\binom{11}{3}$", "binom(11,3)", "165", "$165$"],
      why: "Use formula $\\binom{n+k-1}{k-1}=\\binom{8+4-1}{3}=\\binom{11}{3}=165$.",
    },
  ],
  challenge: [
    {
      id: "ch14-c1",
      prompt: "Derive a formula for the number of surjections from an $n$-element set onto a $k$-element set.",
      solution:
        "Count all functions first: $k^n$. Let $A_i$ be functions that miss codomain element $i$. We need $k^n-|\\cup_i A_i|$. By inclusion-exclusion, $|A_i|=(k-1)^n$, $|A_i\\cap A_j|=(k-2)^n$, etc. Therefore the number of surjections is\n$\\sum_{j=0}^k(-1)^j\\binom{k}{j}(k-j)^n$.\nThis is also $k!\\,S(n,k)$, where $S(n,k)$ are Stirling numbers of the second kind. $\\blacksquare$",
      rubric:
        "Must define missing-value events $A_i$; apply inclusion-exclusion correctly with alternating signs and binomial coefficients; produce final summation with $(k-j)^n$ term; optionally connect to $k!S(n,k)$.",
    },
    {
      id: "ch14-c2",
      prompt: "Use inclusion-exclusion to count derangements of $n$ elements.",
      solution:
        "Let $A_i$ be permutations where position $i$ is fixed. Then derangements are $n!-|\\cup_i A_i|$. For any $j$ specific fixed positions, remaining permutations count is $(n-j)!$, and there are $\\binom{n}{j}$ such choices. So\n$D_n=\\sum_{j=0}^n(-1)^j\\binom{n}{j}(n-j)! = n!\\sum_{j=0}^n\\frac{(-1)^j}{j!}$.\nHence $D_n$ is the nearest integer to $n!/e$. $\\blacksquare$",
      rubric:
        "Needs event definition by fixed points; intersection size $(n-j)!$ with combinatorial factor $\\binom{n}{j}$; correct alternating sum and simplified $n!\\sum(-1)^j/j!$ form.",
    },
  ],
};

export const chapter15: PracticeSet = {
  chapter: "15",
  title: "Probability",
  warmup: [
    { id: "ch15-space", front: "Sample space", back: "The set $\\Omega$ of all possible outcomes." },
    { id: "ch15-event", front: "Event", back: "An event is a subset of $\\Omega$." },
    { id: "ch15-axiom", front: "Probability axioms", back: "$0\\le P(A)\\le1$, $P(\\Omega)=1$, additivity on disjoint events." },
    { id: "ch15-compl", front: "Complement rule", back: "$P(A^c)=1-P(A)$." },
    { id: "ch15-union", front: "Union formula", back: "$P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$." },
    { id: "ch15-uniform", front: "Uniform finite model", back: "If outcomes are equally likely, $P(A)=|A|/|\\Omega|$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch15-p1",
      prompt: "Roll a fair die once. What is $P(\\text{even})$?",
      choices: ["$1/6$", "$1/3$", "$1/2$", "$2/3$"],
      answerIndex: 2,
      why: "Even outcomes are $\\{2,4,6\\}$, so $3/6=1/2$.",
    },
    {
      kind: "mcq",
      id: "ch15-p2",
      prompt: "If $P(A)=0.4$, then $P(A^c)$ equals",
      choices: ["0.6", "0.4", "1.4", "0.2"],
      answerIndex: 0,
      why: "Use complement rule: $1-0.4=0.6$.",
    },
    {
      kind: "proof-order",
      id: "ch15-p3",
      prompt: "Order a derivation of $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$.",
      steps: [
        { id: "s1", text: "Write $A\\cup B$ as disjoint union: $(A\\setminus B)\\cup B$.", deps: [] },
        { id: "s2", text: "So $P(A\\cup B)=P(A\\setminus B)+P(B)$.", deps: ["s1"] },
        { id: "s3", text: "Also $A=(A\\setminus B)\\cup(A\\cap B)$ disjointly.", deps: [] },
        { id: "s4", text: "Hence $P(A\\setminus B)=P(A)-P(A\\cap B)$.", deps: ["s3"] },
        { id: "s5", text: "Substitute into step 2 to get the union formula.", deps: ["s2", "s4"] },
      ],
      why: "The formula follows from two disjoint decompositions and substitution.",
    },
    {
      kind: "spot-flaw",
      id: "ch15-p4",
      prompt: "Spot the invalid line: “$P(A\\cup B)=P(A)+P(B)$ for any events $A,B$.”",
      lines: [
        { id: "l1", text: "Probability is additive for disjoint events." },
        { id: "l2", text: "Events $A$ and $B$ may overlap." },
        { id: "l3", text: "So still $P(A\\cup B)=P(A)+P(B)$." },
      ],
      flawLineId: "l3",
      why: "If events overlap, intersection is counted twice and must be subtracted.",
    },
    {
      kind: "fill-blank",
      id: "ch15-p5",
      prompt: "Complete: If $A\\subseteq B$, then $P(A)$ is ____ $P(B)$.",
      before: "By monotonicity from additivity,",
      after: ".",
      accept: ["less than or equal to", "\\le", "at most", "≤"],
      why: "Since $B=A\\cup(B\\setminus A)$ disjointly, $P(B)=P(A)+P(B\\setminus A)\\ge P(A)$.",
    },
  ],
  challenge: [
    {
      id: "ch15-c1",
      prompt: "A 5-card hand is dealt from a standard 52-card deck. Compute the probability of getting at least one ace.",
      solution:
        "Use complement. Total hands: $\\binom{52}{5}$. Hands with no ace: choose all 5 from 48 non-aces, so $\\binom{48}{5}$. Therefore\n$P(\\text{at least one ace})=1-\\frac{\\binom{48}{5}}{\\binom{52}{5}}$.\nThis exact expression is standard and numerically about $0.3412$. $\\blacksquare$",
      rubric:
        "Should use complement event “no ace”; counts total and favorable hands with combinations; forms ratio and subtracts from 1; arithmetic simplification optional.",
    },
    {
      id: "ch15-c2",
      prompt: "Show that for any events $A,B,C$, $P(A\\cup B\\cup C)$ equals the inclusion-exclusion expression.",
      solution:
        "Apply the two-event union rule twice:\n$P(A\\cup B\\cup C)=P((A\\cup B)\\cup C)=P(A\\cup B)+P(C)-P((A\\cup B)\\cap C)$.\nNow expand $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$, and note\n$(A\\cup B)\\cap C=(A\\cap C)\\cup(B\\cap C)$.\nApply the two-event rule again to that union:\n$P((A\\cap C)\\cup(B\\cap C))=P(A\\cap C)+P(B\\cap C)-P(A\\cap B\\cap C)$.\nSubstitute and simplify to get\n$P(A\\cup B\\cup C)=P(A)+P(B)+P(C)-P(A\\cap B)-P(A\\cap C)-P(B\\cap C)+P(A\\cap B\\cap C)$. $\\blacksquare$",
      rubric:
        "Must show structured derivation (not just state formula); correctly distribute intersection over union; include triple-intersection correction term with plus sign.",
    },
  ],
};

export const chapter16: PracticeSet = {
  chapter: "16",
  title: "Conditional Probability",
  warmup: [
    { id: "ch16-def", front: "Conditional probability", back: "$P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}$ for $P(B)>0$." },
    { id: "ch16-mult", front: "Multiplication rule", back: "$P(A\\cap B)=P(A\\mid B)P(B)=P(B\\mid A)P(A)$." },
    { id: "ch16-bayes", front: "Bayes' theorem", back: "$P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}$." },
    { id: "ch16-partition", front: "Law of total probability", back: "If $\\{H_i\\}$ partitions $\\Omega$, then $P(B)=\\sum_i P(B\\mid H_i)P(H_i)$." },
    { id: "ch16-base", front: "Base rate", back: "Prior probability of a hypothesis before seeing evidence." },
    { id: "ch16-posterior", front: "Posterior", back: "Updated probability after conditioning on observed evidence." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch16-p1",
      prompt: "If $P(A\\cap B)=0.12$ and $P(B)=0.3$, what is $P(A\\mid B)$?",
      choices: ["0.18", "0.4", "2.5", "0.12"],
      answerIndex: 1,
      why: "$P(A\\mid B)=0.12/0.3=0.4$.",
    },
    {
      kind: "mcq",
      id: "ch16-p2",
      prompt: "A disease prevalence is $1\\%$. Test sensitivity is $95\\%$, false positive rate is $10\\%$. Which is true?",
      choices: [
        "$P(\\text{disease}\\mid +)$ must be above $90\\%$",
        "$P(\\text{disease}\\mid +)$ equals $95\\%$",
        "$P(\\text{disease}\\mid +)$ is much lower than sensitivity because prevalence is low",
        "$P(+)$ equals prevalence",
      ],
      answerIndex: 2,
      why: "Low base rate can dominate posterior despite high sensitivity; Bayes combines both rates.",
    },
    {
      kind: "proof-order",
      id: "ch16-p3",
      prompt: "Order the derivation of Bayes' theorem.",
      steps: [
        { id: "s1", text: "From definition, $P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}$.", deps: [] },
        { id: "s2", text: "Also $P(B\\mid A)=\\frac{P(A\\cap B)}{P(A)}$.", deps: [] },
        { id: "s3", text: "Rearrange second equation: $P(A\\cap B)=P(B\\mid A)P(A)$.", deps: ["s2"] },
        { id: "s4", text: "Substitute into first equation.", deps: ["s1", "s3"] },
        { id: "s5", text: "Conclude $P(A\\mid B)=\\frac{P(B\\mid A)P(A)}{P(B)}$.", deps: ["s4"] },
      ],
      why: "Bayes follows by expressing intersection two ways and substituting.",
    },
    {
      kind: "spot-flaw",
      id: "ch16-p4",
      prompt: "Find the flawed step: “$P(A\\mid B)=P(B\\mid A)$ because both mention the same two events.”",
      lines: [
        { id: "l1", text: "$P(A\\mid B)=P(A\\cap B)/P(B)$." },
        { id: "l2", text: "$P(B\\mid A)=P(A\\cap B)/P(A)$." },
        { id: "l3", text: "Since numerators match, the probabilities are equal." },
      ],
      flawLineId: "l3",
      why: "Denominators differ in general; equality holds only in special cases.",
    },
    {
      kind: "fill-blank",
      id: "ch16-p5",
      prompt: "Complete the formula: $P(B)=\\sum_i P(B\\mid H_i)P(H_i)$ is called the law of ____ probability.",
      before: "When $\\{H_i\\}$ is a partition,",
      after: ".",
      accept: ["total", "total probability"],
      why: "It decomposes $B$ across a partition of hypotheses.",
    },
  ],
  challenge: [
    {
      id: "ch16-c1",
      prompt: "A factory has machine $M_1$ making 60% of items with defect rate 1%, and $M_2$ making 40% with defect rate 3%. Given an item is defective, find $P(M_2\\mid D)$.",
      solution:
        "Let $D$ be defect. Given: $P(M_1)=0.6$, $P(M_2)=0.4$, $P(D\\mid M_1)=0.01$, $P(D\\mid M_2)=0.03$.\nFirst compute $P(D)$ by total probability:\n$P(D)=0.01\\cdot0.6+0.03\\cdot0.4=0.006+0.012=0.018$.\nThen Bayes:\n$P(M_2\\mid D)=\\frac{P(D\\mid M_2)P(M_2)}{P(D)}=\\frac{0.03\\cdot0.4}{0.018}=\\frac{2}{3}$.\nSo the posterior is $2/3$. $\\blacksquare$",
      rubric:
        "Must compute total defect probability first; then apply Bayes with correct numerator and denominator; final value $2/3$ or equivalent decimal.",
    },
    {
      id: "ch16-c2",
      prompt: "Derive Bayes with a partition: for partition $\\{H_i\\}$, show $P(H_j\\mid B)=\\frac{P(B\\mid H_j)P(H_j)}{\\sum_i P(B\\mid H_i)P(H_i)}$.",
      solution:
        "By conditional definition, $P(H_j\\mid B)=\\frac{P(H_j\\cap B)}{P(B)}$. Numerator is $P(B\\mid H_j)P(H_j)$. Denominator expands by total probability over partition $\\{H_i\\}$:\n$P(B)=\\sum_i P(B\\cap H_i)=\\sum_i P(B\\mid H_i)P(H_i)$.\nSubstitute numerator and denominator to obtain the stated formula. $\\blacksquare$",
      rubric:
        "Needs both ingredients: multiplication rule for numerator and total-probability expansion for denominator; clear substitution and final normalized expression.",
    },
  ],
};

export const chapter17: PracticeSet = {
  chapter: "17",
  title: "Independent Events",
  warmup: [
    { id: "ch17-indef", front: "Independence (two events)", back: "$A,B$ are independent iff $P(A\\cap B)=P(A)P(B)$." },
    { id: "ch17-cond", front: "Independence via conditioning", back: "If $P(B)>0$, independence is equivalent to $P(A\\mid B)=P(A)$." },
    { id: "ch17-pair", front: "Pairwise independent", back: "Every pair in a collection is independent." },
    { id: "ch17-mutual", front: "Mutually independent", back: "Every finite subcollection intersection factors into product of probabilities." },
    { id: "ch17-notsame", front: "Pairwise vs mutual", back: "Pairwise independence does not imply mutual independence." },
    { id: "ch17-bern", front: "Bernoulli trial", back: "A trial with success probability $p$ and failure probability $1-p$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch17-p1",
      prompt: "If $P(A)=0.5$, $P(B)=0.4$, and $A,B$ are independent, then $P(A\\cap B)$ is",
      choices: ["0.1", "0.2", "0.4", "0.9"],
      answerIndex: 1,
      why: "For independent events, multiply probabilities: $0.5\\times0.4=0.2$.",
    },
    {
      kind: "mcq",
      id: "ch17-p2",
      prompt: "For independent $A,B$, what is $P(A\\mid B)$ (assuming $P(B)>0$)?",
      choices: ["$P(B)$", "$P(A)$", "$P(A\\cap B)$", "always 1"],
      answerIndex: 1,
      why: "Independence means conditioning on $B$ does not change probability of $A$.",
    },
    {
      kind: "proof-order",
      id: "ch17-p3",
      prompt: "Order the proof: if $A$ and $B$ are independent, then $A$ and $B^c$ are independent.",
      steps: [
        { id: "s1", text: "Start with $P(A\\cap B^c)=P(A)-P(A\\cap B)$.", deps: [] },
        { id: "s2", text: "Use independence: $P(A\\cap B)=P(A)P(B)$.", deps: ["s1"] },
        { id: "s3", text: "Substitute to get $P(A\\cap B^c)=P(A)-P(A)P(B)$.", deps: ["s2"] },
        { id: "s4", text: "Factor: $P(A\\cap B^c)=P(A)(1-P(B))$.", deps: ["s3"] },
        { id: "s5", text: "Since $1-P(B)=P(B^c)$, conclude $P(A\\cap B^c)=P(A)P(B^c)$.", deps: ["s4"] },
      ],
      why: "This proof is an algebraic transformation from intersection/complement identities.",
    },
    {
      kind: "spot-flaw",
      id: "ch17-p4",
      prompt: "Find the flaw: “If $A$ and $B$ are disjoint, then they are independent.”",
      lines: [
        { id: "l1", text: "If disjoint, then $P(A\\cap B)=0$." },
        { id: "l2", text: "Independence requires $P(A\\cap B)=P(A)P(B)$." },
        { id: "l3", text: "So disjoint events are always independent." },
      ],
      flawLineId: "l3",
      why: "Disjointness gives product only when at least one event has probability 0.",
    },
    {
      kind: "fill-blank",
      id: "ch17-p5",
      prompt: "Complete: For independent $A,B$, $P(A\\cap B^c)=P(A)\\cdot$ ____.",
      before: "Using complements and independence,",
      after: ".",
      accept: ["$P(B^c)$", "P(B^c)", "1-P(B)"],
      why: "Independence extends to complements: $P(A\\cap B^c)=P(A)P(B^c)$.",
    },
  ],
  challenge: [
    {
      id: "ch17-c1",
      prompt: "Give an example of three events that are pairwise independent but not mutually independent, and prove both claims.",
      solution:
        "Let the sample space be two fair coin flips: $\\Omega=\\{HH,HT,TH,TT\\}$ with each outcome $1/4$. Define events:\n$A$ = first flip is H = $\\{HH,HT\\}$,\n$B$ = second flip is H = $\\{HH,TH\\}$,\n$C$ = flips have same parity (both equal) = $\\{HH,TT\\}$.\nEach event has probability $1/2$. Pair intersections have probability $1/4$:\n$A\\cap B=\\{HH\\}$, $A\\cap C=\\{HH\\}$, $B\\cap C=\\{HH\\}$.\nSo each pair satisfies $P(X\\cap Y)=1/4=(1/2)(1/2)$ and is independent.\nBut $A\\cap B\\cap C=\\{HH\\}$ has probability $1/4$, while $P(A)P(B)P(C)=1/8$.\nThus not mutually independent. $\\blacksquare$",
      rubric:
        "Must provide explicit finite probability space and three events; verify all three pairwise independence equations; then show triple intersection fails product condition.",
    },
    {
      id: "ch17-c2",
      prompt: "For independent Bernoulli trials $X_1,\\dots,X_n$ with success probability $p$, show $P(\\text{at least one success})=1-(1-p)^n$.",
      solution:
        "Let $S$ be event “at least one success.” Its complement $S^c$ is “all $n$ trials fail.” By independence,\n$P(S^c)=\\prod_{i=1}^n P(X_i=0)=(1-p)^n$.\nTherefore\n$P(S)=1-P(S^c)=1-(1-p)^n$. $\\blacksquare$",
      rubric:
        "Should define complement event, use independence to multiply failure probabilities, and apply complement rule for final expression.",
    },
  ],
};

export const chapter18: PracticeSet = {
  chapter: "18",
  title: "Random Variables",
  warmup: [
    { id: "ch18-rv", front: "Random variable", back: "A random variable is a function from outcomes to numbers." },
    { id: "ch18-pmf", front: "PMF", back: "For discrete $X$, $p_X(x)=P(X=x)$ and $\\sum_x p_X(x)=1$." },
    { id: "ch18-cdf", front: "CDF", back: "$F_X(t)=P(X\\le t)$." },
    { id: "ch18-bern", front: "Bernoulli RV", back: "Takes 1 with probability $p$, 0 with probability $1-p$." },
    { id: "ch18-binom", front: "Binomial RV", back: "$X\\sim\\text{Bin}(n,p)$ counts successes in $n$ independent Bernoulli trials." },
    { id: "ch18-transform", front: "Transform", back: "If $Y=g(X)$, then distribution of $Y$ is induced by mapping values of $X$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch18-p1",
      prompt: "If $X\\sim\\text{Bin}(3,1/2)$, what is $P(X=2)$?",
      choices: ["$1/8$", "$3/8$", "$1/2$", "$3/4$"],
      answerIndex: 1,
      why: "$P(X=2)=\\binom{3}{2}(1/2)^2(1/2)=3/8$.",
    },
    {
      kind: "mcq",
      id: "ch18-p2",
      prompt: "Which must be true for a valid PMF $p(x)$?",
      choices: ["$p(x)$ can be negative if total is 1", "$\\sum_x p(x)=0$", "$\\sum_x p(x)=1$ and each $p(x)\\ge0$", "Each $p(x)=1$"],
      answerIndex: 2,
      why: "PMF requires nonnegative masses summing to 1.",
    },
    {
      kind: "proof-order",
      id: "ch18-p3",
      prompt: "Order a proof that CDFs are nondecreasing.",
      steps: [
        { id: "s1", text: "Take real numbers $a\\le b$.", deps: [] },
        { id: "s2", text: "Event $\\{X\\le a\\}$ is a subset of $\\{X\\le b\\}$.", deps: ["s1"] },
        { id: "s3", text: "Probabilities are monotone under inclusion.", deps: ["s2"] },
        { id: "s4", text: "Hence $P(X\\le a)\\le P(X\\le b)$.", deps: ["s3"] },
        { id: "s5", text: "So $F_X(a)\\le F_X(b)$, i.e., $F_X$ is nondecreasing.", deps: ["s4"] },
      ],
      why: "Monotonicity of CDF follows directly from event inclusion.",
    },
    {
      kind: "spot-flaw",
      id: "ch18-p4",
      prompt: "Find the invalid line: “If $X$ is discrete then $P(X\\le t)=P(X=t)$.”",
      lines: [
        { id: "l1", text: "$F_X(t)=P(X\\le t)$ by definition." },
        { id: "l2", text: "For discrete variables, only one value contributes under $\\le t$." },
        { id: "l3", text: "Therefore $F_X(t)=P(X=t)$." },
      ],
      flawLineId: "l2",
      why: "Many values can satisfy $X\\le t$; CDF sums all masses up to $t$.",
    },
    {
      kind: "fill-blank",
      id: "ch18-p5",
      prompt: "Complete: For any discrete $X$, $\\sum_x P(X=x)=\\,$ ____.",
      before: "Total probability over all possible values gives",
      after: ".",
      accept: ["1", "$1$"],
      why: "The disjoint events $\\{X=x\\}$ partition the sample space.",
    },
  ],
  challenge: [
    {
      id: "ch18-c1",
      prompt: "Let $X$ be the number of fixed points in a uniformly random permutation of $[n]$. Find $P(X=0)$ and $P(X=1)$ in terms of derangements.",
      solution:
        "Total permutations: $n!$. Event $X=0$ means a derangement, so\n$P(X=0)=D_n/n!$.\nFor $X=1$, choose which element is fixed ($n$ choices), and derange the remaining $n-1$ elements ($D_{n-1}$ ways). Thus count is $nD_{n-1}$ and\n$P(X=1)=\\frac{nD_{n-1}}{n!}=\\frac{D_{n-1}}{(n-1)!}$. $\\blacksquare$",
      rubric:
        "Needs counting argument based on permutation model; correct identification of derangements for $X=0$ and fixed-point choice plus derangement for $X=1$; divide by $n!$.",
    },
    {
      id: "ch18-c2",
      prompt: "A fair die is rolled twice. Let $X$ be the maximum of the two results. Derive the PMF of $X$.",
      solution:
        "For $k\\in\\{1,\\dots,6\\}$,\n$P(X\\le k)=P(\\text{both rolls}\\le k)=(k/6)^2$.\nHence\n$P(X=k)=P(X\\le k)-P(X\\le k-1)=\\frac{k^2-(k-1)^2}{36}=\\frac{2k-1}{36}$.\nSo PMF is $p_X(k)=(2k-1)/36$ for $k=1,\\dots,6$. $\\blacksquare$",
      rubric:
        "Must use CDF difference (or equivalent direct count); obtain formula $P(X=k)=(2k-1)/36$ over $k=1..6$; show support and normalization implicitly or explicitly.",
    },
  ],
};

export const chapter19: PracticeSet = {
  chapter: "19",
  title: "Expected Value",
  warmup: [
    { id: "ch19-def", front: "Expectation", back: "For discrete $X$, $E[X]=\\sum_x xP(X=x)$." },
    { id: "ch19-linearity", front: "Linearity of expectation", back: "$E[X+Y]=E[X]+E[Y]$ always, no independence needed." },
    { id: "ch19-const", front: "Scaling", back: "$E[aX+b]=aE[X]+b$." },
    { id: "ch19-indicator", front: "Indicator variable", back: "$I_A=1$ if $A$ occurs, else $0$; $E[I_A]=P(A)$." },
    { id: "ch19-binom-mean", front: "Binomial mean", back: "If $X\\sim\\text{Bin}(n,p)$ then $E[X]=np$." },
    { id: "ch19-geometric", front: "Expectation intuition", back: "Expectation is long-run average outcome value." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch19-p1",
      prompt: "If $X\\sim\\text{Bin}(20,0.3)$, what is $E[X]$?",
      choices: ["3", "6", "10", "14"],
      answerIndex: 1,
      why: "Binomial expectation is $np=20\\cdot0.3=6$.",
    },
    {
      kind: "mcq",
      id: "ch19-p2",
      prompt: "Let $I_A$ be an indicator of event $A$. What is $E[I_A]$?",
      choices: ["$0$", "$1$", "$P(A)$", "$P(A)^2$"],
      answerIndex: 2,
      why: "$I_A$ equals 1 with probability $P(A)$ and 0 otherwise, so expectation is $P(A)$.",
    },
    {
      kind: "proof-order",
      id: "ch19-p3",
      prompt: "Order a proof that $E[aX+b]=aE[X]+b$ for discrete $X$.",
      steps: [
        { id: "s1", text: "Write $E[aX+b]=\\sum_x (ax+b)P(X=x)$.", deps: [] },
        { id: "s2", text: "Split the sum into $a\\sum_x xP(X=x)+b\\sum_x P(X=x)$.", deps: ["s1"] },
        { id: "s3", text: "Recognize first sum as $aE[X]$.", deps: ["s2"] },
        { id: "s4", text: "Use $\\sum_x P(X=x)=1$ to simplify second sum to $b$.", deps: ["s2"] },
        { id: "s5", text: "Conclude $E[aX+b]=aE[X]+b$.", deps: ["s3", "s4"] },
      ],
      why: "The derivation uses algebraic splitting plus PMF normalization.",
    },
    {
      kind: "spot-flaw",
      id: "ch19-p4",
      prompt: "Spot the flaw: “$E[XY]=E[X]E[Y]$ for all random variables $X,Y$.”",
      lines: [
        { id: "l1", text: "If $X,Y$ are independent, then $E[XY]=E[X]E[Y]$." },
        { id: "l2", text: "Every pair of random variables is independent." },
        { id: "l3", text: "Therefore $E[XY]=E[X]E[Y]$ always." },
      ],
      flawLineId: "l2",
      why: "Independence is a special condition, not automatic.",
    },
    {
      kind: "fill-blank",
      id: "ch19-p5",
      prompt: "Complete: Linearity says $E\\left[\\sum_{i=1}^n X_i\\right]=\\,$ ____.",
      before: "For any random variables,",
      after: ".",
      accept: ["$\\sum_{i=1}^n E[X_i]$", "sum of expectations", "\\sum E[X_i]"],
      why: "Linearity holds without independence assumptions.",
    },
  ],
  challenge: [
    {
      id: "ch19-c1",
      prompt: "In a random permutation of $[n]$, let $X$ be the number of fixed points. Show $E[X]=1$.",
      solution:
        "Define indicators $I_i$ for event “position $i$ is fixed.” Then $X=\\sum_{i=1}^n I_i$. By linearity,\n$E[X]=\\sum_i E[I_i]=\\sum_i P(I_i=1)$.\nFor uniform random permutation, $P(i\\text{ fixed})=1/n$ for each $i$. Hence\n$E[X]=n\\cdot(1/n)=1$. $\\blacksquare$",
      rubric:
        "Must use indicator decomposition $X=\\sum I_i$; apply linearity; compute $P(i\\text{ fixed})=1/n$; conclude expectation equals 1.",
    },
    {
      id: "ch19-c2",
      prompt: "Suppose $n$ fair coins are flipped. Let $R$ be the number of runs of consecutive equal outcomes. Compute $E[R]$.",
      solution:
        "Let $I_1=1$ always (first flip starts a run). For $i\\ge2$, let $I_i$ indicate that flip $i$ starts a new run, i.e., outcome $i$ differs from outcome $i-1$. Then\n$R=\\sum_{i=1}^n I_i$.\nNow $E[I_1]=1$. For $i\\ge2$, $P(I_i=1)=1/2$ (among HH,HT,TH,TT, exactly HT and TH change). So\n$E[R]=1+\\sum_{i=2}^n 1/2=1+(n-1)/2=(n+1)/2$. $\\blacksquare$",
      rubric:
        "Needs correct indicator setup for run starts; linearity application; probability of change between adjacent fair flips equals $1/2$; final simplification $(n+1)/2$.",
    },
  ],
};

export const chapter20: PracticeSet = {
  chapter: "20",
  title: "Expected Value: Sums and Other Tools",
  warmup: [
    { id: "ch20-sumind", front: "Indicator sum method", back: "Model count as sum of indicators, then take expectation term-by-term." },
    { id: "ch20-double", front: "Double counting with expectation", back: "Compute one quantity by counting pairs and by linearity of expectation." },
    { id: "ch20-tail", front: "Tail-sum formula", back: "For nonnegative integer $X$, $E[X]=\\sum_{t\\ge1}P(X\\ge t)$." },
    { id: "ch20-markov", front: "Markov's inequality", back: "For nonnegative $X$ and $a>0$, $P(X\\ge a)\\le E[X]/a$." },
    { id: "ch20-jensen", front: "Convexity intuition", back: "For convex $f$, typically $f(E[X])\\le E[f(X)]$ (Jensen)." },
    { id: "ch20-lotter", front: "Linearity survives dependence", back: "Expectation of a sum does not require independent terms." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch20-p1",
      prompt: "If $X\\ge0$ and $E[X]=10$, Markov gives which upper bound on $P(X\\ge25)$?",
      choices: ["$0.1$", "$0.4$", "$0.5$", "$2.5$"],
      answerIndex: 1,
      why: "Markov: $P(X\\ge25)\\le E[X]/25=10/25=0.4$.",
    },
    {
      kind: "mcq",
      id: "ch20-p2",
      prompt: "For nonnegative integer-valued $X$, which identity is correct?",
      choices: [
        "$E[X]=\\sum_{t\\ge1}tP(X=t)$",
        "$E[X]=\\sum_{t\\ge1}P(X\\ge t)$",
        "$E[X]=P(X\\ge1)$",
        "$E[X]=\\sum_{t\\ge0}P(X=t)^2$",
      ],
      answerIndex: 1,
      why: "This is the tail-sum formula for nonnegative integer random variables.",
    },
    {
      kind: "proof-order",
      id: "ch20-p3",
      prompt: "Order a proof of the tail-sum formula $E[X]=\\sum_{t\\ge1}P(X\\ge t)$ for nonnegative integer $X$.",
      steps: [
        { id: "s1", text: "Start from definition: $E[X]=\\sum_{k\\ge0} k\\,P(X=k)$.", deps: [] },
        { id: "s2", text: "Rewrite $k$ as $\\sum_{t=1}^{k}1$.", deps: ["s1"] },
        { id: "s3", text: "So $E[X]=\\sum_{k\\ge0}\\sum_{t=1}^{k} P(X=k)$.", deps: ["s2"] },
        { id: "s4", text: "Swap order of summation: $\\sum_{t\\ge1}\\sum_{k\\ge t}P(X=k)$.", deps: ["s3"] },
        { id: "s5", text: "Inner sum equals $P(X\\ge t)$, yielding the formula.", deps: ["s4"] },
      ],
      why: "The identity comes from expanding $k$ as stacked ones and exchanging finite/nonnegative sums.",
    },
    {
      kind: "spot-flaw",
      id: "ch20-p4",
      prompt: "Find the flaw: “By Markov, $P(X\\ge a)=E[X]/a$ for nonnegative $X$.”",
      lines: [
        { id: "l1", text: "Markov relates tail probability and expectation." },
        { id: "l2", text: "Thus $P(X\\ge a)=E[X]/a$." },
      ],
      flawLineId: "l2",
      why: "Markov gives an inequality $P(X\\ge a)\\le E[X]/a$, not equality in general.",
    },
    {
      kind: "fill-blank",
      id: "ch20-p5",
      prompt: "Complete: For any random variables $X_1,\\dots,X_n$, $E[\\sum X_i]$ equals the ____ of expectations.",
      before: "Linearity says",
      after: ".",
      accept: ["sum", "sum of the", "sum of"],
      why: "Linearity is exact even when variables are dependent.",
    },
  ],
  challenge: [
    {
      id: "ch20-c1",
      prompt: "In $G(n,p)$ (each edge present independently with probability $p$), compute the expected number of triangles.",
      solution:
        "For each 3-vertex subset $T$, define indicator $I_T$ that $T$ forms a triangle. Then total triangles\n$X=\\sum_T I_T$ over all $\\binom{n}{3}$ triples. By linearity,\n$E[X]=\\sum_T E[I_T]=\\sum_T P(I_T=1)$.\nA triple is a triangle iff its 3 edges all appear, probability $p^3$. Therefore\n$E[X]=\\binom{n}{3}p^3$. $\\blacksquare$",
      rubric:
        "Must define one indicator per vertex triple; apply linearity; compute triangle probability as $p^3$ from edge independence; multiply by number of triples.",
    },
    {
      id: "ch20-c2",
      prompt: "Use expected value to show any graph with average degree $d$ has an independent set of size at least $n/(d+1)$.",
      solution:
        "Pick a random permutation of vertices and build set $S$ of vertices that appear before all their neighbors. Then $S$ is independent: adjacent vertices cannot both appear before the other. For vertex $v$, event $v\\in S$ occurs when $v$ is earliest among $\\deg(v)+1$ vertices ($v$ plus its neighbors), so\n$P(v\\in S)=1/(\\deg(v)+1)$.\nThus\n$E[|S|]=\\sum_v \\frac{1}{\\deg(v)+1}$.\nUsing AM-HM (or Jensen for convex $1/x$),\n$\\frac{1}{n}\\sum_v \\frac{1}{\\deg(v)+1}\\ge \\frac{1}{\\frac{1}{n}\\sum_v (\\deg(v)+1)}=\\frac{1}{d+1}$.\nHence $E[|S|]\\ge n/(d+1)$, so some outcome has $|S|\\ge n/(d+1)$. $\\blacksquare$",
      rubric:
        "Needs random-order construction; proof that selected set is independent; correct probability $1/(\\deg(v)+1)$ per vertex; expectation sum; inequality converting to $n/(d+1)$; existence conclusion from expectation.",
    },
    {
      id: "ch20-c3",
      prompt: "Let $X$ be nonnegative integer-valued. Prove the tail-sum identity $E[X]=\\sum_{t\\ge1}P(X\\ge t)$ and apply it to $X\\sim\\text{Geom}(p)$ (counting trials until first success) to get $E[X]=1/p$.",
      solution:
        "General proof: write $E[X]=\\sum_{k\\ge0}kP(X=k)=\\sum_{k\\ge0}\\sum_{t=1}^{k}P(X=k)$, swap sums to get $\\sum_{t\\ge1}\\sum_{k\\ge t}P(X=k)=\\sum_{t\\ge1}P(X\\ge t)$.\nFor geometric $X$ with success probability $p$, $P(X\\ge t)=(1-p)^{t-1}$. Therefore\n$E[X]=\\sum_{t\\ge1}(1-p)^{t-1}=\\frac{1}{1-(1-p)}=\\frac{1}{p}$. $\\blacksquare$",
      rubric:
        "Must include valid tail-sum derivation via double sum and exchange; for geometric case identify survival probability $(1-p)^{t-1}$; evaluate resulting geometric series to $1/p$.",
    },
  ],
};
