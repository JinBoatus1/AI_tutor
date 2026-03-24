import { useState } from "react";
import MathText from "./MathText";

export default function AutoGrader() {
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("text", text);
    files.forEach((f) => formData.append("files", f));

    try {
      const resp = await fetch("http://127.0.0.1:8000/api/grade", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        setResult(`Error: ${data?.detail || data?.error || "Request failed."}`);
      } else {
        setResult(data.reply);
      }
    } catch {
      setResult("Error: Could not reach backend.");
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Auto Grader</h1>

      {/* Gradescope-style two-column layout */}
      <div className="grader-layout">
        {/* Left: submission inputs */}
        <div className="grader-panel">
          <div className="grader-section">
            <h2 className="grader-section-title">Submission</h2>

            <div className="grader-field">
              <label className="grader-label">Grading Rubric / Prompt</label>
              <textarea
                className="grader-textarea"
                placeholder="e.g. Grade this algebra problem, award partial credit for correct setup..."
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="grader-field">
              <label className="grader-label">Student Answer (text)</label>
              <textarea
                className="grader-textarea"
                placeholder="Paste the student's text answer here..."
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="grader-field">
              <label className="grader-label">Uploaded Work (images)</label>
              <label className="upload-zone">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {files.length > 0
                  ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                  : "Drop files or click to upload"}
                <input type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              </label>
              {files.length > 0 && (
                <div className="preview-container" style={{ marginTop: 10 }}>
                  {files.map((f, idx) => (
                    <img key={idx} src={URL.createObjectURL(f)} className="preview-img"
                      alt={`Upload ${idx + 1}`} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="grader-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <><span className="loading" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />Grading...</>
            ) : (
              "Grade Submission"
            )}
          </button>
        </div>

        {/* Right: results */}
        <div className="grader-panel grader-result-panel">
          <h2 className="grader-section-title">Feedback</h2>
          {result ? (
            <div className="grader-feedback">
              <div className="grader-feedback-badge">AI Graded</div>
              <div className="grader-feedback-body">
                <MathText>{result}</MathText>
              </div>
            </div>
          ) : (
            <div className="grader-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M9 15l2 2 4-4"/>
              </svg>
              <p>Submit a response to see grading feedback</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
