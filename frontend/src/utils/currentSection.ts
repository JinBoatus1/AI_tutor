/** The section the textbook panel shows, as published to the sidebar outline (spec D10, §5.2). */
export type CurrentSection = {
  bookId: string;
  title: string;
  startBook: number;
  endBook: number;
};

export type OutlineNodeRef = {
  path: string;
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

/**
 * The one outline node to mark (the ribbon has one place, spec §4.5): in the selected book,
 * the first node whose title matches, else the only leaf with the same page range. Sibling
 * sections can share a page (FOCS 1.2 and 1.3 are both p. 8), so a range never picks between
 * two leaves, and a chapter never matches on range alone.
 */
export function currentOutlinePath(
  nodes: Iterable<OutlineNodeRef>,
  current: CurrentSection | null | undefined,
  selectedBookId: string,
): string | null {
  if (!current || current.bookId !== selectedBookId) return null;
  const title = normalizeSectionTitle(current.title);
  const sameRange: string[] = [];
  for (const node of nodes) {
    if (normalizeSectionTitle(node.title) === title) return node.path;
    if (!node.hasKids && node.range?.start === current.startBook && node.range.end === current.endBook) {
      sameRange.push(node.path);
    }
  }
  return sameRange.length === 1 ? sameRange[0] : null;
}
