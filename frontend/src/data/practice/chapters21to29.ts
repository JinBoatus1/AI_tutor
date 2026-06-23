import type { PracticeSet } from "../../practice/types";

export const chapter21: PracticeSet = {
  chapter: "21",
  title: "Deviations from the Mean",
  warmup: [
    { id: "c21-f1", front: "Mean of a list", back: "For values $x_1,\\dots,x_n$, the mean is $\\mu = \\frac{1}{n}\\sum_{i=1}^n x_i$." },
    { id: "c21-f2", front: "Deviation", back: "The deviation of $x_i$ from the mean is $x_i-\\mu$." },
    { id: "c21-f3", front: "Key identity", back: "Always $\\sum_{i=1}^n (x_i-\\mu)=0$." },
    { id: "c21-f4", front: "Variance idea", back: "Variance uses squared deviations: $\\frac{1}{n}\\sum (x_i-\\mu)^2$." },
    { id: "c21-f5", front: "Why square deviations?", back: "Squaring avoids cancellation between positive and negative deviations." },
    { id: "c21-f6", front: "Shift invariance", back: "Adding a constant $c$ to every value keeps deviations unchanged: $(x_i+c)-(\\mu+c)=x_i-\\mu$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c21-p1",
      prompt: "If $\\mu$ is the mean of $x_1,\\dots,x_n$, what is $\\sum_{i=1}^n (x_i-\\mu)$?",
      choices: ["$n\\mu$", "$0$", "$\\sum x_i$", "$\\mu$"],
      answerIndex: 1,
      why: "By definition $\\sum (x_i-\\mu)=\\sum x_i-n\\mu=0$.",
    },
    {
      kind: "spot-flaw",
      id: "c21-p2",
      prompt: "Find the invalid line: someone claims that if $\\sum (x_i-\\mu)=0$, then every $x_i=\\mu$.",
      lines: [
        { id: "l1", text: "Let $\\mu$ be the mean, so $\\sum_{i=1}^n (x_i-\\mu)=0$." },
        { id: "l2", text: "A sum of zero means every term is zero." },
        { id: "l3", text: "Therefore for all $i$, $x_i-\\mu=0$." },
        { id: "l4", text: "So every $x_i=\\mu$." },
      ],
      flawLineId: "l2",
      why: "A sum of several terms being zero does not mean each term is zero; positive and negative terms can cancel.",
    },
    {
      kind: "fill-blank",
      id: "c21-p3",
      prompt: "Complete the identity: $\\sum_{i=1}^n (x_i-a)^2 = \\sum_{i=1}^n (x_i-\\mu)^2 +$ ____.",
      before: "For any $a$, expand and use $\\sum (x_i-\\mu)=0$ to get",
      after: ", so the minimum occurs at $a=\\mu$.",
      accept: ["n(a-\\mu)^2", "n(a - \\mu)^2", "n(\\mu-a)^2", "n(\\mu - a)^2"],
      why: "Shifting to an arbitrary center $a$ adds the nonnegative term $n(a-\\mu)^2$.",
    },
    {
      kind: "mcq",
      id: "c21-p4",
      prompt: "If every data point is increased by a constant $c$, which quantity stays the same?",
      choices: ["The mean $\\mu$", "Each deviation $x_i-\\mu$", "The total $\\sum x_i$", "The maximum value"],
      answerIndex: 1,
      why: "The new deviation is $(x_i+c)-(\\mu+c)=x_i-\\mu$, unchanged.",
    },
    {
      kind: "mcq",
      id: "c21-p5",
      prompt: "Which statement best explains why the mean minimizes the sum of squared errors?",
      choices: [
        "Because the mean minimizes the sum of absolute errors",
        "Because $\\sum (x_i-a)^2=\\sum (x_i-\\mu)^2+n(a-\\mu)^2$",
        "Because the sum of deviations is always positive",
        "Because variance is always equal to 1",
      ],
      answerIndex: 1,
      why: "In the decomposition, the second term is nonnegative and equals zero only when $a=\\mu$.",
    },
  ],
  challenge: [
    {
      id: "c21-c1",
      prompt: "Prove that for any real number $a$, $\\sum_{i=1}^n (x_i-a)^2 = \\sum_{i=1}^n (x_i-\\mu)^2 + n(a-\\mu)^2$.",
      solution:
        "Write $x_i-a=(x_i-\\mu)+(\\mu-a)$. Square and sum: $\\sum (x_i-a)^2=\\sum (x_i-\\mu)^2+2(\\mu-a)\\sum (x_i-\\mu)+\\sum (\\mu-a)^2$. The middle term vanishes because $\\sum (x_i-\\mu)=0$, and the last term is $n(a-\\mu)^2$, as required.",
      rubric:
        "Should split $x_i-a$, expand the square, handle the cross term correctly, and explicitly use $\\sum (x_i-\\mu)=0$; the final expression must be complete with correct signs.",
    },
    {
      id: "c21-c2",
      prompt: "For the data $2,4,7,11$, compute the mean, each deviation, the sum of deviations, and the sum of squared deviations, and explain how they reflect the chapter's conclusions.",
      solution:
        "The mean is $\\mu=(2+4+7+11)/4=6$. The deviations are $-4,-2,1,5$, and their sum is $0$. The squared deviations are $16,4,1,25$, with sum $46$. This shows that deviations can cancel positive and negative, but squared deviations do not cancel, so the sum of squared deviations more stably measures spread.",
      rubric:
        "Must give all four computations with correct values; the explanation should mention both that the deviation sum is 0 and that squaring avoids cancellation.",
    },
  ],
};

export const chapter22: PracticeSet = {
  chapter: "22",
  title: "Infinity",
  warmup: [
    { id: "c22-f1", front: "Countably infinite", back: "A set is countably infinite if it can be put in bijection with $\\mathbb{N}$." },
    { id: "c22-f2", front: "Uncountable", back: "A set is uncountable if no bijection with $\\mathbb{N}$ exists." },
    { id: "c22-f3", front: "Diagonalization", back: "Cantor's method constructs an element differing from every listed element at some index." },
    { id: "c22-f4", front: "Power set theorem", back: "For any set $S$, $|\\mathcal{P}(S)|>|S|$." },
    { id: "c22-f5", front: "Binary strings and naturals", back: "Finite binary strings are countable via length-lex order." },
    { id: "c22-f6", front: "Reals in $(0,1)$", back: "The interval $(0,1)$ is uncountable (classic diagonal argument)." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c22-p1",
      prompt: "Which of the following sets is countably infinite?",
      choices: ["All real numbers in $(0,1)$", "All finite binary strings", "$\\mathcal{P}(\\mathbb{N})$", "All infinite binary sequences"],
      answerIndex: 1,
      why: "Finite binary strings can be enumerated by length and then in lexicographic order.",
    },
    {
      kind: "proof-order",
      id: "c22-p2",
      prompt: "Order the steps in the diagonal proof that $(0,1)$ is uncountable.",
      steps: [
        { id: "s1", text: "Assume for contradiction that $(0,1)$ is countable and list its elements as $r_1,r_2,\\dots$ with decimal expansions.", deps: [] },
        { id: "s2", text: "Construct a new real number $x=0.d_1d_2\\dots$ with $d_i\\neq$ the $i$th digit of the $i$th listed number.", deps: ["s1"] },
        { id: "s3", text: "For each $i$, $x$ differs from $r_i$ in the $i$th digit, so $x\\neq r_i$.", deps: ["s2"] },
        { id: "s4", text: "Therefore $x$ is not in the original list, a contradiction.", deps: ["s3"] },
        { id: "s5", text: "Hence $(0,1)$ is uncountable.", deps: ["s4"] },
      ],
      why: "Assume a listing, construct the diagonal element, compare term by term to get a contradiction, then conclude.",
    },
    {
      kind: "spot-flaw",
      id: "c22-p3",
      prompt: "Find the invalid line: someone \"proves\" that the set of even numbers is smaller than the set of natural numbers.",
      lines: [
        { id: "l1", text: "The set of even numbers is a proper subset of the natural numbers." },
        { id: "l2", text: "A proper subset always has fewer elements." },
        { id: "l3", text: "So the cardinality of the evens is less than that of the naturals." },
      ],
      flawLineId: "l2",
      why: "Finite-set intuition does not apply to infinite sets; here there is a bijection $n \\mapsto 2n$.",
    },
    {
      kind: "fill-blank",
      id: "c22-p4",
      prompt: "Complete: for any function $f:S\\to \\mathcal{P}(S)$, let $T=\\{x\\in S\\mid x\\notin f(x)\\}$. Then $T$ ____.",
      before: "By definition, $T$ is a subset of $S$, so if $f$ were surjective there would be some $y$ with $f(y)=T$. But checking whether $y\\in T$ leads to a contradiction either way, so",
      after: ".",
      accept: ["cannot be in the image of f", "is not in the image of f", "is not in the range of f"],
      why: "This is the core contradiction of the power set theorem: some subset is always missed.",
    },
    {
      kind: "mcq",
      id: "c22-p5",
      prompt: "Which statement is most accurate?",
      choices: [
        "$|\\mathbb{N}|=|\\mathcal{P}(\\mathbb{N})|$",
        "$|\\mathcal{P}(S)|<|S|$",
        "$|\\mathcal{P}(S)|>|S|$",
        "$|\\mathbb{R}|=|\\mathbb{N}|$",
      ],
      answerIndex: 2,
      why: "Cantor's theorem holds for every set: the power set is strictly larger.",
    },
  ],
  challenge: [
    {
      id: "c22-c1",
      prompt: "Prove that the set of all rational numbers $\\mathbb{Q}$ is countable.",
      solution:
        "Write each positive rational as $a/b$ with $a,b\\in\\mathbb{N}$. Place numerator and denominator on a two-dimensional grid and traverse by diagonals of constant $a+b$, outputting each reduced fraction once. This enumerates all positive rationals. Insert $0$ and the negative rationals in an interleaved way (for example $0,q_1,-q_1,q_2,-q_2,\\dots$) to obtain an enumeration of $\\mathbb{Q}$, so it is countable.",
      rubric:
        "Must give a valid enumeration strategy (such as diagonal traversal) and handle duplicate fractions and negatives/zero; the conclusion should clearly establish a bijection with $\\mathbb{N}$ or a surjection followed by deduplication.",
    },
    {
      id: "c22-c2",
      prompt: "Use diagonalization to prove that the set of all infinite binary sequences $\\{0,1\\}^{\\mathbb{N}}$ is uncountable.",
      solution:
        "Assume for contradiction that the set is countable and list it as $b_1,b_2,\\dots$, where each $b_i$ is an infinite $0/1$ sequence. Construct a new sequence $c$ by setting $c_i=1-b_{i,i}$ (flip the $i$th bit of the $i$th sequence). Then for every $i$, $c_i\\neq b_{i,i}$, so $c\\neq b_i$. Therefore $c$ is not on the list, a contradiction, so the set is uncountable.",
      rubric:
        "Must include assuming countability, diagonal construction, and showing the new sequence differs from every listed one; unclear indexing of the $i$th bit or missing the final contradiction loses full credit.",
    },
    {
      id: "c22-c3",
      prompt: "Prove that there is no surjection $f:S\\to\\mathcal{P}(S)$.",
      solution:
        "Define $T=\\{x\\in S\\mid x\\notin f(x)\\}$. If $f$ were surjective, there would exist $y$ with $f(y)=T$. If $y\\in T$, then by definition $y\\notin f(y)=T$; if $y\\notin T$, then by definition $y\\in f(y)=T$. Both cases contradict, so $f$ cannot be surjective.",
      rubric:
        "Must construct $T$ correctly and discuss both cases $y\\in T$ and $y\\notin T$; both contradictions must be written out completely.",
    },
  ],
};

export const chapter23: PracticeSet = {
  chapter: "23",
  title: "Languages: What is Computing?",
  warmup: [
    { id: "c23-f1", front: "Alphabet", back: "An alphabet $\\Sigma$ is a finite nonempty set of symbols." },
    { id: "c23-f2", front: "String", back: "A string over $\\Sigma$ is a finite sequence of symbols from $\\Sigma$." },
    { id: "c23-f3", front: "Language", back: "A language is any set of strings over an alphabet: $L\\subseteq\\Sigma^*$." },
    { id: "c23-f4", front: "Decision problem view", back: "A decision problem asks yes/no; equivalently decide membership $w\\in L$." },
    { id: "c23-f5", front: "Recognizer vs decider", back: "A decider halts on all inputs; a recognizer may loop on non-members." },
    { id: "c23-f6", front: "Operations on languages", back: "Union, intersection, complement, concatenation, and star build new languages." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c23-p1",
      prompt: "Which object is not a language?",
      choices: ["$\\{\\epsilon,0,11\\}$", "$\\Sigma^*$", "The set of all binary strings of even length", "The single string $0101$"],
      answerIndex: 3,
      why: "A language is a set of strings, not a single string itself.",
    },
    {
      kind: "fill-blank",
      id: "c23-p2",
      prompt: "Complete: when viewing \"is the input a prime?\" as a language, the language should be defined as",
      before: "Let an encoding function $enc(n)$ map natural numbers to binary strings. Then define",
      after: ", and the decision problem becomes a membership test.",
      accept: [
        "L=\\{enc(n)\\mid n\\text{ is prime}\\}",
        "L = \\{enc(n)\\mid n\\text{ is prime}\\}",
        "{enc(n) | n is prime}",
      ],
      why: "Computability theory unifies decision problems as \"does this string belong to a set?\"",
    },
    {
      kind: "spot-flaw",
      id: "c23-p3",
      prompt: "Find the invalid line: someone says \"if a machine recognizes $L$, then it also decides $L$.\"",
      lines: [
        { id: "l1", text: "Recognizing $L$ means the machine accepts on every $w\\in L$." },
        { id: "l2", text: "On $w\\notin L$, the machine may run forever." },
        { id: "l3", text: "Running forever also counts as rejection." },
        { id: "l4", text: "So the machine decides $L$." },
      ],
      flawLineId: "l3",
      why: "Deciding requires halting on all inputs; \"not halting\" is not a valid rejection output.",
    },
    {
      kind: "mcq",
      id: "c23-p4",
      prompt: "If $L\\subseteq\\Sigma^*$, its complement language is",
      choices: ["$\\Sigma-L$", "$\\Sigma^*\\setminus L$", "$L\\setminus\\Sigma^*$", "$L^*$"],
      answerIndex: 1,
      why: "The complement is taken relative to the full set $\\Sigma^*$.",
    },
    {
      kind: "mcq",
      id: "c23-p5",
      prompt: "Which description best matches the language view of computation?",
      choices: [
        "Computation means turning any input into a shorter output",
        "Computation means deciding whether an encoded input belongs to a language",
        "Computation studies only numbers, not strings",
        "Computation must be implemented with a Turing machine",
      ],
      answerIndex: 1,
      why: "FOCS emphasizes a unified model: a decision problem is language membership.",
    },
  ],
  challenge: [
    {
      id: "c23-c1",
      prompt: "Formally define the language $L_{pal}=\\{w\\in\\{0,1\\}^*\\mid w\\text{ is a palindrome}\\}$, and explain why it corresponds to a decision problem.",
      solution:
        "Let the alphabet be $\\Sigma=\\{0,1\\}$ and define $L_{pal}=\\{w\\in\\Sigma^*\\mid w=w^R\\}$. Given an input string $w$, the question \"is $w\\in L_{pal}$?\" is a yes/no decision problem. Any algorithm that correctly outputs yes or no and halts is deciding this language.",
      rubric:
        "Must give a clear set definition (including alphabet and palindrome condition) and map it to a membership decision problem; examples alone are not enough.",
    },
    {
      id: "c23-c2",
      prompt: "Suppose $L_1,L_2\\subseteq\\Sigma^*$ are decidable. Prove that $L_1\\cap L_2$ is decidable.",
      solution:
        "Let machines $M_1,M_2$ decide $L_1$ and $L_2$ respectively. Construct a new decider $M$: on input $w$, run $M_1(w)$; if it rejects, reject; if it accepts, run $M_2(w)$; accept if $M_2$ accepts, otherwise reject. Since $M_1$ and $M_2$ always halt, so does $M$, and it accepts exactly when $w\\in L_1\\cap L_2$, so the intersection is decidable.",
      rubric:
        "The key is to give the combined algorithm and explain that halting is inherited; the acceptance condition must match the intersection exactly.",
    },
  ],
};

export const chapter24: PracticeSet = {
  chapter: "24",
  title: "Deterministic Finite Automata",
  warmup: [
    { id: "c24-f1", front: "DFA tuple", back: "A DFA is $(Q,\\Sigma,\\delta,q_0,F)$ with total transition function $\\delta:Q\\times\\Sigma\\to Q$." },
    { id: "c24-f2", front: "Extended transition", back: "$\\delta^*(q,\\epsilon)=q$ and $\\delta^*(q,xa)=\\delta(\\delta^*(q,x),a)$." },
    { id: "c24-f3", front: "Acceptance", back: "A DFA accepts $w$ iff $\\delta^*(q_0,w)\\in F$." },
    { id: "c24-f4", front: "Deterministic", back: "From each state and symbol, exactly one next state." },
    { id: "c24-f5", front: "Product construction", back: "For intersection, track pair states $(q_1,q_2)$." },
    { id: "c24-f6", front: "Regular language", back: "Languages recognized by some DFA are regular." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c24-p1",
      prompt: "In a DFA, the correct type of $\\delta$ is",
      choices: ["$Q\\to\\Sigma$", "$Q\\times\\Sigma\\to Q$", "$\\Sigma\\to Q\\times Q$", "$Q\\times Q\\to\\Sigma$"],
      answerIndex: 1,
      why: "The current state and input symbol together determine a unique next state.",
    },
    {
      kind: "spot-flaw",
      id: "c24-p2",
      prompt: "Find the invalid line: someone says \"a DFA can branch into two edges on the same symbol.\"",
      lines: [
        { id: "l1", text: "Suppose state $q$ on input 0 can go to $r$ or $s$." },
        { id: "l2", text: "Then the machine can try both paths." },
        { id: "l3", text: "So it is still a DFA." },
      ],
      flawLineId: "l1",
      why: "A DFA requires exactly one successor for each $(q,a)$; branching is an NFA feature.",
    },
    {
      kind: "fill-blank",
      id: "c24-p3",
      prompt: "Complete: if $M$ accepts iff the final state is in $F$, then the language is $L(M)=\\{w\\mid$ ____ $\\}$.",
      before: "By the extended transition function,",
      after: ".",
      accept: ["\\delta^*(q_0,w)\\in F", "delta*(q0,w) in F", "delta^*(q0,w) in F"],
      why: "This is the standard set notation for the DFA acceptance condition.",
    },
    {
      kind: "mcq",
      id: "c24-p4",
      prompt: "When constructing a DFA for $L_1\\cap L_2$, the accept state set should be",
      choices: ["$F_1\\cup F_2$", "$F_1\\times F_2$", "$(Q_1\\setminus F_1)\\times(Q_2\\setminus F_2)$", "$Q_1\\times F_2$"],
      answerIndex: 1,
      why: "The intersection requires both machines to accept, so the pair state must lie in both accept sets.",
    },
    {
      kind: "mcq",
      id: "c24-p5",
      prompt: "If a DFA's accept and nonaccept states are swapped, the resulting machine recognizes",
      choices: ["$L$", "$L^*$", "$\\Sigma^*\\setminus L$", "$\\emptyset$"],
      answerIndex: 2,
      why: "The same run ends in the same state, but acceptance is flipped, giving the complement language.",
    },
  ],
  challenge: [
    {
      id: "c24-c1",
      prompt: "Construct a DFA over $\\{0,1\\}$ that recognizes strings ending in 01, and explain the meaning of each state.",
      solution:
        "Use three core states: $q_0$ (current suffix does not match), $q_1$ (most recent symbol read was 0), $q_2$ (the last two symbols are 01; accept). Transitions: $q_0\\xrightarrow{0}q_1,q_0\\xrightarrow{1}q_0$; $q_1\\xrightarrow{0}q_1,q_1\\xrightarrow{1}q_2$; $q_2\\xrightarrow{0}q_1,q_2\\xrightarrow{1}q_0$. Accept set $\\{q_2\\}$.",
      rubric:
        "Must give complete deterministic transitions, start state, and accept states, and explain what suffix information each state tracks; missing transitions or nondeterminism loses credit.",
    },
    {
      id: "c24-c2",
      prompt: "Prove that if a language $L$ is recognized by some DFA, then its complement is also recognized by some DFA.",
      solution:
        "Let $M=(Q,\\Sigma,\\delta,q_0,F)$ recognize $L$. Define $M'=(Q,\\Sigma,\\delta,q_0,Q\\setminus F)$. For any $w$, $M$ and $M'$ run to the same final state $q=\\delta^*(q_0,w)$. If $q\\in F$, then $M$ accepts and $M'$ rejects; if $q\\notin F$, the reverse holds. Hence $L(M')=\\Sigma^*\\setminus L$.",
      rubric:
        "Should keep states and transitions unchanged and only flip the accept set; must argue both directions for arbitrary inputs.",
    },
  ],
};

export const chapter25: PracticeSet = {
  chapter: "25",
  title: "Context Free Grammars",
  warmup: [
    { id: "c25-f1", front: "CFG rule form", back: "A CFG has productions $A\\to\\alpha$ where $A$ is a variable and $\\alpha\\in(V\\cup\\Sigma)^*$." },
    { id: "c25-f2", front: "Derivation", back: "A derivation repeatedly replaces a variable using production rules." },
    { id: "c25-f3", front: "Parse tree", back: "A parse tree records one derivation structure for a string." },
    { id: "c25-f4", front: "Ambiguity", back: "A grammar is ambiguous if some string has two distinct parse trees." },
    { id: "c25-f5", front: "Classic CFL", back: "$\\{0^n1^n\\mid n\\ge 0\\}$ is context free." },
    { id: "c25-f6", front: "Not all languages are CFL", back: "For example $\\{0^n1^n2^n\\mid n\\ge 0\\}$ is not context free." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c25-p1",
      prompt: "Which production rule fits CFG syntax?",
      choices: ["$AB\\to a$", "$A\\to aA\\mid \\epsilon$", "$a\\to Aa$", "$A\\to$ (empty right-hand side, not $\\epsilon$)"],
      answerIndex: 1,
      why: "In a CFG the left side must be a single variable, and the right side is a string of variables and terminals (possibly $\\epsilon$).",
    },
    {
      kind: "fill-blank",
      id: "c25-p2",
      prompt: "For grammar $S\\to 0S1\\mid\\epsilon$, one leftmost derivation of $0011$ is $S\\Rightarrow 0S1\\Rightarrow 00S11\\Rightarrow$ ____.",
      before: "The final step applies $S\\to\\epsilon$, giving",
      after: ".",
      accept: ["0011", "0 0 1 1"],
      why: "This grammar generates exactly the same number of 0s followed by the same number of 1s.",
    },
    {
      kind: "spot-flaw",
      id: "c25-p3",
      prompt: "Find the invalid line: someone proves that $S\\to SS\\mid a$ is an unambiguous grammar.",
      lines: [
        { id: "l1", text: "The grammar generates $aa$." },
        { id: "l2", text: "For every string, the split point is unique." },
        { id: "l3", text: "Therefore each string has only one parse tree." },
      ],
      flawLineId: "l2",
      why: "For example, $aaa$ can be split at different points to get different structures, so splits are not unique.",
    },
    {
      kind: "mcq",
      id: "c25-p4",
      prompt: "Which language is most typically supported by a stack structure?",
      choices: ["$\\{0^n1^n\\}$", "All binary strings whose length is prime", "$\\{ww\\mid w\\in\\{0,1\\}^*\\}$", "The set of halting-problem instances"],
      answerIndex: 0,
      why: "$0^n1^n$ requires remembering a count and matching it, which suits a pushdown automaton.",
    },
    {
      kind: "mcq",
      id: "c25-p5",
      prompt: "Grammar ambiguity means",
      choices: ["The language is empty", "Some string has multiple distinct parse trees", "The grammar has too few variables", "Terminals appear repeatedly"],
      answerIndex: 1,
      why: "Ambiguity is about one string having multiple structural interpretations.",
    },
  ],
  challenge: [
    {
      id: "c25-c1",
      prompt: "Give a CFG for balanced parentheses and briefly prove it is correct.",
      solution:
        "One grammar is $S\\to SS\\mid (S)\\mid\\epsilon$. Correctness: every derived string is built from the empty string, concatenation, and wrapping a pair of parentheses, so balance is preserved; conversely, any balanced string can be decomposed by its outermost structure as concatenation or wrapping, and induction shows it is derivable.",
      rubric:
        "Must give complete rules and explain both directions: every generated string is balanced, and every balanced string can be generated; rules alone without proof idea are not full credit.",
    },
    {
      id: "c25-c2",
      prompt: "Explain why grammar $E\\to E+E\\mid E*E\\mid (E)\\mid id$ is ambiguous, and give a string that exhibits ambiguity.",
      solution:
        "The string $id+id*id$ has two parse trees: one groups $id+id$ before multiplying, another groups $id*id$ before adding. The two trees correspond to different operator precedence, so the grammar is ambiguous.",
      rubric:
        "Must give a concrete string and describe two different structures (or two leftmost derivations); saying \"ambiguous\" without a witness is insufficient.",
    },
    {
      id: "c25-c3",
      prompt: "Construct a CFG generating $\\{0^i1^j\\mid i\\ge j\\ge 0\\}$.",
      solution:
        "Use $S\\to 0S1\\mid A$, $A\\to 0A\\mid\\epsilon$. The first part adds one 0 and one 1 each step, keeping matched counts equal; switching to $A$ adds extra 0s only, so always $i\\ge j$, and every string satisfying the condition can be built by pairing first and then padding with 0s.",
      rubric:
        "Rules must ensure all 1s come after 0s and never outnumber them; the explanation should cover both that only legal strings are generated and that every legal string can be generated.",
    },
  ],
};

export const chapter26: PracticeSet = {
  chapter: "26",
  title: "Turing Machines",
  warmup: [
    { id: "c26-f1", front: "TM components", back: "A TM has finite control, tape alphabet, infinite tape, and read/write head." },
    { id: "c26-f2", front: "Configuration", back: "A configuration captures current state, tape contents, and head position." },
    { id: "c26-f3", front: "Decide vs recognize (TM)", back: "Decider halts on all inputs; recognizer may loop on non-members." },
    { id: "c26-f4", front: "Church-Turing thesis", back: "Informal claim: effectively computable functions are exactly TM-computable." },
    { id: "c26-f5", front: "Encoding machines", back: "A TM can be encoded as a string, enabling machines to reason about machines." },
    { id: "c26-f6", front: "Universal TM", back: "A universal TM simulates any encoded TM on any encoded input." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c26-p1",
      prompt: "The key difference between a Turing machine and a DFA is",
      choices: ["A TM has an infinite writable tape", "A TM has no states", "A DFA can rewrite its input", "A DFA can simulate any Turing machine"],
      answerIndex: 0,
      why: "The TM's read/write infinite tape greatly increases its memory capacity.",
    },
    {
      kind: "spot-flaw",
      id: "c26-p2",
      prompt: "Find the invalid line: someone says \"any recognizer can directly serve as a decider.\"",
      lines: [
        { id: "l1", text: "A recognizer eventually accepts on member inputs." },
        { id: "l2", text: "On non-member inputs it may loop forever." },
        { id: "l3", text: "Looping forever is equivalent to rejection." },
        { id: "l4", text: "Therefore it decides the language." },
      ],
      flawLineId: "l3",
      why: "A decider must halt and give yes/no; looping is not a valid output.",
    },
    {
      kind: "fill-blank",
      id: "c26-p3",
      prompt: "Complete: if language $L$ is decidable, then there is a TM that on every input ____.",
      before: "By definition, a decider must finish on both members and non-members and give an answer, so it",
      after: ".",
      accept: ["halts", "halts and answers", "halts and gives accept or reject"],
      why: "Decidability means always halting plus correctness.",
    },
    {
      kind: "mcq",
      id: "c26-p4",
      prompt: "The most accurate role of a universal Turing machine is",
      choices: ["To recognize only regular languages", "To simulate any encoded TM on a given encoded input", "To make undecidable problems decidable", "To work only on the empty input"],
      answerIndex: 1,
      why: "The universal machine interprets an encoding and runs \"the machine as data.\"",
    },
    {
      kind: "mcq",
      id: "c26-p5",
      prompt: "Why is \"encodability\" central in this chapter?",
      choices: [
        "Because encoding makes inputs shorter",
        "Because machines and programs can be treated as strings",
        "Because encoding automatically guarantees polynomial time",
        "Because encoding is used only for DFAs",
      ],
      answerIndex: 1,
      why: "Later self-reference, diagonalization, and undecidability all rely on \"machines as inputs.\"",
    },
  ],
  challenge: [
    {
      id: "c26-c1",
      prompt: "Describe the idea of a single-tape Turing machine that decides $\\{0^n1^n\\mid n\\ge 0\\}$.",
      solution:
        "Algorithm: repeatedly scan left to right, find the leftmost unmarked 0 and mark it X; then scan right for the leftmost unmarked 1 and mark it Y; if no matching 1 is found, reject. Return to the left end and repeat. If only X and Y (and blanks) remain, accept; if a 1 appears before a 0 or counts mismatch, reject. Each round marks at least one 0, so the machine halts and decides correctly.",
      rubric:
        "Needs a pairing/marking mechanism, failure conditions, and a halting argument; intuition alone without accept/reject rules is not enough.",
    },
    {
      id: "c26-c2",
      prompt: "Explain the difference between recognizing and deciding, and give a behavior pattern that recognizes but does not decide.",
      solution:
        "A recognizer must eventually accept member inputs, but on non-members it may reject or loop; a decider must halt on all inputs and give accept/reject. A typical recognize-only pattern: enumerate evidence and verify; accept when evidence is found, and continue searching forever otherwise. On non-member inputs this may never stop.",
      rubric:
        "Must clearly state the halting-condition difference and give a concrete mechanism that may loop on non-members.",
    },
  ],
};

export const chapter27: PracticeSet = {
  chapter: "27",
  title: "Unsolvable Problems",
  warmup: [
    { id: "c27-f1", front: "Undecidable language", back: "A language is undecidable if no TM decides it on all inputs." },
    { id: "c27-f2", front: "Halting problem", back: "$HALT=\\{\\langle M,w\\rangle\\mid M\\text{ halts on }w\\}$ is undecidable." },
    { id: "c27-f3", front: "Reduction idea", back: "To show $B$ hard, reduce known hard problem $A$ to $B$." },
    { id: "c27-f4", front: "Mapping reduction", back: "$A\\le_m B$ means computable $f$ with $x\\in A\\Leftrightarrow f(x)\\in B$." },
    { id: "c27-f5", front: "Diagonal/self-reference", back: "Many undecidability proofs derive contradiction from self-application." },
    { id: "c27-f6", front: "Recognizable but undecidable", back: "Some languages are semi-decidable: recognizable yet not decidable." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c27-p1",
      prompt: "If $A$ is known undecidable and $A\\le_m B$, we can conclude",
      choices: ["$B$ is decidable", "$B$ is undecidable", "$A$ is recognizable iff $B$ is recognizable", "$B$ must be the empty language"],
      answerIndex: 1,
      why: "If $B$ were decidable, we could combine the reduction to decide $A$, contradicting the assumption.",
    },
    {
      kind: "spot-flaw",
      id: "c27-p2",
      prompt: "Find the invalid line: someone \"proves\" the halting problem is decidable.",
      lines: [
        { id: "l1", text: "Given $\\langle M,w\\rangle$, simulate $M(w)$." },
        { id: "l2", text: "If $M$ halts, accept." },
        { id: "l3", text: "If it runs a long time without halting, declare it will never halt and reject." },
      ],
      flawLineId: "l3",
      why: "\"Running a long time\" gives no finite-time guarantee; the machine may simply not have halted yet.",
    },
    {
      kind: "fill-blank",
      id: "c27-p3",
      prompt: "Complete the reduction template: to show $B$ is undecidable, start from a known undecidable problem $A$ and construct a computable function $f$ such that ____.",
      before: "The key condition preserves yes/no correspondence:",
      after: ". If $B$ were decidable, then $A$ would be too, a contradiction.",
      accept: ["x\\in A \\Leftrightarrow f(x)\\in B", "x in A iff f(x) in B", "x∈A iff f(x)∈B"],
      why: "This is the core of a many-one reduction definition.",
    },
    {
      kind: "mcq",
      id: "c27-p4",
      prompt: "Which statement is correct?",
      choices: [
        "Undecidable means no algorithm outputs anything on any input",
        "An undecidable language must be unrecognizable",
        "Undecidable means only that no algorithm always halts and is always correct",
        "HALT can be decided by a DFA",
      ],
      answerIndex: 2,
      why: "Undecidability rules out deciders, not recognizers or partial algorithms.",
    },
    {
      kind: "mcq",
      id: "c27-p5",
      prompt: "In a reduction, the arrow usually goes from",
      choices: ["An unknown-difficulty problem to a known easy problem", "A known hard problem to the target problem", "The target problem to an arbitrary problem", "A decidable problem to the empty problem"],
      answerIndex: 1,
      why: "That is how known hardness is transferred to the target problem.",
    },
  ],
  challenge: [
    {
      id: "c27-c1",
      prompt: "Use contradiction and self-reference to explain why HALT is undecidable (high-level pseudocode is fine).",
      solution:
        "Assume a decider $H(M,w)$ that decides whether $M$ halts on $w$. Build machine $D(x)$: if $H(x,x)$ predicts \"halts,\" then $D$ loops forever; if it predicts \"does not halt,\" then $D$ halts immediately. Consider $D(D)$: if $H(D,D)$ says halts, then by construction $D(D)$ loops; if it says does not halt, then $D(D)$ halts. Both contradict, so $H$ cannot exist and HALT is undecidable.",
      rubric:
        "Needs assuming a decider, constructing the opposite machine, self-application, and a two-way contradiction; missing self-application is incomplete.",
    },
    {
      id: "c27-c2",
      prompt: "Prove that if $HALT\\le_m B$ with reduction $f$, then $B$ is undecidable.",
      solution:
        "Suppose for contradiction that $B$ is decidable with decider $Dec_B$. Given any $x$, compute $f(x)$ (computable), then run $Dec_B(f(x))$. By the reduction property $x\\in HALT\\Leftrightarrow f(x)\\in B$, this decides HALT, a contradiction. Hence $B$ is undecidable.",
      rubric:
        "Should clearly describe combining $f$ with $Dec_B$, and state how the equivalence guarantees correctness.",
    },
  ],
};

export const chapter28: PracticeSet = {
  chapter: "28",
  title: "Efficiency: The Class P",
  warmup: [
    { id: "c28-f1", front: "Polynomial time", back: "Runtime $O(n^k)$ for some constant $k$ is polynomial time." },
    { id: "c28-f2", front: "Class P", back: "$P$ is the set of decision problems solvable in polynomial time by deterministic TMs." },
    { id: "c28-f3", front: "Why polynomial?", back: "Polynomial growth is considered tractable; exponential often becomes infeasible." },
    { id: "c28-f4", front: "Big-O abstraction", back: "Big-O ignores constant factors and lower-order terms asymptotically." },
    { id: "c28-f5", front: "Input size matters", back: "Complexity is measured as function of encoded input length $n$." },
    { id: "c28-f6", front: "Closure under composition", back: "Composing polynomial-time algorithms remains polynomial-time." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c28-p1",
      prompt: "Which of the following runtimes is polynomial time?",
      choices: ["$O(2^n)$", "$O(n^{3})$", "$O(n!)$", "$O(3^{\\sqrt{n}})$"],
      answerIndex: 1,
      why: "$n^3$ is a standard polynomial, while the others grow much faster than any fixed power.",
    },
    {
      kind: "spot-flaw",
      id: "c28-p2",
      prompt: "Find the invalid line: someone says \"$O(n^2+n)$ is not polynomial because of the plus sign.\"",
      lines: [
        { id: "l1", text: "$n^2+n$ has two terms." },
        { id: "l2", text: "Any expression with addition is not polynomial." },
        { id: "l3", text: "Therefore the algorithm is not in $P$." },
      ],
      flawLineId: "l2",
      why: "A polynomial is a linear combination of power terms; addition does not rule out polynomial growth.",
    },
    {
      kind: "fill-blank",
      id: "c28-p3",
      prompt: "Complete: if algorithm A takes $O(n^2)$ and then calls algorithm B which takes $O(n^3)$, the total time is ____.",
      before: "In serial execution, complexities add and the highest-order term dominates, so",
      after: ".",
      accept: ["O(n^3)", "n^3", "Theta(n^3)"],
      why: "$n^2+n^3=O(n^3)$, still polynomial.",
    },
    {
      kind: "mcq",
      id: "c28-p4",
      prompt: "Problems in class $P$ share which defining feature?",
      choices: ["They all have greedy solutions", "They are all decidable in polynomial time on a deterministic model", "They all require exponential time", "They are all graph problems"],
      answerIndex: 1,
      why: "The defining feature is deterministic polynomial-time decidability.",
    },
    {
      kind: "mcq",
      id: "c28-p5",
      prompt: "If input size doubles and runtime roughly multiplies by 8, the algorithm is most likely",
      choices: ["Linear time", "Logarithmic time", "Cubic polynomial time", "Exponential time"],
      answerIndex: 2,
      why: "$T(2n)\\approx 8T(n)$ corresponds to an $n^3$ scale.",
    },
  ],
  challenge: [
    {
      id: "c28-c1",
      prompt: "Prove that if problems $A,B\\in P$, then their intersection $A\\cap B$ is also in $P$.",
      solution:
        "Let deciders $M_A,M_B$ decide $A,B$ in time $n^{k_1}$ and $n^{k_2}$ respectively. Construct a decider on input $x$: run $M_A(x)$; if it rejects, reject; if it accepts, run $M_B(x)$ and return its result. Total time is $O(n^{k_1}+n^{k_2})=O(n^{\\max(k_1,k_2)})$, still polynomial, so $A\\cap B\\in P$.",
      rubric:
        "Must include the algorithm construction and a time bound; must explain why the acceptance condition matches the intersection.",
    },
    {
      id: "c28-c2",
      prompt: "Give a recursive example that looks fast but is actually exponential, and explain why it is not in $P$ (for that algorithm).",
      solution:
        "For example, naive Fibonacci recursion $F(n)=F(n-1)+F(n-2)$ without memoization: the recursion tree has roughly exponential size, so runtime is about $\\Theta(\\varphi^n)$. Therefore this specific algorithm is not polynomial time, and one cannot conclude from it that the underlying problem is in $P$.",
      rubric:
        "Should give a concrete algorithm, growth analysis (recursion tree or lower bound), and distinguish algorithm complexity from problem complexity.",
    },
    {
      id: "c28-c3",
      prompt: "Explain why complexity analysis uses encoded input length rather than numeric magnitude itself, with a short example.",
      solution:
        "Algorithm input is an encoded string, and length is the natural measure of reading cost. Example: integer $N$ has binary length about $\\log N$. If runtime is written as $O(N)$, in terms of input length $n=\\log N$ it becomes $O(2^n)$, which is exponential. So analysis must use encoded length consistently.",
      rubric:
        "Must highlight the difference between encoded length and numeric magnitude, with an $N$ versus $\\log N$ conversion example.",
    },
  ],
};

export const chapter29: PracticeSet = {
  chapter: "29",
  title: "Hard Problems: NP",
  warmup: [
    { id: "c29-f1", front: "Class NP", back: "$NP$ contains decision problems whose YES instances have polynomial-size certificates verifiable in polynomial time." },
    { id: "c29-f2", front: "Verifier view", back: "A verifier $V(x,c)$ runs in polytime and accepts iff certificate $c$ proves $x\\in L$." },
    { id: "c29-f3", front: "P vs NP fact", back: "It is known that $P\\subseteq NP$; whether $P=NP$ is open." },
    { id: "c29-f4", front: "NP-hard", back: "A problem is NP-hard if every NP problem reduces to it in polynomial time." },
    { id: "c29-f5", front: "NP-complete", back: "NP-complete means both in NP and NP-hard." },
    { id: "c29-f6", front: "SAT role", back: "SAT is canonical NP-complete (Cook-Levin theorem)." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "c29-p1",
      prompt: "Which of the following is currently known to hold for $P$ and $NP$?",
      choices: ["$NP\\subseteq P$", "$P=NP$", "$P\\subseteq NP$", "$P\\cap NP=\\emptyset$"],
      answerIndex: 2,
      why: "Anything solvable in polynomial time can certainly be verified in polynomial time.",
    },
    {
      kind: "spot-flaw",
      id: "c29-p2",
      prompt: "Find the invalid line: someone says \"being in NP means you can solve it quickly.\"",
      lines: [
        { id: "l1", text: "If a problem is in NP, there is a polynomial-time verifier." },
        { id: "l2", text: "Having a verifier lets you immediately build a polynomial-time solver." },
        { id: "l3", text: "So every NP problem is in P." },
      ],
      flawLineId: "l2",
      why: "\"Easy to verify\" does not mean \"easy to solve\"; that is the core $P$ vs $NP$ gap.",
    },
    {
      kind: "fill-blank",
      id: "c29-p3",
      prompt: "Complete the definition: problem $L$ is NP-complete if and only if ____.",
      before: "It must satisfy both membership and hardness conditions, namely",
      after: ".",
      accept: [
        "L\\in NP \\text{ and } L \\text{ is NP-hard}",
        "L in NP and L is NP-hard",
        "L is in NP and L is NP-hard",
      ],
      why: "NP-complete is the formal combination of being in NP and being NP-hard.",
    },
    {
      kind: "mcq",
      id: "c29-p4",
      prompt: "If a known NP-complete problem $X$ is also in $P$, we can conclude",
      choices: ["$P\\neq NP$", "$P=NP$", "SAT is not in NP", "Nothing changes"],
      answerIndex: 1,
      why: "An NP-complete problem in polynomial time would let every NP problem be reduced and solved in polynomial time.",
    },
    {
      kind: "mcq",
      id: "c29-p5",
      prompt: "To prove a new problem $Y$ is NP-complete, the usual strategy is",
      choices: [
        "First prove $Y$ is decidable, then stop",
        "Reduce from a known NP-complete problem to $Y$, and prove $Y\\in NP$",
        "Only prove $Y$ is hard to understand",
        "Prove $Y$ has an exponential algorithm",
      ],
      answerIndex: 1,
      why: "Both steps are required: NP-hardness via reduction, plus membership in NP via verifiability.",
    },
  ],
  challenge: [
    {
      id: "c29-c1",
      prompt: "Explain at a high level why the verifiability definition of NP and the nondeterministic polynomial-time definition of NP are equivalent.",
      solution:
        "Direction one: if there is a polynomial verifier $V(x,c)$, a nondeterministic machine can guess certificate $c$ and run $V$, accepting all YES instances in polynomial time. Direction two: if there is a nondeterministic polynomial-time machine, the sequence of choices on an accepting branch can serve as a certificate; a verifier replays that branch and checks it is legal and reaches an accept state, also in polynomial time. So the definitions are equivalent.",
      rubric:
        "Must cover both directions and explain how guessed/branch traces become certificates; one direction alone is incomplete.",
    },
    {
      id: "c29-c2",
      prompt: "Prove that if $A\\le_p B$ and $B\\in P$, then $A\\in P$.",
      solution:
        "Let reduction function $f$ be computable in polynomial time with $x\\in A\\Leftrightarrow f(x)\\in B$. Given input $x$, compute $f(x)$, then run $B$'s polynomial-time decider. Total time is the sum (or composition) of two polynomials, still polynomial, and correctness follows from the reduction equivalence, so $A\\in P$.",
      rubric:
        "Must state the algorithm flow, correctness justification, and polynomial-closure argument; conclusion alone is not enough.",
    },
    {
      id: "c29-c3",
      prompt: "Suppose problem $Z$ is known to be NP-hard. If you also prove $Z\\in NP$, what can you conclude? Explain the significance.",
      solution:
        "You can immediately conclude that $Z$ is NP-complete. This means $Z$ is at least as hard as any problem in NP, while also having polynomial verification; if a polynomial-time algorithm for $Z$ were found later, it would imply $P=NP$.",
      rubric:
        "The conclusion must be \"NP-complete,\" and the explanation must combine the meaning of NP-hard and in-NP with the impact on $P$ vs $NP$.",
    },
  ],
};
