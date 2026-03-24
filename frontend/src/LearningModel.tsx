import { useState, useRef, useCallback, useEffect } from "react";
import "./Chat.css";
import MathText from "./MathText";
import { useCurriculum } from "./context/CurriculumContext";

const REF_MIN_PCT = 20;
const REF_MAX_PCT = 55;

export default function LearningModel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { curriculumTree } = useCurriculum();

  const [matchedSection, setMatchedSection] = useState<any>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [enlargedImageSrc, setEnlargedImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // reference panel data (persists even when panel is hidden)
  const [refSnippets, setRefSnippets] = useState<string[]>([]);
  const [refTopicName, setRefTopicName] = useState<string | null>(null);
  const [refPages, setRefPages] = useState<{ start: number; end: number } | null>(null);
  // section pages for multi-page navigation
  const [refSectionPages, setRefSectionPages] = useState<string[]>([]);
  const [sectionPageIndex, setSectionPageIndex] = useState(0);
  // panel visibility — separate from data
  const [refPanelOpen, setRefPanelOpen] = useState(false);
  const hasRefData = refSnippets.length > 0 || refSectionPages.length > 0;
  const showPanel = hasRefData && refPanelOpen;

  // resize state
  const [refPanelPct, setRefPanelPct] = useState(35);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startPct: number } | null>(null);

  const onDragMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d || !bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    // panel is on the right, so moving mouse right = smaller panel
    const deltaPct = ((e.clientX - d.startX) / rect.width) * 100;
    const newPct = Math.min(REF_MAX_PCT, Math.max(REF_MIN_PCT, d.startPct - deltaPct));
    setRefPanelPct(newPct);
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }, [onDragMove]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startPct: refPanelPct };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }, [refPanelPct, onDragMove, onDragEnd]);

  // auto-open panel when new ref data arrives
  useEffect(() => {
    if (hasRefData) setRefPanelOpen(true);
  }, [refSnippets, refSectionPages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ============================
  // IMAGE HELPERS
  // ============================
  const handleScreenshot = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Browser does not support screen capture. Use the image button or paste (Ctrl+V).");
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
      if (!w || !h) { stream.getTracks().forEach((t) => t.stop()); return; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { stream.getTracks().forEach((t) => t.stop()); return; }
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      setAttachedImages((prev) => [...prev, canvas.toDataURL("image/png")]);
    } catch (err) {
      if ((err as Error).name !== "NotAllowedError") {
        console.error("Screenshot failed:", err);
      }
    }
  }, []);

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
  // MESSAGE HELPERS
  // ============================
  const addUserMessage = (text: string, images?: string[]) => {
    setMessages((prev) => [...prev, { sender: "user", text, images }]);
  };

  const addAIMessage = (text: string) => {
    if (typeof text !== "string") text = String(text || "");
    setMessages((prev) => [...prev, { sender: "ai", text }]);
  };

  // ============================
  // SEND
  // ============================
  const handleSend = async () => {
    const userText = input.trim();
    const hasImages = attachedImages.length > 0;
    if (!userText && !hasImages) return;

    addUserMessage(userText || "(image)", hasImages ? [...attachedImages] : undefined);
    setInput("");
    setAttachedImages([]);
    setLoading(true);

    const imagesB64 = hasImages
      ? attachedImages.map((d) => d.replace(/^data:image\/\w+;base64,/, ""))
      : undefined;

    const CHAT_TIMEOUT_MS = 120000;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const resp = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText || "(image)",
          history: messages,
          images_b64: imagesB64,
        }),
        signal: controller.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;

      const data = await resp.json();
      if (!resp.ok) {
        addAIMessage(`Error: ${data?.detail || data?.error || "Request failed."}`);
        setLoading(false);
        return;
      }

      const reply = data.reply || "[Empty reply]";
      const conf = typeof data.confidence === "number" ? data.confidence : null;
      const text = conf !== null ? `${reply}\n\nConfidence: ${conf}/100` : reply;
      addAIMessage(text);

      // update reference panel data
      if (data.reference_section_pages_b64?.length) {
        setRefSectionPages(
          data.reference_section_pages_b64.map((b64: string) => `data:image/png;base64,${b64}`)
        );
        setSectionPageIndex(0);
        setRefSnippets([]);
      } else {
        const newSnippets: string[] = [];
        if (data.reference_page_snippets_b64?.length) {
          data.reference_page_snippets_b64.forEach((b: string) =>
            newSnippets.push(`data:image/png;base64,${b}`)
          );
        } else if (data.reference_page_image_b64) {
          newSnippets.push(`data:image/png;base64,${data.reference_page_image_b64}`);
        }

        if (newSnippets.length > 0) {
          setRefSnippets(newSnippets);
          setRefSectionPages([]);
          // panel auto-opens via useEffect
        }
      }

      if (data.matched_topic) {
        setRefTopicName(data.matched_topic.name || null);
        setRefPages(
          data.matched_topic.start != null
            ? { start: data.matched_topic.start, end: data.matched_topic.end }
            : null
        );
      }

      if (curriculumTree && data?.matched_topic) {
        matchCurriculum(userText);
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if ((err as Error).name === "AbortError") {
        addAIMessage("Request timed out (~2 minutes). Please check if the backend is running, or try again later.");
      } else {
        addAIMessage("Error: Could not reach backend.");
      }
    }
    setLoading(false);
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
        q.split(" ").forEach((w: string) => {
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

  const reset = () => {
    setMessages([]);
    setRefSnippets([]);
    setRefSectionPages([]);
    setRefTopicName(null);
    setRefPages(null);
    setRefPanelOpen(false);
    setMatchedSection(null);
    setSectionPageIndex(0);
    setEnlargedImageSrc(null);
  };

  // ============================
  // RENDER
  // ============================
  return (
    <div className="learn-page" onPaste={handlePaste}>
      {/* Header */}
      <div className="learn-header">
        <div>
          <h1 className="learn-title">Learning Mode</h1>
          <p className="learn-subtitle">Ask a question and get step-by-step guidance</p>
        </div>
        <div className="learn-header-actions">
          {/* Reopen reference button — visible when panel hidden but data exists */}
          {hasRefData && !refPanelOpen && (
            <button className="learn-show-ref" onClick={() => setRefPanelOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Show Reference
            </button>
          )}
          {messages.length > 0 && (
            <button className="learn-reset" onClick={reset}>New Conversation</button>
          )}
        </div>
      </div>

      {/* Body: chat + optional reference panel */}
      <div className={`learn-body ${showPanel ? "learn-body-with-ref" : ""}`} ref={bodyRef}>
        {/* Main chat column */}
        <div className="learn-main" style={showPanel ? { flex: `1 1 ${100 - refPanelPct}%` } : undefined}>
          <div className="learn-chat" ref={chatScrollRef}>
            {messages.length === 0 ? (
              <div className="learn-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>Type a math question below to get started</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`learn-msg ${m.sender === "user" ? "learn-msg-user" : "learn-msg-ai"}`}>
                  {m.sender === "ai" && (
                    <div className="learn-avatar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                      </svg>
                    </div>
                  )}
                  <div className={`learn-bubble ${m.sender === "user" ? "learn-bubble-user" : "learn-bubble-ai"}`}>
                    <MathText>{m.text}</MathText>
                    {m.images?.length > 0 && (
                      <div className="learn-msg-images">
                        {m.images.map((src: string, j: number) => (
                          <img key={j} src={src} alt="" className="learn-msg-thumb"
                            onClick={() => setEnlargedImageSrc(src)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="learn-msg learn-msg-ai">
                <div className="learn-avatar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div className="learn-bubble learn-bubble-ai">
                  <div className="learn-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
          </div>

          {/* Attached image previews */}
          {attachedImages.length > 0 && (
            <div className="learn-attached">
              {attachedImages.map((src, i) => (
                <span key={i} className="learn-attached-wrap">
                  <img src={src} alt="" className="learn-attached-thumb" />
                  <button type="button" className="learn-attached-remove"
                    onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                  >&times;</button>
                </span>
              ))}
            </div>
          )}

          {/* Input bar */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            className="hidden-file-input"
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
          <div className="learn-input-bar">
            <button type="button" className="learn-input-icon"
              onClick={() => fileInputRef.current?.click()} title="Upload image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <button type="button" className="learn-input-icon"
              onClick={handleScreenshot} title="Screenshot">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <input type="text" className="learn-input-text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ask a math question..."
              disabled={loading}
            />
            <button className="learn-send" onClick={handleSend}
              disabled={loading || (!input.trim() && !attachedImages.length)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Drag handle + Reference panel */}
        {showPanel && (
          <>
            <div className="learn-resize-handle" onMouseDown={onDragStart} title="Drag to resize" />
            <aside className="learn-ref-panel" style={{ flex: `0 0 ${refPanelPct}%` }}>
              <div className="learn-ref-panel-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span>Textbook Reference</span>
                <button className="learn-ref-panel-close"
                  onClick={() => setRefPanelOpen(false)}
                  title="Close panel">&times;</button>
              </div>

              {refTopicName && (
                <div className="learn-ref-meta">
                  <span className="learn-ref-meta-name">{refTopicName}</span>
                  {refPages && <span className="learn-ref-meta-pages">pp. {refPages.start}&ndash;{refPages.end}</span>}
                </div>
              )}

              {matchedSection && (
                <div className="learn-ref-meta">
                  <span className="learn-ref-meta-name">{matchedSection.topic} &mdash; {matchedSection.chapter}</span>
                </div>
              )}

              <div className="learn-ref-scroll">
                {refSectionPages.length > 0 ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 8px" }}>
                      <button type="button" disabled={sectionPageIndex <= 0}
                        onClick={() => setSectionPageIndex((i) => Math.max(0, i - 1))}>
                        &lsaquo; Prev
                      </button>
                      <span>Page {sectionPageIndex + 1} of {refSectionPages.length}</span>
                      <button type="button" disabled={sectionPageIndex >= refSectionPages.length - 1}
                        onClick={() => setSectionPageIndex((i) => Math.min(refSectionPages.length - 1, i + 1))}>
                        Next &rsaquo;
                      </button>
                    </div>
                    <img src={refSectionPages[sectionPageIndex]} alt={`Section page ${sectionPageIndex + 1}`}
                      className="learn-ref-img"
                      onClick={() => setEnlargedImageSrc(refSectionPages[sectionPageIndex])} />
                  </>
                ) : (
                  refSnippets.map((src, i) => (
                    <img key={i} src={src} alt={`Reference ${i + 1}`}
                      className="learn-ref-img"
                      onClick={() => setEnlargedImageSrc(src)} />
                  ))
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Lightbox */}
      {enlargedImageSrc && (
        <div className="learn-lightbox" onClick={() => setEnlargedImageSrc(null)}>
          <button type="button" className="learn-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setEnlargedImageSrc(null); }}>&times;</button>
          <img src={enlargedImageSrc} alt="enlarged" className="learn-lightbox-img"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
