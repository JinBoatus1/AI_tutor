import { useState, useRef, useCallback } from "react";
import "./Chat.css";
import { useCurriculum } from "./context/CurriculumContext";
import MathText from "./MathText";

const RIGHT_PANEL_MIN = 20;
const RIGHT_PANEL_MAX = 55;

const WELCOME_MSG =
  "Hi! Which chapter do you want to learn or review? Type a chapter name or topic (e.g. \"Chapter 5\", \"Induction\", \"Proofs\"), and I’ll look up the textbook pages and walk you through the most important formulas and definitions.";

export default function LearningModel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([{ sender: "ai", text: WELCOME_MSG }]);
  const { curriculumTree } = useCurriculum();

  const [matchedSection, setMatchedSection] = useState<any>(null);
  const [dataMatchedTopic, setDataMatchedTopic] = useState<{
    name: string;
    start: number;
    end: number;
  } | null>(null);
  const [referencePageImage, setReferencePageImage] = useState<string | null>(null);
  const [referencePageSnippets, setReferencePageSnippets] = useState<string[] | null>(null);
  const [referenceSectionPages, setReferenceSectionPages] = useState<string[] | null>(null);
  const [sectionPageIndex, setSectionPageIndex] = useState(0);
  const [enlargedImageSrc, setEnlargedImageSrc] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rightPanelWidth, setRightPanelWidth] = useState(67); // 左侧书页约 2/3，右侧对话 1/3
  const layoutRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const start = resizeStartRef.current;
    if (!start || !layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const deltaPercent = ((e.clientX - start.x) / rect.width) * 100;
    const newWidth = Math.min(
      RIGHT_PANEL_MAX,
      Math.max(RIGHT_PANEL_MIN, start.width + deltaPercent)
    );
    setRightPanelWidth(newWidth);
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeStartRef.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeStartRef.current = { x: e.clientX, width: rightPanelWidth };
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    },
    [rightPanelWidth, handleResizeMove, handleResizeEnd]
  );

  /** 点击截图：屏幕/窗口捕获，取一帧加入附件 */
  const handleScreenshot = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("当前浏览器不支持屏幕截图，请用「选择图片」或粘贴截图 (Ctrl+V)");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      const dataUrl = canvas.toDataURL("image/png");
      setAttachedImages((prev) => [...prev, dataUrl]);
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") {
        console.error("Screenshot failed:", err);
        alert("截图失败，请重试或使用「选择图片」/ 粘贴 (Ctrl+V)");
      }
    }
  }, []);

  /** 粘贴时若剪贴板有图片则加入附件 */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (dataUrl) setAttachedImages((prev) => [...prev, dataUrl]);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  // ============================
  // UTILS
  // ============================
  const addUserMessage = (text: string, images?: string[]) => {
    setMessages((prev) => [...prev, { sender: "user", text, images }]);
  };

  const addAIMessage = (text: string) => {
    if (typeof text !== "string") text = String(text || "");
    setMessages((prev) => [...prev, { sender: "ai", text }]);
  };

  // ============================
  // SEND MESSAGE → BACKEND → SHOW REPLY
  // ============================
  const handleSend = async () => {
    const userText = input.trim();
    const hasImages = attachedImages.length > 0;
    if (!userText && !hasImages) return;

    addUserMessage(userText || "(图片)", hasImages ? [...attachedImages] : undefined);
    setInput("");
    setAttachedImages([]);

    const imagesB64 = hasImages
      ? attachedImages.map((dataUrl) => dataUrl.replace(/^data:image\/\w+;base64,/, ""))
      : undefined;

    let data:
      | {
          matched_topic?: any;
          reply?: string;
          confidence?: number;
          reference_page_image_b64?: string;
          reference_page_snippets_b64?: string[];
          reference_section_pages_b64?: string[];
        }
      | undefined;
    const CHAT_TIMEOUT_MS = 120000;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const resp = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText || "(图片)",
          history: messages,
          images_b64: imagesB64,
        }),
        signal: controller.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;

      data = await resp.json();
      if (!resp.ok) {
        const detail = (data as any)?.detail || (data as any)?.error || "Backend request failed.";
        addAIMessage(`Backend error: ${detail}`);
        return;
      }

      const reply = data.reply || "[Empty reply]";
      const conf = typeof data.confidence === "number" ? data.confidence : null;

      if (data.matched_topic) {
        setDataMatchedTopic({
          name: data.matched_topic.name,
          start: data.matched_topic.start,
          end: data.matched_topic.end,
        });
      } else {
        setDataMatchedTopic(null);
        setMatchedSection(null);
      }
      if (data.reference_section_pages_b64?.length) {
        setReferenceSectionPages(
          data.reference_section_pages_b64.map((b64) => `data:image/png;base64,${b64}`)
        );
        setSectionPageIndex(0);
        setReferencePageSnippets(null);
        setReferencePageImage(null);
      } else if (data.reference_page_snippets_b64?.length) {
        setReferencePageSnippets(
          data.reference_page_snippets_b64.map((b64) => `data:image/png;base64,${b64}`)
        );
        setReferencePageImage(null);
        setReferenceSectionPages(null);
      } else if (data.reference_page_image_b64) {
        setReferencePageImage(`data:image/png;base64,${data.reference_page_image_b64}`);
        setReferencePageSnippets(null);
        setReferenceSectionPages(null);
      } else {
        setReferencePageImage(null);
        setReferencePageSnippets(null);
        setReferenceSectionPages(null);
      }

      if (conf === null) {
        addAIMessage(reply);
      } else {
        addAIMessage(`${reply}\n\nConfidence: ${conf}/100`);
      }

      if (curriculumTree && data?.matched_topic) {
        matchCurriculum(userText);
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if ((err as Error).name === "AbortError") {
        addAIMessage("请求超时（约 2 分钟）。请检查后端是否正常运行，或稍后重试。");
      } else {
        addAIMessage("请求失败，无法连接后端。请确认后端已在 http://127.0.0.1:8000 运行。");
      }
    }
  };

  // ============================
  // MATCH CURRICULUM SECTION
  // ============================
  const matchCurriculum = (question: string) => {
    if (
      !curriculumTree ||
      typeof curriculumTree !== "object" ||
      !Array.isArray(curriculumTree.topics)
    ) {
      return;
    }

    let best: any = null;
    let score = 0;

    curriculumTree.topics.forEach((t: any) => {
      if (!Array.isArray(t.chapters)) return;

      t.chapters.forEach((c: any) => {
        const text = (c.chapter + " " + c.key_points.join(" ")).toLowerCase();
        const q = question.toLowerCase();

        let s = 0;
        q.split(" ").forEach((w) => {
          if (text.includes(w)) s++;
        });

        if (s > score) {
          score = s;
          best = { topic: t.topic, chapter: c.chapter, key_points: c.key_points };
        }
      });
    });

    setMatchedSection(best);
  };

  // ============================
  // CLEAR EVERYTHING
  // ============================
  const reset = () => {
    setMessages([{ sender: "ai", text: WELCOME_MSG }]);
    setMatchedSection(null);
    setDataMatchedTopic(null);
    setReferencePageImage(null);
    setReferencePageSnippets(null);
    setReferenceSectionPages(null);
    setSectionPageIndex(0);
  };

  return (
    <div className="learning-page-wrapper">
    <div className="learning-layout" ref={layoutRef}>
      {/* LEFT: 书页 / 参考区 */}
      <div
        className="right-panel"
        style={{ flex: `0 0 ${rightPanelWidth}%` }}
      >
        <h3>📚 Related Section</h3>

        {dataMatchedTopic ? (
          <div className="match-box">
            <h4>📖 Textbook: {dataMatchedTopic.name}</h4>
            <p>Pages {dataMatchedTopic.start}–{dataMatchedTopic.end}</p>
          </div>
        ) : matchedSection ? (
          <div className="match-box">
            <h4>🔍 Topic: {matchedSection.topic}</h4>
            <h5>📘 Chapter: {matchedSection.chapter}</h5>
            <ul>
              {matchedSection.key_points.map((kp: string, i: number) => (
                <li key={i}>• {kp}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>No related topic yet. Ask a question!</p>
        )}

        {(referenceSectionPages?.length || referencePageSnippets?.length || referencePageImage) && (
          <>
            <hr />
            <h3>📖 Original page in Textbook</h3>
            <div className="reference-page-box reference-page-sidebar">
              {referenceSectionPages?.length ? (
                <>
                  <div className="section-pages-nav">
                    <button
                      type="button"
                      disabled={sectionPageIndex <= 0}
                      onClick={() => setSectionPageIndex((i) => Math.max(0, i - 1))}
                      aria-label="上一页"
                    >
                      ‹ Prev
                    </button>
                    <span className="section-pages-info">
                      Page {sectionPageIndex + 1} of {referenceSectionPages.length}
                    </span>
                    <button
                      type="button"
                      disabled={sectionPageIndex >= referenceSectionPages.length - 1}
                      onClick={() =>
                        setSectionPageIndex((i) =>
                          Math.min(referenceSectionPages.length - 1, i + 1)
                        )
                      }
                      aria-label="下一页"
                    >
                      Next ›
                    </button>
                  </div>
                  <img
                    src={referenceSectionPages[sectionPageIndex]}
                    alt={`Section page ${sectionPageIndex + 1}`}
                    className="reference-page-img reference-img-clickable"
                    onClick={() => setEnlargedImageSrc(referenceSectionPages[sectionPageIndex])}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setEnlargedImageSrc(referenceSectionPages[sectionPageIndex])
                    }
                  />
                </>
              ) : referencePageSnippets?.length ? (
                referencePageSnippets.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`教材片段 ${i + 1}`}
                    className="reference-page-img reference-snippet reference-img-clickable"
                    onClick={() => setEnlargedImageSrc(src)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setEnlargedImageSrc(src)}
                  />
                ))
              ) : referencePageImage ? (
                <img
                  src={referencePageImage}
                  alt="教材参考页"
                  className="reference-page-img reference-img-clickable"
                  onClick={() => setEnlargedImageSrc(referencePageImage)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setEnlargedImageSrc(referencePageImage)}
                />
              ) : null}
            </div>
            {enlargedImageSrc && (
              <div
                className="reference-image-lightbox"
                onClick={() => setEnlargedImageSrc(null)}
                role="dialog"
                aria-modal="true"
                aria-label="放大查看图片"
              >
                <button
                  type="button"
                  className="reference-image-lightbox-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnlargedImageSrc(null);
                  }}
                  aria-label="关闭"
                >
                  ×
                </button>
                <img
                  src={enlargedImageSrc}
                  alt="放大查看"
                  className="reference-image-lightbox-img"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 可拖拽缩放条 */}
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
        title="拖拽调整书页区宽度"
      />

      {/* RIGHT: 对话区（支持 Ctrl+V 粘贴截图） */}
      <div
        className="chat-panel"
        style={{ flex: `1 1 ${100 - rightPanelWidth}%`, minWidth: 0 }}
        onPaste={handlePaste}
      >
        <h1 className="title">Learning Mode</h1>

        {/* Reset button */}
        <div className="reset-box">
          <button onClick={reset}>
            🔄 I already fully understand — Start a new question
          </button>
        </div>

        {/* Messages */}
        <div className="chat-box">
          {messages.map((m, i) => (
            <div key={i} className={m.sender === "user" ? "msg-user" : "msg-ai"}>
              <p><MathText>{m.text}</MathText></p>
              {m.images?.length > 0 && (
                <div className="msg-user-images">
                  {m.images.map((src: string, j: number) => (
                    <img key={j} src={src} alt="" className="msg-user-thumb" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 已选图片预览 */}
        {attachedImages.length > 0 && (
          <div className="attached-images-row">
            {attachedImages.map((src, i) => (
              <span key={i} className="attached-img-wrap">
                <img src={src} alt="" className="attached-img-thumb" />
                <button
                  type="button"
                  className="attached-img-remove"
                  onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="移除图片"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input bar */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden-file-input"
          aria-hidden
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            Array.from(files).forEach((file) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                if (dataUrl) setAttachedImages((prev) => [...prev, dataUrl]);
              };
              reader.readAsDataURL(file);
            });
            e.target.value = "";
          }}
        />
        <div className="input-row">
          <button
            type="button"
            className="input-add-image-btn"
            onClick={() => fileInputRef.current?.click()}
            title="选择本地图片"
          >
            📷
          </button>
          <button
            type="button"
            className="input-add-image-btn"
            onClick={handleScreenshot}
            title="截屏（选择窗口/屏幕）"
          >
            🖥️
          </button>
          <input
            type="text"
            className="chat-input-text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask or continue your question..."
          />
          <button onClick={handleSend}>▶</button>
        </div>
      </div>
    </div>
    </div>
  );
}
