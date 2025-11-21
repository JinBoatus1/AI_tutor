import { useState } from "react";
import { useCurriculum } from "./context/CurriculumContext";

export default function UploadTextbook() {
  const { setCurriculumTree } = useCurriculum();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const handleBuildTree = async () => {
    if (!file) {
      alert("Please upload a PDF textbook first.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("file", file); // VERY IMPORTANT! This must be “file”

    console.log("Sending file:", file);

    const resp = await fetch("http://127.0.0.1:8000/api/upload_textbook", {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    setLoading(false);
    console.log("BACKEND RESPONSE:", data);

    if (!data.tree) {
      alert("Failed to parse uploaded textbook. Try a different file.");
      return;
    }

    try {
      const parsed = JSON.parse(data.tree);
      setCurriculumTree(parsed);
    } catch (err) {
      console.error("❌ JSON parse failed:", err);
      alert("Text extracted but cannot form valid curriculum JSON.");
    }

    alert("📚 Curriculum Tree Created Successfully!");
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Upload Textbook</h1>

      <input
        className="input-box"
        placeholder="Subject (optional)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <input
        type="file"
        accept=".pdf"
        onChange={handleUpload}
        className="file-upload"
      />

      {file && (
        <div className="pdf-preview">📄 {file.name}</div>
      )}

      <button className="btn-primary" onClick={handleBuildTree} disabled={loading}>
        {loading ? "Building Curriculum Tree..." : "Generate Curriculum Tree"}
      </button>
    </div>
  );
}
