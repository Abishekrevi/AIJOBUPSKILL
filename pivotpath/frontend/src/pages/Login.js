import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useWorker } from '../App';

export default function Login() {
  const { setWorker, setHRCompany } = useWorker();
  const navigate = useNavigate();
  const [tab, setTab] = useState('worker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'worker') {
        const res = await authAPI.workerLogin(email, password);
        setWorker(res.data);
        navigate('/');
      } else {
        const res = await authAPI.hrLogin(email, password);
        setHRCompany(res.data);
        navigate('/hr');
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed. Please check your details.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>Pivot<span style={{ color: '#7DB3F5' }}>Path</span></div>
          <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>Welcome back</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 8, padding: 4, marginBottom: 24 }}>
            {['worker', 'hr'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? 'var(--brand)' : 'var(--gray-500)',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>
                {t === 'worker' ? 'Worker login' : 'HR team login'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginTop: 16 }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading || !email || !password} style={{
            width: '100%', marginTop: 20, padding: '12px', borderRadius: 10, border: 'none',
            background: loading || !email || !password ? 'var(--gray-200)' : 'var(--brand)',
            color: loading || !email || !password ? 'var(--gray-400)' : '#fff',
            fontWeight: 600, fontSize: 14, cursor: loading ? 'wait' : 'pointer'
          }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--gray-500)' }}>
            Don't have an account?{' '}
            <span style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/onboarding')}>
              Register free
            </span>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 20 }}>
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/landing')}>Back to home</span>
        </p>
      </div>
    </div>
  );
}
