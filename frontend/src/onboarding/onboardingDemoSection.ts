import type { OutlineSectionPreviewDetail } from "../LearningBarPanel";

/** Demo section for onboarding Note step (FOCS — matches User Guide screenshots). */
export const ONBOARDING_NOTE_SECTION: OutlineSectionPreviewDetail = {
  sectionTitle: "1.2 Speed Dating",
  path: "1 A Taste of Discrete Mathematics/1.2 Speed Dating",
  startBook: 8,
  endBook: 8,
  sectionHint: "1.2",
};

const CH5_INDUCTION = '5 Induction: Proving "FOR ALL ..." ';

/** Expand Chapter 5 in the left outline during the Problems tour step. */
export const ONBOARDING_INDUCTION_EXPAND_PATHS = [CH5_INDUCTION];

/** Demo section for onboarding Problems step — Chapter 5 induction problem set. */
export const ONBOARDING_PROBLEMS_SECTION: OutlineSectionPreviewDetail = {
  sectionTitle: "5.3 Problems",
  path: `${CH5_INDUCTION}/5.3 Problems`,
  startBook: 64,
  endBook: 70,
  sectionHint: "5.3",
};
