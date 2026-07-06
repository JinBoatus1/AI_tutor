import type { Course } from "./types";
import { addItem as addItemRow } from "./rubric";
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
  // Reuse the rubric row helper so a gradebook-added row also keeps the rule's slot count
  // in sync (and seeds a fixedWeights row with a weight) — no rule/row desync.
  const addItem = (catId: string) =>
    onChange({
      ...course,
      categories: course.categories.map((cat) => (cat.id !== catId ? cat : addItemRow(cat))),
    });

  return (
    <section className="gr-card gr-gradebook">
      <h2 className="gr-sec-label">{t("grades.gradebook")}</h2>
      {course.categories.map((cat) => (
        <div className="gr-gb-cat" key={cat.id}>
          <div className="gr-gb-cat-head">
            <span className="gr-gb-cat-name">{cat.name}</span>
            <span className="gr-gb-cat-weight">{cat.weight}%</span>
          </div>
          {cat.items.length === 0 && <div className="gr-gb-empty">{t("grades.noItems")}</div>}
          {cat.items.map((it) => (
            <div className="gr-gb-row" key={it.id}>
              <span className="gr-gb-name">{it.name}</span>
              <span className="gr-gb-leader" />
              {it.score == null && <span className="gr-gb-upcoming">{t("grades.upcoming")}</span>}
              <span className="gr-gb-score">
                <input
                  className="gr-gb-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={it.score ?? ""}
                  aria-label={`${it.name} score`}
                  onChange={(e) => setScore(cat.id, it.id, e.target.value)}
                />
                <span className="gr-gb-max">/ {it.maxScore}</span>
              </span>
            </div>
          ))}
          <button className="gr-linkbtn gr-gb-add" onClick={() => addItem(cat.id)}>
            {t("grades.addGrade")}
          </button>
        </div>
      ))}
    </section>
  );
}
