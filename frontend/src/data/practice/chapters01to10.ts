import type { PracticeSet } from "../../practice/types";

export const chapter01: PracticeSet = {
  chapter: "1",
  title: "A Taste of Discrete Mathematics",
  warmup: [
    { id: "ch1-w1", front: "Domain of discourse", back: "The universe of objects a statement is about." },
    { id: "ch1-w2", front: "Universal statement", back: "A claim of the form $\\forall x\\, P(x)$." },
    { id: "ch1-w3", front: "Existential statement", back: "A claim of the form $\\exists x\\, P(x)$." },
    { id: "ch1-w4", front: "Counterexample", back: "A single object showing a universal claim is false." },
    { id: "ch1-w5", front: "Parity", back: "An integer is even or odd depending on remainder mod $2$." },
    { id: "ch1-w6", front: "Divisibility", back: "$a\\mid b$ means $b = ak$ for some integer $k$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch1-p1",
      prompt: "Which sentence is the negation of $\\forall n \\in \\mathbb{Z},\\ n^2 \\ge 0$?",
      choices: [
        "$\\forall n \\in \\mathbb{Z},\\ n^2 < 0$",
        "$\\exists n \\in \\mathbb{Z}\\text{ such that } n^2 < 0$",
        "$\\exists n \\in \\mathbb{Z}\\text{ such that } n^2 \\le 0$",
        "$\\forall n \\in \\mathbb{Z},\\ n^2 > 0$",
      ],
      answerIndex: 1,
      why: "Negating $\\forall x\\,P(x)$ gives $\\exists x\\,\\neg P(x)$, so we need one integer with $n^2<0$.",
    },
    {
      kind: "mcq",
      id: "ch1-p2",
      prompt: "Which set has exactly one element?",
      choices: ["$\\{\\emptyset\\}$", "$\\emptyset$", "$\\{0,\\emptyset\\}$", "$\\{\\{\\emptyset\\},\\emptyset\\}$"],
      answerIndex: 0,
      why: "$\\{\\emptyset\\}$ contains one element (the empty set itself), while $\\emptyset$ contains none.",
    },
    {
      kind: "spot-flaw",
      id: "ch1-p3",
      prompt: "Find the invalid line in this attempted proof that all odd integers are prime.",
      lines: [
        { id: "ch1-l1", text: "Let $n$ be an odd integer greater than $1$." },
        { id: "ch1-l2", text: "Then $n = 2k+1$ for some integer $k$." },
        { id: "ch1-l3", text: "Numbers of the form $2k+1$ are not divisible by $2$." },
        { id: "ch1-l4", text: "So $n$ has no divisors other than $1$ and $n$, hence $n$ is prime." },
      ],
      flawLineId: "ch1-l4",
      why: "Not being divisible by $2$ does not rule out divisibility by $3,5,7,\\dots$; e.g. $9$ is odd but composite.",
    },
    {
      kind: "fill-blank",
      id: "ch1-p4",
      prompt: "Complete the statement: if $a\\mid b$ and $b\\mid c$, then ____.",
      before: "By definition, $b = ak$ and $c = b\\ell$ for integers $k,\\ell$. Substituting gives $c = a(k\\ell)$, so",
      after: ".",
      accept: ["a|c", "a divides c", "$a\\mid c$"],
      why: "The composition of divisibility is transitive because the witness integers multiply.",
    },
    {
      kind: "proof-order",
      id: "ch1-p5",
      prompt: "Order the steps proving: if $n$ is odd, then $n^2$ is odd.",
      steps: [
        { id: "ch1-s1", text: "Assume $n$ is odd, so $n=2k+1$ for some integer $k$.", deps: [] },
        { id: "ch1-s2", text: "Compute $n^2=(2k+1)^2=4k^2+4k+1$.", deps: ["ch1-s1"] },
        { id: "ch1-s3", text: "Rewrite as $n^2=2(2k^2+2k)+1$.", deps: ["ch1-s2"] },
        { id: "ch1-s4", text: "Since $2k^2+2k$ is an integer, $n^2$ is odd. $\\blacksquare$", deps: ["ch1-s3"] },
      ],
      why: "You must first introduce the odd form, then expand, then rewrite into $2m+1$ form to conclude oddness.",
    },
  ],
  challenge: [
    {
      id: "ch1-c1",
      prompt: "Show that the sum of two odd integers is even.",
      solution:
        "Let $a=2m+1$ and $b=2n+1$ with integers $m,n$. Then $a+b=2m+2n+2=2(m+n+1)$. " +
        "Since $m+n+1$ is an integer, $a+b$ is even. $\\blacksquare$",
      rubric:
        "Defines odd numbers as $2k+1$; substitutes both correctly; factors a $2$; explicitly states the resulting integer witness.",
      twinPromptId: "ch1-c2",
    },
    {
      id: "ch1-c2",
      prompt: "Show that the difference of two odd integers is even.",
      solution:
        "Let $a=2m+1$ and $b=2n+1$. Then $a-b=(2m+1)-(2n+1)=2(m-n)$. " +
        "Because $m-n\\in\\mathbb{Z}$, $a-b$ is even. $\\blacksquare$",
      rubric:
        "Uses the odd form for both integers; simplifies without algebra mistakes; presents an integer witness for evenness.",
    },
  ],
};

export const chapter02: PracticeSet = {
  chapter: "2",
  title: "Discrete Objects",
  warmup: [
    { id: "ch2-w1", front: "Set builder notation", back: "$\\{x\\in U\\mid P(x)\\}$ means all $x$ in $U$ satisfying $P$." },
    { id: "ch2-w2", front: "Cartesian product", back: "$A\\times B = \\{(a,b)\\mid a\\in A, b\\in B\\}$." },
    { id: "ch2-w3", front: "Power set", back: "$\\mathcal{P}(A)$ is the set of all subsets of $A$." },
    { id: "ch2-w4", front: "Function injective", back: "$f(x)=f(y)\\Rightarrow x=y$." },
    { id: "ch2-w5", front: "Function surjective", back: "Every codomain element has at least one preimage." },
    { id: "ch2-w6", front: "String length", back: "For a string $w$, $|w|$ is its number of symbols." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch2-p1",
      prompt: "If $|A|=3$ and $|B|=4$, what is $|A\\times B|$?",
      choices: ["$7$", "$12$", "$24$", "$81$"],
      answerIndex: 1,
      why: "Each of the $3$ choices from $A$ pairs with $4$ choices from $B$, giving $3\\cdot4$ ordered pairs.",
    },
    {
      kind: "fill-blank",
      id: "ch2-p2",
      prompt: "Complete: for any finite set $A$ with $|A|=n$, $|\\mathcal{P}(A)|$ = ____.",
      before: "Each element has two choices (in or out) for each subset. Therefore",
      after: ".",
      accept: ["2^n", "$2^n$", "2**n"],
      why: "Subset choice is independent per element, giving $2\\times2\\times\\cdots\\times2 = 2^n$.",
    },
    {
      kind: "proof-order",
      id: "ch2-p3",
      prompt: "Order the argument that composition of injections is injective.",
      steps: [
        { id: "ch2-s1", text: "Assume $f:A\\to B$ and $g:B\\to C$ are injective.", deps: [] },
        { id: "ch2-s2", text: "Assume $(g\\circ f)(x_1)=(g\\circ f)(x_2)$.", deps: ["ch2-s1"] },
        { id: "ch2-s3", text: "Then $g(f(x_1))=g(f(x_2))$, so by injectivity of $g$, $f(x_1)=f(x_2)$.", deps: ["ch2-s2"] },
        { id: "ch2-s4", text: "By injectivity of $f$, conclude $x_1=x_2$.", deps: ["ch2-s3"] },
        { id: "ch2-s5", text: "Hence $g\\circ f$ is injective. $\\blacksquare$", deps: ["ch2-s4"] },
      ],
      why: "The key chain is equality under composition, then peel off $g$, then peel off $f$.",
    },
    {
      kind: "spot-flaw",
      id: "ch2-p4",
      prompt: "Find the faulty line in this claim: every function is injective.",
      lines: [
        { id: "ch2-l1", text: "Let $f:A\\to B$ be any function." },
        { id: "ch2-l2", text: "Choose $x_1,x_2\\in A$ with $f(x_1)=f(x_2)$." },
        { id: "ch2-l3", text: "Since outputs are equal, inputs must be equal: $x_1=x_2$." },
        { id: "ch2-l4", text: "Therefore $f$ is injective." },
      ],
      flawLineId: "ch2-l3",
      why: "That implication is exactly the definition of injective, not a consequence of being a function.",
    },
    {
      kind: "mcq",
      id: "ch2-p5",
      prompt: "Which map $f:\\mathbb{Z}\\to\\mathbb{Z}$ is bijective?",
      choices: ["$f(n)=n^2$", "$f(n)=n+1$", "$f(n)=2n$", "$f(n)=|n|$"],
      answerIndex: 1,
      why: "$f(n)=n+1$ is injective and surjective on $\\mathbb{Z}$ with inverse $f^{-1}(m)=m-1$.",
    },
  ],
  challenge: [
    {
      id: "ch2-c1",
      prompt: "Prove $A\\cap(B\\cup C)=(A\\cap B)\\cup(A\\cap C)$ by element chasing.",
      solution:
        "For $x$, show both inclusions. If $x\\in A\\cap(B\\cup C)$, then $x\\in A$ and ($x\\in B$ or $x\\in C$). " +
        "So either $x\\in A\\cap B$ or $x\\in A\\cap C$, hence $x\\in (A\\cap B)\\cup(A\\cap C)$. " +
        "Conversely, if $x\\in (A\\cap B)\\cup(A\\cap C)$, then either $x\\in A\\cap B$ or $x\\in A\\cap C$. " +
        "In both cases $x\\in A$ and $x\\in B\\cup C$, so $x\\in A\\cap(B\\cup C)$. $\\blacksquare$",
      rubric:
        "Proves two inclusions; uses correct logical unpacking of union/intersection; avoids assuming what must be shown.",
      twinPromptId: "ch2-c2",
    },
    {
      id: "ch2-c2",
      prompt: "Prove $A\\cup(B\\cap C)=(A\\cup B)\\cap(A\\cup C)$ by element chasing.",
      solution:
        "Again prove both directions with an arbitrary $x$. If $x\\in A\\cup(B\\cap C)$, then either $x\\in A$ or ($x\\in B$ and $x\\in C$). " +
        "Either way, $x\\in A\\cup B$ and $x\\in A\\cup C$, so $x\\in (A\\cup B)\\cap(A\\cup C)$. " +
        "For the reverse inclusion, if $x\\in (A\\cup B)\\cap(A\\cup C)$ then $x\\in A\\cup B$ and $x\\in A\\cup C$. " +
        "If $x\\notin A$, those force $x\\in B$ and $x\\in C$, so $x\\in B\\cap C$. Thus $x\\in A\\cup(B\\cap C)$. $\\blacksquare$",
      rubric:
        "Handles case split carefully, especially reverse direction using $x\\notin A$; establishes both inclusions cleanly.",
    },
  ],
};

export const chapter03: PracticeSet = {
  chapter: "3",
  title: "Making Precise Statements",
  warmup: [
    { id: "ch3-w1", front: "Predicate", back: "A statement template $P(x)$ that becomes true/false when $x$ is specified." },
    { id: "ch3-w2", front: "Negating quantifiers", back: "$\\neg\\forall x\\,P(x)\\equiv\\exists x\\,\\neg P(x)$ and vice versa." },
    { id: "ch3-w3", front: "Implication", back: "$P\\Rightarrow Q$ is false only when $P$ true and $Q$ false." },
    { id: "ch3-w4", front: "Biconditional", back: "$P\\Leftrightarrow Q$ means both $P\\Rightarrow Q$ and $Q\\Rightarrow P$." },
    { id: "ch3-w5", front: "Necessary condition", back: "$Q$ is necessary for $P$ if $P\\Rightarrow Q$." },
    { id: "ch3-w6", front: "Sufficient condition", back: "$P$ is sufficient for $Q$ if $P\\Rightarrow Q$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch3-p1",
      prompt: "Translate: “Every real number has a larger real number.”",
      choices: [
        "$\\forall x\\in\\mathbb{R},\\exists y\\in\\mathbb{R},\\ y>x$",
        "$\\exists y\\in\\mathbb{R},\\forall x\\in\\mathbb{R},\\ y>x$",
        "$\\forall x\\in\\mathbb{R},\\forall y\\in\\mathbb{R},\\ y>x$",
        "$\\exists x\\in\\mathbb{R},\\exists y\\in\\mathbb{R},\\ y>x$",
      ],
      answerIndex: 0,
      why: "The larger number can depend on $x$, so the quantifier order is $\\forall x\\exists y$.",
    },
    {
      kind: "spot-flaw",
      id: "ch3-p2",
      prompt: "A student negates “$\\forall x\\exists y\\,P(x,y)$”. Click the wrong line.",
      lines: [
        { id: "ch3-l1", text: "Start with $\\neg\\forall x\\exists y\\,P(x,y)$." },
        { id: "ch3-l2", text: "This equals $\\forall x\\neg\\exists y\\,P(x,y)$." },
        { id: "ch3-l3", text: "Then equals $\\forall x\\forall y\\,\\neg P(x,y)$." },
      ],
      flawLineId: "ch3-l2",
      why: "Negating $\\forall x$ should produce $\\exists x$, not another $\\forall x$.",
    },
    {
      kind: "fill-blank",
      id: "ch3-p3",
      prompt: "Fill in the contrapositive of $P\\Rightarrow Q$.",
      before: "The contrapositive is",
      after: ".",
      accept: ["not Q implies not P", "$\\neg Q \\Rightarrow \\neg P$", "¬Q => ¬P"],
      why: "Contrapositive swaps and negates both parts and is logically equivalent to the original implication.",
    },
    {
      kind: "mcq",
      id: "ch3-p4",
      prompt: "Which is equivalent to “$x$ is even” for integer $x$?",
      choices: ["$\\exists k\\in\\mathbb{Z},\\ x=2k$", "$\\forall k\\in\\mathbb{Z},\\ x=2k$", "$x=2k+1$ for some $k$", "$x\\equiv 1\\pmod 2$"],
      answerIndex: 0,
      why: "Existential witness form $x=2k$ is the standard precise definition of even.",
    },
    {
      kind: "proof-order",
      id: "ch3-p5",
      prompt: "Order the steps proving: if $x>3$, then $x^2>9$ for real $x$.",
      steps: [
        { id: "ch3-s1", text: "Assume $x>3$.", deps: [] },
        { id: "ch3-s2", text: "Then $x+3>6>0$ and $x-3>0$.", deps: ["ch3-s1"] },
        { id: "ch3-s3", text: "Multiply positives: $(x-3)(x+3)>0$.", deps: ["ch3-s2"] },
        { id: "ch3-s4", text: "So $x^2-9>0$, hence $x^2>9$. $\\blacksquare$", deps: ["ch3-s3"] },
      ],
      why: "The product argument depends on first establishing both factors are positive.",
    },
  ],
  challenge: [
    {
      id: "ch3-c1",
      prompt: "Negate precisely: “For every integer $n$, there exists an integer $m$ such that $m>n$ and $m$ is even.”",
      solution:
        "The negation is: “There exists an integer $n$ such that for every integer $m$, either $m\\le n$ or $m$ is odd.” " +
        "Formally, $\\exists n\\in\\mathbb{Z}\\,\\forall m\\in\\mathbb{Z}\\,\\neg(m>n\\land \\text{Even}(m))$, then apply De Morgan. ",
      rubric:
        "Switches quantifiers in correct order ($\\forall\\exists$ to $\\exists\\forall$); negates conjunction using “or”; preserves integer domains.",
      twinPromptId: "ch3-c2",
    },
    {
      id: "ch3-c2",
      prompt: "Rewrite and negate: “There exists a real number that is greater than every integer.”",
      solution:
        "Original: $\\exists x\\in\\mathbb{R}\\,\\forall n\\in\\mathbb{Z},\\ x>n$. Negation: $\\forall x\\in\\mathbb{R}\\,\\exists n\\in\\mathbb{Z},\\ x\\le n$. " +
        "This says every real has some integer at least as large as it.",
      rubric:
        "States formal original correctly; flips quantifiers correctly; negates $x>n$ to $x\\le n$ with domains intact.",
    },
  ],
};

export const chapter05: PracticeSet = {
  chapter: "5",
  title: "Induction: Proving \"FOR ALL ...\" ",
  warmup: [
    { id: "ch5-w1", front: "Induction basis", back: "Verify the statement at the starting index (often $n=0$ or $n=1$)." },
    { id: "ch5-w2", front: "Induction hypothesis", back: "Assume statement true at $n=k$." },
    { id: "ch5-w3", front: "Induction step", back: "Use hypothesis to prove truth at $n=k+1$." },
    { id: "ch5-w4", front: "Weak induction", back: "Assumes only $P(k)$ to prove $P(k+1)$." },
    { id: "ch5-w5", front: "Geometric sum", back: "$\\sum_{i=0}^{n} r^i = (r^{n+1}-1)/(r-1)$ for $r\\ne1$." },
    { id: "ch5-w6", front: "Divisibility induction", back: "Often use algebra to factor a known divisible term." },
  ],
  practice: [
    {
      kind: "proof-order",
      id: "ch5-p1",
      prompt: "Order an induction proof of $1+2+\\cdots+n=\\frac{n(n+1)}{2}$ for $n\\ge1$.",
      steps: [
        { id: "ch5-s1", text: "Base case $n=1$: left side $=1$, right side $=1$.", deps: [] },
        { id: "ch5-s2", text: "Induction hypothesis: assume true for $n=k$.", deps: ["ch5-s1"] },
        { id: "ch5-s3", text: "Then $1+\\cdots+k+(k+1)=\\frac{k(k+1)}{2}+(k+1)$.", deps: ["ch5-s2"] },
        { id: "ch5-s4", text: "Simplify to $(k+1)(k+2)/2$.", deps: ["ch5-s3"] },
        { id: "ch5-s5", text: "So statement holds for $k+1$; by induction true for all $n\\ge1$. $\\blacksquare$", deps: ["ch5-s4"] },
      ],
      why: "A valid induction needs basis, explicit hypothesis, then the $k\\to k+1$ derivation.",
    },
    {
      kind: "proof-order",
      id: "ch5-p2",
      prompt: "Arrange proof that $2^n\\ge n+1$ for all $n\\ge0$.",
      steps: [
        { id: "ch5-t1", text: "Base $n=0$: $2^0=1\\ge1$.", deps: [] },
        { id: "ch5-t2", text: "Assume $2^k\\ge k+1$ for some $k\\ge0$.", deps: ["ch5-t1"] },
        { id: "ch5-t3", text: "Multiply by $2$: $2^{k+1}=2\\cdot2^k\\ge2(k+1)$.", deps: ["ch5-t2"] },
        { id: "ch5-t4", text: "Since $2(k+1)\\ge k+2$, conclude $2^{k+1}\\ge k+2$.", deps: ["ch5-t3"] },
        { id: "ch5-t5", text: "Therefore true for all $n\\ge0$ by induction. $\\blacksquare$", deps: ["ch5-t4"] },
      ],
      why: "After applying hypothesis, one extra inequality bridges to the desired $k+2$ bound.",
    },
    {
      kind: "mcq",
      id: "ch5-p3",
      prompt: "In an induction proof beginning at $n=4$, which base case is required?",
      choices: ["$n=0$", "$n=1$", "$n=4$", "$n=2$ and $n=3$ only"],
      answerIndex: 2,
      why: "Weak induction starts at the first index where the statement is claimed.",
    },
    {
      kind: "fill-blank",
      id: "ch5-p4",
      prompt: "Complete the algebra in the induction step for geometric sum.",
      before: "Assume $\\sum_{i=0}^{k}2^i=2^{k+1}-1$. Then $\\sum_{i=0}^{k+1}2^i=(2^{k+1}-1)+2^{k+1}=$",
      after: ".",
      accept: ["2^(k+2)-1", "$2^{k+2}-1$", "2^{k+2}-1"],
      why: "Combine like powers: $2^{k+1}+2^{k+1}=2^{k+2}$.",
    },
    {
      kind: "spot-flaw",
      id: "ch5-p5",
      prompt: "Spot the flaw in this attempted induction for “all horses are same color.”",
      lines: [
        { id: "ch5-l1", text: "Base case $n=1$: one horse is trivially one color." },
        { id: "ch5-l2", text: "Assume any set of $k$ horses has one color." },
        { id: "ch5-l3", text: "For $k+1$ horses, compare first $k$ and last $k$ horses." },
        { id: "ch5-l4", text: "These two groups overlap, so colors match and all $k+1$ horses share one color." },
      ],
      flawLineId: "ch5-l4",
      why: "At transition from $k=1$ to $k+1=2$, the two groups do not overlap, so the argument breaks.",
    },
  ],
  challenge: [
    {
      id: "ch5-c1",
      prompt: "Prove by induction that $7\\mid (8^n-1)$ for all $n\\ge1$.",
      solution:
        "Base $n=1$: $8^1-1=7$, divisible by $7$. Assume $8^k-1=7m$. Then " +
        "$8^{k+1}-1=8\\cdot8^k-1=8(8^k-1)+7=8\\cdot7m+7=7(8m+1)$, divisible by $7$. " +
        "Hence true for all $n\\ge1$. $\\blacksquare$",
      rubric:
        "Checks base case; states hypothesis in divisibility form; rewrites $8^{k+1}-1$ using $8(8^k-1)+7$; factors $7$ cleanly.",
      twinPromptId: "ch5-c2",
    },
    {
      id: "ch5-c2",
      prompt: "Prove by induction that $3\\mid (4^n-1)$ for all $n\\ge1$.",
      solution:
        "Base $n=1$: $4-1=3$. Assume $4^k-1=3m$. Then " +
        "$4^{k+1}-1=4(4^k-1)+3=4\\cdot3m+3=3(4m+1)$. So divisible by $3$ for $k+1$. " +
        "By induction, true for all $n\\ge1$. $\\blacksquare$",
      rubric:
        "Same induction template with correct constants; no arithmetic slips in the factorization.",
    },
  ],
};

export const chapter06: PracticeSet = {
  chapter: "6",
  title: "Strong Induction",
  warmup: [
    { id: "ch6-w1", front: "Strong induction hypothesis", back: "Assume $P(j)$ for all start$\\le j\\le k$ to prove $P(k+1)$." },
    { id: "ch6-w2", front: "Well-ordering principle", back: "Every nonempty subset of $\\mathbb{N}$ has a least element." },
    { id: "ch6-w3", front: "Prime number", back: "Integer $p>1$ with exactly two positive divisors: $1$ and $p$." },
    { id: "ch6-w4", front: "Composite number", back: "Integer $n>1$ that is not prime." },
    { id: "ch6-w5", front: "Fibonacci recurrence", back: "$F_0=0,F_1=1,F_n=F_{n-1}+F_{n-2}$ for $n\\ge2$." },
    { id: "ch6-w6", front: "Binary decomposition", back: "Any $n\\ge1$ can be written as sum of distinct powers of $2$." },
  ],
  practice: [
    {
      kind: "proof-order",
      id: "ch6-p1",
      prompt: "Order the strong induction proof: every integer $n\\ge2$ factors into primes.",
      steps: [
        { id: "ch6-s1", text: "Base case $n=2$: $2$ is prime, so done.", deps: [] },
        { id: "ch6-s2", text: "Assume every integer $m$ with $2\\le m\\le k$ has a prime factorization.", deps: ["ch6-s1"] },
        { id: "ch6-s3", text: "Consider $k+1$. If prime, done.", deps: ["ch6-s2"] },
        { id: "ch6-s4", text: "If composite, write $k+1=ab$ with $2\\le a,b\\le k$.", deps: ["ch6-s3"] },
        { id: "ch6-s5", text: "By hypothesis, both $a$ and $b$ factor into primes, so their product does too.", deps: ["ch6-s4"] },
        { id: "ch6-s6", text: "Thus every $n\\ge2$ has a prime factorization. $\\blacksquare$", deps: ["ch6-s5"] },
      ],
      why: "The composite case needs factors strictly below $k+1$, exactly where strong induction is used.",
    },
    {
      kind: "proof-order",
      id: "ch6-p2",
      prompt: "Arrange proof that every postage value $n\\ge12$ can be made from 4- and 5-cent stamps.",
      steps: [
        { id: "ch6-t1", text: "Verify bases: $12=4+4+4$, $13=4+4+5$, $14=4+5+5$, $15=5+5+5$.", deps: [] },
        { id: "ch6-t2", text: "Assume each value from $12$ through $k$ is achievable, where $k\\ge15$.", deps: ["ch6-t1"] },
        { id: "ch6-t3", text: "Then $k-3\\ge12$, so by hypothesis $k-3$ is achievable.", deps: ["ch6-t2"] },
        { id: "ch6-t4", text: "Add one 4-cent stamp to get $(k-3)+4=k+1$.", deps: ["ch6-t3"] },
        { id: "ch6-t5", text: "Therefore all $n\\ge12$ are achievable by strong induction. $\\blacksquare$", deps: ["ch6-t4"] },
      ],
      why: "The step to $k+1$ depends on a smaller value $k-3$, not only on $k$.",
    },
    {
      kind: "mcq",
      id: "ch6-p3",
      prompt: "Why are multiple base cases often needed in strong induction on recurrences?",
      choices: [
        "Because the hypothesis is weaker",
        "Because step formulas may reference several previous indices",
        "Because base cases are optional",
        "Because strong induction only works for primes",
      ],
      answerIndex: 1,
      why: "If $P(k+1)$ depends on $P(k)$ and $P(k-1)$, both early values must be anchored.",
    },
    {
      kind: "spot-flaw",
      id: "ch6-p4",
      prompt: "Find the flaw in this argument that all $n\\ge2$ are prime.",
      lines: [
        { id: "ch6-l1", text: "Base: $2$ is prime." },
        { id: "ch6-l2", text: "Assume all integers from $2$ to $k$ are prime." },
        { id: "ch6-l3", text: "Then $k+1$ must be prime because it is larger than all previous numbers." },
        { id: "ch6-l4", text: "So by strong induction, all $n\\ge2$ are prime." },
      ],
      flawLineId: "ch6-l3",
      why: "Being larger than known primes does not imply primality; e.g. $k+1$ could be composite.",
    },
    {
      kind: "fill-blank",
      id: "ch6-p5",
      prompt: "Complete the strong-induction statement for prime factorization.",
      before: "Induction hypothesis: for each integer $m$ with $2\\le m\\le k$,",
      after: ".",
      accept: [
        "m has a prime factorization",
        "$m$ has a prime factorization",
        "every such m factors into primes",
      ],
      why: "Strong induction assumes the property for all earlier values in the range, not just one value.",
    },
  ],
  challenge: [
    {
      id: "ch6-c1",
      prompt: "Use strong induction to prove every integer $n\\ge2$ can be written as a product of primes.",
      solution:
        "Base $n=2$: prime. Assume true for all $m$ with $2\\le m\\le k$. For $k+1$, if prime we are done. " +
        "If composite, $k+1=ab$ with $2\\le a,b\\le k$. By hypothesis both $a,b$ are products of primes, so $k+1$ is too. " +
        "Hence true for all $n\\ge2$. $\\blacksquare$",
      rubric:
        "Includes base, strong hypothesis over full interval, prime/composite case split, and bound $a,b\\le k$ justification.",
      twinPromptId: "ch6-c2",
    },
    {
      id: "ch6-c2",
      prompt: "Use strong induction to prove every integer $n\\ge8$ can be expressed as $3a+5b$ with $a,b\\in\\mathbb{N}$.",
      solution:
        "Check bases: $8=3+5$, $9=3+3+3$, $10=5+5$. Assume every value from $8$ to $k$ is representable as $3a+5b$, where $k\\ge10$. " +
        "Since $k\\ge10$, we have $k-2\\ge8$, so by the hypothesis $k-2=3a+5b$ for some $a,b\\in\\mathbb{N}$. Then $k+1=(k-2)+3=3(a+1)+5b$. " +
        "Therefore all $n\\ge8$ are representable. $\\blacksquare$",
      rubric:
        "Uses the three base values $8,9,10$; applies the hypothesis to a smaller index (e.g. $k-2$); builds $k+1$ with valid nonnegative coefficients.",
    },
  ],
};

export const chapter07: PracticeSet = {
  chapter: "7",
  title: "Recursion",
  warmup: [
    { id: "ch7-w1", front: "Recursive definition", back: "Defines objects using base case(s) plus rule(s) from smaller objects." },
    { id: "ch7-w2", front: "Fibonacci", back: "$F_0=0,F_1=1,F_n=F_{n-1}+F_{n-2}$." },
    { id: "ch7-w3", front: "Factorial", back: "$0!=1$, and $(n+1)!=(n+1)\\cdot n!$." },
    { id: "ch7-w4", front: "Termination", back: "A recursive process must eventually hit a base case." },
    { id: "ch7-w5", front: "Recursion tree", back: "A branching view of recursive calls and their subproblem sizes." },
    { id: "ch7-w6", front: "Structural recursion", back: "Recursing on parts/substructures of the input object." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch7-p1",
      prompt: "Which definition is recursive with a valid base case?",
      choices: [
        "$a_n=a_{n+1}+1$ for $n\\ge0$",
        "$a_0=1$ and $a_{n+1}=2a_n$",
        "$a_n=2a_n$ for all $n$",
        "$a_n=n+1$ only",
      ],
      answerIndex: 1,
      why: "It gives initial value and defines each next term from a smaller index.",
    },
    {
      kind: "proof-order",
      id: "ch7-p2",
      prompt: "Order proof by induction that recursively defined $n!$ satisfies $n!\\ge2^{n-1}$ for $n\\ge1$.",
      steps: [
        { id: "ch7-s1", text: "Base $n=1$: $1!=1\\ge1=2^0$.", deps: [] },
        { id: "ch7-s2", text: "Assume $k!\\ge2^{k-1}$ for some $k\\ge1$.", deps: ["ch7-s1"] },
        { id: "ch7-s3", text: "$(k+1)!=(k+1)k!\\ge2k!$ since $k+1\\ge2$.", deps: ["ch7-s2"] },
        { id: "ch7-s4", text: "Thus $(k+1)!\\ge2\\cdot2^{k-1}=2^k$.", deps: ["ch7-s3"] },
        { id: "ch7-s5", text: "So true for all $n\\ge1$. $\\blacksquare$", deps: ["ch7-s4"] },
      ],
      why: "Use the recursive step $(k+1)!=(k+1)k!$ and lower-bound factor $(k+1)$ by $2$.",
    },
    {
      kind: "spot-flaw",
      id: "ch7-p3",
      prompt: "Find the flaw in this recursive algorithm for list sum.",
      lines: [
        { id: "ch7-l1", text: "sum(L): if L has one element, return that element." },
        { id: "ch7-l2", text: "Otherwise return first(L) + sum(L)." },
        { id: "ch7-l3", text: "Therefore sum terminates for all finite lists." },
      ],
      flawLineId: "ch7-l2",
      why: "The recursive call does not shrink input; it should call sum(rest(L)) or equivalent.",
    },
    {
      kind: "fill-blank",
      id: "ch7-p4",
      prompt: "Complete the recursive definition of powers of 2.",
      before: "$p_0=1$ and for $n\\ge0$, $p_{n+1}=$",
      after: ".",
      accept: ["2p_n", "2*p_n", "$2p_n$"],
      why: "Each term doubles the previous one, matching $p_n=2^n$.",
    },
    {
      kind: "mcq",
      id: "ch7-p5",
      prompt: "What is $F_5$ for Fibonacci with $F_0=0,F_1=1$?",
      choices: ["$3$", "$5$", "$8$", "$13$"],
      answerIndex: 1,
      why: "Sequence is $0,1,1,2,3,5,\\dots$, so $F_5=5$.",
    },
  ],
  challenge: [
    {
      id: "ch7-c1",
      prompt: "Give a recursive definition for the set of binary strings with no consecutive $1$s.",
      solution:
        "One formulation: base strings are $\\epsilon$, $0$, and $1$. Recursive rules: if $w$ is valid then $w0$ is valid; if $w$ is valid and ends with $0$, then $w1$ is valid. " +
        "No other strings are valid. This enforces that a $1$ can only follow $0$ (or start).",
      rubric:
        "Includes clear base set, growth rules, and an exclusivity clause; rules must prevent appending $1$ after $1$.",
      twinPromptId: "ch7-c2",
    },
    {
      id: "ch7-c2",
      prompt: "Define recursively the set of balanced parentheses strings.",
      solution:
        "Base: $\\epsilon$ is balanced. Rules: if $w$ is balanced then $(w)$ is balanced; if $u,v$ are balanced then $uv$ is balanced. " +
        "No other strings are balanced. These rules generate exactly properly nested and concatenated pairs.",
      rubric:
        "Must contain empty-string base; wrapping rule and concatenation rule; optional exclusivity statement for precision.",
    },
  ],
};

export const chapter08: PracticeSet = {
  chapter: "8",
  title: "Proofs with Recursive Objects",
  warmup: [
    { id: "ch8-w1", front: "Structural induction", back: "Prove property for all recursively built objects by matching construction rules." },
    { id: "ch8-w2", front: "Binary tree", back: "Either empty, or a root with left/right binary subtrees." },
    { id: "ch8-w3", front: "Leaf", back: "A tree node with no children." },
    { id: "ch8-w4", front: "Height of tree", back: "Length of longest root-to-leaf path (edge count convention)." },
    { id: "ch8-w5", front: "Parse tree", back: "Tree representing recursive grammatical structure of an expression." },
    { id: "ch8-w6", front: "Inductive set proof", back: "Show property for base objects and preserved by each constructor." },
  ],
  practice: [
    {
      kind: "proof-order",
      id: "ch8-p1",
      prompt: "Order a structural induction proof: every full binary tree has odd number of nodes.",
      steps: [
        { id: "ch8-s1", text: "Base: a single-node full binary tree has $1$ node (odd).", deps: [] },
        { id: "ch8-s2", text: "Induction hypothesis: left and right full subtrees each have odd node counts.", deps: ["ch8-s1"] },
        { id: "ch8-s3", text: "Write counts as $2a+1$ and $2b+1$.", deps: ["ch8-s2"] },
        { id: "ch8-s4", text: "Total nodes $=1+(2a+1)+(2b+1)=2(a+b+1)+1$, odd.", deps: ["ch8-s3"] },
        { id: "ch8-s5", text: "Therefore every full binary tree has odd nodes. $\\blacksquare$", deps: ["ch8-s4"] },
      ],
      why: "Structural induction mirrors the tree constructor: root plus two smaller full trees.",
    },
    {
      kind: "proof-order",
      id: "ch8-p2",
      prompt: "Arrange proof: for strings over alphabet $\\{a,b\\}$, length of concatenation is additive.",
      steps: [
        { id: "ch8-t1", text: "Base string $\\epsilon$: $|\\epsilon x|=|x|=0+|x|$.", deps: [] },
        { id: "ch8-t2", text: "Assume for a string $w$, $|wx|=|w|+|x|$.", deps: ["ch8-t1"] },
        { id: "ch8-t3", text: "For $aw$, $|(aw)x|=|a(wx)|=1+|wx|$.", deps: ["ch8-t2"] },
        { id: "ch8-t4", text: "Substitute hypothesis: $1+|wx|=1+(|w|+|x|)=|aw|+|x|$.", deps: ["ch8-t3"] },
        { id: "ch8-t5", text: "Hence property holds for all strings by structural induction. $\\blacksquare$", deps: ["ch8-t4"] },
      ],
      why: "The recursive constructor for nonempty strings adds one symbol to a smaller string.",
    },
    {
      kind: "mcq",
      id: "ch8-p3",
      prompt: "Structural induction differs from numeric induction mainly because it:",
      choices: [
        "proves only existential claims",
        "uses constructors of objects rather than successor $k\\to k+1$",
        "never needs base cases",
        "cannot prove properties of trees",
      ],
      answerIndex: 1,
      why: "You prove closure under each recursive construction rule.",
    },
    {
      kind: "spot-flaw",
      id: "ch8-p4",
      prompt: "Find the flaw in this tree proof.",
      lines: [
        { id: "ch8-l1", text: "Claim: every binary tree has leaves = internal nodes." },
        { id: "ch8-l2", text: "Base: one-node tree has 1 leaf and 0 internal nodes." },
        { id: "ch8-l3", text: "So leaves = internal nodes in the base case." },
        { id: "ch8-l4", text: "Hence true for all binary trees." },
      ],
      flawLineId: "ch8-l3",
      why: "In base case, $1\\neq0$, so the claimed equality is already false.",
    },
    {
      kind: "fill-blank",
      id: "ch8-p5",
      prompt: "Complete: in structural induction, after base cases you prove property is preserved by each ____.",
      before: "This mirrors exactly how objects are generated:",
      after: ".",
      accept: ["constructor", "construction rule", "recursive constructor"],
      why: "Constructors define all objects, so preservation under them implies universal validity.",
    },
  ],
  challenge: [
    {
      id: "ch8-c1",
      prompt: "Prove by structural induction that every full binary tree has one more leaf than internal node.",
      solution:
        "Base: single-node full tree has $L=1$, $I=0$, so $L=I+1$. Inductive step: build a full tree by joining two full subtrees $T_1,T_2$ under a new root. " +
        "If $L_i=I_i+1$ for each subtree, then new tree has $L=L_1+L_2$ and $I=I_1+I_2+1$. Thus " +
        "$L=(I_1+1)+(I_2+1)=I_1+I_2+2=(I_1+I_2+1)+1=I+1$. $\\blacksquare$",
      rubric:
        "Uses correct base; applies induction hypotheses to both recursive subtrees; computes new leaf/internal counts correctly.",
      twinPromptId: "ch8-c2",
    },
    {
      id: "ch8-c2",
      prompt: "Prove by structural induction that every nonempty binary tree has at least one leaf.",
      solution:
        "Base: one-node tree is itself a leaf. Step: a nonempty tree has root and possibly subtrees. " +
        "If a child subtree is nonempty, by hypothesis it has a leaf, which is also a leaf of whole tree. If both children empty, root is a leaf. " +
        "So every nonempty tree has a leaf. $\\blacksquare$",
      rubric:
        "Covers base and constructor cases carefully; explains why subtree leaf remains leaf of entire tree or why root is leaf when no children.",
    },
  ],
};

export const chapter09: PracticeSet = {
  chapter: "9",
  title: "Sums and Asymptotics",
  warmup: [
    { id: "ch9-w1", front: "Sigma notation", back: "$\\sum_{i=m}^{n} a_i$ is the sum of terms from index $m$ to $n$." },
    { id: "ch9-w2", front: "Arithmetic series", back: "$1+2+\\cdots+n = n(n+1)/2$." },
    { id: "ch9-w3", front: "Geometric series", back: "$\\sum_{i=0}^{n}r^i = (r^{n+1}-1)/(r-1)$ for $r\\ne1$." },
    { id: "ch9-w4", front: "Big-O", back: "$f(n)=O(g(n))$ if $f(n)\\le c\\,g(n)$ eventually for some $c>0$." },
    { id: "ch9-w5", front: "Big-Omega", back: "$f(n)=\\Omega(g(n))$ if $f(n)\\ge c\\,g(n)$ eventually." },
    { id: "ch9-w6", front: "Big-Theta", back: "$f(n)=\\Theta(g(n))$ means both $O(g(n))$ and $\\Omega(g(n))$." },
  ],
  practice: [
    {
      kind: "mcq",
      id: "ch9-p1",
      prompt: "What is $\\sum_{i=1}^{n}(2i-1)$?",
      choices: ["$n^2$", "$n(n+1)$", "$2n-1$", "$n^2+n$"],
      answerIndex: 0,
      why: "The first $n$ odd numbers sum to $n^2$.",
    },
    {
      kind: "fill-blank",
      id: "ch9-p2",
      prompt: "Complete: if $f(n)=3n^2+10n+7$, then $f(n)=\\Theta($___$)$.",
      before: "The highest-degree term dominates asymptotically, so",
      after: ".",
      accept: ["n^2", "$n^2$"],
      why: "Lower-order terms and constants do not change polynomial growth class.",
    },
    {
      kind: "spot-flaw",
      id: "ch9-p3",
      prompt: "Spot the flaw in this asymptotic argument.",
      lines: [
        { id: "ch9-l1", text: "Claim: $n^2+100n$ is $O(n)$." },
        { id: "ch9-l2", text: "Because for large $n$, $100n$ is $O(n)$." },
        { id: "ch9-l3", text: "Therefore $n^2+100n$ is $O(n)$." },
      ],
      flawLineId: "ch9-l3",
      why: "The $n^2$ term dominates; a sum is not $O(n)$ if one component grows as $n^2$.",
    },
    {
      kind: "mcq",
      id: "ch9-p4",
      prompt: "Which statement is true?",
      choices: [
        "$n\\log n = O(n)$",
        "$n = O(n\\log n)$",
        "$2^n = O(n^5)$",
        "$\\log n = \\Omega(n)$",
      ],
      answerIndex: 1,
      why: "$n\\log n$ eventually exceeds $n$, so linear is bounded above by $n\\log n$.",
    },
    {
      kind: "proof-order",
      id: "ch9-p5",
      prompt: "Order proof that $\\sum_{i=1}^{n} i = n(n+1)/2$ by induction.",
      steps: [
        { id: "ch9-s1", text: "Base $n=1$: both sides equal $1$.", deps: [] },
        { id: "ch9-s2", text: "Assume $\\sum_{i=1}^{k} i = k(k+1)/2$.", deps: ["ch9-s1"] },
        { id: "ch9-s3", text: "Then $\\sum_{i=1}^{k+1} i = \\sum_{i=1}^{k} i + (k+1)$.", deps: ["ch9-s2"] },
        { id: "ch9-s4", text: "Substitute and simplify: $k(k+1)/2 + (k+1) = (k+1)(k+2)/2$.", deps: ["ch9-s3"] },
        { id: "ch9-s5", text: "Hence formula holds for all $n\\ge1$. $\\blacksquare$", deps: ["ch9-s4"] },
      ],
      why: "The induction step extends partial sum by adding the next term and simplifying.",
    },
  ],
  challenge: [
    {
      id: "ch9-c1",
      prompt: "Prove $\\sum_{i=1}^{n} i^2 = n(n+1)(2n+1)/6$ by induction.",
      solution:
        "Base $n=1$: $1=1\\cdot2\\cdot3/6$. Assume true for $k$. Then " +
        "$\\sum_{i=1}^{k+1} i^2 = \\frac{k(k+1)(2k+1)}{6} + (k+1)^2 = \\frac{(k+1)(k+2)(2k+3)}{6}$ after algebra. " +
        "This is the same formula with $n=k+1$. $\\blacksquare$",
      rubric:
        "Includes base and hypothesis; substitutes correctly; performs algebra to target closed form for $k+1$.",
    },
    {
      id: "ch9-c2",
      prompt: "Show that $5n^2+3n+4=\\Theta(n^2)$ using formal constants.",
      solution:
        "For $n\\ge1$, we have $5n^2 \\le 5n^2+3n+4 \\le 5n^2+3n^2+4n^2=12n^2$. " +
        "So with $c_1=5,c_2=12,n_0=1$, both $c_1n^2\\le f(n)\\le c_2n^2$ hold for all $n\\ge n_0$. Hence $f(n)=\\Theta(n^2)$.",
      rubric:
        "Provides both upper and lower bounds with explicit positive constants and threshold $n_0$.",
    },
  ],
};

export const chapter10: PracticeSet = {
  chapter: "10",
  title: "Number Theory",
  warmup: [
    { id: "ch10-w1", front: "Greatest common divisor", back: "$\\gcd(a,b)$ is the largest positive integer dividing both." },
    { id: "ch10-w2", front: "Euclidean algorithm", back: "$\\gcd(a,b)=\\gcd(b, a\\bmod b)$ repeatedly." },
    { id: "ch10-w3", front: "Congruence mod $m$", back: "$a\\equiv b\\pmod m$ iff $m\\mid(a-b)$." },
    { id: "ch10-w4", front: "Relatively prime", back: "Integers with gcd equal to $1$." },
    { id: "ch10-w5", front: "Bezout identity", back: "If $d=\\gcd(a,b)$, then $ax+by=d$ for some integers $x,y$." },
    { id: "ch10-w6", front: "Prime divides product", back: "If prime $p\\mid ab$, then $p\\mid a$ or $p\\mid b$." },
  ],
  practice: [
    {
      kind: "proof-order",
      id: "ch10-p1",
      prompt: "Order proof: if $a\\equiv b\\pmod m$ and $c\\equiv d\\pmod m$, then $a+c\\equiv b+d\\pmod m$.",
      steps: [
        { id: "ch10-s1", text: "From $a\\equiv b\\pmod m$, write $m\\mid(a-b)$.", deps: [] },
        { id: "ch10-s2", text: "From $c\\equiv d\\pmod m$, write $m\\mid(c-d)$.", deps: [] },
        { id: "ch10-s3", text: "Then $m\\mid[(a-b)+(c-d)]$ by closure under addition.", deps: ["ch10-s1", "ch10-s2"] },
        { id: "ch10-s4", text: "But $(a-b)+(c-d)=(a+c)-(b+d)$.", deps: ["ch10-s3"] },
        { id: "ch10-s5", text: "Hence $a+c\\equiv b+d\\pmod m$. $\\blacksquare$", deps: ["ch10-s4"] },
      ],
      why: "Congruence is divisibility of differences; add differences then convert back.",
    },
    {
      kind: "proof-order",
      id: "ch10-p2",
      prompt: "Arrange proof that if $\\gcd(a,b)=1$ and $a\\mid bc$, then $a\\mid c$.",
      steps: [
        { id: "ch10-t1", text: "Since $\\gcd(a,b)=1$, Bezout gives integers $x,y$ with $ax+by=1$.", deps: [] },
        { id: "ch10-t2", text: "Multiply by $c$: $acx+bcy=c$.", deps: ["ch10-t1"] },
        { id: "ch10-t3", text: "$a\\mid acx$ obviously.", deps: ["ch10-t2"] },
        { id: "ch10-t4", text: "Given $a\\mid bc$, we get $a\\mid bcy$.", deps: ["ch10-t2"] },
        { id: "ch10-t5", text: "So $a$ divides their sum $acx+bcy=c$, hence $a\\mid c$. $\\blacksquare$", deps: ["ch10-t3", "ch10-t4"] },
      ],
      why: "Bezout converts coprimality into a linear combination that isolates $c$.",
    },
    {
      kind: "mcq",
      id: "ch10-p3",
      prompt: "Compute $\\gcd(84,30)$.",
      choices: ["$2$", "$3$", "$6$", "$12$"],
      answerIndex: 2,
      why: "Euclidean algorithm: $84=2\\cdot30+24$, $30=1\\cdot24+6$, $24=4\\cdot6+0$, so gcd is $6$.",
    },
    {
      kind: "spot-flaw",
      id: "ch10-p4",
      prompt: "Find the invalid step in this modular claim.",
      lines: [
        { id: "ch10-l1", text: "Given $14\\equiv2\\pmod{12}$." },
        { id: "ch10-l2", text: "Divide both sides by $2$ to get $7\\equiv1\\pmod{12}$." },
        { id: "ch10-l3", text: "Hence division by any common factor preserves the same modulus." },
      ],
      flawLineId: "ch10-l2",
      why: "Cancelling in modular arithmetic requires conditions and usually changes modulus; naive division is invalid here.",
    },
    {
      kind: "fill-blank",
      id: "ch10-p5",
      prompt: "Complete Euclid's lemma statement.",
      before: "If prime $p$ divides $ab$, then",
      after: ".",
      accept: ["p divides a or p divides b", "$p\\mid a$ or $p\\mid b$", "p|a or p|b"],
      why: "This prime-divides-product property is fundamental for unique factorization proofs.",
    },
  ],
  challenge: [
    {
      id: "ch10-c1",
      prompt: "Use the Euclidean algorithm to find integers $x,y$ with $252x+198y=\\gcd(252,198)$.",
      solution:
        "Compute gcd: $252=1\\cdot198+54$, $198=3\\cdot54+36$, $54=1\\cdot36+18$, $36=2\\cdot18+0$, so gcd is $18$. " +
        "Back-substitute: $18=54-36=54-(198-3\\cdot54)=4\\cdot54-198=4(252-198)-198=4\\cdot252-5\\cdot198$. " +
        "Thus $x=4,y=-5$.",
      rubric:
        "Runs Euclidean algorithm correctly; back-substitutes to linear combination; states explicit coefficients matching gcd.",
      twinPromptId: "ch10-c2",
    },
    {
      id: "ch10-c2",
      prompt: "Prove that if $a\\equiv b\\pmod m$, then $a^2\\equiv b^2\\pmod m$.",
      solution:
        "From $a\\equiv b\\pmod m$, we have $m\\mid(a-b)$. Then $a^2-b^2=(a-b)(a+b)$. Since $m$ divides $(a-b)$, it divides the product $(a-b)(a+b)$, so $m\\mid(a^2-b^2)$. Therefore $a^2\\equiv b^2\\pmod m$. $\\blacksquare$",
      rubric:
        "Uses divisibility definition of congruence; factors difference of squares; concludes congruence by divisibility of difference.",
    },
  ],
};
