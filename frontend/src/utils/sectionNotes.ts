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

/** Raw note lookup (chapter fallback for legacy callers). */
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

/**
 * Note for display: subsections never inherit chapter formulas (only explicit
 * entries). Vocabulary still falls back to chapter when a subsection has none.
 */
export function getMergedSectionNote(
  notes: Record<string, SectionNote>,
  token: string
): SectionNote | null {
  const exact = notes[token];
  const chapterKey = token.split(".")[0];
  const chapterNote = notes[chapterKey];

  if (exact) {
    return {
      objectives: exact.objectives,
      vocabulary:
        exact.vocabulary.length > 0 ? exact.vocabulary : (chapterNote?.vocabulary ?? []),
      formulas: exact.formulas,
    };
  }

  if (token.includes(".")) {
    if (!chapterNote) return null;
    return {
      objectives: chapterNote.objectives,
      vocabulary: chapterNote.vocabulary,
      formulas: [],
    };
  }

  return chapterNote ?? null;
}

export function formulaExprKey(expr: string): string {
  return expr
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
    const note = getMergedSectionNote(notes, t);
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
  const note = getMergedSectionNote(notes, token);
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

export function buildFormulasIntroducedByToken(
  notes: Record<string, SectionNote>,
  sectionOrder: string[]
): Map<string, FormulaEntry[]> {
  const seen = new Set<string>();
  const byToken = new Map<string, FormulaEntry[]>();

  for (const t of sectionOrder) {
    const note = getMergedSectionNote(notes, t);
    if (!note) {
      byToken.set(t, []);
      continue;
    }
    const formulas = note.formulas.filter((entry) => !seen.has(formulaExprKey(entry.expr)));
    byToken.set(t, formulas);
    for (const entry of formulas) {
      seen.add(formulaExprKey(entry.expr));
    }
  }

  return byToken;
}

function formulasForTokenDisplay(
  notes: Record<string, SectionNote>,
  sectionOrder: string[],
  token: string,
  introduced: Map<string, FormulaEntry[]>
): FormulaEntry[] {
  if (introduced.has(token)) {
    return introduced.get(token) ?? [];
  }

  const note = getMergedSectionNote(notes, token);
  if (!note) return [];

  const seen = new Set<string>();
  const firstSubsection = sectionOrder.find((t) => t.startsWith(`${token}.`));
  for (const t of sectionOrder) {
    if (t === firstSubsection) break;
    for (const entry of introduced.get(t) ?? []) {
      seen.add(formulaExprKey(entry.expr));
    }
  }

  return note.formulas.filter((entry) => !seen.has(formulaExprKey(entry.expr)));
}

/** Section note for UI: deduped vocabulary + core formulas only for this section. */
export function getSectionNoteWithNewVocab(
  notes: Record<string, SectionNote>,
  sectionOrder: string[],
  sectionHint?: string | null,
  topicName?: string | null
): SectionNote | null {
  const token = resolveSectionToken(sectionHint, topicName);
  const merged = token ? getMergedSectionNote(notes, token) : null;
  if (!token || !merged) return null;

  const vocabIntroduced = buildVocabularyIntroducedByToken(notes, sectionOrder);
  const formulasIntroduced = buildFormulasIntroducedByToken(notes, sectionOrder);
  const vocabulary = vocabularyForTokenDisplay(notes, sectionOrder, token, vocabIntroduced);
  const formulas = formulasForTokenDisplay(notes, sectionOrder, token, formulasIntroduced);

  return {
    objectives: merged.objectives,
    vocabulary,
    formulas,
  };
}
