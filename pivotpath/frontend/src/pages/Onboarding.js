import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workerAPI, coachAPI, authAPI } from '../lib/api';
import { useWorker } from '../App';
import { CheckCircle, ArrowRight, Zap } from 'lucide-react';

const steps = ['Welcome', 'Your Background', 'Your Goals', 'Set Password'];

export default function Onboarding() {
  const { setWorker } = useWorker();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [careerPath, setCareerPath] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', current_role: '',
    current_salary: '', target_role: '', skills_summary: ''
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    coachAPI.allRoles().then(r => setAvailableRoles(r.data?.roles || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.current_role && form.target_role && form.current_role !== form.target_role) {
      coachAPI.careerPath(form.current_role, form.target_role)
        .then(r => setCareerPath(r.data))
        .catch(() => setCareerPath(null));
    } else {
      setCareerPath(null);
    }
  }, [form.current_role, form.target_role]);

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        current_role: form.current_role,
        current_salary: form.current_salary ? parseFloat(form.current_salary) : null,
        target_role: form.target_role || null,
        skills_summary: form.skills_summary || null,
      };
      const res = await workerAPI.create(payload);
      setWorker(res.data);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const targetOptions = [
    'AI Product Manager', 'Data Analyst', 'AI Solutions Engineer',
    'ML Engineer', 'AI Consultant', 'Prompt Engineer',
    'LLM Engineer', 'AI Ethics Specialist', 'Data Scientist', 'Other'
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            Pivot<span style={{ color: '#7DB3F5' }}>Path</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 15 }}>
            AI-Powered Workforce Transition
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: i < step ? 'var(--accent)' : i === step ? 'var(--brand)' : 'var(--gray-200)', transition: 'background 0.3s' }} />
                <div style={{ fontSize: 10, color: i === step ? 'var(--brand)' : i < step ? 'var(--accent)' : 'var(--gray-400)', marginTop: 4, fontWeight: i === step ? 600 : 400 }}>
                  {i < step ? '✓' : s}
                </div>
              </div>
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Welcome to PivotPath</h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24, lineHeight: 1.7, fontSize: 14 }}>
                Your AI career coach will build a personalised reskilling roadmap using graph algorithms tied to real employer demand — and connect you to pre-committed interview slots.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Full name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Sarah Johnson" />
                <Field label="Work email" value={form.email} onChange={v => set('email', v)} placeholder="sarah@company.com" type="email" />
              </div>
              <Btn onClick={() => { if (form.name && form.email) setStep(1); }} disabled={!form.name || !form.email}>
                Get started <ArrowRight size={16} />
              </Btn>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--gray-500)' }}>
                Already have an account?{' '}
                <span style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/login')}>Sign in</span>
              </div>
            </div>
          )}

          {/* Step 1: Background */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Your background</h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 14 }}>
                Tell us where you're coming from so we can find the fastest path forward.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Current / most recent role</label>
                  {availableRoles.length > 0 ? (
                    <select value={form.current_role} onChange={e => set('current_role', e.target.value)}>
                      <option value="">Select your role...</option>
                      {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value="Other">Other (not listed)</option>
                    </select>
                  ) : (
                    <input value={form.current_role} onChange={e => set('current_role', e.target.value)} placeholder="e.g. Marketing Manager" />
                  )}
                </div>
                <Field label="Current annual salary (USD)" value={form.current_salary} onChange={v => set('current_salary', v)} placeholder="e.g. 65000" type="number" />
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Key skills you already have</label>
                  <textarea rows={3} value={form.skills_summary} onChange={e => set('skills_summary', e.target.value)}
                    placeholder="e.g. Project management, Excel, stakeholder communication..."
                    style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <Btn secondary onClick={() => setStep(0)}>← Back</Btn>
                <Btn onClick={() => { if (form.current_role) setStep(2); }} disabled={!form.current_role}>Continue →</Btn>
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Where do you want to go?</h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 20, fontSize: 14 }}>
                Don't worry if you're not sure yet — your AI coach will help you narrow this down.
              </p>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Target role</label>
                <select value={form.target_role} onChange={e => set('target_role', e.target.value)}>
                  <option value="">Not sure yet</option>
                  {targetOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Career path preview */}
              {careerPath && form.target_role && (
                <div style={{ marginTop: 16, background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.2)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Zap size={13} color="var(--brand)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>Career path found!</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {careerPath.path?.map((role, i) => (
                      <React.Fragment key={role}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: i === careerPath.path.length - 1 ? 'var(--accent)' : 'var(--brand)', color: '#fff' }}>{role}</span>
                        {i < careerPath.path.length - 1 && <ArrowRight size={10} color="var(--gray-400)" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                    <span><strong>{careerPath.total_weeks}w</strong> <span style={{ color: 'var(--gray-500)' }}>timeline</span></span>
                    <span><strong>${careerPath.total_cost_usd?.toLocaleString()}</strong> <span style={{ color: 'var(--gray-500)' }}>total cost</span></span>
                    <span><strong style={{ color: 'var(--accent)' }}>+${careerPath.salary_uplift?.toLocaleString()}</strong> <span style={{ color: 'var(--gray-500)' }}>uplift</span></span>
                  </div>
                </div>
              )}

              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginTop: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <Btn secondary onClick={() => setStep(1)}>← Back</Btn>
                <Btn onClick={() => setStep(3)}>Continue →</Btn>
              </div>
            </div>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Secure your account</h2>
              <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                Set a password to protect your account. You can skip this and set it later in your profile.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Password (optional)" value={form.password} onChange={v => set('password', v)} placeholder="At least 8 characters" type="password" />
              </div>
              {form.password && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password)].map((ok, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: ok ? 'var(--accent-light)' : 'var(--gray-100)', color: ok ? 'var(--accent)' : 'var(--gray-400)', fontWeight: 500 }}>
                      {['8+ chars', 'Uppercase', 'Number'][i]}
                    </span>
                  ))}
                </div>
              )}
              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginTop: 16 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <Btn secondary onClick={() => setStep(2)}>← Back</Btn>
                <Btn onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating account...' : 'Start my journey →'}
                </Btn>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', marginTop: 14 }}>
                No upfront cost. Income share only on successful placement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Btn({ children, onClick, disabled, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: secondary ? '0 0 auto' : 1, padding: '12px 20px', borderRadius: 10,
      fontWeight: 600, fontSize: 14,
      background: secondary ? 'var(--gray-100)' : disabled ? 'var(--gray-200)' : 'var(--brand)',
      color: secondary ? 'var(--gray-600)' : disabled ? 'var(--gray-400)' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: secondary ? 'auto' : '100%'
    }}>
      {children}
    </button>
  );
}
