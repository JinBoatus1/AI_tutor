import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import MathText from "./MathText";
import type { BookAnchor, FormulaEntry, SectionNote, VocabEntry } from "./utils/sectionNotes";

export type SectionNoteActions = {
  onAskChat: (question: string) => void;
  onJumpToBook: (anchor: BookAnchor, highlightLabel: string) => void;
};

export function useSectionNoteToggle(sectionLabel: string) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const prevLabelRef = useRef(sectionLabel);

  useEffect(() => {
    if (prevLabelRef.current !== sectionLabel) {
      prevLabelRef.current = sectionLabel;
      setOpen(true);
    }
  }, [sectionLabel]);

  return { open, setOpen, panelId };
}

type SectionNoteButtonProps = {
  open: boolean;
  onToggle: () => void;
  panelId: string;
};

export function SectionNoteButton({ open, onToggle, panelId }: SectionNoteButtonProps) {
  return (
    <button
      type="button"
      className={`left-panel-note-btn${open ? " left-panel-note-btn--open" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      title="Chapter study note: goals, vocabulary, key formulas"
    >
      Note
    </button>
  );
}

type SectionNotePanelProps = {
  note: SectionNote;
  panelId: string;
  actions: SectionNoteActions;
};

function plainTermLabel(label: ReactNode, fallback: string): string {
  if (typeof label === "string") return label.replace(/\$/g, "").trim();
  return fallback;
}

type ExpandableEntry = {
  label: ReactNode;
  labelKey: string;
  definition: string;
  example?: string;
  exampleRef?: string;
  book?: BookAnchor;
};

function ExpandableNoteEntry({
  entry,
  actions,
}: {
  entry: ExpandableEntry;
  actions: SectionNoteActions;
}) {
  const [open, setOpen] = useState(false);
  const termPlain = plainTermLabel(entry.label, entry.labelKey);
  const hasCurated = Boolean(entry.example && entry.book);
  const hasExampleOnly = Boolean(entry.example && !entry.book);

  const askQuestion = (suffix = "") => {
    const q = suffix
      ? `What is "${termPlain}"? ${suffix}`
      : `What is "${termPlain}"? Explain using this section and give a short example.`;
    actions.onAskChat(q);
  };

  return (
    <div className={`section-note-entry${open ? " section-note-entry--open" : ""}`}>
      <div className="section-note-entry-head">
        <div className="section-note-entry-title">
          <MathText>{typeof entry.label === "string" ? entry.label : entry.labelKey}</MathText>
        </div>
        <button
          type="button"
          className="section-note-entry-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Collapse" : "Example / Ask"}
        </button>
      </div>
      <p className="section-note-entry-def">
        <MathText>{entry.definition}</MathText>
      </p>

      {open ? (
        <div className="section-note-entry-body">
          {hasCurated || hasExampleOnly ? (
            <>
              <p className="section-note-entry-example">
                <MathText>{entry.example!}</MathText>
              </p>
              {entry.exampleRef ? (
                <span className="section-note-entry-ref">{entry.exampleRef}</span>
              ) : null}
              {entry.book ? (
                <button
                  type="button"
                  className="section-note-entry-book"
                  onClick={() => actions.onJumpToBook(entry.book!, entry.exampleRef ?? termPlain)}
                >
                  See in textbook ↗
                </button>
              ) : null}
              <button
                type="button"
                className="section-note-entry-ask"
                onClick={() => askQuestion("Please give another example or help me understand more deeply.")}
              >
                Ask AI to follow up
              </button>
            </>
          ) : (
            <>
              <p className="section-note-entry-empty">No curated example for this term in the book yet.</p>
              <button
                type="button"
                className="section-note-entry-ask section-note-entry-ask--primary"
                onClick={() => askQuestion()}
              >
                Ask AI: What is &ldquo;{termPlain}&rdquo;?
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function vocabToEntry(item: VocabEntry): ExpandableEntry {
  return {
    label: item.term,
    labelKey: item.term,
    definition: item.definition,
    example: item.example,
    exampleRef: item.exampleRef,
    book: item.book,
  };
}

function formulaToEntry(item: FormulaEntry): ExpandableEntry {
  return {
    label: item.expr,
    labelKey: item.expr,
    definition: item.explanation,
    example: item.example,
    exampleRef: item.exampleRef,
    book: item.book,
  };
}

export function SectionNotePanel({ note, panelId, actions }: SectionNotePanelProps) {
  return (
    <div id={panelId} className="left-panel-section-note" role="region" aria-label="Section study note">
      <div className="section-note-card section-note-card--goals">
        <div className="section-note-card-icon" aria-hidden>
          ◆
        </div>
        <div className="section-note-card-body">
          <h3 className="left-panel-section-note-heading">What you&apos;ll learn</h3>
          <p className="left-panel-section-note-text">{note.objectives}</p>
        </div>
      </div>

      {note.vocabulary.length > 0 ? (
        <div className="section-note-card section-note-card--vocab">
          <div className="section-note-card-icon" aria-hidden>
            Aa
          </div>
          <div className="section-note-card-body">
            <h3 className="left-panel-section-note-heading">Key vocabulary</h3>
            <div className="section-note-entry-list">
              {note.vocabulary.map((item) => (
                <ExpandableNoteEntry
                  key={item.term}
                  entry={vocabToEntry(item)}
                  actions={actions}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {note.formulas.length > 0 ? (
        <div className="section-note-card section-note-card--formulas">
          <div className="section-note-card-icon" aria-hidden>
            ∑
          </div>
          <div className="section-note-card-body">
            <h3 className="left-panel-section-note-heading">Important formulas</h3>
            <div className="section-note-entry-list">
              {note.formulas.map((item) => (
                <ExpandableNoteEntry
                  key={`${item.expr}:${item.explanation}`}
                  entry={formulaToEntry(item)}
                  actions={actions}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
