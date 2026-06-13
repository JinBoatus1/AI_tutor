import type { Tier } from "./types";

const TIER_LABEL: Record<Tier, string> = {
  not_started: "Not started",
  familiar: "Familiar",
  proficient: "Proficient",
  mastered: "Mastered",
};

// Khan-style fill: Familiar half, Proficient most of the way, Mastered full.
const TIER_FILL: Record<Tier, number> = { not_started: 0, familiar: 50, proficient: 80, mastered: 100 };

export function MasteryHeader({ chapterTitle, tier }: { chapterTitle: string; tier: Tier }) {
  return (
    <div className="pr-mastery">
      <div className="pr-mastery-top">
        <span className="pr-mastery-title">{chapterTitle} · Mastery</span>
        <span className="pr-mastery-tier" aria-live="polite">
          {TIER_LABEL[tier]}
        </span>
      </div>
      <div
        className="pr-mastery-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={TIER_FILL[tier]}
        aria-label="Chapter mastery"
      >
        <div className="pr-mastery-fill" style={{ width: `${TIER_FILL[tier]}%` }} />
      </div>
      <div className="pr-mastery-labels">
        <span className={tier !== "not_started" ? "is-on" : ""}>Familiar</span>
        <span className={tier === "proficient" || tier === "mastered" ? "is-on" : ""}>Proficient</span>
        <span className={tier === "mastered" ? "is-on" : ""}>Mastered</span>
      </div>
    </div>
  );
}
