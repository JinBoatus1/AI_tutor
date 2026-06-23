import { useMemo, useRef, useState } from "react";
import { apiUrl } from "./api";
import { useLocale } from "./i18n/LocaleContext";
import "./AutoGrader.css";

type ScoreMode = "absolute" | "percentage" | "manual_review";
type GradingMode = "question_answer" | "question_only";

type ScoreItem = {
  score: number | null;
  mode: ScoreMode;
  max_score?: number | null;
  manual_review?: boolean;
  reason?: string | null;
  question_text?: string | null;
  answer_text?: string | null;
};

type GradeResponse = {
  paper_id: string;
  pair_count: number;
  grading_mode: GradingMode;
  pairs: string[];
  scores: Record<string, ScoreItem>;
  all_absolute: boolean;
  total_score: number | null;
  total_max_score: number | null;
};

export default function AutoGrader() {
  const { t } = useLocale();
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [gradingCriteria, setGradingCriteria] = useState("");
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GradeResponse | null>(null);

  const sortedScores = useMemo(() => {
    if (!result) {
      return [] as Array<[string, ScoreItem]>;
    }
    return Object.entries(result.scores).sort((a, b) => {
      const an = Number(a[0]);
      const bn = Number(b[0]);
      const aNum = Number.isFinite(an);
      const bNum = Number.isFinite(bn);
      if (aNum && bNum) {
        return an - bn;
      }
      return a[0].localeCompare(b[0]);
    });
  }, [result]);

  const handleSubmit = async () => {
    setError("");
    setResult(null);
    if (!questionFile) {
      setError(t("autograder.errQuestionFile"));
      return;
    }

    const formData = new FormData();
    formData.append("paper_id", `web-${Date.now()}`);
    formData.append("question_file", questionFile);
    if (answerFile) {
      formData.append("answer_file", answerFile);
    }
    if (gradingCriteria.trim()) {
      formData.append("grading_criteria", gradingCriteria.trim());
    }

    setGrading(true);
    try {
      const resp = await fetch(apiUrl("/api/autograder/grade"), {
        method: "POST",
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok) {
        const detail = data?.detail || data?.error || t("learning.errBackendGeneric");
        setError(t("autograder.errBackend", { detail: String(detail) }));
        return;
      }
      setResult(data as GradeResponse);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      setError(t("autograder.errRequest", { message }));
    } finally {
      setGrading(false);
    }
  };

  const renderScoreValue = (item: ScoreItem) => {
    if (item.manual_review || item.mode === "manual_review") {
      return "Manual review";
    }
    if (item.mode === "absolute" && item.max_score != null) {
      return `${item.score ?? 0}/${item.max_score}`;
    }
    return `${item.score ?? 0}%`;
  };

  return (
    <div className="autograder-page">
      <div className="autograder-page-inner">
        <header className="autograder-hero">
          <h1 className="autograder-hero-title">{t("autograder.title")}</h1>
          <p className="autograder-hero-sub">{t("autograder.subtitle")}</p>
        </header>

        <section className="autograder-card" aria-label="Auto grader inputs">
          <div className="autograder-panel">
            <span className="autograder-panel-label">{t("autograder.questionFile")}</span>
            <div className="autograder-file-row">
              <input
                ref={questionInputRef}
                className="autograder-file-input-hidden"
                type="file"
                accept=".pdf,image/*"
                aria-label={t("autograder.uploadQuestion")}
                onChange={(e) => setQuestionFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="autograder-file-choose-btn"
                onClick={() => questionInputRef.current?.click()}
              >
                {t("autograder.chooseQuestion")}
              </button>
              <span
                className={`autograder-file-status${questionFile ? " autograder-file-status--picked" : ""}`}
              >
                {questionFile ? questionFile.name : t("autograder.noFile")}
              </span>
            </div>
          </div>

          <div className="autograder-panel">
            <span className="autograder-panel-label">{t("autograder.answerFileOptional")}</span>
            <div className="autograder-file-row">
              <input
                ref={answerInputRef}
                className="autograder-file-input-hidden"
                type="file"
                accept=".pdf,image/*"
                aria-label={t("autograder.uploadAnswer")}
                onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="autograder-file-choose-btn"
                onClick={() => answerInputRef.current?.click()}
              >
                {t("autograder.chooseAnswer")}
              </button>
              <span
                className={`autograder-file-status${answerFile ? " autograder-file-status--picked" : ""}`}
              >
                {answerFile ? answerFile.name : t("autograder.noFile")}
              </span>
            </div>
          </div>

          <div className="autograder-panel">
            <label className="autograder-panel-label" htmlFor="autograder-criteria">
              {t("autograder.criteria")}
            </label>
            <textarea
              id="autograder-criteria"
              className="autograder-textarea"
              value={gradingCriteria}
              placeholder={t("autograder.criteriaPlaceholder")}
              onChange={(event) => setGradingCriteria(event.target.value)}
            />
          </div>

          <button type="button" className="autograder-submit" onClick={handleSubmit} disabled={grading}>
            {grading ? t("autograder.grading") : t("autograder.start")}
          </button>

          {error ? <p className="autograder-error-text">{error}</p> : null}
        </section>

        {result ? (
          <section className="autograder-result" aria-labelledby="autograder-result-heading">
            <div className="autograder-result-header">
              <h3 id="autograder-result-heading">{t("autograder.results")}</h3>
              <span className="autograder-mode-pill">
                {result.grading_mode === "question_only"
                  ? t("autograder.modeQuestionOnly")
                  : t("autograder.modeQuestionAnswer")}
              </span>
            </div>
            <p className="autograder-result-meta">
              {t("autograder.pairsDetected", { count: String(result.pair_count) })}
            </p>

            <div className="autograder-score-list">
              {sortedScores.map(([qid, item]) => (
                <div className="autograder-score-item" key={qid}>
                  <div className="autograder-score-main">
                    <span>Q{qid}</span>
                    <strong>{renderScoreValue(item)}</strong>
                  </div>
                  {item.reason ? <small>{item.reason}</small> : null}
                  {item.answer_text && result.grading_mode === "question_only" ? (
                    <details className="autograder-answer-details">
                      <summary>Reference answer</summary>
                      <p>{item.answer_text}</p>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>

            {result.all_absolute && result.total_score != null && result.total_max_score != null ? (
              <p className="autograder-total-score">
                {t("autograder.totalScore", {
                  score: String(result.total_score),
                  max: String(result.total_max_score),
                })}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
