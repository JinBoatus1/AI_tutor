import type { Course } from "./types";
import { addItem as addItemRow, scoreWarning } from "./rubric";
import { useLocale } from "../i18n/LocaleContext";

export default function Gradebook({ course, onChange }: { course: Course; onChange: (c: Course) => void }) {
  const { t } = useLocale();
  const setScore = (catId: string, itemId: string, raw: string) => {
    const score = raw.trim() === "" ? null : Number(raw);
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, score } : it)) },
      ),
    });
  };
  const setMaxScore = (catId: string, itemId: string, raw: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) =>
        cat.id !== catId
          ? cat
          : { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, maxScore: Number(raw) || 100 } : it)) },
      ),
    });
  // Reuse the rubric row helper so a gradebook-added row also keeps the rule's slot count
  // in sync (and seeds a fixedWeights row with a weight) — no rule/row desync.
  const addItem = (catId: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) => (cat.id !== catId ? cat : addItemRow(cat))),
    });

  return (
    <section className="gr-gradebook">
      <h2 className="gr-sec">
        <span>{t("grades.gradebook")}</span>
      </h2>
      {course.categories.map((cat) => (
        <div className="gr-gb-cat" key={cat.id}>
          <div className="gr-gb-cat-head">
            <span className="gr-gb-cat-name">{cat.name}</span>
            <span className="gr-gb-weight">{cat.weight}%</span>
          </div>
          {cat.items.length === 0 && <div className="gr-gb-empty">{t("grades.noItems")}</div>}
          {cat.items.map((it) => {
            const warn = scoreWarning(it);
            const upcoming = it.score == null;
            return (
              <div className={`gr-gb-row${upcoming ? " is-upcoming" : ""}`} key={it.id}>
                <span className="gr-gb-name">{it.name}</span>
                <span className="gr-gb-lead" />
                {upcoming && <span className="gr-tag">{t("grades.upcoming")}</span>}
                {warn && <span className="gr-warn-tag">{t("grades.scoreOverMax")}</span>}
                <span className={`gr-score${upcoming ? " is-empty" : ""}${warn ? " is-warn" : ""}`}>
                  <input
                    className="gr-score-in"
                    type="number"
                    inputMode="numeric"
                    placeholder="—"
                    value={it.score ?? ""}
                    aria-label={`${it.name} score`}
                    onChange={(e) => setScore(cat.id, it.id, e.target.value)}
                  />
                  <span className="gr-score-sep">/</span>
                  <input
                    className="gr-score-max"
                    type="number"
                    inputMode="numeric"
                    value={it.maxScore}
                    aria-label={`${it.name} max score`}
                    onChange={(e) => setMaxScore(cat.id, it.id, e.target.value)}
                  />
                </span>
              </div>
            );
          })}
          <button className="gr-gb-add" onClick={() => addItem(cat.id)}>
            {t("grades.addGrade")}
          </button>
        </div>
      ))}
    </section>
  );
}
