import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Building2, MessageCircle, CheckCircle, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1F2937' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 60px', background: '#fff', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1F4D8C' }}>Pivot<span style={{ color: '#2D9B6F' }}>Path</span></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/login')} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Sign in</button>
          <button onClick={() => navigate('/onboarding')} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#1F4D8C', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1F4D8C 0%, #2B5FAA 100%)', padding: '100px 60px', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            300 million jobs at risk from AI by 2030
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-1px' }}>
            Turn displacement<br />into your next opportunity
          </h1>
          <p style={{ fontSize: 19, opacity: 0.85, lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            PivotPath gives displaced workers a personalised AI career coach, employer-endorsed credentials, and pre-committed interview slots. No upfront cost.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/onboarding')} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: '#2D9B6F', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              Start your transition free <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/hr')} style={{ padding: '14px 32px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              For HR teams →
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '60px', background: '#F9FAFB', display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap' }}>
        {[
          ['< $5,000', 'Cost per placement vs $40K industry avg'],
          ['70%+', 'Placement rate for programme graduates'],
          ['+$21,500', 'Average salary uplift after transition'],
          ['6–12 months', 'Average time to new role'],
        ].map(([stat, label]) => (
          <div key={stat} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#1F4D8C' }}>{stat}</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginTop: 6, maxWidth: 160 }}>{label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section style={{ padding: '80px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 16 }}>Everything you need to transition</h2>
        <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 16, marginBottom: 56 }}>One platform. Every step of the journey.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {[
            { icon: MessageCircle, color: '#1F4D8C', bg: '#E8EEFA', title: 'AI Career Coach', desc: 'Alex builds your personalised roadmap tied to real employer demand — not generic advice.' },
            { icon: TrendingUp, color: '#7C3AED', bg: '#F5F3FF', title: 'Skills Demand Signal', desc: 'Real-time data on which skills employers are hiring for in the next 3–5 years.' },
            { icon: Award, color: '#2D9B6F', bg: '#E6F5EF', title: 'Credential Marketplace', desc: 'Only employer-endorsed credentials that map to live job openings. No wasted certificates.' },
            { icon: Building2, color: '#B45309', bg: '#FFFBEB', title: 'Employer Pipeline', desc: 'Pre-committed interview slots at top companies. A guaranteed interview, not a job board.' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={22} color={color} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</h3>
              <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 60px', background: '#F9FAFB' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 56 }}>How it works</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
          {[
            ['1', 'Register free', 'Tell us your background. No CV needed.'],
            ['2', 'Get your roadmap', 'Your AI coach builds a personalised pathway.'],
            ['3', 'Earn credentials', 'Complete employer-endorsed courses at your pace.'],
            ['4', 'Land the interview', 'We connect you to pre-committed employer slots.'],
          ].map(([num, title, desc], i) => (
            <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '0 30px 40px', flex: '1 1 200px', minWidth: 200 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1F4D8C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{num}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
                <div style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For HR */}
      <section style={{ padding: '80px 60px', background: '#1F4D8C', color: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Built for HR teams too</h2>
          <p style={{ fontSize: 17, opacity: 0.85, marginBottom: 40, lineHeight: 1.7 }}>
            When you need to reduce headcount, PivotPath manages the entire transition — reducing legal exposure, meeting ESG commitments, and getting your people to their next role faster.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            {['Per-employee pricing', 'ESG reporting built in', 'Placement rate tracking', 'Dedicated HR dashboard'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '8px 16px' }}>
                <CheckCircle size={14} color="#2D9B6F" /><span style={{ fontSize: 13, fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/hr')} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: '#fff', color: '#1F4D8C', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            View HR Dashboard →
          </button>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 60px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Ready to take the first step?</h2>
        <p style={{ color: '#6B7280', fontSize: 16, marginBottom: 32 }}>Free to join. Income share only on successful placement.</p>
        <button onClick={() => navigate('/onboarding')} style={{ padding: '14px 40px', borderRadius: 10, border: 'none', background: '#1F4D8C', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          Get started — it's free
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E5E7EB', padding: '24px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 700, color: '#1F4D8C' }}>PivotPath</div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>© 2026 PivotPath. No upfront cost. Income share only on successful placement.</div>
      </footer>
    </div>
  );
}
