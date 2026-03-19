import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { signalAPI } from '../lib/api';

export default function Signal() {
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    signalAPI.list().then(r => setSignals(r.data)).catch(() => {});
  }, []);

  const chartData = signals.map(s => ({ name: s.skill_name.split(' ')[0], demand: s.demand_score, growth: s.growth_rate }));
  const COLORS = ['#1F4D8C', '#2B5FAA', '#3B7EC8', '#2D9B6F', '#38B885', '#7C3AED', '#9B5DE5'];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Skills Demand Signal</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>
          Real-time labour market data. Updated nightly from job postings and employer ATS pipelines.
        </p>
      </div>

      {/* Chart */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Demand score by skill (0–100)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}/100`, 'Demand score']} />
            <Bar dataKey="demand" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Signal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {signals.map((s, i) => (
          <div key={s.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15 }}>{s.skill_name}</h3>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 500 }}>
                  {s.category}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{s.demand_score}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>/ 100</div>
              </div>
            </div>

            <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${s.demand_score}%`, background: COLORS[i % COLORS.length], borderRadius: 4 }} />
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <TrendingUp size={14} color="var(--accent)" />
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>+{s.growth_rate}%</span>
                <span style={{ color: 'var(--gray-400)' }}>YoY</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <DollarSign size={14} color="var(--brand)" />
                <span style={{ fontWeight: 600, color: 'var(--brand)' }}>+${(s.avg_salary_uplift / 1000).toFixed(0)}K</span>
                <span style={{ color: 'var(--gray-400)' }}>avg uplift</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--gray-500)', marginBottom: 6 }}>Top hiring employers</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(s.top_employers || []).map(e => (
                  <span key={e} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-700)' }}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
