import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Building2, MessageCircle, CheckCircle, ArrowRight, Shield, Zap, Users, BarChart2, Route } from 'lucide-react';

function useCountUp(target, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function AnimatedStat({ value, suffix = '', prefix = '', label, start }) {
  const numeric = parseInt(value.replace(/[^0-9]/g, '')) || 0;
  const count = useCountUp(numeric, 1800, start);
  const display = value.includes('+') ? `+${prefix}${count.toLocaleString()}${suffix}` :
                  value.includes('<') ? `< ${prefix}${count.toLocaleString()}${suffix}` :
                  `${prefix}${count.toLocaleString()}${suffix}`;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: '#1F4D8C', letterSpacing: '-1px' }}>{display}</div>
      <div style={{ fontSize: 14, color: '#6B7280', marginTop: 6, maxWidth: 180, margin: '6px auto 0' }}>{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveTestimonial(t => (t + 1) % testimonials.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonials = [
    { name: 'Sarah M.', role: 'Former Retail Manager → AI Product Manager', quote: 'I went from a $45K retail management job to $128K at Stripe in 8 months. The career graph showed me the exact path — I just followed it.', uplift: '+$83K', avatar: 'SM' },
    { name: 'James T.', role: 'Former Data Entry Clerk → Data Analyst', quote: 'The AI coach remembered every conversation. After 16 weeks of Python training, I had 3 interview offers. PivotPath is unlike anything else.', uplift: '+$38K', avatar: 'JT' },
    { name: 'Priya K.', role: 'Former HR Coordinator → AI Ethics Specialist', quote: 'I was terrified about being made redundant. Alex mapped my existing HR skills directly to AI compliance — the transition took 12 weeks.', uplift: '+$46K', avatar: 'PK' },
  ];

  const features = [
    { icon: MessageCircle, color: '#1F4D8C', bg: '#E8EEFA', title: 'AI Career Coach with Memory', desc: 'Alex remembers every conversation using RAG vector memory, builds your personalised roadmap, and adapts as you progress.' },
    { icon: Route, color: '#7C3AED', bg: '#F5F3FF', title: 'Career Graph Engine', desc: "Dijkstra's algorithm maps the optimal path from your current role to your target — with exact weeks, costs, and salary uplift at every step." },
    { icon: Zap, color: '#2D9B6F', bg: '#E6F5EF', title: 'Smart Recommendations', desc: 'Collaborative filtering analyses workers similar to you to recommend the credentials most likely to accelerate your transition.' },
    { icon: TrendingUp, color: '#D97706', bg: '#FFFBEB', title: 'Live Skills Signal', desc: 'Real-time demand scoring across 7 AI skill categories, updated from live job postings. Know exactly what employers are hiring for.' },
    { icon: Award, color: '#0369A1', bg: '#E0F2FE', title: 'Employer-Endorsed Credentials', desc: 'Every credential maps directly to open roles. No wasted certificates — only qualifications employers have pre-agreed to recognise.' },
    { icon: Building2, color: '#B45309', bg: '#FEF3C7', title: 'Pre-Committed Interviews', desc: 'Not a job board. Employers pre-commit interview slots to PivotPath graduates. A guaranteed interview when you complete your pathway.' },
  ];

  const techBadges = [
    { label: 'RAG Memory', desc: 'Vector embeddings' },
    { label: 'Career Graph', desc: "Dijkstra's algo" },
    { label: 'Collab Filtering', desc: 'Sparse CSR matrix' },
    { label: 'Dropout Detection', desc: 'Isolation Forest' },
    { label: 'Audit Chain', desc: 'Tamper-evident log' },
    { label: 'JWT Security', desc: 'bcrypt + rate limiting' },
  ];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1F2937', overflowX: 'hidden' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 60px', background: '#fff', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1F4D8C' }}>Pivot<span style={{ color: '#2D9B6F' }}>Path</span></div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#features" style={{ fontSize: 14, color: '#6B7280', fontWeight: 500, textDecoration: 'none' }}>Features</a>
          <a href="#how" style={{ fontSize: 14, color: '#6B7280', fontWeight: 500, textDecoration: 'none' }}>How it works</a>
          <a href="#hr" style={{ fontSize: 14, color: '#6B7280', fontWeight: 500, textDecoration: 'none' }}>For HR</a>
          <button onClick={() => navigate('/login')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Sign in</button>
          <button onClick={() => navigate('/onboarding')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1F4D8C', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1F4D8C 0%, #2B5FAA 60%, #1a3d6e 100%)', padding: '110px 60px 90px', textAlign: 'center', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 780, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '7px 18px', fontSize: 13, fontWeight: 600, marginBottom: 28, border: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2D9B6F', display: 'inline-block' }} />
            300 million jobs at risk from AI by 2030 — we're on the right side of that
          </div>
          <h1 style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.1, marginBottom: 22, letterSpacing: '-2px' }}>
            Turn displacement<br />into your next <span style={{ color: '#7DB3F5' }}>opportunity</span>
          </h1>
          <p style={{ fontSize: 19, opacity: 0.88, lineHeight: 1.75, marginBottom: 42, maxWidth: 580, margin: '0 auto 42px' }}>
            PivotPath gives displaced workers an AI career coach with memory, a graph-powered transition roadmap, employer-endorsed credentials, and pre-committed interview slots. No upfront cost — ever.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/onboarding')} style={{ padding: '15px 34px', borderRadius: 10, border: 'none', background: '#2D9B6F', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 14px rgba(45,155,111,0.4)' }}>
              Start your transition free <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/hr')} style={{ padding: '15px 34px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              For HR teams →
            </button>
          </div>
          {/* Social proof */}
          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex' }}>
              {['SM', 'JT', 'PK', 'AR'].map((init, i) => (
                <div key={init} style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${i * 60 + 200}, 60%, 50%)`, border: '2px solid rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', marginLeft: i > 0 ? -10 : 0 }}>{init}</div>
              ))}
            </div>
            <span style={{ fontSize: 13, opacity: 0.85 }}>Join 2,400+ workers already transitioning</span>
          </div>
        </div>
      </section>

      {/* Tech badges */}
      <section style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', padding: '18px 60px', display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        {techBadges.map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fff', border: '1px solid #E5E7EB', fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: '#1F4D8C' }}>{b.label}</span>
            <span style={{ color: '#9CA3AF' }}>·</span>
            <span style={{ color: '#6B7280' }}>{b.desc}</span>
          </div>
        ))}
      </section>

      {/* Stats */}
      <section ref={statsRef} style={{ padding: '72px 60px', background: '#fff', display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap' }}>
        <AnimatedStat value="5000" prefix="< $" label="Cost per placement vs $40K industry avg" start={statsVisible} />
        <AnimatedStat value="70" suffix="%" prefix="" label="Placement rate for programme graduates" start={statsVisible} />
        <AnimatedStat value="21500" prefix="+$" label="Average salary uplift after transition" start={statsVisible} />
        <AnimatedStat value="8" suffix=" months" label="Average time from enrolment to new role" start={statsVisible} />
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '90px 60px', background: '#F9FAFB', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', background: '#E8EEFA', color: '#1F4D8C', fontWeight: 700, fontSize: 12, padding: '5px 14px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Platform features</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px', marginBottom: 14 }}>Built different. Not a job board.</h2>
          <p style={{ color: '#6B7280', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>Six deeply integrated systems working together to get you to your next role.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {features.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 28, transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon size={24} color={color} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: '#111827' }}>{title}</h3>
              <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '90px 60px', background: '#1F4D8C', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Real transitions. Real numbers.</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>Every story below comes with a verifiable salary uplift.</p>
        </div>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ display: i === activeTestimonial ? 'block' : 'none', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: 36, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2D9B6F', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 18, fontWeight: 800, color: '#fff' }}>{t.avatar}</div>
              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.8, marginBottom: 24, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{t.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>{t.role}</div>
              <div style={{ marginTop: 16, display: 'inline-block', background: '#2D9B6F', color: '#fff', fontWeight: 800, fontSize: 18, padding: '6px 20px', borderRadius: 20 }}>{t.uplift} salary uplift</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActiveTestimonial(i)} style={{ width: i === activeTestimonial ? 24 : 8, height: 8, borderRadius: 4, background: i === activeTestimonial ? '#7DB3F5' : 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: '90px 60px', background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>How it works</h2>
          <p style={{ color: '#6B7280', fontSize: 16 }}>Four steps from displacement to new role.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0, maxWidth: 960, margin: '0 auto', position: 'relative' }}>
          {[
            { num: '1', color: '#1F4D8C', title: 'Register free', desc: "Tell us your background. No CV needed. Alex builds your profile from a 3-minute conversation." },
            { num: '2', color: '#2B5FAA', title: 'Get your roadmap', desc: "The career graph engine finds the optimal path to your target role — with every step, week, and cost mapped out." },
            { num: '3', color: '#2D9B6F', title: 'Earn credentials', desc: "Complete employer-endorsed courses at your pace. The AI coach adapts your plan as you progress." },
            { num: '4', color: '#059669', title: 'Land the interview', desc: "We connect you to pre-committed employer slots. A guaranteed interview when you complete your pathway." },
          ].map(({ num, color, title, desc }, i) => (
            <div key={num} style={{ textAlign: 'center', padding: '0 24px 40px', position: 'relative' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, margin: '0 auto 20px', boxShadow: `0 6px 20px ${color}40` }}>{num}</div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{title}</h3>
              <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For HR */}
      <section id="hr" style={{ padding: '90px 60px', background: 'linear-gradient(135deg, #1F4D8C 0%, #1a3a70 100%)', color: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            <Users size={14} /> Built for HR teams
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 18, letterSpacing: '-1px' }}>Reduce headcount with dignity</h2>
          <p style={{ fontSize: 17, opacity: 0.85, marginBottom: 44, lineHeight: 1.75, maxWidth: 600, margin: '0 auto 44px' }}>
            When you need to reduce headcount, PivotPath manages the entire transition — reducing legal exposure, meeting ESG commitments, and getting your people to their next role faster than any outplacement firm.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 44, maxWidth: 800, margin: '0 auto 44px' }}>
            {[
              { icon: BarChart2, title: 'Cohort analytics', desc: 'Track placement rates by enrolment month' },
              { icon: Shield, title: 'Audit log', desc: 'Tamper-evident record of every action' },
              { icon: Zap, title: 'Dropout detection', desc: 'AI flags at-risk workers before they disengage' },
              { icon: CheckCircle, title: 'ESG reporting', desc: 'Ready-made workforce transition metrics' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '20px 16px', textAlign: 'left' }}>
                <Icon size={18} color="#7DB3F5" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hr')} style={{ padding: '14px 36px', borderRadius: 10, border: 'none', background: '#fff', color: '#1F4D8C', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            View HR Dashboard →
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '90px 60px', textAlign: 'center', background: '#fff' }}>
        <h2 style={{ fontSize: 44, fontWeight: 800, marginBottom: 18, letterSpacing: '-1.5px' }}>Ready to take the first step?</h2>
        <p style={{ color: '#6B7280', fontSize: 17, marginBottom: 36, lineHeight: 1.6 }}>Free to join. No credit card. Income share only on successful placement.</p>
        <button onClick={() => navigate('/onboarding')} style={{ padding: '16px 44px', borderRadius: 12, border: 'none', background: '#1F4D8C', color: '#fff', fontWeight: 700, fontSize: 17, cursor: 'pointer', boxShadow: '0 4px 20px rgba(31,77,140,0.3)' }}>
          Get started — it's free →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#F9FAFB' }}>
        <div style={{ fontWeight: 800, color: '#1F4D8C', fontSize: 16 }}>Pivot<span style={{ color: '#2D9B6F' }}>Path</span></div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Features', 'How it works', 'For HR', 'Sign in'].map(l => (
            <span key={l} style={{ fontSize: 13, color: '#9CA3AF', cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>© 2026 PivotPath · No upfront cost · Income share only on placement</div>
      </footer>
    </div>
  );
}
