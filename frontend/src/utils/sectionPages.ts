/** The textbook panel shows a section's pages in order: index i is printed page startBook + i. */

/** The printed page the student is looking at, or undefined when the panel shows no section pages. */
export function viewingBookPage(
  startBook: number | undefined,
  pageCount: number,
  pageIndex: number
): number | undefined {
  if (typeof startBook !== "number" || !Number.isFinite(startBook)) return undefined;
  if (pageIndex < 0 || pageIndex >= pageCount) return undefined;
  return startBook + pageIndex;
}

type OpenSection = { bookId: string; name: string; startBook: number; endBook: number };

/** A chat reply's matched_topic; book pages come as start_book/end_book (older replies: startBook, start). */
type ReplyTopic = {
  name?: string;
  start_book?: number;
  end_book?: number;
  startBook?: number;
  endBook?: number;
  start?: number;
  end?: number;
};

/** Whether a reply is about the section the question was asked from. */
export function replyIsAboutSection(
  askedFrom: OpenSection | null | undefined,
  bookId: string,
  reply: ReplyTopic | null | undefined
): boolean {
  if (!askedFrom || !reply) return false;
  const start = reply.start_book ?? reply.startBook ?? reply.start;
  const end = reply.end_book ?? reply.endBook ?? reply.end;
  return (
    askedFrom.bookId === bookId &&
    askedFrom.name === reply.name &&
    askedFrom.startBook === start &&
    askedFrom.endBook === end
  );
}

/** Where the viewer lands when a reply brings back a section's pages: the same section keeps its page. */
export function pageIndexAfterReply(sameSection: boolean, currentIndex: number, pageCount: number): number {
  if (!sameSection || pageCount <= 0) return 0;
  return Math.min(Math.max(currentIndex, 0), pageCount - 1);
}
