import { useMemo, useRef, useState } from "react";
import { apiUrl } from "./api";
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
      setError("Please upload a question file.");
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
        const detail = data?.detail || data?.error || "Backend request failed.";
        setError(`Backend error: ${detail}`);
        return;
      }
      setResult(data as GradeResponse);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      setError(`Request failed: ${message}`);
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
          <h1 className="autograder-hero-title">Auto Grader</h1>
        </header>

        <section className="autograder-card" aria-label="Auto grader inputs">
          <div className="autograder-panel">
            <label className="autograder-panel-label">Question file</label>
            <div className="autograder-file-row">
              <input
                ref={questionInputRef}
                className="autograder-file-input-hidden"
                type="file"
                accept=".pdf,image/*"
                aria-label="Upload question file"
                onChange={(e) => setQuestionFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="autograder-file-choose-btn"
                onClick={() => questionInputRef.current?.click()}
              >
                Choose question
              </button>
              <span className={`autograder-file-status ${questionFile ? "autograder-file-status--picked" : ""}`}>
                {questionFile ? questionFile.name : "No file chosen"}
              </span>
            </div>
          </div>

          <div className="autograder-panel">
            <label className="autograder-panel-label">Answer file (optional)</label>
            <div className="autograder-file-row">
              <input
                ref={answerInputRef}
                className="autograder-file-input-hidden"
                type="file"
                accept=".pdf,image/*"
                aria-label="Upload answer file"
                onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="autograder-file-choose-btn"
                onClick={() => answerInputRef.current?.click()}
              >
                Choose answer
              </button>
              <span className={`autograder-file-status ${answerFile ? "autograder-file-status--picked" : ""}`}>
                {answerFile ? answerFile.name : "No file chosen"}
              </span>
            </div>
          </div>

          <div className="autograder-panel">
            <label className="autograder-panel-label" htmlFor="autograder-criteria">
              Grading Criteria (optional)
            </label>
            <textarea
              id="autograder-criteria"
              className="autograder-textarea"
              value={gradingCriteria}
              onChange={(e) => setGradingCriteria(e.target.value)}
              rows={5}
              placeholder="Award full credit only for simplified final answers. Deduct 2 points for missing reasoning."
            />
          </div>
        </div>

          <button className="autograder-submit" type="button" onClick={handleSubmit} disabled={grading}>
            {grading ? "Grading..." : "Start grading"}
          </button>

<<<<<<< HEAD
        <button className="btn-primary" onClick={handleSubmit} disabled={grading}>
          {grading ? "Grading..." : "Start grading"}
        </button>

        {error && <p className="autograder-error-text">{error}</p>}
      </div>

      {result && (
        <div className="result-box">
          <h3>Grading results</h3>
          <p>paper_id: {result.paper_id}</p>
          <p>Detected sub-questions: {result.pair_count}</p>

          <div className="autograder-score-list">
            {sortedScores.map(([qid, item]) => {
              if (item.manual_review || item.mode === "manual_review") {
                return (
                  <div className="autograder-score-item" key={qid}>
                    <span>Q{qid}</span>
                    <strong>Manual review</strong>
                    {item.reason ? <small>{item.reason}</small> : null}
                  </div>
                );
              }
              const display =
                item.mode === "absolute" && item.max_score != null
                  ? `${item.score ?? 0}/${item.max_score}`
                  : `${item.score ?? 0}%`;
              return (
                <div className="autograder-score-item" key={qid}>
                  <span>Q{qid}</span>
                  <strong>{display}</strong>
                </div>
              );
            })}
          </div>

          {result.all_absolute && result.total_score != null && result.total_max_score != null && (
            <p className="autograder-total-score">
              Total score: {result.total_score}/{result.total_max_score}
            </p>
          )}
        </div>
      )}
=======
          {error ? <p className="autograder-error-text">{error}</p> : null}
        </section>

        {result ? (
          <section className="autograder-result" aria-labelledby="autograder-result-heading">
            <div className="autograder-result-header">
              <h3 id="autograder-result-heading">Grading results</h3>
              <span className="autograder-mode-pill">
                {result.grading_mode === "question_only" ? "Question only" : "Question + answer"}
              </span>
            </div>
            <p className="autograder-result-meta">Sub-questions detected: {result.pair_count}</p>

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
                Total score: {result.total_score}/{result.total_max_score}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
>>>>>>> 33d557730534dc55437464baf8007565af9c91a2
    </div>
  );
}
