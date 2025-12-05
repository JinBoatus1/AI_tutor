import { useState } from "react";
import "./Chat.css";
import { useCurriculum } from "./context/CurriculumContext";

export default function LearningModel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [waitingForPolyaChoice, setWaitingForPolyaChoice] = useState(false);
  const [problem, setProblem] = useState("");
  const { curriculumTree } = useCurriculum();

  const [matchedSection, setMatchedSection] = useState<any>(null);

  // ============================
  // UTILS
  // ============================
  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);
  };

  const addAIMessage = (text: string) => {
    if (typeof text !== "string") text = String(text || "");
    setMessages((prev) => [...prev, { sender: "ai", text }]);
  };

  // ============================
  // MAIN SEND
  // ============================
  const handleSend = async () => {
    if (!input.trim()) return;

    addUserMessage(input);
    setProblem(input);
    setInput("");

    // WAIT FOR POLYA CHOICE
    setWaitingForPolyaChoice(true);
  };

  // ============================
  // POLYA RESPONSE
  // ============================
  const handlePolyaChoice = async (choice: string) => {
    setWaitingForPolyaChoice(false);

    addAIMessage(`📘 You selected: ${choice}. Let me help you step by step.`);

    // call backend
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${choice}\nStudent problem: ${problem}`,
          history: messages,
        }),
      });

      const data = await resp.json();
      addAIMessage(data.reply || "[Empty reply]");
    } catch (err) {
      addAIMessage("Error: Could not reach backend.");
    }

    // match curriculum
    if (curriculumTree) {
      matchCurriculum(problem);
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
    setMessages([]);
    setWaitingForPolyaChoice(false);
    setProblem("");
    setMatchedSection(null);
  };

  // ============================
  // POLYA UI COMPONENT
  // ============================
  const PolyaSelector = () => {
    if (!waitingForPolyaChoice) return null;
    return (
      <div className="polya-container">
        <h3>Where do you feel stuck?</h3>

        <button onClick={() => handlePolyaChoice("I don't understand the problem")}>
          I don't understand
        </button>

        <button onClick={() => handlePolyaChoice("I don't know what to do next")}>
          I don't know what to do
        </button>

        <button onClick={() => handlePolyaChoice("I solved it but my answer is wrong")}>
          I solved but answer is wrong
        </button>
      </div>
    );
  };

  return (
    <div className="learning-layout">
      {/* LEFT CHAT AREA */}
      <div className="chat-panel">
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
              <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
            </div>
          ))}

          <PolyaSelector />
        </div>

        {/* Input bar */}
        <div className="input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or continue your question..."
          />
          <button onClick={handleSend}>▶</button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        <h3>📚 Related Section</h3>

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
        ) : (
          <p>No related topic yet. Ask a question!</p>
        )}

        <hr />

        <h3>📖 Curriculum Overview</h3>

        {curriculumTree?.topics ? (
          <div className="tree-scroll">
            {curriculumTree.topics.map((t: any, i: number) => (
              <div key={i} className="topic-box">
                <strong>📌 {t.topic}</strong>
                {t.chapters.map((c: any, j: number) => (
                  <div key={j} className="chappter-box">┗ 📘 {c.chapter}</div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="note">Upload textbook to build curriculum tree →</p>
        )}
      </div>
    </div>
  );
}
