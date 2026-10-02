/** The section the textbook panel shows, as published to the sidebar outline (spec D10, §5.2). */
export type CurrentSection = {
  bookId: string;
  title: string;
  startBook: number;
  endBook: number;
};

export type OutlineNodeRef = {
  title: string;
  range: { start: number; end: number } | null;
  hasKids: boolean;
};

export function normalizeSectionTitle(title: string): string {
  return title.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sameSection(a: CurrentSection | null, b: CurrentSection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.bookId === b.bookId && a.title === b.title && a.startBook === b.startBook && a.endBook === b.endBook;
}

/** Same book, and the same title or (for a leaf) the same page range. A chapter never matches on range alone. */
export function isCurrentSection(
  node: OutlineNodeRef,
  current: CurrentSection | null | undefined,
  selectedBookId: string,
): boolean {
  if (!current || current.bookId !== selectedBookId) return false;
  if (normalizeSectionTitle(node.title) === normalizeSectionTitle(current.title)) return true;
  return (
    !node.hasKids &&
    node.range !== null &&
    node.range.start === current.startBook &&
    node.range.end === current.endBook
  );
}
