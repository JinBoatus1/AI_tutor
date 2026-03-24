import { useState } from "react";
import { useCurriculum } from "./context/CurriculumContext";

export default function UploadTextbook() {
  const { curriculumTree, setCurriculumTree } = useCurriculum();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");

  const [openTopics, setOpenTopics] = useState<Record<number, boolean>>({});
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  const toggleTopic = (i: number) => {
    setOpenTopics((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const toggleChapter = (topicIndex: number, chapterIndex: number) => {
    const key = `${topicIndex}-${chapterIndex}`;
    setOpenChapters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    formData.append("file", file);

    const resp = await fetch("http://127.0.0.1:8000/api/upload_textbook", {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();
    setLoading(false);

    if (data.tree) {
      setCurriculumTree(data.tree);
    } else {
      alert("Failed to build tree.");
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 10 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload Textbook
      </h1>

      <div className="card">
        <label className="field-label">Subject</label>
        <input
          className="input-box"
          style={{ minHeight: "auto", padding: "12px 16px" }}
          placeholder="e.g. Number Theory, Algebra..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <label className="field-label">PDF File</label>
        <label className="upload-zone">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
          {file ? file.name : "Click to select a PDF textbook"}
          <input
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </label>

        <button className="btn-primary" onClick={handleBuildTree} disabled={loading}>
          {loading ? (
            <>
              <span className="loading" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
              Building...
            </>
          ) : (
            "Generate Curriculum Tree"
          )}
        </button>
      </div>

      {/* Curriculum tree */}
      {curriculumTree ? (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
            Curriculum Tree
          </h2>

          <div className="tree-view">
            {curriculumTree.topics?.map((t: any, i: number) => (
              <div key={i} className="tree-topic">
                <div
                  className="tree-topic-header"
                  onClick={() => toggleTopic(i)}
                >
                  <span className="tree-toggle">{openTopics[i] ? "\u25BC" : "\u25B6"}</span>
                  {t.topic}
                </div>

                {openTopics[i] &&
                  t.chapters.map((c: any, j: number) => {
                    const chapKey = `${i}-${j}`;
                    return (
                      <div key={j} className="tree-chapter">
                        <div
                          className="tree-chapter-header"
                          onClick={() => toggleChapter(i, j)}
                        >
                          <span className="tree-toggle">{openChapters[chapKey] ? "\u25BC" : "\u25B6"}</span>
                          {c.chapter}
                        </div>

                        {openChapters[chapKey] && (
                          <ul className="tree-keypoints">
                            {c.key_points.map((kp: string, k: number) => (
                              <li key={k}>{kp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#9ca3af", marginTop: 28, fontSize: 14 }}>
          Upload a textbook to generate its curriculum tree
        </p>
      )}
    </div>
  );
}
