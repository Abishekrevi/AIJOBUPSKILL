import React, { useState } from 'react';
import { useWorker } from '../App';
import { workerAPI, authAPI } from '../lib/api';
import { User, Lock, TrendingUp, CheckCircle } from 'lucide-react';

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    setSaving(true); setError('');
    try {
      const res = await workerAPI.update(worker.id, { ...form, current_salary: form.current_salary ? parseFloat(form.current_salary) : null });
      setWorker(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSavingPwd(true); setError('');
    try {
      await authAPI.setPassword(worker.id, password);
      setPassword(''); setConfirmPassword('');
      setSavedPwd(true);
      setTimeout(() => setSavedPwd(false), 3000);
    } catch { setError('Failed to set password.'); }
    finally { setSavingPwd(false); }
  };

  const uplift = form.current_salary ? Math.round((parseFloat(form.current_salary) * 0.3) / 1000) * 1000 : 21500;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>My Profile</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Keep your profile updated so your AI coach gives you the best advice.</p>
      </div>

      {/* Salary uplift calculator */}
      <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.15)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={24} color="var(--brand)" />
          <div>
            <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500 }}>Estimated salary uplift</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand)' }}>+${uplift.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-600)', maxWidth: 280, lineHeight: 1.6 }}>
          Based on your current salary and target role. Update your details below to refine this estimate.
        </div>
      </div>

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
        <button onClick={saveProfile} disabled={saving} style={{
          marginTop: 16, padding: '10px 24px', borderRadius: 9, border: 'none',
          background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {saved ? <><CheckCircle size={15} /> Saved!</> : saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>

      {/* Password */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Lock size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 16 }}>Set password</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 5 }}>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
          </div>
        </div>
        <button onClick={savePassword} disabled={savingPwd || !password} style={{
          marginTop: 16, padding: '10px 24px', borderRadius: 9, border: 'none',
          background: password ? 'var(--brand)' : 'var(--gray-200)',
          color: password ? '#fff' : 'var(--gray-400)', fontWeight: 600, fontSize: 13, cursor: password ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {savedPwd ? <><CheckCircle size={15} /> Password set!</> : savingPwd ? 'Saving...' : 'Set password'}
        </button>
      </div>
    </div>
  );
}
