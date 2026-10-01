export type FeedbackType = "bug" | "content" | "suggestion" | "other";

export const FEEDBACK_TYPES: readonly FeedbackType[] = ["bug", "content", "suggestion", "other"];

/** The longest description the server accepts. The textarea enforces the same limit. */
export const MAX_DESCRIPTION_CHARS = 2000;

/** What Learning Mode knows about the screen. */
export interface FeedbackPageContext {
  bookId?: string;
  section?: string;
  page?: number;
}

/** The `context` object sent to POST /api/feedback. */
export interface FeedbackRequestContext {
  book_id?: string;
  section?: string;
  page?: number;
  locale?: string;
  route?: string;
}

export interface FeedbackPayload {
  type: FeedbackType;
  description: string;
  contact_ok: boolean;
  context: FeedbackRequestContext;
}
