import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, DollarSign, Building2, PlusCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { hrAPI, workerAPI } from '../lib/api';

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', contact_name: '', contact_email: '', contract_value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hrAPI.dashboard().then(r => setStats(r.data)).catch(() => {});
    workerAPI.list().then(r => setWorkers(r.data)).catch(() => {});
    hrAPI.companies().then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  const placementData = [
    { month: 'Jan', placed: 4, active: 12 }, { month: 'Feb', placed: 7, active: 18 },
    { month: 'Mar', placed: 11, active: 24 }, { month: 'Apr', placed: 9, active: 29 },
    { month: 'May', placed: 16, active: 35 }, { month: 'Jun', placed: 22, active: 41 },
  ];

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>HR Transition Dashboard</h1>
          <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Real-time view of your workforce transition programme.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9,
          background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13
        }}>
          <PlusCircle size={15} /> Add HR Company
        </button>
      </div>

      {/* Add company form */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>New HR Company</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              ['name', 'Company name', 'e.g. Acme Corp'],
              ['industry', 'Industry', 'e.g. Technology'],
              ['contact_name', 'Contact name', 'e.g. Jane Smith'],
              ['contact_email', 'Contact email', 'jane@acme.com'],
              ['contract_value', 'Contract value ($)', 'e.g. 500000'],
            ].map(([k, label, ph]) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addCompany} disabled={saving || !form.name} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13 }}>
              {saving ? 'Saving...' : 'Save company'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 600, fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* KPI cards */}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Placement trend */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Placement trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={placementData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="placed" stroke="var(--accent)" strokeWidth={2} dot={false} name="Placed" />
              <Line type="monotone" dataKey="active" stroke="var(--brand)" strokeWidth={2} dot={false} name="Active" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Worker status breakdown */}
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
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                    background: `${statusColors[w.status]}22`, color: statusColors[w.status]
                  }}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Companies table */}
      {companies.length > 0 && (
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
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent)' }}>
                    {c.contract_value ? `$${c.contract_value.toLocaleString()}` : '—'}
                  </td>
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
