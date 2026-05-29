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

export function resolveSectionToken(
  sectionHint?: string | null,
  topicName?: string | null
): string {
  return (sectionHint?.trim() || "") || sectionTokenFromTitle(topicName || "") || "";
}

export function getSectionNote(
  notes: Record<string, SectionNote>,
  sectionHint?: string | null,
  topicName?: string | null
): SectionNote | null {
  const token = resolveSectionToken(sectionHint, topicName);
  if (!token) return null;
  if (notes[token]) return notes[token];
  const chapter = token.split(".")[0];
  return notes[chapter] ?? null;
}

/** Normalize term text for dedup (ignore case, parentheticals, extra spaces). */
export function vocabTermKey(term: string): string {
  return term
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** First introduction of each term along outline order (for deduped display). */
export function buildVocabularyIntroducedByToken(
  notes: Record<string, SectionNote>,
  sectionOrder: string[]
): Map<string, VocabEntry[]> {
  const seen = new Set<string>();
  const byToken = new Map<string, VocabEntry[]>();

  for (const t of sectionOrder) {
    const note = getSectionNote(notes, t, null);
    if (!note) {
      byToken.set(t, []);
      continue;
    }
    const vocab = note.vocabulary.filter((entry) => !seen.has(vocabTermKey(entry.term)));
    byToken.set(t, vocab);
    for (const entry of vocab) {
      seen.add(vocabTermKey(entry.term));
    }
  }

  return byToken;
}

/**
 * Section note with vocabulary filtered: terms already introduced in earlier
 * sections (per outline preorder) are omitted.
 */
function vocabularyForTokenDisplay(
  notes: Record<string, SectionNote>,
  sectionOrder: string[],
  token: string,
  introduced: Map<string, VocabEntry[]>
): VocabEntry[] {
  if (introduced.has(token)) {
    return introduced.get(token) ?? [];
  }

  /* Whole-chapter row (e.g. "1") — not listed in leaf-only order */
  const note = getSectionNote(notes, token, null);
  if (!note) return [];

  const seen = new Set<string>();
  const firstSubsection = sectionOrder.find((t) => t.startsWith(`${token}.`));
  for (const t of sectionOrder) {
    if (t === firstSubsection) break;
    for (const entry of introduced.get(t) ?? []) {
      seen.add(vocabTermKey(entry.term));
    }
  }

  return note.vocabulary.filter((entry) => !seen.has(vocabTermKey(entry.term)));
}

export function getSectionNoteWithNewVocab(
  notes: Record<string, SectionNote>,
  sectionOrder: string[],
  sectionHint?: string | null,
  topicName?: string | null
): SectionNote | null {
  const token = resolveSectionToken(sectionHint, topicName);
  const base = getSectionNote(notes, sectionHint, topicName);
  if (!token || !base) return base;

  const introduced = buildVocabularyIntroducedByToken(notes, sectionOrder);
  const vocabulary = vocabularyForTokenDisplay(notes, sectionOrder, token, introduced);
  return { ...base, vocabulary };
}
