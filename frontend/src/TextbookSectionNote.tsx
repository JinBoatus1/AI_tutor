import { useEffect, useId, useRef, useState } from "react";
import MathText from "./MathText";
import type { SectionNote } from "./utils/sectionNotes";

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
};

export function SectionNotePanel({ note, panelId }: SectionNotePanelProps) {
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
            <dl className="section-note-vocab-list">
              {note.vocabulary.map((item) => (
                <div key={item.term} className="section-note-vocab-row">
                  <dt className="section-note-vocab-term">
                    <MathText>{item.term}</MathText>
                  </dt>
                  <dd className="section-note-vocab-def">
                    <MathText>{item.definition}</MathText>
                  </dd>
                </div>
              ))}
            </dl>
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
            <ul className="section-note-formula-list">
              {note.formulas.map((item) => (
                <li key={`${item.expr}:${item.explanation}`} className="section-note-formula-item">
                  <div className="section-note-formula-expr">
                    <MathText>{item.expr}</MathText>
                  </div>
                  <p className="section-note-formula-explain">
                    <MathText>{item.explanation}</MathText>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
