import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader, Zap, Cpu } from 'lucide-react';
import { useWorker } from '../App';
import { coachAPI } from '../lib/api';

const PROMPTS = [
  'What skills should I focus on first?',
  'How long will my transition take?',
  'Which employers are hiring right now?',
  'Build me a salary projection',
];

const PROVIDER_LABELS = {
  groq: { label: 'Groq · Llama 3.3 70B', color: '#F97316' },
  gemini: { label: 'Google Gemini 2.0', color: '#4285F4' },
  ollama: { label: 'Ollama · Local', color: '#059669' },
  fallback: { label: 'Smart fallback', color: '#9CA3AF' },
};

export default function Coach() {
  const { worker } = useWorker();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!worker) return;
    coachAPI.history(worker.id).then(r => {
      const hist = [];
      r.data.forEach(s => {
        hist.push({ role: 'user', text: s.message, ts: s.created_at });
        hist.push({ role: 'assistant', text: s.response, ts: s.created_at });
      });
      if (hist.length === 0) {
        hist.push({
          role: 'assistant',
          text: `Hi ${worker.name?.split(' ')[0]}! I'm Alex, your PivotPath AI career coach. I'm here to help you navigate your transition to a new, in-demand role.\n\nTell me: what kind of work excites you most? Or ask me anything about skills, timelines, or the job market.`,
        });
      }
      setMessages(hist);
      setHistoryLoaded(true);
    }).catch(() => setHistoryLoaded(true));

    // Fetch AI provider status
    fetch('/api/coach/status').then(r => r.json()).then(setAiStatus).catch(() => {});
  }, [worker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await coachAPI.chat(worker.id, msg);
      setMessages(m => [...m, { role: 'assistant', text: res.data.response }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: "Sorry, I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const provider = aiStatus ? PROVIDER_LABELS[aiStatus.active_provider] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700 }}>Alex — AI Career Coach</h1>
              <div style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                Online · Powered by PivotPath signal data
              </div>
            </div>
          </div>
          {/* AI provider badge */}
          {provider && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: `${provider.color}15`, border: `1px solid ${provider.color}40` }}>
              <Cpu size={12} color={provider.color} />
              <span style={{ fontSize: 11, fontWeight: 600, color: provider.color }}>{provider.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {PROMPTS.map(p => (
            <button key={p} onClick={() => send(p)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)'
            }}>
              <Zap size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />{p}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!historyLoaded && (
          <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar assistant />
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
              <span style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(j => (
                  <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gray-400)', display: 'inline-block', animation: `bounce 1s ease-in-out ${j * 0.15}s infinite` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, padding: '12px 0' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask Alex anything about your career transition..."
          style={{ flex: 1, borderRadius: 24, padding: '10px 18px', border: '1.5px solid var(--gray-200)' }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          width: 44, height: 44, borderRadius: '50%',
          background: input.trim() ? 'var(--brand)' : 'var(--gray-200)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Send size={16} color={input.trim() ? '#fff' : 'var(--gray-400)'} />
        </button>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Avatar({ assistant }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: assistant ? 'var(--brand)' : 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {assistant ? <Bot size={14} color="#fff" /> : <User size={14} color="var(--gray-600)" />}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
      <Avatar assistant={!isUser} />
      <div style={{
        maxWidth: '78%', padding: '10px 14px', lineHeight: 1.65, fontSize: 14,
        background: isUser ? 'var(--brand)' : '#fff',
        color: isUser ? '#fff' : 'var(--gray-800)',
        borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
        border: isUser ? 'none' : '1px solid var(--gray-200)',
        whiteSpace: 'pre-wrap'
      }}>
        {msg.text}
      </div>
    </div>
  );
}
