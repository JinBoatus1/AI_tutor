import { useState } from "react";
import type { Category, Course, Cutoff, Rule } from "./mockEngine";
import { weightsSum } from "./mockEngine";

/* The plain-English rubric rule picker (design D4). Editing is mock-local;
   on Confirm the parent persists. Maps 1:1 to the engine's three rules. */

type Kind = "uniform" | "dropLowest" | "rankWeights";
const kindOf = (r: Rule): Kind => r.kind;
const slotCount = (c: Category): number =>
  c.rule.kind === "rankWeights" ? c.rule.weights.length : c.rule.kind === "uniform" ? c.rule.nSlots : c.rule.nSlots;

// Two-tier read of a rankWeights vector: lowest N at `low`, the rest at `high`.
function twoTier(weights: number[]): { lowN: number; low: number; high: number } {
  if (weights.length === 0) return { lowN: 1, low: 0, high: 0 };
  const min = Math.min(...weights);
  const high = Math.max(...weights);
  return { lowN: weights.filter((w) => w === min).length, low: min, high };
}
function buildRank(nSlots: number, lowN: number, low: number, high: number): number[] {
  const n = Math.max(nSlots, 1);
  const k = Math.min(Math.max(lowN, 0), n);
  return [...Array(n - k).fill(high), ...Array(k).fill(low)];
}

export default function RubricEditor({
  course,
  parsed,
  onChange,
  onConfirm,
  onCancel,
}: {
  course: Course;
  parsed: boolean; // true when this is a fresh syllabus parse to confirm
  onChange: (c: Course) => void;
  onConfirm: (c: Course) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState<Course>(course);
  const push = (updater: Course | ((prev: Course) => Course)) => {
    setC((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onChange(next);
      return next;
    });
  };
  const setCat = (i: number, patch: Partial<Category>) =>
    push((prev) => ({
      ...prev,
      categories: prev.categories.map((cat, j) => (j === i ? { ...cat, ...patch } : cat)),
    }));
  const setRule = (i: number, rule: Rule) => setCat(i, { rule });
  const setCutoff = (i: number, patch: Partial<Cutoff>) =>
    push((prev) => ({
      ...prev,
      cutoffs: prev.cutoffs.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));

  const sum = weightsSum(c);
  const sumOk = Math.abs(sum - 100) < 0.01;

  return (
    <div className="gr-editor" role="dialog" aria-label="Edit rubric">
      <div className="gr-editor-head">
        <h2 className="gr-card-h">{parsed ? "Confirm your rubric" : "Edit rubric"}</h2>
        <span className={`gr-sumchip${sumOk ? " ok" : " warn"}`}>
          weights: {sum}% {sumOk ? "✓" : "— should be 100"}
        </span>
      </div>
      {parsed && (
        <p className="gr-editor-note">
          We read this from your syllabus. Check it over and fix anything before we compute grades.
        </p>
      )}

      <div className="gr-editor-cats">
        {c.categories.map((cat, i) => {
          const kind = kindOf(cat.rule);
          const n = slotCount(cat);
          return (
            <div className="gr-edit-cat" key={cat.id}>
              <div className="gr-edit-cat-top">
                <input
                  className="gr-edit-name"
                  value={cat.name}
                  aria-label="Category name"
                  onChange={(e) => setCat(i, { name: e.target.value })}
                />
                <label className="gr-edit-weight">
                  weight
                  <input
                    type="number"
                    value={cat.weight}
                    aria-label={`${cat.name} weight`}
                    onChange={(e) => setCat(i, { weight: Number(e.target.value) || 0 })}
                  />
                  %
                </label>
              </div>

              <div className="gr-scoring" role="radiogroup" aria-label={`${cat.name} scoring`}>
                <span className="gr-scoring-label">Scoring:</span>
                {(["uniform", "dropLowest", "rankWeights"] as Kind[]).map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={kind === k}
                    className={`gr-seg${kind === k ? " is-on" : ""}`}
                    onClick={() =>
                      setRule(
                        i,
                        k === "uniform"
                          ? { kind: "uniform", nSlots: n }
                          : k === "dropLowest"
                            ? { kind: "dropLowest", nSlots: n, k: 1 }
                            : { kind: "rankWeights", weights: buildRank(n, 1, Math.round(cat.weight / n) - 1, Math.round(cat.weight / n)) },
                      )
                    }
                  >
                    {k === "uniform" ? "All equal" : k === "dropLowest" ? "Drop lowest" : "Lowest counts less"}
                  </button>
                ))}
              </div>

              <div className="gr-rule-params">
                {cat.rule.kind === "uniform" && (
                  <span>
                    <NumIn v={cat.rule.nSlots} onV={(v) => setRule(i, { kind: "uniform", nSlots: v })} /> items, each counts the same
                  </span>
                )}
                {cat.rule.kind === "dropLowest" && (
                  <span>
                    drop the lowest <NumIn v={cat.rule.k} onV={(v) => setRule(i, { kind: "dropLowest", nSlots: cat.rule.kind === "dropLowest" ? cat.rule.nSlots : n, k: v })} /> of{" "}
                    <NumIn v={cat.rule.nSlots} onV={(v) => setRule(i, { kind: "dropLowest", nSlots: v, k: cat.rule.kind === "dropLowest" ? cat.rule.k : 1 })} /> items
                  </span>
                )}
                {cat.rule.kind === "rankWeights" &&
                  (() => {
                    const t = twoTier(cat.rule.weights);
                    const ns = cat.rule.weights.length;
                    const rebuild = (lowN: number, low: number, high: number) =>
                      setRule(i, { kind: "rankWeights", weights: buildRank(ns, lowN, low, high) });
                    const tierSum = t.lowN * t.low + (ns - t.lowN) * t.high;
                    return (
                      <span>
                        the lowest <NumIn v={t.lowN} onV={(v) => rebuild(v, t.low, t.high)} /> of{" "}
                        <NumIn v={ns} onV={(v) => setRule(i, { kind: "rankWeights", weights: buildRank(v, t.lowN, t.low, t.high) })} /> count{" "}
                        <NumIn v={t.low} onV={(v) => rebuild(t.lowN, v, t.high)} /> pts, others{" "}
                        <NumIn v={t.high} onV={(v) => rebuild(t.lowN, t.low, v)} /> pts each
                        <span className={`gr-tier-sum${Math.abs(tierSum - cat.weight) < 0.01 ? " ok" : " warn"}`}>
                          {Math.abs(tierSum - cat.weight) < 0.01 ? `✓ adds up to ${cat.weight}` : `= ${tierSum}, not ${cat.weight}`}
                        </span>
                      </span>
                    );
                  })()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="gr-edit-cutoffs">
        <span className="gr-edit-cutoffs-label">Letter cutoffs</span>
        <div className="gr-cutoff-row">
          {c.cutoffs
            .filter((x) => x.letter !== "F")
            .map((x) => {
              const idx = c.cutoffs.indexOf(x);
              return (
                <label key={x.letter} className="gr-cutoff">
                  {x.letter} ≥
                  <input
                    type="number"
                    value={x.min}
                    aria-label={`${x.letter} cutoff`}
                    onChange={(e) => setCutoff(idx, { min: Number(e.target.value) || 0 })}
                  />
                </label>
              );
            })}
        </div>
      </div>

      <div className="gr-editor-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="gr-btn-primary" onClick={() => onConfirm(c)}>
          {parsed ? "Confirm rubric" : "Save"}
        </button>
      </div>
    </div>
  );
}

function NumIn({ v, onV }: { v: number; onV: (v: number) => void }) {
  return (
    <input
      className="gr-numin"
      type="number"
      value={v}
      onChange={(e) => onV(Number(e.target.value) || 0)}
    />
  );
}
