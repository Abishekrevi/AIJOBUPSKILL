import React, { useEffect, useState } from 'react';
import { Briefcase, Clock, DollarSign, Wifi, WifiOff } from 'lucide-react';
import { gigAPI } from '../lib/api';

export default function GigMarketplace() {
  const [gigs, setGigs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { gigAPI.list().then(r => setGigs(r.data)).catch(() => {}); }, []);

  const filtered = filter === 'remote' ? gigs.filter(g => g.remote) : filter === 'onsite' ? gigs.filter(g => !g.remote) : gigs;
  const totalEarnings = gigs.reduce((a, g) => a + (g.rate_per_day * (g.duration_weeks || 4) * 5), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gig Marketplace</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Short-term consulting contracts to keep you earning while you reskill. Apply your existing expertise immediately.</p>
      </div>

      {/* Banner */}
      <div style={{ background: 'var(--brand)', borderRadius: 14, padding: '20px 28px', marginBottom: 24, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Total earning potential across all gigs</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>${totalEarnings.toLocaleString()}</div>
        </div>
        <div style={{ fontSize: 14, opacity: 0.85, maxWidth: 340, lineHeight: 1.6 }}>
          Stay financially stable during your transition. Mid-career consultants average $8,500/month on short contracts while completing their credential pathway.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['all', 'All gigs'], ['remote', 'Remote only'], ['onsite', 'On-site']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1px solid', transition: 'all 0.15s',
            borderColor: filter === v ? 'var(--brand)' : 'var(--gray-200)',
            background: filter === v ? 'var(--brand)' : '#fff',
            color: filter === v ? '#fff' : 'var(--gray-600)'
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {filtered.map(gig => {
          const totalEarn = gig.rate_per_day * (gig.duration_weeks || 4) * 5;
          return (
            <div key={gig.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Briefcase size={18} color="var(--brand)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 15 }}>{gig.title}</h3>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{gig.company}</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4,
                  background: gig.remote ? 'var(--accent-light)' : 'var(--brand-light)',
                  color: gig.remote ? 'var(--accent)' : 'var(--brand)' }}>
                  {gig.remote ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {gig.remote ? 'Remote' : 'On-site'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                  <DollarSign size={14} color="var(--accent)" />
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${gig.rate_per_day}/day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--gray-500)' }}>
                  <Clock size={14} />
                  {gig.duration_weeks} weeks
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>Skills needed</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(gig.skills_needed || []).map(s => (
                    <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-700)' }}>{s}</span>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Total contract value</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>${totalEarn.toLocaleString()}</span>
              </div>

              <button style={{ width: '100%', padding: '10px', borderRadius: 9, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                Express interest
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
