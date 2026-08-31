'use client';
import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'model'; text: string };
type Session = { id: string; title: string; createdAt: string };

export default function EmbeddedChat({ folderId, persona }: { folderId: string, persona: 'Pal' | 'VM' }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // UI Rebranding
  const uiName = persona === 'Pal' ? 'Pal Tutor' : 'Aura';
  const uiIcon = persona === 'Pal' ? '🧠' : '🌿';
  const uiColor = persona === 'Pal' ? 'bg-indigo-600' : 'bg-emerald-600';
  const uiTagline = persona === 'Pal' ? 'Your elite academic tutor.' : 'Your calming mental wellbeing space.';

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    fetch(`/api/chat?folderId=${folderId}&persona=${persona}`)
      .then(res => res.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setActiveSessionId(null); });
  }, [folderId, persona]);

  useEffect(() => {
    if (!activeSessionId || activeSessionId === 'new') {
      setHistory(activeSessionId === 'new' ? [{ role: 'model', text: persona === 'Pal' ? "What are we studying today?" : "Take a deep breath. How are you feeling today?" }] : []);
      return;
    }
    fetch(`/api/chat?sessionId=${activeSessionId}`).then(res => res.json()).then(data => setHistory(Array.isArray(data) ? data : []));
  }, [activeSessionId, persona]);

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/chat?sessionId=${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history, persona, folderId, sessionId: activeSessionId === 'new' ? null : activeSessionId })
      });
      const data = await res.json();
      setHistory(prev => [...prev, { role: 'model', text: data.reply }]);
      if (data.sessionId && activeSessionId === 'new') {
        setActiveSessionId(data.sessionId);
        fetch(`/api/chat?folderId=${folderId}&persona=${persona}`).then(r => r.json()).then(setSessions);
      }
    } catch {
      setHistory(prev => [...prev, { role: 'model', text: '⚠️ Error connecting to AI.' }]);
    } finally { setIsLoading(false); }
  };

  if (!activeSessionId) {
    return (
      <div className="flex flex-col h-full items-center justify-center space-y-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">{uiIcon}</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{uiName}</h2>
          <p className="text-slate-500 mb-8">{uiTagline}</p>
          <button onClick={() => setActiveSessionId('new')} className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 ${uiColor}`}>
            + Start New Conversation
          </button>
        </div>
        <div className="w-full max-w-md mt-10">
          <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Past Conversations</h4>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="group flex justify-between items-center w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg overflow-hidden">
                <button onClick={() => setActiveSessionId(s.id)} className="flex-1 p-4 text-sm text-slate-700 font-medium truncate text-left">💬 {s.title}</button>
                <button onClick={(e) => handleDeleteSession(e, s.id)} className="p-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">🗑️</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <button onClick={() => setActiveSessionId(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">← Back</button>
        <span className="font-bold text-slate-700">{uiIcon} {uiName}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? `${uiColor} text-white rounded-br-sm` : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl rounded-bl-sm text-sm">Thinking...</div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." disabled={isLoading} className="flex-1 bg-slate-100 border-none rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`px-6 rounded-xl text-white font-bold transition-transform hover:scale-105 disabled:opacity-50 ${uiColor}`}>Send</button>
      </div>
    </div>
  );
}
