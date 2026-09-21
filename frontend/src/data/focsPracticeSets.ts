// Practice-set lookup, keyed by book. The actual FOCS content bundle lives in the
// leaf module ./practice/focsSets.ts (imported by books/registry.ts directly) so
// that this module can safely import BOOKS without creating an import cycle
// (Task 8 ruling 1).
import { chapterOfProblems } from "../practice/isProblemsSection";
import { compareChapterTokens, isChapterToken } from "../utils/chapterToken";
import { BOOKS } from "../books/registry";
import type { PracticeSet } from "../practice/types";

/**
 * Chapters that have a practice entry point, per that book's anchor rule.
 * Returns [] for a book id that is not registered (Task 8 ruling 2 — no fallback
 * to the default book; an unregistered book has no chapters, full stop).
 */
export function problemChaptersFor(bookId: string): string[] {
  const book = BOOKS[bookId];
  if (!book) return [];
  const chapters = new Set<string>();
  if (book.practiceAnchor.kind === "problems_section") {
    collectProblemChapters(book.tree as Record<string, unknown>, chapters);
  } else {
    for (const key of Object.keys(book.tree)) {
      const token = key.trim().split(/\s+/)[0] ?? "";
      if (isChapterToken(token)) chapters.add(token);
    }
  }
  return [...chapters].sort(compareChapterTokens);
}

/**
 * Practice set for a chapter token in a given book, or null if none is authored —
 * also null when `bookId` is not a registered book (Task 8 ruling 2 — no fallback
 * to the default book here; see LearningModel.tsx's practiceActive for why).
 */
export function getPracticeSet(bookId: string, chapter: string): PracticeSet | null {
  const book = BOOKS[bookId];
  return book?.practiceSets[chapter] ?? null;
}

function collectProblemChapters(node: Record<string, unknown>, chapters: Set<string>): void {
  for (const [key, value] of Object.entries(node)) {
    if (key === "_range" || key === "start" || key === "end") continue;
    const ch = chapterOfProblems(key);
    if (ch) chapters.add(ch);
    if (value && typeof value === "object") {
      collectProblemChapters(value as Record<string, unknown>, chapters);
    }
  }
}
