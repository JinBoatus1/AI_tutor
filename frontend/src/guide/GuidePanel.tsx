import { useEffect, useMemo, useState } from "react";
import "../practice/Practice.css";
import { Flashcard } from "../practice/formats/Flashcard";
import { McqQuestion } from "../practice/formats/McqQuestion";
import { ProofOrderQuestion } from "../practice/formats/ProofOrderQuestion";
import { SpotFlawQuestion } from "../practice/formats/SpotFlawQuestion";
import { loadGuideProgress, saveGuideProgress } from "../utils/guideProgress";
import type { GuideScript, GuideStep } from "./types";

function stepUnlocked(stepIndex: number, completed: Set<string>, steps: GuideStep[]): boolean {
  if (stepIndex === 0) return true;
  return completed.has(steps[stepIndex - 1]!.id);
}

function firstIncompleteIndex(steps: GuideStep[], completed: Set<string>): number {
  const idx = steps.findIndex((s) => !completed.has(s.id));
  return idx === -1 ? steps.length - 1 : idx;
}

function GuideStepper({
  steps,
  stepIndex,
  completed,
  onSelect,
}: {
  steps: GuideStep[];
  stepIndex: number;
  completed: Set<string>;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="pr-stepper" role="tablist" aria-label="Guided lesson steps">
      {steps.map((s, i) => {
        const unlocked = stepUnlocked(i, completed, steps);
        const done = completed.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={stepIndex === i}
            aria-disabled={!unlocked}
            className={
              "pr-step-btn" +
              (stepIndex === i ? " pr-step-btn--active" : "") +
              (!unlocked ? " pr-step-btn--locked" : "") +
              (done && stepIndex !== i ? " pr-step-btn--done" : "")
            }
            onClick={() => unlocked && onSelect(i)}
          >
            <span>
              {i + 1} · {s.label}
            </span>
            <small>{done ? "✓" : unlocked ? " " : "🔒"}</small>
          </button>
        );
      })}
    </div>
  );
}

export function GuidePanel({
  script,
  textbookId,
  onOpenProblems,
  onViewNote,
}: {
  script: GuideScript;
  textbookId: string;
  onOpenProblems?: () => void;
  onViewNote?: () => void;
}) {
  const [progress, setProgress] = useState(() => loadGuideProgress(textbookId, script.chapter));
  const completed = useMemo(() => new Set(progress.completedStepIds), [progress.completedStepIds]);
  const [stepIndex, setStepIndex] = useState(() =>
    firstIncompleteIndex(script.steps, new Set(loadGuideProgress(textbookId, script.chapter).completedStepIds)),
  );
  const [questionSolved, setQuestionSolved] = useState(false);

  useEffect(() => {
    saveGuideProgress(textbookId, script.chapter, progress);
  }, [textbookId, script.chapter, progress]);

  const step = script.steps[stepIndex];
  if (!step) return null;

  const markComplete = (id: string) => {
    setProgress((p) =>
      p.completedStepIds.includes(id) ? p : { completedStepIds: [...p.completedStepIds, id] },
    );
  };

  const advance = () => {
    markComplete(step.id);
    if (stepIndex < script.steps.length - 1) {
      setStepIndex(stepIndex + 1);
      setQuestionSolved(false);
    }
  };

  const pct = Math.round((progress.completedStepIds.length / script.steps.length) * 100);

  return (
    <div className="practice guide-panel">
      <div className="pr-mastery">
        <div className="pr-mastery-top">
          <span className="pr-mastery-title">{script.title}</span>
          <span className="pr-mastery-tier" aria-live="polite">
            Guided · demo
          </span>
        </div>
        <div className="pr-mastery-bar" aria-label="Lesson progress">
          <div className="pr-mastery-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <GuideStepper
        steps={script.steps}
        stepIndex={stepIndex}
        completed={completed}
        onSelect={(i) => {
          setStepIndex(i);
          setQuestionSolved(false);
        }}
      />

      {onViewNote ? (
        <div className="pr-toolbar">
          <button type="button" className="pr-link" onClick={onViewNote}>
            View study note
          </button>
        </div>
      ) : null}

      <div className="pr-stage">
        <p className="pr-progress-line">
          Step {stepIndex + 1} of {script.steps.length} · {step.title}
        </p>

        {step.kind === "read" ? (
          <>
            <p className="pr-q-prompt">{step.body}</p>
            {step.bookHint ? <p className="guide-book-hint">{step.bookHint}</p> : null}
            <button type="button" className="pr-btn" onClick={advance}>
              Continue →
            </button>
          </>
        ) : null}

        {step.kind === "flashcard" ? (
          <>
            <Flashcard key={step.card.id} card={step.card} />
            <div className="pr-deck-nav">
              <button type="button" className="pr-btn" onClick={advance}>
                Got it →
              </button>
            </div>
          </>
        ) : null}

        {step.kind === "question" ? (
          <>
            {step.question.kind === "mcq" ? (
              <McqQuestion
                key={step.question.id}
                question={step.question}
                onAnswered={(correct) => {
                  if (correct) setQuestionSolved(true);
                }}
              />
            ) : null}
            {step.question.kind === "proof-order" ? (
              <ProofOrderQuestion
                key={step.question.id}
                question={step.question}
                onAnswered={(correct) => {
                  if (correct) setQuestionSolved(true);
                }}
              />
            ) : null}
            {step.question.kind === "spot-flaw" ? (
              <SpotFlawQuestion
                key={step.question.id}
                question={step.question}
                onAnswered={(correct) => {
                  if (correct) setQuestionSolved(true);
                }}
              />
            ) : null}
            <div className="pr-deck-nav">
              <button
                type="button"
                className="pr-btn"
                disabled={!questionSolved}
                onClick={advance}
              >
                Next step →
              </button>
            </div>
          </>
        ) : null}

        {step.kind === "done" ? (
          <>
            <p className="pr-q-prompt">{step.body}</p>
            <p className="pr-mastered-note">Nice work — you walked through induction once.</p>
            {onOpenProblems ? (
              <button type="button" className="pr-btn" onClick={onOpenProblems}>
                Open 5.3 Problems →
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
