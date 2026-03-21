import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, MessageCircle, Building2, ArrowRight, CheckCircle, Bell, BellOff, Route, Zap } from 'lucide-react';
import { useWorker } from '../App';
import { coachAPI, signalAPI, credentialAPI, connectNotifications } from '../lib/api';

export default function Dashboard() {
  const { worker } = useWorker();
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState(null);
  const [signals, setSignals] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [careerPath, setCareerPath] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifConnected, setNotifConnected] = useState(false);

  useEffect(() => {
    if (!worker) return;

    coachAPI.roadmap(worker.id).then(r => {
      setRoadmap(r.data);
      if (r.data?.career_path) setCareerPath(r.data.career_path);
    }).catch(() => {});

    signalAPI.top(4).then(r => setSignals(r.data)).catch(() => {});
    credentialAPI.workerCredentials(worker.id).then(r => setEnrollments(r.data)).catch(() => {});
    credentialAPI.recommended(worker.id).then(r => setRecommended(r.data)).catch(() => {});

    // Connect WebSocket for real-time notifications
    connectNotifications(worker.id, (msg) => {
      setNotifications(prev => [{ ...msg, id: Date.now() }, ...prev].slice(0, 10));
    });
    setNotifConnected(true);
  }, [worker]);

  const statusColor = { onboarding: '#D97706', active: 'var(--brand)', learning: 'var(--accent)', placed: '#059669', paused: 'var(--gray-400)' };
  const statusLabel = { onboarding: 'Onboarding', active: 'Active', learning: 'Learning', placed: 'Placed ✓', paused: 'Paused' };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-800)' }}>
            Welcome back, {worker?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Here's your transition overview.</p>
        </div>
        {/* Notification indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {notifConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--accent-light)', border: '1px solid rgba(45,155,111,0.2)' }}>
              <Bell size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Live updates on</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--gray-100)' }}>
              <BellOff size={13} color="var(--gray-400)" />
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Notifications off</span>
            </div>
          )}
        </div>
      </div>

      {/* Live notifications */}
      {notifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {notifications.slice(0, 2).map(n => (
            <div key={n.id} style={{ background: 'var(--accent-light)', border: '1px solid rgba(45,155,111,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <Bell size={14} color="var(--accent)" />
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{n.data?.message || n.event}</span>
              <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Status banner */}
      <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500 }}>Current status</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: statusColor[worker?.status] || 'var(--brand)', marginTop: 2 }}>
            {statusLabel[worker?.status] || 'Onboarding'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Current role</div>
          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{worker?.current_role || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Target role</div>
          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{worker?.target_role || 'Not set yet'}</div>
        </div>
        {roadmap && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Est. salary uplift</div>
            <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 18 }}>
              +${roadmap.estimated_salary_uplift?.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Career path visualiser */}
      {careerPath && careerPath.path && careerPath.path.length > 1 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Route size={16} color="var(--brand)" />
            <h3 style={{ fontWeight: 600, fontSize: 15 }}>Your optimal career path</h3>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 600, marginLeft: 'auto' }}>
              Dijkstra's algorithm
            </span>
          </div>
          {/* Path steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {careerPath.path.map((role, i) => (
              <React.Fragment key={role}>
                <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: i === 0 ? 'var(--gray-100)' : i === careerPath.path.length - 1 ? 'var(--accent-light)' : 'var(--brand-light)', color: i === 0 ? 'var(--gray-600)' : i === careerPath.path.length - 1 ? 'var(--accent)' : 'var(--brand)' }}>
                  {role}
                </div>
                {i < careerPath.path.length - 1 && <ArrowRight size={14} color="var(--gray-400)" />}
              </React.Fragment>
            ))}
          </div>
          {/* Path stats */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13 }}><span style={{ color: 'var(--gray-500)' }}>Total time: </span><span style={{ fontWeight: 600 }}>{careerPath.total_weeks} weeks</span></div>
            <div style={{ fontSize: 13 }}><span style={{ color: 'var(--gray-500)' }}>Total cost: </span><span style={{ fontWeight: 600 }}>${careerPath.total_cost_usd?.toLocaleString()}</span></div>
            <div style={{ fontSize: 13 }}><span style={{ color: 'var(--gray-500)' }}>Salary uplift: </span><span style={{ fontWeight: 700, color: 'var(--accent)' }}>+${careerPath.salary_uplift?.toLocaleString()}</span></div>
          </div>
          {/* Step breakdown */}
          {careerPath.steps && careerPath.steps.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>Step-by-step breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {careerPath.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: 'var(--brand)', minWidth: 20 }}>#{i + 1}</span>
                    <span style={{ color: 'var(--gray-600)' }}>{step.from}</span>
                    <ArrowRight size={12} color="var(--gray-400)" />
                    <span style={{ fontWeight: 600 }}>{step.to}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--gray-400)' }}>{step.weeks}w · ${step.cost?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { icon: MessageCircle, label: 'Chat with AI Coach', sub: 'RAG-powered memory', to: '/coach', color: 'var(--brand)', bg: 'var(--brand-light)' },
          { icon: Award, label: 'Browse Credentials', sub: `${enrollments.length} enrolled`, to: '/credentials', color: 'var(--accent)', bg: 'var(--accent-light)' },
          { icon: TrendingUp, label: 'Skills Signal', sub: 'Top demand skills', to: '/signal', color: '#7C3AED', bg: '#F5F3FF' },
          { icon: Building2, label: 'Employer Pipeline', sub: 'Pre-committed interviews', to: '/employers', color: '#B45309', bg: '#FFFBEB' },
        ].map(({ icon: Icon, label, sub, to, color, bg }) => (
          <button key={to} onClick={() => navigate(to)} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 12, padding: '18px 16px', textAlign: 'left', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
            <Icon size={22} color={color} style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 14 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Top skills */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 600, fontSize: 15 }}>Top in-demand skills</h3>
            <button onClick={() => navigate('/signal')} style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              See all <ArrowRight size={12} />
            </button>
          </div>
          {signals.map(s => (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{s.skill_name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{s.demand_score}/100</span>
              </div>
              <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.demand_score}%`, background: 'var(--brand)', borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>+{s.growth_rate}% YoY growth</div>
            </div>
          ))}
        </div>

        {/* Roadmap / recommended */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 22 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
            {recommended.length > 0 ? 'Recommended for you' : 'Your AI roadmap'}
          </h3>

          {/* Collaborative filtering recommendations */}
          {recommended.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Zap size={13} color="var(--accent)" />
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Based on workers similar to you</span>
              </div>
              {recommended.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <CheckCircle size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.provider} · {r.duration_weeks}w</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)' }}>{Math.round(r.score * 100)}% match</span>
                </div>
              ))}
              <button onClick={() => navigate('/credentials')} style={{ marginTop: 12, width: '100%', padding: '9px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                View all credentials →
              </button>
            </div>
          )}

          {/* Roadmap fallback */}
          {recommended.length === 0 && roadmap && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <Chip label={`~${roadmap.estimated_timeline_weeks}w timeline`} color="var(--brand)" />
                <Chip label={`+$${(roadmap.estimated_salary_uplift / 1000).toFixed(0)}K uplift`} color="var(--accent)" />
              </div>
              {roadmap.recommended_credentials?.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <CheckCircle size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{c.provider} · {c.weeks}w · {Math.round(c.placement_rate * 100)}% placement</div>
                  </div>
                </div>
              ))}
              <button onClick={() => navigate('/coach')} style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                Chat with your coach →
              </button>
            </div>
          )}

          {recommended.length === 0 && !roadmap && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)' }}>
              <MessageCircle size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>Chat with your AI coach to generate a personalised roadmap.</p>
              <button onClick={() => navigate('/coach')} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                Start coaching →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${color}18`, color }}>
      {label}
    </span>
  );
}
