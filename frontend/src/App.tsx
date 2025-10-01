import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
    text: string;
    sender: 'user' | 'ai';
}

function App() {
    const [messages, setMessages] = useState<Message[]>([
        {
            text: "Hi! I'm your Math tutor. I'll guide you through your questions and help you learn math concepts.What question do you have?",
            sender: 'ai'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // auto scroll to the bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();

        // add user msg
        setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
        setInput('');
        setIsLoading(true);

        try {
            // create chat history
            const conversationHistory = messages.slice(1).map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));

            const response = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: conversationHistory
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // ai reply
            setMessages(prev => [...prev, { text: data.reply, sender: 'ai' }]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                text: 'Sorry, I encountered an error. Please make sure the backend server is running!',
                sender: 'ai'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const setExample = (question: string) => {
        setInput(question);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            sendMessage();
        }
    };

    return (
        <div className="app">
            <div className="container">
                <div className="header">
                    <h1>Math AI Tutor</h1>
                    <p className="subtitle">Learn math through guided discovery and Socratic questioning</p>
                </div>

                <div className="chat-container" ref={chatContainerRef}>
                    {messages.map((message, index) => (
                        <div key={index} className={`message ${message.sender}-message`}>
                            <div className="sender">{message.sender === 'user' ? 'You' : 'AI Tutor'}</div>
                            <div className="message-content">{message.text}</div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message ai-message">
                            <div className="sender">AI Tutor</div>
                            <div className="message-content">
                                <div className="loading"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="input-container">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me a math question like: 'How do I solve x² + 5x + 6 = 0?'"
                        maxLength={500}
                        disabled={isLoading}
                    />
                    <button
                        className="send-btn"
                        onClick={sendMessage}
                        disabled={isLoading}
                    >
                        ➤
                    </button>
                </div>

                <div className="example-questions">
                    <h3>💡 Try these example questions:</h3>
                    <div className="example-grid">
                        <button className="example-btn" onClick={() => setExample('How do I solve x² + 5x + 6 = 0?')}>
                            🔢 Quadratic Equation
                        </button>
                        <button className="example-btn" onClick={() => setExample('What is the derivative of x³ + 2x?')}>
                            📈 Derivatives
                        </button>
                        <button className="example-btn" onClick={() => setExample('How do I factor x² - 9?')}>
                            🔨 Factoring
                        </button>
                        <button className="example-btn" onClick={() => setExample('What is the integral of 2x?')}>
                            ∫ Integration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;