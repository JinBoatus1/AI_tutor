import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="container">
      <h1>🎓 AI Tutor System Demo</h1>
      <p className="subtitle">Empowering Math Learning through AI-guided Teaching and Auto Grading</p>
      <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
        <Link className="example-btn" to="/learning">📘 Go to Learning Model</Link>
        <Link className="example-btn" to="/auto">🧮 Go to Auto Grader</Link>
      </div>
    </div>
  );
}
