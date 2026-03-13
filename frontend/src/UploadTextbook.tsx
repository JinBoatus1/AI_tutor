import { useState } from "react";
import { useCurriculum } from "./context/CurriculumContext";
import { apiCandidates } from "./api";

export default function UploadTextbook() {
  const { curriculumTree, setCurriculumTree } = useCurriculum();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");

  // 控制折叠
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

    let resp: Response | null = null;
    let data: any = null;
    let lastError = "Backend returned a non-JSON response.";
    for (const endpoint of apiCandidates("/api/upload_textbook")) {
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
      setLoading(false);
      alert(lastError);
      return;
    }

    setLoading(false);

    if (!resp.ok) {
      const detail = data?.detail || data?.error || "Backend request failed.";
      alert(detail);
      return;
    }

    if (data.tree) {
      setCurriculumTree(data.tree);
      console.log("📚 Curriculum Tree Saved:", data.tree);
    } else {
      alert("Failed to build tree.");
    }
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

      {file && <div className="pdf-preview">📄 {file.name}</div>}

      <button className="btn-primary" onClick={handleBuildTree} disabled={loading}>
        {loading ? "Building..." : "Generate Curriculum Tree"}
      </button>

      {/* 分割线 */}
      <hr style={{ margin: "30px 0" }} />

      {/* 树形结构 */}
      {curriculumTree ? (
        <>
          <h2>🌳 Curriculum Tree</h2>

          <div style={{ background: "#fafafa", padding: "15px", borderRadius: 12 }}>
            {curriculumTree.topics?.map((t: any, i: number) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div
                  style={{ cursor: "pointer", fontWeight: 600 }}
                  onClick={() => toggleTopic(i)}
                >
                  {openTopics[i] ? "" : ""} {t.topic}
                </div>

                {openTopics[i] &&
                  t.chapters.map((c: any, j: number) => {
                    const chapKey = `${i}-${j}`;
                    return (
                      <div key={j} style={{ marginLeft: 20 }}>
                        <div
                          style={{ cursor: "pointer", color: "#333" }}
                          onClick={() => toggleChapter(i, j)}
                        >
                          {openChapters[chapKey] ? "▼" : "▶"} {c.chapter}
                        </div>

                        {openChapters[chapKey] && (
                          <ul style={{ marginLeft: 30, color: "#555" }}>
                            {c.key_points.map((kp: string, k: number) => (
                              <li key={k}>• {kp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>⬆ Upload textbook to see tree</p>
      )}
    </div>
  );
}
