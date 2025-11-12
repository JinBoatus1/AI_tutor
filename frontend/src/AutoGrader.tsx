import { useState } from 'react';

export default function AutoGrader() {
  const [prompt, setPrompt] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt && !text && !file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('text', text);
    if (file) formData.append('file', file);

    const res = await fetch('http://localhost:8000/api/grade', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setResult(data.reply);
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>🧮 Auto Grader</h1>
      <textarea placeholder="Enter grading prompt..." value={prompt} onChange={e => setPrompt(e.target.value)} />
      <textarea placeholder="Student text answer..." value={text} onChange={e => setText(e.target.value)} />
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <button onClick={handleSubmit} disabled={loading}>Run Auto Grader</button>
      {loading && <p>⏳ Grading in progress...</p>}
      {result && <div className="result-box"><strong>Result:</strong><p>{result}</p></div>}
    </div>
  );
}
