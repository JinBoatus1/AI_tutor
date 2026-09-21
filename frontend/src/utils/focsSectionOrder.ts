import { getBook } from "../books/registry";
import { sectionTokenFromTitle } from "./sectionNotes";

type FocsNode = Record<string, unknown>;

function childEntries(node: FocsNode): [string, FocsNode][] {
  return Object.entries(node).filter(
    ([k, v]) =>
      k !== "_range" &&
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v)
  ) as [string, FocsNode][];
}

/**
 * Preorder section tokens for vocab dedup.
 * Chapter rows that only group subsections are omitted so vocabulary is not
 * consumed before e.g. 1.1; clicking the chapter row still uses that chapter key.
 */
function collectSectionTokensPreorder(node: FocsNode): string[] {
  const out: string[] = [];
  for (const [title, child] of childEntries(node)) {
    const kids = childEntries(child);
    const token = sectionTokenFromTitle(title);
    if (kids.length === 0) {
      if (token) out.push(token);
    } else {
      out.push(...collectSectionTokensPreorder(child));
    }
  }
  return out;
}

const cache = new Map<string, string[]>();

/** Outline section tokens in reading order (0, 1.1, 1.2, …), memoized per book. */
export function sectionTokensPreorder(bookId: string): string[] {
  const book = getBook(bookId);
  const hit = cache.get(book.id);
  if (hit) return hit;
  const tokens = collectSectionTokensPreorder(book.tree as FocsNode);
  cache.set(book.id, tokens);
  return tokens;
}
