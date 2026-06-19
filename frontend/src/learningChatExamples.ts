/** Starter prompts above Learning Mode chat input (book content stays English). */
export const LEARNING_CHAT_EXAMPLES = [
  {
    id: "induction",
    label: "What is induction?",
    sendText: "What is induction?",
  },
  {
    id: "problem-5-1",
    label: "Problem 5.1: Is 2^p − 1 prime for p = 2, 3, 5, 7?",
    sendText:
      "Problem 5.1: Is 2^p - 1 prime for the primes p = 2, 3, 5, 7? Is 2^p - 1 prime whenever p is prime?",
  },
] as const;
