import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader, Zap, Cpu, Route, ArrowRight, Activity } from 'lucide-react';
import { useWorker } from '../App';
import { coachAPI } from '../lib/api';

const BASE = process.env.REACT_APP_API_URL || '';

const PROMPTS = [
  'What skills should I focus on first?',
  'Show me my career path',
  'How long will my transition take?',
  'Which employers are hiring right now?',
];

const INTENT_LABELS = {
  SKILL_ADVICE: { label: 'Skill advice', color: '#7C3AED', bg: '#F5F3FF' },
  SALARY_QUESTION: { label: 'Salary insight', color: '#2D9B6F', bg: '#E6F5EF' },
  CAREER_PATH: { label: 'Career path', color: '#1F4D8C', bg: '#E8EEFA' },
  EMOTIONAL_SUPPORT: { label: 'Support mode', color: '#D97706', bg: '#FFFBEB' },
  CREDENTIAL_QUESTION: { label: 'Credentials', color: '#059669', bg: '#ECFDF5' },
  JOB_MARKET: { label: 'Job market', color: '#0369A1', bg: '#E0F2FE' },
  PROGRESS_CHECK: { label: 'Progress', color: '#6D28D9', bg: '#EDE9FE' },
  GENERAL: { label: 'General', color: '#6B7280', bg: '#F3F4F6' },
};

export default function Coach() {
  const { worker } = useWorker();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [careerPath, setCareerPath] = useState(null);
  const [lastIntent, setLastIntent] = useState(null);
  const [lastSentiment, setLastSentiment] = useState(null);
  const [useStreaming, setUseStreaming] = useState(true);
  const bottomRef = useRef(null);
  const token = localStorage.getItem('pp_token');

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
          text: `Hi ${worker.name?.split(' ')[0]}! I'm Alex, your PivotPath AI coach — powered by hybrid RAG memory, a career graph, knowledge graph, and intent-aware routing.\n\nI remember everything we've discussed and I can detect when you need practical advice vs emotional support.\n\nWhat would you like to explore?`,
        });
      }
      setMessages(hist);
      setHistoryLoaded(true);
    }).catch(() => setHistoryLoaded(true));

    coachAPI.status().then(r => setAiStatus(r.data)).catch(() => {});

    if (worker.current_role && worker.target_role) {
      coachAPI.careerPath(worker.current_role, worker.target_role)
        .then(r => setCareerPath(r.data)).catch(() => {});
    }
  }, [worker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Upgrade 25: Streaming send ──────────────────────────────────────────
  const sendStreaming = async (msg) => {
    setMessages(m => [...m, { role: 'user', text: msg }, { role: 'assistant', text: '', streaming: true }]);
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/coach/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ worker_id: worker.id, message: msg }),
      });

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data?.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              setMessages(m => {
                const updated = [...m];
                updated[updated.length - 1] = { role: 'assistant', text: fullText, streaming: true };
                return updated;
              });
            }
          } catch (e) {}
        }
      }
      setMessages(m => {
        const updated = [...m];
        updated[updated.length - 1] = { role: 'assistant', text: fullText, streaming: false };
        return updated;
      });
    } catch (e) {
      // Fall back to normal send
      await sendNormal(msg);
    } finally {
      setLoading(false);
    }
  };

  const sendNormal = async (msg) => {
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await coachAPI.chat(worker.id, msg);
      setMessages(m => [...m, { role: 'assistant', text: res.data.response }]);
      if (res.data.intent) setLastIntent(res.data.intent);
      if (res.data.sentiment) setLastSentiment(res.data.sentiment);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: "Sorry, I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    if (useStreaming && aiStatus?.streaming) {
      await sendStreaming(msg);
    } else {
      await sendNormal(msg);
    }
  };

  const intentInfo = lastIntent ? INTENT_LABELS[lastIntent] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700 }}>Alex — AI Career Coach</h1>
              <div style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                Hybrid RAG · Intent routing · KG · Guardrails
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Streaming toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-500)', cursor: 'pointer' }}>
              <input type="checkbox" checked={useStreaming} onChange={e => setUseStreaming(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
              Streaming
            </label>
            {intentInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: intentInfo.bg, border: `1px solid ${intentInfo.color}30` }}>
                <Activity size={10} color={intentInfo.color} />
                <span style={{ fontSize: 10, fontWeight: 600, color: intentInfo.color }}>{intentInfo.label}</span>
              </div>
            )}
            {lastSentiment === 'NEGATIVE' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#D97706' }}>Support mode active</span>
              </div>
            )}
            {aiStatus?.groq && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <Cpu size={10} color="#F97316" />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#F97316' }}>Groq · Llama 3.3 70B</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Career path card */}
      {careerPath && (
        <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Route size={12} color="var(--brand)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>
              Optimal path · {careerPath.total_weeks}w · ${careerPath.total_cost_usd?.toLocaleString()} · +${careerPath.salary_uplift?.toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {careerPath.path?.map((role, i) => (
              <React.Fragment key={role}>
                <span style={{ fontSize: 11, fontWeight: 500, color: i === careerPath.path.length - 1 ? 'var(--accent)' : 'var(--brand)' }}>{role}</span>
                {i < careerPath.path.length - 1 && <ArrowRight size={10} color="var(--gray-400)" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {PROMPTS.map(p => (
            <button key={p} onClick={() => send(p)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)', cursor: 'pointer' }}>
              <Zap size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />{p}
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
        {loading && !messages[messages.length - 1]?.streaming && (
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
      <div style={{ marginTop: 10, display: 'flex', gap: 10, padding: '10px 0' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask Alex anything about your career transition..."
          style={{ flex: 1, borderRadius: 24, padding: '10px 18px', border: '1.5px solid var(--gray-200)' }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{ width: 44, height: 44, borderRadius: '50%', background: input.trim() ? 'var(--brand)' : 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }}>
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
        whiteSpace: 'pre-wrap',
        opacity: msg.streaming && !msg.text ? 0.5 : 1,
      }}>
        {msg.text || (msg.streaming ? '▌' : '')}
      </div>
    </div>
  );
}
