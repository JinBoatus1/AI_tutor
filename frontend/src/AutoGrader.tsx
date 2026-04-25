import { useMemo, useRef, useState } from "react";
import { apiUrl } from "./api";

type ScoreMode = "absolute" | "percentage" | "manual_review";

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
  pairs: string[];
  scores: Record<string, ScoreItem>;
  all_absolute: boolean;
  total_score: number | null;
  total_max_score: number | null;
};

export default function AutoGrader() {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
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
    if (!questionFile || !answerFile) {
      setError("请先上传 question 和 answer 两个文件。");
      return;
    }

    const formData = new FormData();

    formData.append("paper_id", `web-${Date.now()}`);
    formData.append("question_file", questionFile);
    formData.append("answer_file", answerFile);

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

  return (
    <div className="page-container">
      <h1 className="page-title">Auto Grader</h1>

      <div className="card">
        <div className="autograder-upload-block">
          <label className="autograder-upload-label">Question 文件</label>
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
              上传 Question
            </button>
            <span className="autograder-file-status">
              {questionFile ? questionFile.name : "未选择文件"}
            </span>
          </div>
        </div>

        <div className="autograder-upload-block">
          <label className="autograder-upload-label">Answer 文件</label>
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
              上传 Answer
            </button>
            <span className="autograder-file-status">
              {answerFile ? answerFile.name : "未选择文件"}
            </span>
          </div>
        </div>

        <button className="btn-primary" onClick={handleSubmit} disabled={grading}>
          {grading ? "评分中..." : "开始评分"}
        </button>

        {error && <p className="autograder-error-text">{error}</p>}
      </div>

      {result && (
        <div className="result-box">
          <h3>评分结果</h3>
          <p>paper_id: {result.paper_id}</p>
          <p>识别题目数: {result.pair_count}</p>

          <div className="autograder-score-list">
            {sortedScores.map(([qid, item]) => {
              if (item.manual_review || item.mode === "manual_review") {
                return (
                  <div className="autograder-score-item" key={qid}>
                    <span>Q{qid}</span>
                    <strong>人工复核</strong>
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
              总分: {result.total_score}/{result.total_max_score}
            </p>
          )}
        </div>
      )}
    </div>
  );
}



