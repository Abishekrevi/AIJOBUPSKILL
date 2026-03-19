import React, { useEffect, useState } from 'react';
import { Award, Clock, DollarSign, CheckCircle, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { useWorker } from '../App';
import { credentialAPI } from '../lib/api';

export default function Credentials() {
  const { worker } = useWorker();
  const [creds, setCreds] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    credentialAPI.list().then(r => setCreds(r.data)).catch(() => {});
    if (worker) credentialAPI.workerCredentials(worker.id).then(r => setEnrollments(r.data)).catch(() => {});
  };

  useEffect(() => { loadData(); }, [worker]);

  const enrolledMap = {};
  enrollments.forEach(e => { enrolledMap[e.credential_id] = e; });

  const enroll = async (credId) => {
    setEnrolling(credId);
    try {
      await credentialAPI.enroll(worker.id, credId);
      await loadData();
    } catch (e) { alert(e.response?.data?.detail || 'Enrollment failed'); }
    finally { setEnrolling(null); }
  };

  const updateProgress = async (enrollmentId, newPct) => {
    try {
      await credentialAPI.updateProgress(enrollmentId, Math.min(100, Math.max(0, newPct)));
      await loadData();
    } catch {}
  };

  const filtered = filter === 'all' ? creds : filter === 'enrolled' ? creds.filter(c => enrolledMap[c.id]) : creds.filter(c => c.employer_endorsed);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Credential Marketplace</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Employer-endorsed credentials ranked by demand signal. Track your progress on each one.</p>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['total', creds.length, 'Available', 'var(--brand)'], ['enrolled', enrollments.length, 'Enrolled', 'var(--accent)'], ['completed', enrollments.filter(e => e.status === 'completed').length, 'Completed', '#7C3AED']].map(([k, v, l, c]) => (
          <div key={k} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['all', 'All'], ['enrolled', 'My credentials'], ['endorsed', 'Employer endorsed']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid', cursor: 'pointer',
            borderColor: filter === v ? 'var(--brand)' : 'var(--gray-200)',
            background: filter === v ? 'var(--brand)' : '#fff',
            color: filter === v ? '#fff' : 'var(--gray-600)'
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {filtered.map(cred => {
          const enrollment = enrolledMap[cred.id];
          const progress = enrollment?.progress_pct || 0;
          const isCompleted = enrollment?.status === 'completed';
          return (
            <div key={cred.id} style={{ background: '#fff', border: `1px solid ${enrollment ? 'var(--accent)' : 'var(--gray-200)'}`, borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', boxShadow: enrollment ? '0 0 0 2px var(--accent-light)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cred.employer_endorsed && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)' }}>✓ Employer endorsed</span>}
                  {isCompleted && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#7C3AED' }}>Completed</span>}
                  {enrollment && !isCompleted && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--brand-light)', color: 'var(--brand)' }}>In progress</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: cred.demand_score >= 90 ? '#DCFCE7' : 'var(--brand-light)', color: cred.demand_score >= 90 ? '#059669' : 'var(--brand)' }}>{cred.demand_score}/100</span>
              </div>

              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{cred.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>{cred.provider}</p>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {(cred.skills_taught || []).map(s => (
                  <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>{s}</span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gray-500)' }}><Clock size={13} />{cred.duration_weeks}w</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gray-500)' }}><DollarSign size={13} />${cred.cost_usd?.toLocaleString()}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}><Star size={13} />{Math.round((cred.placement_rate || 0) * 100)}% placed</span>
              </div>

              {enrollment && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)' }}>Your progress</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? 'var(--accent)' : 'var(--brand)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                  {!isCompleted && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {[25, 50, 75, 100].map(pct => (
                        <button key={pct} onClick={() => updateProgress(enrollment.id, pct)} style={{
                          flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          borderColor: progress >= pct ? 'var(--accent)' : 'var(--gray-200)',
                          background: progress >= pct ? 'var(--accent-light)' : '#fff',
                          color: progress >= pct ? 'var(--accent)' : 'var(--gray-500)'
                        }}>{pct}%</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => !enrollment && enroll(cred.id)} disabled={!!enrollment || enrolling === cred.id} style={{
                marginTop: 'auto', padding: '10px', borderRadius: 9, fontWeight: 600, fontSize: 13, border: 'none',
                background: isCompleted ? '#EDE9FE' : enrollment ? 'var(--accent-light)' : 'var(--brand)',
                color: isCompleted ? '#7C3AED' : enrollment ? 'var(--accent)' : '#fff',
                cursor: enrollment ? 'default' : 'pointer'
              }}>
                {isCompleted ? <><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Completed</> :
                  enrollment ? <><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Enrolled — update progress above</> :
                  enrolling === cred.id ? 'Enrolling...' : 'Enrol in this credential'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
