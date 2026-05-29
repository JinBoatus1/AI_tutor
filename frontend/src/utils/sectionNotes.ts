export type VocabEntry = {
  term: string;
  definition: string;
};

export type FormulaEntry = {
  /** LaTeX allowed: $...$ inline, $$...$$ block. */
  expr: string;
  explanation: string;
};

export type SectionNote = {
  objectives: string;
  vocabulary: VocabEntry[];
  formulas: FormulaEntry[];
};

/** First token in a section title if it looks like 1, 1.1, 24.2, … */
export function sectionTokenFromTitle(title: string): string | null {
  const w = title.trim().split(/\s+/)[0] ?? "";
  return /^\d+(?:\.\d+)*$/.test(w) ? w : null;
}

export function getSectionNote(
  notes: Record<string, SectionNote>,
  sectionHint?: string | null,
  topicName?: string | null
): SectionNote | null {
  const token =
    (sectionHint?.trim() || "") || sectionTokenFromTitle(topicName || "") || "";
  if (!token) return null;
  if (notes[token]) return notes[token];
  const chapter = token.split(".")[0];
  return notes[chapter] ?? null;
}
