'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'What is AAPL trading at?',
  'Tell me about Microsoft',
  "What is Microsoft's latest 10-K?",
  'Compare Apple and Microsoft',
  'What is the latest news about NVIDIA?',
];

export default function FinancialChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Hello! I'm Atlas AI, your financial assistant. Ask me anything about stock prices, company research, SEC filings, document intelligence, or financial comparisons.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:3001/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'default-web-user',
        },
        body: JSON.stringify({ messageText: query }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to reach Atlas AI chat gateway`);
      }

      const data = await res.json();
      const replyText = data.output || 'No response returned.';

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Error communicating with AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Financial AI Assistant</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Llama-3.3 70B
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Grounded financial analyst with real-time Finnhub market data & SEC EDGAR filings.
          </p>
        </div>
      </div>

      {/* Quick Prompts Carousel */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap shrink-0">Quick Prompts:</span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="px-3 py-1 text-xs font-medium rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 whitespace-nowrap transition duration-200 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Window */}
      <div className="flex-1 glass-card rounded-2xl p-6 border border-slate-800 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-5 py-3.5 space-y-1 shadow-md ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] opacity-75 mb-1 space-x-4">
                <span className="font-semibold">{msg.sender === 'user' ? 'You' : 'Atlas AI'}</span>
                <span>{msg.timestamp}</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.text}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-5 py-3 text-xs flex items-center space-x-2 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
              <span>Atlas AI is evaluating query & retrieving market context...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="glass-card rounded-2xl p-3 border border-slate-800 flex items-center space-x-3 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Atlas AI about stocks, financials, SEC filings, or uploaded documents..."
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="px-6 py-3 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition duration-200 shrink-0"
        >
          {loading ? 'Processing...' : 'Send Query'}
        </button>
      </form>
    </div>
  );
}
