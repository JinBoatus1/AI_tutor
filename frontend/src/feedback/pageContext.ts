import type { FeedbackPageContext } from "./types";

/** The section on screen, as Learning Mode keeps it. `bookId` is the book its pages came from. */
export interface ShownSection {
  bookId: string;
  name: string;
  startBook: number;
}

/**
 * What the feedback form says is on screen. The section's own book wins over the selected one:
 * switching books in the sidebar doesn't clear the section that is still showing.
 */
export function pageContextFor(
  selectedBookId: string,
  shown: ShownSection | null,
  pagesShown: boolean,
  pageIndex: number,
): FeedbackPageContext {
  return {
    bookId: shown?.bookId ?? selectedBookId,
    section: shown?.name,
    page: shown && pagesShown ? shown.startBook + pageIndex : undefined,
  };
}
