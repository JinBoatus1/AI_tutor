import { useState } from "react";
import type { Category, Course, Cutoff } from "./types";
import {
  activeMode,
  addCategory,
  addItem,
  addScheme,
  categoryWeightSum,
  hasEnteredScores,
  itemWeightSum,
  materializeCourse,
  removeCategory,
  removeItem,
  removeScheme,
  schemeSum,
  setMode,
  setReplacer,
  setSchemeWeight,
  type ScoringMode,
} from "./rubric";
import { useLocale } from "../i18n/LocaleContext";

/* The plain-English rubric editor (redesign 2026-07-02). Each category card = name +
   weight% + a scoring mode + an item-row list; the ROWS are the slots, so editing them
   pre-creates gradebook items the student can fill immediately. Editing is local; the
   parent persists on change / confirm. All grade math stays server-side. */

const MODES: ScoringMode[] = ["uniform", "dropLowest", "fixedWeights", "replaceLowest"];

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
  const { t } = useLocale();
  // Materialize on mount so parsed categories arrive with fillable rows (T3).
  const [c, setC] = useState<Course>(() => materializeCourse(course));
  const [pendingDel, setPendingDel] = useState<string | null>(null);

  const push = (updater: (prev: Course) => Course) => {
    setC((prev) => {
      const next = updater(prev);
      onChange(next);
      return next;
    });
  };
  // Replace category i with fn(category_i).
  const mutCat = (i: number, fn: (cat: Category) => Category) =>
    push((prev) => ({ ...prev, categories: prev.categories.map((cat, j) => (j === i ? fn(cat) : cat)) }));
  const setItem = (i: number, itemId: string, patch: Partial<Category["items"][number]>) =>
    mutCat(i, (cat) => ({ ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }));
  const setCutoff = (i: number, patch: Partial<Cutoff>) =>
    push((prev) => ({ ...prev, cutoffs: prev.cutoffs.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const onDeleteCat = (cat: Category) => {
    if (hasEnteredScores(cat) && pendingDel !== cat.id) {
      setPendingDel(cat.id); // two-click guard when the bucket holds entered scores (T5)
      return;
    }
    setPendingDel(null);
    push((prev) => removeCategory(prev, cat.id));
  };

  const sum = categoryWeightSum(c);
  const sumOk = Math.abs(sum - 100) < 0.01;

  return (
    <div className="gr-editor" role="dialog" aria-label={t("grades.editRubricTitle")}>
      <div className="gr-editor-head">
        <div>
          <div className="gr-eyebrow">{t("grades.setupReportCard")}</div>
          <h2 className="gr-card-h">{parsed ? t("grades.confirmRubric") : t("grades.editRubricTitle")}</h2>
        </div>
        <span className={`gr-sumchip${sumOk ? " ok" : " warn"}`}>
          {t("grades.weightsSum", { sum: String(sum) })} {sumOk ? t("grades.weightsOk") : t("grades.weightsWarn")}
        </span>
      </div>
      {parsed && <p className="gr-editor-note">{t("grades.parsedNote")}</p>}

      <div className="gr-editor-cats">
        {c.categories.length === 0 && (
          <div className="gr-edit-empty">
            <button className="gr-linkbtn" onClick={() => push(addCategory)}>
              {t("grades.addFirstCategory")}
            </button>
            <p className="gr-edit-empty-hint">{t("grades.firstCategoryHint")}</p>
          </div>
        )}

        {c.categories.map((cat, i) => {
          const mode = activeMode(cat.rule);
          const isFixed = mode === "fixedWeights" || mode === "replaceLowest";
          const isReplace = mode === "replaceLowest";
          const wSum = itemWeightSum(cat);
          const wOk = Math.abs(wSum - cat.weight) < 0.01;
          return (
            <div className="gr-edit-cat" key={cat.id}>
              <div className="gr-edit-cat-top">
                <input
                  className="gr-edit-name"
                  value={cat.name}
                  aria-label={t("grades.categoryName")}
                  onChange={(e) => mutCat(i, (x) => ({ ...x, name: e.target.value }))}
                />
                <label className="gr-edit-weight">
                  {t("grades.weight")}
                  <input
                    type="number"
                    value={cat.weight}
                    aria-label={`${cat.name} weight`}
                    onChange={(e) => mutCat(i, (x) => ({ ...x, weight: Number(e.target.value) || 0 }))}
                  />
                  %
                </label>
                {pendingDel === cat.id ? (
                  <span className="gr-del-confirm">
                    <span className="gr-del-q">{t("grades.deleteCategoryQ")}</span>
                    <button className="gr-del-yes" onClick={() => onDeleteCat(cat)}>
                      {t("grades.deleteConfirm")}
                    </button>
                    <button className="gr-del-no" onClick={() => setPendingDel(null)}>
                      {t("grades.deleteKeep")}
                    </button>
                  </span>
                ) : (
                  <button
                    className="gr-edit-x gr-edit-x-cat"
                    aria-label={`${t("grades.deleteCategory")}: ${cat.name}`}
                    onClick={() => onDeleteCat(cat)}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="gr-scoring" role="radiogroup" aria-label={`${cat.name} scoring`}>
                <span className="gr-scoring-label">{t("grades.scoring")}</span>
                {MODES.map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={mode === m}
                    className={`gr-seg${mode === m ? " is-on" : ""}`}
                    onClick={() => mutCat(i, (x) => setMode(x, m))}
                  >
                    {m === "uniform"
                      ? t("grades.allEqual")
                      : m === "dropLowest"
                        ? t("grades.dropLowest")
                        : m === "fixedWeights"
                          ? t("grades.customWeights")
                          : t("grades.replaceLowestMode")}
                  </button>
                ))}
                {mode === null && <span className="gr-legacy-note">{t("grades.legacyRank")}</span>}
              </div>

              {cat.rule.kind === "dropLowest" && (
                <div className="gr-rule-params">
                  {t("grades.dropPrefix")}{" "}
                  <NumIn
                    v={cat.rule.k}
                    onV={(v) => mutCat(i, (x) => ({ ...x, rule: { kind: "dropLowest", nSlots: x.items.length, k: v } }))}
                  />
                </div>
              )}

              <div className="gr-edit-items">
                {cat.items.length === 0 && <div className="gr-gb-empty">{t("grades.noItems")}</div>}
                {cat.items.map((it) => (
                  <div className="gr-edit-item-row" key={it.id}>
                    <input
                      className="gr-edit-item-name"
                      value={it.name}
                      aria-label={t("grades.itemName")}
                      onChange={(e) => setItem(i, it.id, { name: e.target.value })}
                    />
                    {isFixed && (
                      <label className="gr-edit-item-w">
                        <input
                          type="number"
                          value={it.weight ?? 0}
                          aria-label={`${it.name} ${t("grades.weight")}`}
                          onChange={(e) => setItem(i, it.id, { weight: Number(e.target.value) || 0 })}
                        />
                        {t("grades.pts")}
                      </label>
                    )}
                    {isReplace && (
                      <label className="gr-item-rep">
                        <input
                          type="radio"
                          name={`rep-${cat.id}`}
                          checked={!!it.replacer}
                          aria-label={t("grades.replacerLabel")}
                          onChange={() => mutCat(i, (x) => setReplacer(x, it.id))}
                        />
                        {t("grades.replacerLabel")}
                      </label>
                    )}
                    <button
                      className="gr-edit-x"
                      aria-label={`${t("grades.removeItem")}: ${it.name}`}
                      onClick={() => mutCat(i, (x) => removeItem(x, it.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="gr-edit-item-foot">
                  <button className="gr-linkbtn" onClick={() => mutCat(i, addItem)}>
                    {t("grades.addItem")}
                  </button>
                  {isFixed && cat.items.length > 0 && (
                    <span className={`gr-tier-sum${wOk ? " ok" : " warn"}`}>
                      {wOk
                        ? t("grades.tierOk", { weight: String(cat.weight) })
                        : t("grades.tierWarn", { sum: String(wSum), weight: String(cat.weight) })}
                    </span>
                  )}
                </div>
                {isReplace && <p className="gr-replace-hint">{t("grades.replaceLowestHint")}</p>}
              </div>
            </div>
          );
        })}

        {c.categories.length > 0 && (
          <button className="gr-linkbtn gr-add-cat" onClick={() => push(addCategory)}>
            {t("grades.addCategory")}
          </button>
        )}
      </div>

      <div className="gr-alt-weighting">
        <div className="gr-edit-cutoffs-label">{t("grades.altWeighting")}</div>
        {(c.weightings ?? []).map((s, si) => {
          const ssum = schemeSum(s);
          const ok = Math.abs(ssum - 100) < 0.01;
          return (
            <div className="gr-scheme" key={si}>
              <div className="gr-scheme-head">
                <span className="gr-scheme-name">{s.name}</span>
                <button className="gr-edit-x" aria-label={`${t("grades.removeScheme")}: ${s.name}`}
                  onClick={() => push((prev) => removeScheme(prev, si))}>×</button>
              </div>
              <div className="gr-scheme-rows">
                {c.categories.map((cat) => (
                  <label className="gr-scheme-w" key={cat.id}>
                    <span>{cat.name}</span>
                    <input type="number" value={s.weights[cat.id] ?? cat.weight}
                      aria-label={`${cat.name} weight in ${s.name}`}
                      onChange={(e) => push((prev) => setSchemeWeight(prev, si, cat.id, Number(e.target.value) || 0))} />
                  </label>
                ))}
              </div>
              <span className={`gr-tier-sum${ok ? " ok" : " warn"}`}>
                {ok ? t("grades.schemeSumOk") : t("grades.schemeSumWarn", { sum: String(ssum) })}
              </span>
            </div>
          );
        })}
        <button className="gr-linkbtn" onClick={() => push(addScheme)}>{t("grades.addScheme")}</button>
        {(c.weightings?.length ?? 0) > 0 && <p className="gr-replace-hint">{t("grades.altWeightingHint")}</p>}
      </div>

      <div className="gr-edit-cutoffs">
        <span className="gr-edit-cutoffs-label">{t("grades.letterCutoffs")}</span>
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
          {t("grades.cancel")}
        </button>
        <button className="gr-btn-primary" onClick={() => onConfirm(c)}>
          {parsed ? t("grades.confirmRubricBtn") : t("grades.save")}
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
