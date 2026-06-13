import type { Stage } from "./types";

const STAGES: { key: Stage; label: string }[] = [
  { key: "warmup", label: "Warm-up" },
  { key: "practice", label: "Practice" },
  { key: "challenge", label: "Challenge" },
];

export function StageStepper({
  stage,
  unlocked,
  onStage,
}: {
  stage: Stage;
  unlocked: Record<Stage, boolean>;
  onStage: (s: Stage) => void;
}) {
  return (
    <div className="pr-stepper" role="tablist" aria-label="Practice stages">
      {STAGES.map((s, i) => {
        const isUnlocked = unlocked[s.key];
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={stage === s.key}
            aria-disabled={!isUnlocked}
            className={
              "pr-step-btn" +
              (stage === s.key ? " pr-step-btn--active" : "") +
              (!isUnlocked ? " pr-step-btn--locked" : "")
            }
            onClick={() => isUnlocked && onStage(s.key)}
          >
            <span>
              {i + 1} · {s.label}
            </span>
            <small>{isUnlocked ? " " : "🔒 locked"}</small>
          </button>
        );
      })}
    </div>
  );
}
