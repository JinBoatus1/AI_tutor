import { useState, useRef, useEffect } from 'react';

interface Message {
  text: string;
  sender: 'user' | 'ai';
}

export default function LearningModel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { text: input, sender: 'user' }]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    const res = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, history }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { text: data.reply, sender: 'ai' }]);
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>📘 Learning Model</h1>
      <div className="chat-container" ref={ref}>
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.sender}-message`}>
            <div className="sender">{m.sender === 'user' ? 'You' : 'AI Tutor'}</div>
            <div className="message-content">{m.text}</div>
          </div>
        ))}
        {loading && <div className="loading"></div>}
      </div>
      <div className="input-container">
        <input
          type="text"
          placeholder="Ask or continue your math question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button className="send-btn" onClick={send} disabled={loading}>➤</button>
      </div>
    </div>
  );
}
