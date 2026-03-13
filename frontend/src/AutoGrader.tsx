import { useState } from "react";
import { apiCandidates } from "./api";

export default function AutoGrader() {
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [result, setResult] = useState("");

  const handleSubmit = async () => {
    const formData = new FormData();

    formData.append("prompt", prompt);
    formData.append("text", text);

    files.forEach((f) => {
      formData.append("files", f);   // ← 注意这里用 "files"
    });

    let resp: Response | null = null;
    let data: any = null;
    let lastError = "Backend returned a non-JSON response.";
    for (const endpoint of apiCandidates("/api/grade")) {
      const candidate = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const contentType = candidate.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        resp = candidate;
        data = await candidate.json();
        break;
      }
      lastError = (await candidate.text()).slice(0, 200) || lastError;
    }

    if (!resp) {
      setResult(`Backend error: ${lastError}`);
      return;
    }

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

        <input
          className="file-upload"
          type="file"
          accept="image/*"
          multiple      // ← 关键
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />

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



