import { useMemo, useRef, useState } from "react";
import { apiUrl } from "./api";
import { useLocale } from "./i18n/LocaleContext";
import "./AutoGrader.css";

type ScoreMode = "absolute" | "percentage" | "manual_review";
type GradingMode = "question_answer" | "question_only";
type ConsensusBand = "high" | "medium" | "low";

type AttemptFeedback = {
  summary: string;
  awarded_points: string[];
  deductions: string[];
  evidence: string[];
  suggestion?: string | null;
};

type ScoreItem = {
  score: number | null;
  mode: ScoreMode;
  max_score?: number | null;
  manual_review?: boolean;
  reason?: string | null;
  question_text?: string | null;
  answer_text?: string | null;
  paper_instance_id?: string | null;
  question_attempt_id?: string | null;
  confidence?: number | null;
  consensus?: ConsensusBand | null;
  agent_count?: number;
  arbitrated?: boolean;
  feedback?: AttemptFeedback | null;
};

type PaperGradeResult = {
  paper_id: string;
  display_name: string;
  pair_count: number;
  grading_mode: GradingMode;
  pairs: string[];
  scores: Record<string, ScoreItem>;
  all_absolute: boolean;
  total_score: number | null;
  total_max_score: number | null;
};

type BatchGradeResponse = {
  paper_count: number;
  papers: PaperGradeResult[];
};

function sortScoreEntries(scores: Record<string, ScoreItem>) {
  return Object.entries(scores).sort((a, b) => {
    const an = Number(a[0]);
    const bn = Number(b[0]);
    const aNum = Number.isFinite(an);
    const bNum = Number.isFinite(bn);
    if (aNum && bNum) {
      return an - bn;
    }
    return a[0].localeCompare(b[0], undefined, { numeric: true });
  });
}

export default function AutoGrader() {
  const { t } = useLocale();
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [gradingCriteria, setGradingCriteria] = useState("");
  const questionInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<PaperGradeResult[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");

  const selectedResult = useMemo(
    () => results.find((paper) => paper.paper_id === selectedPaperId) ?? results[0] ?? null,
    [results, selectedPaperId],
  );
  const sortedScores = useMemo(
    () => (selectedResult ? sortScoreEntries(selectedResult.scores) : []),
    [selectedResult],
  );

  const handleSubmit = async () => {
    setError("");
    setResults([]);
    setSelectedPaperId("");
    if (!questionFile) {
      setError(t("autograder.errQuestionFile"));
      return;
    }

    const requestId = `web-${Date.now()}`;
    const formData = new FormData();
    formData.append("question_file", questionFile);
    if (gradingCriteria.trim()) {
      formData.append("grading_criteria", gradingCriteria.trim());
    }

    const isBatch = answerFiles.length > 0;
    if (isBatch) {
      formData.append("batch_id", requestId);
      answerFiles.forEach((file) => formData.append("answer_files", file));
    } else {
      formData.append("paper_id", requestId);
    }

    setGrading(true);
    try {
      const resp = await fetch(
        apiUrl(isBatch ? "/api/autograder/grade-batch" : "/api/autograder/grade"),
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await resp.json();
      if (!resp.ok) {
        const detail = data?.detail || data?.error || t("learning.errBackendGeneric");
        setError(t("autograder.errBackend", { detail: String(detail) }));
        return;
      }

      const nextResults = isBatch
        ? (data as BatchGradeResponse).papers
        : [{ ...(data as Omit<PaperGradeResult, "display_name">), display_name: questionFile.name }];
      if (!Array.isArray(nextResults) || nextResults.length === 0) {
        setError(t("autograder.errBackend", { detail: t("autograder.emptyResults") }));
        return;
      }
      setResults(nextResults);
      setSelectedPaperId(nextResults[0].paper_id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      setError(t("autograder.errRequest", { message }));
    } finally {
      setGrading(false);
    }
  };

  const renderScoreValue = (item: ScoreItem) => {
    if (item.manual_review || item.mode === "manual_review") {
      return t("autograder.manualReview");
    }
    if (item.mode === "absolute" && item.max_score != null) {
      return `${item.score ?? 0}/${item.max_score}`;
    }
    return `${item.score ?? 0}%`;
  };

  const renderPaperTotal = (paper: PaperGradeResult) => {
    if (paper.all_absolute && paper.total_score != null && paper.total_max_score != null) {
      return `${paper.total_score}/${paper.total_max_score}`;
    }
    return t("autograder.mixedScoring");
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
                onChange={(event) => setQuestionFile(event.target.files?.[0] ?? null)}
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
            <span className="autograder-panel-label">{t("autograder.answerFilesOptional")}</span>
            <div className="autograder-file-row">
              <input
                ref={answerInputRef}
                className="autograder-file-input-hidden"
                type="file"
                accept=".pdf,image/*"
                multiple
                aria-label={t("autograder.uploadAnswer")}
                onChange={(event) => setAnswerFiles(Array.from(event.target.files ?? []))}
              />
              <button
                type="button"
                className="autograder-file-choose-btn"
                onClick={() => answerInputRef.current?.click()}
              >
                {t("autograder.chooseAnswers")}
              </button>
              <span
                className={`autograder-file-status${answerFiles.length ? " autograder-file-status--picked" : ""}`}
              >
                {answerFiles.length
                  ? t("autograder.filesSelected", { count: String(answerFiles.length) })
                  : t("autograder.noFile")}
              </span>
            </div>
            {answerFiles.length ? (
              <ul className="autograder-file-list" aria-label={t("autograder.selectedAnswerFiles")}>
                {answerFiles.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
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

        {selectedResult ? (
          <section className="autograder-result" aria-labelledby="autograder-result-heading">
            <div className="autograder-result-header">
              <div>
                <h3 id="autograder-result-heading">{t("autograder.results")}</h3>
                <p className="autograder-result-meta">
                  {t("autograder.paperCount", { count: String(results.length) })}
                </p>
              </div>
              <span className="autograder-mode-pill">
                {selectedResult.grading_mode === "question_only"
                  ? t("autograder.modeQuestionOnly")
                  : t("autograder.modeQuestionAnswer")}
              </span>
            </div>

            {results.length > 1 ? (
              <div className="autograder-paper-tabs" role="tablist" aria-label={t("autograder.papers")}>
                {results.map((paper) => {
                  const selected = paper.paper_id === selectedResult.paper_id;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`autograder-paper-tab${selected ? " autograder-paper-tab--selected" : ""}`}
                      key={paper.paper_id}
                      onClick={() => setSelectedPaperId(paper.paper_id)}
                    >
                      <span>{paper.display_name}</span>
                      <strong>{renderPaperTotal(paper)}</strong>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="autograder-paper-heading">
              <div>
                <span className="autograder-panel-label">{t("autograder.currentPaper")}</span>
                <h4>{selectedResult.display_name}</h4>
              </div>
              <span className="autograder-paper-id">{selectedResult.paper_id}</span>
            </div>
            <p className="autograder-result-meta">
              {t("autograder.pairsDetected", { count: String(selectedResult.pair_count) })}
            </p>

            <div className="autograder-score-list">
              {sortedScores.map(([qid, item]) => (
                <article className="autograder-score-item" key={item.question_attempt_id ?? qid}>
                  <div className="autograder-score-main">
                    <span className="autograder-question-label">Q{qid}</span>
                    <strong>{renderScoreValue(item)}</strong>
                  </div>

                  <div className="autograder-score-badges">
                    {item.confidence != null ? (
                      <span className={`autograder-confidence autograder-confidence--${item.consensus ?? "low"}`}>
                        {t("autograder.confidence", { value: String(item.confidence) })}
                      </span>
                    ) : null}
                    {item.agent_count ? (
                      <span>{t("autograder.agentCount", { count: String(item.agent_count) })}</span>
                    ) : null}
                    {item.arbitrated ? <span>{t("autograder.arbitrated")}</span> : null}
                  </div>

                  {item.feedback?.summary ? (
                    <p className="autograder-feedback-summary">{item.feedback.summary}</p>
                  ) : item.reason ? (
                    <p className="autograder-feedback-summary">{item.reason}</p>
                  ) : null}

                  {item.feedback?.awarded_points.length ? (
                    <div className="autograder-feedback-block">
                      <h5>{t("autograder.awardedPoints")}</h5>
                      <ul>
                        {item.feedback.awarded_points.map((point, index) => (
                          <li key={`${item.question_attempt_id}-awarded-${index}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {item.feedback?.deductions.length ? (
                    <div className="autograder-feedback-block autograder-feedback-block--deduction">
                      <h5>{t("autograder.deductions")}</h5>
                      <ul>
                        {item.feedback.deductions.map((deduction, index) => (
                          <li key={`${item.question_attempt_id}-deduction-${index}`}>{deduction}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {item.feedback?.evidence.length ? (
                    <details className="autograder-answer-details">
                      <summary>{t("autograder.evidence")}</summary>
                      <ul>
                        {item.feedback.evidence.map((evidence, index) => (
                          <li key={`${item.question_attempt_id}-evidence-${index}`}>{evidence}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  {item.feedback?.suggestion ? (
                    <p className="autograder-suggestion">
                      <strong>{t("autograder.suggestion")}</strong> {item.feedback.suggestion}
                    </p>
                  ) : null}

                  {item.answer_text && selectedResult.grading_mode === "question_only" ? (
                    <details className="autograder-answer-details">
                      <summary>{t("autograder.referenceAnswer")}</summary>
                      <p>{item.answer_text}</p>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>

            {selectedResult.all_absolute &&
            selectedResult.total_score != null &&
            selectedResult.total_max_score != null ? (
              <p className="autograder-total-score">
                {t("autograder.totalScore", {
                  score: String(selectedResult.total_score),
                  max: String(selectedResult.total_max_score),
                })}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
