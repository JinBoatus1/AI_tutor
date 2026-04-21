import { useMemo, useRef, useState } from "react";
import { apiUrl } from "./api";
import "./AutoGrader.css";

type ScoreMode = "absolute" | "percentage";

type ScoreItem = {
  score: number;
  mode: ScoreMode;
  max_score?: number | null;
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
    <div className="autograder-page">
      <div className="autograder-page-inner">
        <header className="autograder-hero">
          <h1 className="autograder-hero-title">Auto Grader</h1>
          <p className="autograder-hero-sub">
            上传题目与答案 PDF 或图片，与 Learning Mode 使用同一套界面基调。支持自动拆分小题并打分。
          </p>
        </header>

        <div className="autograder-card">
          <div className="autograder-panel">
            <span className="autograder-panel-label">Question 文件</span>
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
              <span
                className={`autograder-file-status${questionFile ? " autograder-file-status--picked" : ""}`}
              >
                {questionFile ? questionFile.name : "未选择文件"}
              </span>
            </div>
          </div>

          <div className="autograder-panel">
            <span className="autograder-panel-label">Answer 文件</span>
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
              <span
                className={`autograder-file-status${answerFile ? " autograder-file-status--picked" : ""}`}
              >
                {answerFile ? answerFile.name : "未选择文件"}
              </span>
            </div>
          </div>

          <button type="button" className="autograder-submit" onClick={handleSubmit} disabled={grading}>
            {grading ? "评分中…" : "开始评分"}
          </button>

          {error ? <p className="autograder-error-text">{error}</p> : null}
        </div>

        {result ? (
          <section className="autograder-result" aria-labelledby="autograder-result-heading">
            <h3 id="autograder-result-heading">评分结果</h3>
            <p className="autograder-result-meta">paper_id: {result.paper_id}</p>
            <p className="autograder-result-meta">识别题目数: {result.pair_count}</p>

            <div className="autograder-score-list">
              {sortedScores.map(([qid, item]) => {
                const display =
                  item.mode === "absolute" && item.max_score != null
                    ? `${item.score}/${item.max_score}`
                    : `${item.score}%`;
                return (
                  <div className="autograder-score-item" key={qid}>
                    <span>Q{qid}</span>
                    <strong>{display}</strong>
                  </div>
                );
              })}
            </div>

            {result.all_absolute && result.total_score != null && result.total_max_score != null ? (
              <p className="autograder-total-score">
                总分: {result.total_score}/{result.total_max_score}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}



