import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workerAPI } from '../lib/api';
import { useWorker } from '../App';

const steps = ['Welcome', 'Your Background', 'Your Goals'];

export default function Onboarding() {
  const { setWorker } = useWorker();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', current_role: '',
    current_salary: '', target_role: '', skills_summary: ''
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        current_salary: form.current_salary ? parseFloat(form.current_salary) : null
      };
      const res = await workerAPI.create(payload);
      setWorker(res.data);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            Pivot<span style={{ color: '#7DB3F5' }}>Path</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 15 }}>
            AI-Powered Workforce Transition
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: i <= step ? 'var(--brand)' : 'var(--gray-200)',
                  transition: 'background 0.3s'
                }} />
                <div style={{ fontSize: 11, color: i === step ? 'var(--brand)' : 'var(--gray-400)', marginTop: 4, fontWeight: i === step ? 600 : 400 }}>
                  {s}
                </div>
              </div>
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
                Welcome to PivotPath
              </h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24, lineHeight: 1.7 }}>
                Your AI career coach will build a personalised reskilling roadmap tied to real employer demand — and connect you to pre-committed interview slots.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Full name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Sarah Johnson" />
                <Field label="Work email" value={form.email} onChange={v => set('email', v)} placeholder="sarah@company.com" type="email" />
              </div>
              <Btn onClick={() => { if (form.name && form.email) setStep(1); }} disabled={!form.name || !form.email}>
                Get started →
              </Btn>
            </div>
          )}

          {/* Step 1: Background */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
                Your background
              </h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>
                Tell us where you're coming from so we can find the fastest path forward.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Current / most recent role" value={form.current_role} onChange={v => set('current_role', v)} placeholder="e.g. Marketing Manager" />
                <Field label="Current annual salary (USD)" value={form.current_salary} onChange={v => set('current_salary', v)} placeholder="e.g. 65000" type="number" />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                    Key skills you already have
                  </label>
                  <textarea
                    rows={3}
                    value={form.skills_summary}
                    onChange={e => set('skills_summary', e.target.value)}
                    placeholder="e.g. Project management, Excel, stakeholder communication, copywriting..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <Btn secondary onClick={() => setStep(0)}>← Back</Btn>
                <Btn onClick={() => { if (form.current_role) setStep(2); }} disabled={!form.current_role}>
                  Continue →
                </Btn>
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
                Where do you want to go?
              </h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24 }}>
                Don't worry if you're not sure yet — your AI coach will help you narrow this down.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                    Target role (optional)
                  </label>
                  <select value={form.target_role} onChange={e => set('target_role', e.target.value)}>
                    <option value="">Not sure yet</option>
                    <option>AI Product Manager</option>
                    <option>Data Analyst</option>
                    <option>AI Solutions Engineer</option>
                    <option>ML Engineer</option>
                    <option>AI Consultant</option>
                    <option>Prompt Engineer</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginTop: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <Btn secondary onClick={() => setStep(1)}>← Back</Btn>
                <Btn onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating your account...' : 'Start my journey →'}
                </Btn>
              </div>

              <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', marginTop: 16 }}>
                Already have an account? <span style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={() => navigate('/')}>Sign in</span>
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 20 }}>
          No upfront cost. Income share only on successful placement.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Btn({ children, onClick, disabled, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: secondary ? '0 0 auto' : 1, padding: '12px 20px', borderRadius: 10,
      fontWeight: 600, fontSize: 14, marginTop: secondary ? 0 : 8,
      background: secondary ? 'var(--gray-100)' : (disabled ? 'var(--gray-200)' : 'var(--brand)'),
      color: secondary ? 'var(--gray-600)' : (disabled ? 'var(--gray-400)' : '#fff'),
      cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
      transition: 'all 0.15s', width: secondary ? 'auto' : '100%'
    }}>
      {children}
    </button>
  );
}
