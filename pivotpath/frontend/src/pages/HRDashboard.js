import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, DollarSign, Building2, PlusCircle, CheckCircle, AlertTriangle, ListOrdered } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { hrAPI, workerAPI } from '../lib/api';

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [dropoutRisk, setDropoutRisk] = useState(null);
  const [interviewQueue, setInterviewQueue] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', contact_name: '', contact_email: '', contract_value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hrAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
    workerAPI.list().then(r => setWorkers(r.data)).catch(() => {});
    hrAPI.companies().then(r => setCompanies(r.data)).catch(() => {});
    hrAPI.cohortAnalytics().then(r => setCohorts(r.data?.cohorts || [])).catch(() => {});
    hrAPI.dropoutRisk().then(r => setDropoutRisk(r.data)).catch(() => {});
    hrAPI.interviewQueue().then(r => setInterviewQueue(r.data)).catch(() => {});
  }, []);

  const statusColors = { onboarding: '#D97706', active: '#2B5FAA', learning: '#2D9B6F', placed: '#059669', paused: '#9CA3AF' };

  const addCompany = async () => {
    setSaving(true);
    try {
      await hrAPI.createCompany({ ...form, contract_value: parseFloat(form.contract_value) || null });
      setShowForm(false);
      setForm({ name: '', industry: '', contact_name: '', contact_email: '', contract_value: '' });
      hrAPI.companies().then(r => setCompanies(r.data));
      hrAPI.dashboard().then(r => setStats(r.data));
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'cohorts', label: 'Cohort Analytics' },
    { id: 'risk', label: `Dropout Risk ${dropoutRisk?.risk_count > 0 ? `(${dropoutRisk.risk_count})` : ''}` },
    { id: 'queue', label: 'Interview Queue' },
    { id: 'companies', label: 'Companies' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>HR Transition Dashboard</h1>
          <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Real-time view of your workforce transition programme.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
          <PlusCircle size={15} /> Add HR Company
        </button>
      </div>

      {/* Add company form */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>New HR Company</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['name', 'Company name', 'e.g. Acme Corp'], ['industry', 'Industry', 'e.g. Technology'], ['contact_name', 'Contact name', 'e.g. Jane Smith'], ['contact_email', 'Contact email', 'jane@acme.com'], ['contract_value', 'Contract value ($)', 'e.g. 500000']].map(([k, label, ph]) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addCompany} disabled={saving || !form.name} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save company'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '9px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid', borderBottom: activeTab === t.id ? '1px solid #fff' : '1px solid var(--gray-200)',
            marginBottom: activeTab === t.id ? '-1px' : 0,
            borderColor: activeTab === t.id ? 'var(--gray-200)' : 'transparent',
            background: activeTab === t.id ? '#fff' : 'transparent',
            color: activeTab === t.id ? 'var(--brand)' : 'var(--gray-500)',
            position: 'relative'
          }}>
            {t.id === 'risk' && dropoutRisk?.risk_count > 0 && (
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EF4444', marginRight: 6 }} />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Total workers', value: stats.total_workers, icon: Users, color: 'var(--brand)' },
                { label: 'Workers placed', value: stats.workers_placed, icon: CheckCircle, color: 'var(--accent)' },
                { label: 'Placement rate', value: `${stats.placement_rate}%`, icon: TrendingUp, color: '#059669' },
                { label: 'HR companies', value: stats.hr_companies, icon: Building2, color: '#7C3AED' },
                { label: 'Cost per placement', value: `$${stats.cost_per_placement?.toLocaleString()}`, icon: DollarSign, color: '#B45309' },
                { label: 'Avg salary uplift', value: `$${stats.avg_salary_uplift?.toLocaleString()}`, icon: TrendingUp, color: '#0369A1' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{label}</span>
                    <Icon size={16} color={color} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Cohort placement rates</h3>
              {cohorts.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={cohorts}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip formatter={v => [`${v}%`, 'Placement rate']} />
                    <Bar dataKey="placement_rate" radius={[4, 4, 0, 0]} fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40, fontSize: 13 }}>No cohort data yet</div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Worker roster</h3>
              {workers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '30px 0', fontSize: 13 }}>No workers enrolled yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {workers.map(w => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{w.current_role}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: `${statusColors[w.status]}22`, color: statusColors[w.status] }}>{w.status}</span>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{w.progress_pct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* COHORT ANALYTICS TAB */}
      {activeTab === 'cohorts' && (
        <div>
          <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.15)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, fontSize: 13, color: 'var(--brand)' }}>
            Workers grouped by enrolment month. Tracks placement rates, avg progress, and engagement per cohort.
          </div>
          {cohorts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 60, fontSize: 14 }}>No cohort data yet — enrol some workers first.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220} style={{ marginBottom: 24 }}>
                <LineChart data={cohorts}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="placement_rate" stroke="var(--accent)" strokeWidth={2} name="Placement %" dot={false} />
                  <Line type="monotone" dataKey="avg_progress" stroke="var(--brand)" strokeWidth={2} name="Avg progress %" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                    {['Month', 'Workers', 'Avg progress', 'Placement rate', 'Learning', 'ISA signed'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: 'var(--gray-600)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c, i) => (
                    <tr key={c.month} style={{ background: i % 2 === 0 ? '#fff' : 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.month}</td>
                      <td style={{ padding: '10px 14px' }}>{c.count}</td>
                      <td style={{ padding: '10px 14px' }}>{c.avg_progress}%</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: c.placement_rate > 50 ? 'var(--accent)' : 'var(--gray-600)' }}>{c.placement_rate}%</td>
                      <td style={{ padding: '10px 14px' }}>{c.learning}</td>
                      <td style={{ padding: '10px 14px' }}>{c.isa_signed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* DROPOUT RISK TAB */}
      {activeTab === 'risk' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <AlertTriangle size={18} color={dropoutRisk?.risk_count > 0 ? '#EF4444' : 'var(--gray-400)'} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {dropoutRisk?.risk_count || 0} workers flagged at dropout risk out of {dropoutRisk?.total_assessed || 0} assessed
            </span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 4 }}>— Isolation Forest anomaly detection</span>
          </div>
          {!dropoutRisk?.at_risk?.length ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 60, fontSize: 14 }}>
              {dropoutRisk?.total_assessed < 5 ? 'Need at least 5 workers to run dropout detection.' : 'No workers currently flagged at risk. ✓'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dropoutRisk.at_risk.map(w => (
                <div key={w.worker_id} style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#DC2626' }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Status: {w.status} · {w.days_enrolled} days enrolled · {w.progress_pct}% progress</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#DC2626', color: '#fff' }}>At risk</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INTERVIEW QUEUE TAB */}
      {activeTab === 'queue' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ListOrdered size={16} color="var(--brand)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Priority queue — ranked by skill match (60%) + completion (40%)</span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 4 }}>— Min-heap algorithm</span>
          </div>
          {!interviewQueue?.queue?.length ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 60, fontSize: 14 }}>No workers in queue yet.</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                    {['Rank', 'Worker', 'Priority score', 'Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: 'var(--gray-600)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interviewQueue.queue.map((entry, i) => (
                    <tr key={entry.worker_id} style={{ borderBottom: '1px solid var(--gray-100)', background: i === 0 ? 'rgba(45,155,111,0.04)' : '#fff' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--gray-400)', fontSize: 18 }}>#{i + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{entry.name || entry.worker_id.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ height: 6, width: 80, background: 'var(--gray-100)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${entry.priority_score}%`, background: 'var(--accent)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{entry.priority_score}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {i === 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: 'var(--accent)', color: '#fff' }}>Next for interview</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-500)' }}>
                {interviewQueue.total_in_queue} workers total in queue
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPANIES TAB */}
      {activeTab === 'companies' && companies.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>HR Company Contracts</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                {['Company', 'Industry', 'Contact', 'Contract value', 'Workers enrolled'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--gray-600)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gray-500)' }}>{c.industry}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gray-500)' }}>{c.contact_name}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent)' }}>{c.contract_value ? `$${c.contract_value.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{c.workers_enrolled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
