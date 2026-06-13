import { useEffect, useMemo, useState } from "react";
import "./Practice.css";
import { getPracticeSet } from "../data/focsPracticeSets";
import { loadProgress, saveProgress } from "../utils/practiceProgress";
import { computeTier, stageUnlock } from "./masteryEngine";
import { emptyProgress, type PracticeProgress, type PracticeSet, type Stage, type PracticeQuestion } from "./types";
import { MasteryHeader } from "./MasteryHeader";
import { StageStepper } from "./StageStepper";
import { HintLadderPanel } from "./HintLadderPanel";
import { Flashcard } from "./formats/Flashcard";
import { McqQuestion } from "./formats/McqQuestion";
import { ProofOrderQuestion } from "./formats/ProofOrderQuestion";

// Formats whose UI exists in the spine. spot-flaw + fill-blank join with T13/T14;
// until then they're filtered out so the denominators (tier %, unlocks) stay honest.
const SUPPORTED_KINDS = new Set<PracticeQuestion["kind"]>(["mcq", "proof-order"]);

export function PracticePanel({
  chapter,
  textbookId,
  chapterTitle,
  token,
  onViewNote,
}: {
  chapter: string;
  textbookId: string;
  chapterTitle: string;
  token: string | null;
  onViewNote?: () => void;
}) {
  const rawSet = getPracticeSet(chapter);
  // Restrict to renderable formats; keep everything else (warm-up, challenge) intact.
  const set: PracticeSet | null = useMemo(
    () => (rawSet ? { ...rawSet, practice: rawSet.practice.filter((q) => SUPPORTED_KINDS.has(q.kind)) } : null),
    [rawSet],
  );

  const [progress, setProgress] = useState<PracticeProgress>(() => loadProgress(textbookId, chapter));
  const [stage, setStage] = useState<Stage>("warmup");
  const [skipped, setSkipped] = useState(false);
  const [deck, setDeck] = useState(0);
  const [pIdx, setPIdx] = useState(0);
  const [pSolved, setPSolved] = useState(false);
  const [cIdx, setCIdx] = useState(0);

  // Persist on every change.
  useEffect(() => {
    saveProgress(textbookId, chapter, progress);
  }, [textbookId, chapter, progress]);

  if (!set) return null;

  const tier = computeTier(set, progress);
  const unlocked = stageUnlock(set, progress, skipped);

  const goTo = (s: Stage) => {
    setStage(s);
  };
  const skipToChallenge = () => {
    setSkipped(true);
    setStage("challenge");
  };

  // ---- warm-up ----
  function WarmupStage() {
    const cards = set!.warmup;
    const card = cards[deck];
    const last = deck >= cards.length - 1;
    return (
      <div className="pr-stage">
        <p className="pr-progress-line">Warm-up · card {deck + 1} of {cards.length}</p>
        <Flashcard key={card.id} card={card} />
        <div className="pr-deck-nav">
          <button type="button" className="pr-btn pr-btn--ghost" disabled={deck === 0} onClick={() => setDeck((d) => d - 1)}>
            Back
          </button>
          {last ? (
            <button
              type="button"
              className="pr-btn"
              onClick={() => {
                setProgress((p) => ({ ...p, warmupDone: true }));
                setStage("practice");
              }}
            >
              Finish warm-up →
            </button>
          ) : (
            <button type="button" className="pr-btn" onClick={() => setDeck((d) => d + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- practice ----
  function renderQuestion(q: PracticeQuestion) {
    const onAnswered = (correct: boolean) => {
      setProgress((p) => ({
        ...p,
        practiceAttempted: { ...p.practiceAttempted, [q.id]: true },
        practiceCorrect: correct ? { ...p.practiceCorrect, [q.id]: true } : p.practiceCorrect,
      }));
      if (correct) setPSolved(true);
    };
    switch (q.kind) {
      case "mcq":
        return <McqQuestion key={q.id} question={q} onAnswered={onAnswered} />;
      case "proof-order":
        return <ProofOrderQuestion key={q.id} question={q} onAnswered={onAnswered} />;
      default:
        return null;
    }
  }

  function PracticeStage() {
    const qs = set!.practice;
    const q = qs[pIdx];
    const last = pIdx >= qs.length - 1;
    return (
      <div className="pr-stage">
        <p className="pr-progress-line">Practice · {pIdx + 1} of {qs.length}</p>
        {renderQuestion(q)}
        {pSolved && (
          <div className="pr-deck-nav">
            <span className="pr-deck-count" />
            {last ? (
              <button
                type="button"
                className="pr-btn"
                disabled={!unlocked.challenge}
                onClick={() => setStage("challenge")}
              >
                {unlocked.challenge ? "Go to Challenge →" : "Answer more to unlock"}
              </button>
            ) : (
              <button
                type="button"
                className="pr-btn"
                onClick={() => {
                  setPIdx((i) => i + 1);
                  setPSolved(false);
                }}
              >
                Next question →
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- challenge ----
  function ChallengeStage() {
    if (!unlocked.challenge) {
      return (
        <div className="pr-stage">
          <p className="pr-locked-note">Answer at least half of the practice set to unlock the challenge, or use “Skip to challenge”.</p>
        </div>
      );
    }
    const problem = set!.challenge[cIdx];
    if (!problem) return null;
    const twinIdx = problem.twinPromptId ? set!.challenge.findIndex((c) => c.id === problem.twinPromptId) : -1;
    return (
      <div className="pr-stage">
        <HintLadderPanel
          key={problem.id}
          problem={problem}
          token={token}
          hasTwin={twinIdx >= 0}
          onSolved={() =>
            setProgress((p) =>
              p.challengeSolved.includes(problem.id) ? p : { ...p, challengeSolved: [...p.challengeSolved, problem.id] },
            )
          }
          onTwin={() => twinIdx >= 0 && setCIdx(twinIdx)}
        />
      </div>
    );
  }

  return (
    <div className="practice">
      <MasteryHeader chapterTitle={chapterTitle} tier={tier} />
      {tier === "mastered" && <p className="pr-mastered-note">Mastered — nice work.</p>}
      <StageStepper stage={stage} unlocked={unlocked} onStage={goTo} />
      <div className="pr-toolbar">
        {onViewNote && (
          <button type="button" className="pr-link" onClick={onViewNote}>
            View study note
          </button>
        )}
        <button type="button" className="pr-link" onClick={skipToChallenge} disabled={stage === "challenge"}>
          Skip to challenge
        </button>
      </div>

      {stage === "warmup" && WarmupStage()}
      {stage === "practice" && PracticeStage()}
      {stage === "challenge" && ChallengeStage()}
    </div>
  );
}
