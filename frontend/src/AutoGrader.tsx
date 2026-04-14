import { useState, useRef } from "react";
import { API_BASE } from "./apiBase";

export default function AutoGrader() {
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState("");

  const handleSubmit = async () => {
    const formData = new FormData();

    formData.append("prompt", prompt);
    formData.append("text", text);

    files.forEach((f) => {
      formData.append("files", f); // field name must be "files" for the API
    });

    const resp = await fetch(`${API_BASE}/api/grade`, {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    if (!resp.ok) {
      const detail = data?.detail || data?.error || "Backend request failed.";
      setResult(`Backend error: ${detail}`);
      return;
    }
    setResult(data.reply);
  };

  return (
    <div className="page-container">

      <h1 className="page-title">Auto Grader</h1>

      <div className="card">

        <textarea
          className="input-box"
          placeholder="Enter grading prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <textarea
          className="input-box"
          placeholder="Student text answer..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="autograder-file-row">
          <input
            ref={fileInputRef}
            className="autograder-file-input-hidden"
            type="file"
            accept="image/*"
            multiple
            aria-label="Attach answer images"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <button
            type="button"
            className="autograder-file-choose-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose images
          </button>
          <span className="autograder-file-status">
            {files.length === 0
              ? "No files selected"
              : `${files.length} file(s): ${files.map((f) => f.name).join(", ")}`}
          </span>
        </div>

        <div className="preview-container">
          {files.map((f, idx) => (
            <img
              key={idx}
              src={URL.createObjectURL(f)}
              className="preview-img"
            />
          ))}
        </div>


        <button className="btn-primary" onClick={handleSubmit}>
          Run Auto Grader
        </button>
      </div>

      {result && (
        <div className="result-box">
          <h3>Grading Result</h3>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}



