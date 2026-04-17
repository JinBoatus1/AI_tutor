import { useState, useRef, useCallback, useEffect } from "react";
import "./Chat.css";
import { apiUrl } from "./apiBase";
import { useCurriculum } from "./context/CurriculumContext";
import {
  focsOutlineToCurriculum,
  getTextbookTree,
  readSelectedTextbookId,
} from "./learningTextbooks";
import MarkdownMessage from "./MarkdownMessage";
import { getOrCreateStudentId } from "./utils/studentId";
import { useAuth } from "./context/AuthContext";
import ChatHistory from "./ChatHistory";
import LearningBarPanel from "./LearningBarPanel";

/** Left textbook panel width as % of layout (matches state rightPanelWidth). */
const TEXTBOOK_PANEL_MIN_PCT = 15;
const TEXTBOOK_PANEL_MAX_PCT = 90;

const WELCOME_MSG =
  "1) Are you learning new content or reviewing for an exam?\n2) 选择左边你已经学会的 topic。\n3) Which chapter(s) or section(s) do you want to study now?\n\nI will match the right topic using the textbook tree structure, then guide you step by step through tasks.";

/** Client-side cap for chat PDF attach; keep in line with backend MAX_USER_PDF_MB (default 100). */
const MAX_PDF_UPLOAD_BYTES = 100 * 1024 * 1024;

const LEARNING_BAR_WIDTH_KEY = "ai_tutor_learning_bar_width_px";
const LEARNING_BAR_COLLAPSED_KEY = "ai_tutor_learning_bar_collapsed";
const LEARNING_BAR_MIN_PX = 200;
const LEARNING_BAR_MAX_PX = 560;
const LEARNING_BAR_DEFAULT_PX = 280;

function readLearningBarWidthPx(): number {
  try {
    const raw = localStorage.getItem(LEARNING_BAR_WIDTH_KEY);
    const v = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(v)) return LEARNING_BAR_DEFAULT_PX;
    return Math.min(LEARNING_BAR_MAX_PX, Math.max(LEARNING_BAR_MIN_PX, v));
  } catch {
    return LEARNING_BAR_DEFAULT_PX;
  }
}

function readLearningBarCollapsed(): boolean {
  try {
    return localStorage.getItem(LEARNING_BAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function LearningModel() {
  const [studentId] = useState<string>(() => getOrCreateStudentId());
  const { user, token } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([{ sender: "ai", text: WELCOME_MSG }]);
  const { curriculumTree, setCurriculumTree } = useCurriculum();
  const [textbookId, setTextbookId] = useState(() => readSelectedTextbookId());

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
  const [pdfAttachment, setPdfAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [rightPanelWidth, setRightPanelWidth] = useState(67); // ~2/3 textbook, ~1/3 chat
  const layoutRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const tree = getTextbookTree(textbookId);
    setCurriculumTree(focsOutlineToCurriculum(tree));
  }, [textbookId, setCurriculumTree]);

  useEffect(() => {
    const sync = () => setTextbookId(readSelectedTextbookId());
    window.addEventListener("ai-tutor-textbook-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ai-tutor-textbook-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const [learningBarCollapsed, setLearningBarCollapsed] = useState(readLearningBarCollapsed);
  const [learningBarWidthPx, setLearningBarWidthPx] = useState(readLearningBarWidthPx);
  const learningBarDragRef = useRef<{ x: number; width: number } | null>(null);
  const learningBarWidthRef = useRef(learningBarWidthPx);
  learningBarWidthRef.current = learningBarWidthPx;

  const persistLearningBarCollapsed = useCallback((collapsed: boolean) => {
    setLearningBarCollapsed(collapsed);
    try {
      if (collapsed) localStorage.setItem(LEARNING_BAR_COLLAPSED_KEY, "1");
      else localStorage.removeItem(LEARNING_BAR_COLLAPSED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const handleLearningBarResizeMove = useCallback((e: MouseEvent) => {
    const start = learningBarDragRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const next = Math.min(
      LEARNING_BAR_MAX_PX,
      Math.max(LEARNING_BAR_MIN_PX, start.width + dx)
    );
    learningBarWidthRef.current = next;
    setLearningBarWidthPx(next);
  }, []);

  const handleLearningBarResizeEnd = useCallback(() => {
    learningBarDragRef.current = null;
    window.removeEventListener("mousemove", handleLearningBarResizeMove);
    window.removeEventListener("mouseup", handleLearningBarResizeEnd);
    try {
      localStorage.setItem(LEARNING_BAR_WIDTH_KEY, String(learningBarWidthRef.current));
    } catch {
      /* ignore */
    }
  }, [handleLearningBarResizeMove]);

  const handleLearningBarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      learningBarDragRef.current = { x: e.clientX, width: learningBarWidthRef.current };
      window.addEventListener("mousemove", handleLearningBarResizeMove);
      window.addEventListener("mouseup", handleLearningBarResizeEnd);
    },
    [handleLearningBarResizeMove, handleLearningBarResizeEnd]
  );

  useEffect(() => {
    return () => {
      learningBarDragRef.current = null;
      window.removeEventListener("mousemove", handleLearningBarResizeMove);
      window.removeEventListener("mouseup", handleLearningBarResizeEnd);
    };
  }, [handleLearningBarResizeMove, handleLearningBarResizeEnd]);

  const hasLeftPanelContent = Boolean(
    dataMatchedTopic ||
      matchedSection ||
      (referenceSectionPages && referenceSectionPages.length > 0) ||
      (referencePageSnippets && referencePageSnippets.length > 0) ||
      referencePageImage
  );

  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const hadLeftContentRef = useRef(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasLeftPanelContent) {
      if (!hadLeftContentRef.current) {
        setLeftPanelOpen(true);
      }
      hadLeftContentRef.current = true;
    } else {
      hadLeftContentRef.current = false;
    }
  }, [hasLeftPanelContent]);

  useEffect(() => {
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTo({
      top: chatBoxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isAwaitingReply]);

  const showLeftColumn = hasLeftPanelContent && leftPanelOpen;

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const start = resizeStartRef.current;
    if (!start || !layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const deltaPercent = ((e.clientX - start.x) / rect.width) * 100;
    const newWidth = Math.min(
      TEXTBOOK_PANEL_MAX_PCT,
      Math.max(TEXTBOOK_PANEL_MIN_PCT, start.width + deltaPercent)
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

  /** Screen/window capture: grab one frame and attach. */
  const handleScreenshot = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('This browser does not support screen capture. Use "Choose image" or paste a screenshot (Ctrl+V).');
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
        alert('Screenshot failed. Try again, or use "Choose image" / paste (Ctrl+V).');
      }
    }
  }, []);

  /** On paste, attach images from the clipboard if present. */
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
    const pdfSnapshot = pdfAttachment;
    const hasPdf = Boolean(pdfSnapshot);
    if (!userText && !hasImages && !hasPdf) return;
    if (isAwaitingReply) return;

    const displayMessage =
      userText ||
      (hasPdf ? `(PDF: ${pdfSnapshot!.name})` : "") ||
      (hasImages ? "(image)" : "") ||
      "(attachments)";

    addUserMessage(displayMessage, hasImages ? [...attachedImages] : undefined);
    setInput("");
    setAttachedImages([]);
    setPdfAttachment(null);
    setIsAwaitingReply(true);

    const imagesB64 = hasImages
      ? attachedImages.map((dataUrl) =>
          dataUrl.replace(/^data:image\/[^;]+;base64,/, "")
        )
      : undefined;

    let data:
      | {
          matched_topic?: any;
          reply?: string;
          confidence?: number;
          reference_page_image_b64?: string;
          reference_page_snippets_b64?: string[];
          reference_section_pages_b64?: string[];
          session_id?: string;
        }
      | undefined;
    const CHAT_TIMEOUT_MS = 120000;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const resp = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: displayMessage,
          history: messages,
          images_b64: imagesB64,
          pdf_b64: hasPdf ? pdfSnapshot!.dataUrl : undefined,
          student_id: studentId,
          session_id: sessionId,
          textbook_id: textbookId,
        }),
        signal: controller.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;

      data = await resp.json();
      // Track session ID for subsequent messages
      if (data?.session_id && !sessionId) {
        setSessionId(data.session_id);
        setRefreshTrigger((n) => n + 1);
      }
      if (!resp.ok) {
        const detail = (data as any)?.detail || (data as any)?.error || "Backend request failed.";
        addAIMessage(`Backend error: ${detail}`);
        return;
      }
      if (!data) { addAIMessage("Empty response from backend."); return; }

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
        matchCurriculum(userText || displayMessage);
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if ((err as Error).name === "AbortError") {
        addAIMessage("Request timed out (~2 min). Check that the backend is running, or try again later.");
      } else {
        addAIMessage("Request failed—could not reach the backend. Make sure the API server is running.");
      }
    } finally {
      setIsAwaitingReply(false);
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
  const hasUserMessage = messages.some((m) => m.sender === "user");

  const reset = () => {
    setMessages([{ sender: "ai", text: WELCOME_MSG }]);
    setSessionId(null);
    setMatchedSection(null);
    setDataMatchedTopic(null);
    setReferencePageImage(null);
    setReferencePageSnippets(null);
    setReferenceSectionPages(null);
    setSectionPageIndex(0);
    setEnlargedImageSrc(null);
    setPdfAttachment(null);
    setIsAwaitingReply(false);
  };

  const loadSession = async (sid: string) => {
    if (!token) return;
    try {
      const resp = await fetch(apiUrl(`/api/sessions/${sid}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const msgs = (data.messages || []).map((m: any) => ({
        sender: m.sender,
        text: m.text,
      }));
      setMessages(msgs.length > 0 ? msgs : [{ sender: "ai", text: WELCOME_MSG }]);
      setSessionId(sid);
      setMatchedSection(null);
      setDataMatchedTopic(null);
      setReferencePageImage(null);
      setReferencePageSnippets(null);
      setReferenceSectionPages(null);
      setSectionPageIndex(0);
    } catch (e) {
      console.error("Failed to load session", e);
    }
  };

  const handleNewChat = () => {
    reset();
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <div className="learning-page-wrapper">
      {learningBarCollapsed ? (
        <div className="learning-bar-root learning-bar-root--collapsed">
          <button
            type="button"
            className="learning-bar-reveal-btn"
            onClick={() => persistLearningBarCollapsed(false)}
            title="Show learning progress"
            aria-label="Show learning progress"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          className="learning-bar-column"
          style={{ width: learningBarWidthPx, flexShrink: 0 }}
        >
          <div className="learning-bar-column-body">
            <LearningBarPanel
              variant="embed"
              studentId={studentId}
              embedHeaderEnd={
                <button
                  type="button"
                  className="learning-bar-hide-btn"
                  onClick={() => persistLearningBarCollapsed(true)}
                  title="Hide learning progress"
                  aria-label="Hide learning progress"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              }
            />
            <div
              className="resize-handle learning-bar-resize-handle"
              onMouseDown={handleLearningBarResizeStart}
              title="Drag right to widen, left to narrow"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize learning progress panel"
            />
          </div>
        </div>
      )}
      {user && (
        <ChatHistory
          activeSessionId={sessionId}
          onSelectSession={loadSession}
          onNewChat={handleNewChat}
          refreshTrigger={refreshTrigger}
        />
      )}
    <div className="learning-layout" ref={layoutRef}>
      {/* LEFT: textbook / reference (when content exists; can collapse) */}
      {showLeftColumn && (
      <div
        className="right-panel"
        style={{ flex: `0 0 ${rightPanelWidth}%` }}
      >
        {dataMatchedTopic ? (
          <div className="left-panel-topic-bar">
            <div
              className="left-panel-topic-bar-text"
              role="group"
              aria-label="Current textbook section"
            >
              <span className="left-panel-topic-bar-title">
                📖 Textbook: {dataMatchedTopic.name}
              </span>
              <span className="left-panel-topic-bar-sep" aria-hidden="true">
                ·
              </span>
              <span className="left-panel-topic-bar-pages">
                Pages {dataMatchedTopic.start}–{dataMatchedTopic.end}
              </span>
            </div>
            <button
              type="button"
              className="left-panel-hide-btn left-panel-hide-btn--in-bar"
              onClick={() => setLeftPanelOpen(false)}
              title="Hide textbook sidebar"
            >
              Hide
            </button>
          </div>
        ) : (
          <div className="left-panel-hide-row">
            <button
              type="button"
              className="left-panel-hide-btn"
              onClick={() => setLeftPanelOpen(false)}
              title="Hide textbook sidebar"
            >
              Hide
            </button>
          </div>
        )}

        {matchedSection ? (
          <div className="match-box">
            <h4>🔍 Topic: {matchedSection.topic}</h4>
            <h5>📘 Chapter: {matchedSection.chapter}</h5>
            <ul>
              {matchedSection.key_points.map((kp: string, i: number) => (
                <li key={i}>• {kp}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {(referenceSectionPages?.length || referencePageSnippets?.length || referencePageImage) && (
          <div className="reference-page-box reference-page-sidebar">
              {referenceSectionPages?.length ? (
                <>
                  <div className="section-pages-nav">
                    <button
                      type="button"
                      disabled={sectionPageIndex <= 0}
                      onClick={() => setSectionPageIndex((i) => Math.max(0, i - 1))}
                      aria-label="Previous page"
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
                      aria-label="Next page"
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
                    alt={`Textbook snippet ${i + 1}`}
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
                  alt="Textbook reference page"
                  className="reference-page-img reference-img-clickable"
                  onClick={() => setEnlargedImageSrc(referencePageImage)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setEnlargedImageSrc(referencePageImage)}
                />
              ) : null}
          </div>
        )}
      </div>
      )}

      {showLeftColumn && (
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize textbook panel"
      />
      )}

      {/* RIGHT: chat (Ctrl+V to paste screenshots) */}
      <div
        className="chat-panel"
        aria-label="Learning Mode"
        style={
          showLeftColumn
            ? { flex: `1 1 ${100 - rightPanelWidth}%`, minWidth: 0 }
            : { flex: "1 1 100%", minWidth: 0 }
        }
        onPaste={handlePaste}
      >
        {hasLeftPanelContent && !leftPanelOpen && (
          <div className="chat-panel-header-row">
            <button
              type="button"
              className="btn-show-textbook-panel"
              onClick={() => setLeftPanelOpen(true)}
            >
              Show textbook sidebar
            </button>
          </div>
        )}

        {/* Reset button */}
        <div className="reset-box">
          <button type="button" onClick={reset} disabled={isAwaitingReply}>
            I already fully understand — Start a new question
          </button>
        </div>

        {isAwaitingReply && (
          <div className="learning-reply-status" role="status" aria-live="polite">
            <span className="learning-reply-status-spinner" aria-hidden />
            <span className="learning-reply-status-text">
              Looking up the textbook and loading page images…
            </span>
          </div>
        )}

        {/* Messages */}
        <div
          ref={chatBoxRef}
          className={`chat-box${!hasUserMessage ? " chat-box--with-empty" : ""}`}
        >
          {messages.map((m, i) => (
            <div key={i} className={m.sender === "user" ? "msg-user" : "msg-ai"}>
              <MarkdownMessage
                className={
                  m.sender === "user"
                    ? "markdown-message markdown-message--user"
                    : "markdown-message"
                }
                onPickLine={
                  m.sender === "ai"
                    ? (text) => {
                        setInput(text);
                        queueMicrotask(() => chatInputRef.current?.focus());
                      }
                    : undefined
                }
              >
                {m.text}
              </MarkdownMessage>
              {m.images?.length > 0 && (
                <div className="msg-user-images">
                  {m.images.map((src: string, j: number) => (
                    <img key={j} src={src} alt="" className="msg-user-thumb" />
                  ))}
                </div>
              )}
            </div>
          ))}
          {isAwaitingReply && (
            <div className="msg-ai msg-ai-loading-placeholder" aria-busy="true">
              <div className="msg-ai-loading-inner">
                <span className="learning-inline-spinner" aria-hidden />
                <div className="msg-ai-loading-lines">
                  <span className="msg-ai-loading-line" />
                  <span className="msg-ai-loading-line msg-ai-loading-line--short" />
                </div>
              </div>
            </div>
          )}
          {!hasUserMessage && (
            <div className="chat-empty-hint">
              <svg className="chat-empty-icon" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                />
              </svg>
              <p className="chat-empty-text">Type a math question below to get started</p>
            </div>
          )}
        </div>

        {/* Selected image previews */}
        {(attachedImages.length > 0 || pdfAttachment) && (
          <div className="attached-images-row">
            {pdfAttachment && (
              <span className="attached-img-wrap attached-pdf-wrap">
                <span className="attached-pdf-chip" title={pdfAttachment.name}>
                  PDF
                </span>
                <span className="attached-pdf-name">{pdfAttachment.name}</span>
                <button
                  type="button"
                  className="attached-img-remove"
                  onClick={() => setPdfAttachment(null)}
                  aria-label="Remove PDF"
                >
                  ×
                </button>
              </span>
            )}
            {attachedImages.map((src, i) => (
              <span key={i} className="attached-img-wrap">
                <img src={src} alt="" className="attached-img-thumb" />
                <button
                  type="button"
                  className="attached-img-remove"
                  onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove image"
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
          accept="image/*,.pdf,application/pdf"
          multiple
          className="hidden-file-input"
          aria-hidden
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            Array.from(files).forEach((file) => {
              const isPdf =
                file.type === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");
              if (isPdf) {
                if (file.size > MAX_PDF_UPLOAD_BYTES) {
                  alert(`PDF too large (max ${MAX_PDF_UPLOAD_BYTES / (1024 * 1024)} MB).`);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  if (dataUrl) setPdfAttachment({ name: file.name, dataUrl });
                };
                reader.readAsDataURL(file);
                return;
              }
              if (!file.type.startsWith("image/")) return;
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
        <div className="learning-input-shell">
          <div className="input-row">
            <button
              type="button"
              className="input-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Choose image or PDF"
              aria-label="Choose image or PDF"
            >
              <svg className="input-icon-svg" viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="input-icon-btn"
              onClick={handleScreenshot}
              title="Screenshot (pick window or screen)"
              aria-label="Screenshot"
            >
              <svg className="input-icon-svg" viewBox="0 0 24 24" aria-hidden>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
            <input
              ref={chatInputRef}
              type="text"
              className="chat-input-text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isAwaitingReply) handleSend();
                }
              }}
              placeholder="Ask a math question..."
              disabled={isAwaitingReply}
            />
            <button
              type="button"
              className="learning-send-btn"
              onClick={handleSend}
              title="Send"
              aria-label="Send"
              disabled={isAwaitingReply}
            >
              <svg className="learning-send-icon" viewBox="0 0 24 24" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M22 2L15 22l-4-9-9-4 20-7z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    {enlargedImageSrc && (
      <div
        className="reference-image-lightbox"
        onClick={() => setEnlargedImageSrc(null)}
        role="dialog"
        aria-modal="true"
        aria-label="Enlarged image"
      >
        <button
          type="button"
          className="reference-image-lightbox-close"
          onClick={(e) => {
            e.stopPropagation();
            setEnlargedImageSrc(null);
          }}
          aria-label="Close"
        >
          ×
        </button>
        <img
          src={enlargedImageSrc}
          alt="Enlarged view"
          className="reference-image-lightbox-img"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </div>
  );
}
