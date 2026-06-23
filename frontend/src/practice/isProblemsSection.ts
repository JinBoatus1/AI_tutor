// Detect a chapter problem-set section from its title. Strict regex (eng-review #3):
// only "X.Y Problems" matches, so decoys like "11.5 Problem Solving with Graphs",
// "12.3 Whirlwind Tour of Graph Problems", "23.1 Decision Problems", and the
// chapter-level "27 ... Problems" are correctly excluded.
const PROBLEMS_RE = /^(\d+)\.\d+\s+Problems$/;

export function isProblemsSection(title: string | null | undefined): boolean {
  return !!title && PROBLEMS_RE.test(title.trim());
}

/** Chapter token (e.g. "4") from a "4.6 Problems" title, or null if not a problem set. */
export function chapterOfProblems(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = title.trim().match(PROBLEMS_RE);
  return m ? m[1] : null;
}
