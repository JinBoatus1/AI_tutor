/**
 * A chapter/section token is the first word of an outline title: "4", "4.1",
 * "B", "B.1". Lettered chapters exist (Lathi opens with "B Background"), so the
 * numeric-only assumption is gone — but the letter case is restricted to a
 * SINGLE uppercase letter on purpose. A looser [A-Za-z0-9]+ would swallow the
 * first words of back-matter titles like "Answers to Selected Problems" and
 * "Supplementary Reading" and register them as chapters.
 */
export const CHAPTER_TOKEN_RE = /^(?:\d+|[A-Z])(?:\.\d+)*$/;

export function isChapterToken(token: string): boolean {
  return CHAPTER_TOKEN_RE.test(token);
}

/** Lettered chapters (background/appendix) sort before numeric ones. */
export function compareChapterTokens(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return 1;
  if (bNum) return -1;
  return a.localeCompare(b);
}
