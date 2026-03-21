import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Zap, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, CartesianGrid, Legend
} from 'recharts';
import { signalAPI } from '../lib/api';

const COLORS = ['#1F4D8C', '#2B5FAA', '#3B7EC8', '#2D9B6F', '#38B885', '#7C3AED', '#9B5DE5'];

const CATEGORY_COLORS = {
  'AI/ML': '#7C3AED',
  'Data': '#1F4D8C',
  'Product': '#2D9B6F',
  'Policy': '#D97706',
};

export default function Signal() {
  const [signals, setSignals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeChart, setActiveChart] = useState('bar');
  const [roiSalary, setRoiSalary] = useState(60000);
  const [roiSkill, setRoiSkill] = useState('');

  useEffect(() => {
    signalAPI.list().then(r => setSignals(r.data)).catch(() => {});
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/signal/summary`)
      .then(r => r.json()).then(setSummary).catch(() => {});
  }, []);

  const categories = ['All', ...new Set(signals.map(s => s.category).filter(Boolean))];
  const filtered = activeCategory === 'All' ? signals : signals.filter(s => s.category === activeCategory);

  const chartData = filtered.map(s => ({
    name: s.skill_name.split(' ')[0],
    fullName: s.skill_name,
    demand: s.demand_score,
    growth: s.growth_rate,
    uplift: Math.round(s.avg_salary_uplift / 1000),
  }));

  const radarData = filtered.map(s => ({
    skill: s.skill_name.split(' ')[0],
    demand: s.demand_score,
    growth: Math.min(s.growth_rate, 100),
    uplift: Math.round(s.avg_salary_uplift / 1000),
  }));

  // ROI calculator
  const selectedSignal = signals.find(s => s.skill_name === roiSkill) || signals[0];
  const roiUplift = selectedSignal?.avg_salary_uplift || 0;
  const roiNewSalary = roiSalary + roiUplift;
  const roiWeeks = 12;
  const roiCost = 800;
  const roiNetGain = roiUplift * 2 - roiCost;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Skills Demand Signal</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>
          Real-time labour market data. Demand scores, growth rates, and salary uplift across all AI skill categories.
        </p>
      </div>

      {/* Summary stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Avg demand score', value: `${summary.avg_demand_score}/100`, color: 'var(--brand)', icon: BarChart2 },
            { label: 'Avg YoY growth', value: `+${summary.avg_growth_rate}%`, color: 'var(--accent)', icon: TrendingUp },
            { label: 'Avg salary uplift', value: `+$${Math.round(summary.avg_salary_uplift / 1000)}K`, color: '#7C3AED', icon: DollarSign },
            { label: 'Hottest skill', value: summary.hottest_skill?.split(' ')[0], color: '#D97706', icon: Zap },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{label}</span>
                <Icon size={14} color={color} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1px solid',
            borderColor: activeCategory === cat ? (CATEGORY_COLORS[cat] || 'var(--brand)') : 'var(--gray-200)',
            background: activeCategory === cat ? (CATEGORY_COLORS[cat] || 'var(--brand)') : '#fff',
            color: activeCategory === cat ? '#fff' : 'var(--gray-600)',
          }}>{cat}</button>
        ))}
      </div>

      {/* Chart type toggle */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15 }}>Demand visualisation</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['bar', 'Bar chart'], ['radar', 'Radar'], ['scatter', 'Growth vs Demand']].map(([v, l]) => (
              <button key={v} onClick={() => setActiveChart(v)} style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: '1px solid',
                borderColor: activeChart === v ? 'var(--brand)' : 'var(--gray-200)',
                background: activeChart === v ? 'var(--brand-light)' : '#fff',
                color: activeChart === v ? 'var(--brand)' : 'var(--gray-600)',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {activeChart === 'bar' && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n, p) => [`${v}/100`, p.payload.fullName]} />
              <Bar dataKey="demand" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'radar' && (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--gray-200)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="Demand" dataKey="demand" stroke="#1F4D8C" fill="#1F4D8C" fillOpacity={0.25} />
              <Radar name="Growth" dataKey="growth" stroke="#2D9B6F" fill="#2D9B6F" fillOpacity={0.2} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'scatter' && (
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
              <CartesianGrid stroke="var(--gray-100)" />
              <XAxis dataKey="demand" name="Demand score" domain={[70, 100]} tick={{ fontSize: 11 }} label={{ value: 'Demand →', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis dataKey="growth" name="YoY growth %" tick={{ fontSize: 11 }} label={{ value: 'Growth %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <ZAxis dataKey="uplift" range={[60, 300]} name="Salary uplift $K" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{filtered[chartData.findIndex(c => c.demand === d.demand)]?.skill_name || ''}</div>
                    <div>Demand: <strong>{d.demand}/100</strong></div>
                    <div>Growth: <strong>+{d.growth}% YoY</strong></div>
                    <div>Uplift: <strong>+${d.uplift}K</strong></div>
                  </div>
                );
              }} />
              <Scatter data={chartData} fill="#1F4D8C" fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8, textAlign: 'center' }}>
          {activeChart === 'scatter' ? 'Bubble size = salary uplift potential' : 'Demand score out of 100'}
        </div>
      </div>

      {/* Salary ROI calculator */}
      <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <DollarSign size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 15 }}>Skill ROI calculator</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
              Your current salary: <span style={{ color: 'var(--brand)' }}>${roiSalary.toLocaleString()}</span>
            </label>
            <input type="range" min={20000} max={150000} step={1000} value={roiSalary}
              onChange={e => setRoiSalary(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Skill to learn</label>
            <select value={roiSkill} onChange={e => setRoiSkill(e.target.value)}>
              <option value="">Top skill ({signals[0]?.skill_name})</option>
              {signals.map(s => <option key={s.id} value={s.skill_name}>{s.skill_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {[
            { label: 'Salary uplift', value: `+$${roiUplift.toLocaleString()}`, color: 'var(--accent)', bg: 'var(--accent-light)' },
            { label: 'New salary', value: `$${roiNewSalary.toLocaleString()}`, color: 'var(--brand)', bg: 'var(--brand-light)' },
            { label: 'Typical study time', value: `~${roiWeeks} weeks`, color: '#7C3AED', bg: '#F5F3FF' },
            { label: '2-year net gain', value: `+$${roiNetGain.toLocaleString()}`, color: roiNetGain > 0 ? 'var(--accent)' : '#DC2626', bg: roiNetGain > 0 ? 'var(--accent-light)' : '#FEF2F2' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map((s, i) => (
          <div key={s.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 20, transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{s.skill_name}</h3>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: `${CATEGORY_COLORS[s.category] || 'var(--brand)'}18`, color: CATEGORY_COLORS[s.category] || 'var(--brand)', fontWeight: 600 }}>
                  {s.category}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{s.demand_score}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>/ 100</div>
              </div>
            </div>

            <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.demand_score}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: 'width 0.8s ease' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--accent-light)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>YoY growth</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={13} />+{s.growth_rate}%
                </div>
              </div>
              <div style={{ background: 'var(--brand-light)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 600, marginBottom: 2 }}>Avg uplift</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <DollarSign size={13} />+${(s.avg_salary_uplift / 1000).toFixed(0)}K
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>Top hiring employers</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(s.top_employers || []).map(e => (
                  <span key={e} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-700)' }}>{e}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
