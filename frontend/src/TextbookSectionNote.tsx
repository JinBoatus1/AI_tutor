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
      setOpen(false);
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
  open: boolean;
  panelId: string;
};

export function SectionNotePanel({ note, open, panelId }: SectionNotePanelProps) {
  if (!open) return null;

  return (
    <div id={panelId} className="left-panel-section-note" role="region" aria-label="Section study note">
      <div className="left-panel-section-note-block">
        <h3 className="left-panel-section-note-heading">What you&apos;ll learn</h3>
        <p className="left-panel-section-note-text">{note.objectives}</p>
      </div>
      {note.vocabulary.length > 0 ? (
        <div className="left-panel-section-note-block">
          <h3 className="left-panel-section-note-heading">Key vocabulary</h3>
          <ul className="left-panel-section-note-list">
            {note.vocabulary.map((term) => (
              <li key={term}>
                <MathText>{term}</MathText>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {note.formulas.length > 0 ? (
        <div className="left-panel-section-note-block">
          <h3 className="left-panel-section-note-heading">Important formulas</h3>
          <ul className="left-panel-section-note-list left-panel-section-note-list--formulas">
            {note.formulas.map((f) => (
              <li key={f}>
                <MathText>{f}</MathText>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
