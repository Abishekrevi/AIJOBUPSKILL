import React, { useState, useEffect } from 'react';
import { useWorker } from '../App';
import { workerAPI, authAPI, coachAPI } from '../lib/api';
import { User, Lock, TrendingUp, CheckCircle, Route, ArrowRight, Shield } from 'lucide-react';

function ProgressRing({ percent, size = 80, stroke = 7, color = 'var(--brand)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-200)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`, fontSize: 15, fontWeight: 700, fill: color, fontFamily: 'inherit' }}>
        {percent}%
      </text>
    </svg>
  );
}

export default function Profile() {
  const { worker, setWorker } = useWorker();
  const [form, setForm] = useState({
    name: worker?.name || '',
    current_role: worker?.current_role || '',
    current_salary: worker?.current_salary || '',
    target_role: worker?.target_role || '',
    skills_summary: worker?.skills_summary || '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPwd, setSavedPwd] = useState(false);
  const [error, setError] = useState('');
  const [careerPath, setCareerPath] = useState(null);
  const [loadingPath, setLoadingPath] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const currentSal = parseFloat(form.current_salary) || 0;
  const estimatedNewSal = currentSal > 0 ? Math.round(currentSal * 1.35 / 1000) * 1000 : 85000;
  const uplift = estimatedNewSal - currentSal;
  const isaPayment = uplift > 0 ? Math.round(uplift * 0.12 * 24 / 12) : 0;

  useEffect(() => {
    if (form.current_role && form.target_role && form.current_role !== form.target_role) {
      setLoadingPath(true);
      coachAPI.careerPath(form.current_role, form.target_role)
        .then(r => setCareerPath(r.data))
        .catch(() => setCareerPath(null))
        .finally(() => setLoadingPath(false));
    } else {
      setCareerPath(null);
    }
  }, [form.current_role, form.target_role]);

  const saveProfile = async () => {
    setSaving(true); setError('');
    try {
      const res = await workerAPI.update(worker.id, {
        ...form,
        current_salary: form.current_salary ? parseFloat(form.current_salary) : null
      });
      setWorker(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSavingPwd(true); setError('');
    try {
      await authAPI.setPassword(worker.id, password);
      setPassword(''); setConfirmPassword('');
      setSavedPwd(true);
      setTimeout(() => setSavedPwd(false), 3000);
    } catch { setError('Failed to set password.'); }
    finally { setSavingPwd(false); }
  };

  const statusColor = { onboarding: '#D97706', active: 'var(--brand)', learning: 'var(--accent)', placed: '#059669', paused: 'var(--gray-400)' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>My Profile</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Keep your profile updated so your AI coach gives you the best advice.</p>
      </div>

      {/* Progress overview */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <ProgressRing percent={worker?.progress_pct || 0} size={90} color="var(--brand)" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{worker?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 8 }}>{worker?.current_role} → {worker?.target_role || 'target not set'}</div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${statusColor[worker?.status] || 'var(--brand)'}18`, color: statusColor[worker?.status] || 'var(--brand)' }}>
            {worker?.status || 'onboarding'}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>ISA status</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: worker?.isa_signed ? 'var(--accent)' : 'var(--gray-400)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            {worker?.isa_signed ? <><CheckCircle size={14} /> Signed</> : 'Not signed'}
          </div>
        </div>
      </div>

      {/* Live salary calculator */}
      <div style={{ background: 'linear-gradient(135deg, var(--brand-light), #EEF6FF)', border: '1px solid rgba(31,77,140,0.15)', borderRadius: 14, padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 15 }}>Live salary uplift calculator</h3>
          <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 4 }}>updates as you type</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Current salary</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-800)' }}>${currentSal > 0 ? currentSal.toLocaleString() : '—'}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', textAlign: 'center', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Estimated new salary</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>${estimatedNewSal.toLocaleString()}</div>
          </div>
          <div style={{ background: 'var(--accent-light)', borderRadius: 10, padding: '14px 18px', textAlign: 'center', border: '1px solid rgba(45,155,111,0.2)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>Your uplift</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>+${uplift > 0 ? uplift.toLocaleString() : '—'}</div>
          </div>
        </div>
        {uplift > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(31,77,140,0.06)', borderRadius: 8, fontSize: 13, color: 'var(--brand)' }}>
            ISA estimate: ~${isaPayment.toLocaleString()}/month for 24 months after placement (12% of uplift only)
          </div>
        )}
      </div>

      {/* Career path preview */}
      {(form.current_role && form.target_role) && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Route size={15} color="var(--brand)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Career path preview</span>
            {loadingPath && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Calculating...</span>}
          </div>
          {careerPath ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {careerPath.path?.map((role, i) => (
                  <React.Fragment key={role}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 16, background: i === 0 ? 'var(--gray-100)' : i === careerPath.path.length - 1 ? 'var(--accent-light)' : 'var(--brand-light)', color: i === 0 ? 'var(--gray-600)' : i === careerPath.path.length - 1 ? 'var(--accent)' : 'var(--brand)' }}>{role}</span>
                    {i < careerPath.path.length - 1 && <ArrowRight size={12} color="var(--gray-400)" />}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span><span style={{ color: 'var(--gray-500)' }}>Time: </span><strong>{careerPath.total_weeks}w</strong></span>
                <span><span style={{ color: 'var(--gray-500)' }}>Cost: </span><strong>${careerPath.total_cost_usd?.toLocaleString()}</strong></span>
                <span><span style={{ color: 'var(--gray-500)' }}>Uplift: </span><strong style={{ color: 'var(--accent)' }}>+${careerPath.salary_uplift?.toLocaleString()}</strong></span>
              </div>
            </>
          ) : (
            !loadingPath && <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>No direct path found for these roles. Try a different target role.</div>
          )}
        </div>
      )}

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Profile form */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <User size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 16 }}>Personal details</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['name', 'Full name', 'Your full name', 'text'],
            ['current_role', 'Current / last role', 'e.g. Marketing Manager', 'text'],
            ['current_salary', 'Current salary (USD)', 'e.g. 65000', 'number'],
            ['target_role', 'Target role', 'e.g. AI Product Manager', 'text'],
          ].map(([k, label, ph, type]) => (
            <div key={k}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>Skills you already have</label>
          <textarea rows={3} value={form.skills_summary} onChange={e => set('skills_summary', e.target.value)}
            placeholder="e.g. Project management, Excel, stakeholder communication..."
            style={{ resize: 'vertical' }} />
        </div>
        <button onClick={saveProfile} disabled={saving} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 9, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved ? <><CheckCircle size={15} /> Saved!</> : saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>

      {/* Password */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 28, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Lock size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 16 }}>Change password</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password"
              style={{ borderColor: confirmPassword && password !== confirmPassword ? '#EF4444' : '' }} />
          </div>
        </div>
        {password && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {[password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password)].map((ok, i) => (
              <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: ok ? 'var(--accent-light)' : 'var(--gray-100)', color: ok ? 'var(--accent)' : 'var(--gray-400)', fontWeight: 500 }}>
                {['8+ chars', 'Uppercase', 'Number'][i]}
              </span>
            ))}
          </div>
        )}
        <button onClick={savePassword} disabled={savingPwd || !password || password !== confirmPassword} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 9, border: 'none', background: password && password === confirmPassword ? 'var(--brand)' : 'var(--gray-200)', color: password && password === confirmPassword ? '#fff' : 'var(--gray-400)', fontWeight: 600, fontSize: 13, cursor: password ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
          {savedPwd ? <><CheckCircle size={15} /> Password updated!</> : savingPwd ? 'Saving...' : 'Update password'}
        </button>
      </div>

      {/* Security info */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Shield size={16} color="var(--gray-400)" />
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Your password is hashed with bcrypt. Your session uses JWT tokens that expire in 24 hours. All actions are recorded in a tamper-evident audit log.</span>
      </div>
    </div>
  );
}