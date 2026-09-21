import focsTree from "../data/focsTree.json";
import { FOCS_SECTION_NOTES } from "../data/focsSectionNotes";
import { FOCS_PRACTICE_SETS } from "../data/focsPracticeSets";
import { INDUCTION_GUIDE } from "../guide/inductionGuide";
import {
  ONBOARDING_NOTE_SECTION,
  ONBOARDING_PROBLEMS_SECTION,
  ONBOARDING_INDUCTION_EXPAND_PATHS,
} from "../onboarding/onboardingDemoSection";
import type { OutlineSectionPreviewDetail } from "../LearningBarPanel";
import type { SectionNote } from "../utils/sectionNotes";
import type { PracticeSet } from "../practice/types";
import type { GuideScript } from "../guide/types";

export type TextbookTreeRoot = Record<string, unknown>;

/** Where a chapter's practice set hangs off the outline. */
export type PracticeAnchor = { kind: "problems_section" } | { kind: "chapter" };

/**
 * Sections the onboarding tour drives the student to. Book-specific by nature —
 * the FOCS tour opens "1.2 Speed Dating" and "5.3 Problems", which do not exist
 * in any other book. A book without this simply has no guided tour.
 */
export interface BookOnboarding {
  noteSection: OutlineSectionPreviewDetail;
  problemsSection: OutlineSectionPreviewDetail;
  expandPaths: string[];
}

export interface BookDef {
  id: string;
  /** Label in the textbook picker. */
  shortLabel: string;
  practiceAnchor: PracticeAnchor;
  tree: TextbookTreeRoot;
  sectionNotes: Record<string, SectionNote>;
  practiceSets: Record<string, PracticeSet>;
  guides?: GuideScript[];
  onboarding?: BookOnboarding;
}

export const DEFAULT_BOOK_ID = "focs";

export const BOOKS: Record<string, BookDef> = {
  focs: {
    id: "focs",
    shortLabel: "FOCS",
    practiceAnchor: { kind: "problems_section" },
    tree: focsTree as TextbookTreeRoot,
    sectionNotes: FOCS_SECTION_NOTES,
    practiceSets: FOCS_PRACTICE_SETS,
    guides: [INDUCTION_GUIDE],
    onboarding: {
      noteSection: ONBOARDING_NOTE_SECTION,
      problemsSection: ONBOARDING_PROBLEMS_SECTION,
      expandPaths: ONBOARDING_INDUCTION_EXPAND_PATHS,
    },
  },
};

export function isBuiltinBook(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BOOKS, id);
}

export function getBook(id: string): BookDef {
  return BOOKS[id] ?? BOOKS[DEFAULT_BOOK_ID];
}

export function builtinBookOptions(): { id: string; linkLabel: string }[] {
  return Object.values(BOOKS).map((b) => ({ id: b.id, linkLabel: b.shortLabel }));
}
