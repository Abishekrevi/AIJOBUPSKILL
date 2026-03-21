import React, { useEffect, useState } from 'react';
import { Briefcase, Clock, DollarSign, Wifi, WifiOff, TrendingUp, Star } from 'lucide-react';
import { gigAPI, signalAPI } from '../lib/api';
import { useWorker } from '../App';

export default function GigMarketplace() {
  const { worker } = useWorker();
  const [gigs, setGigs] = useState([]);
  const [signals, setSignals] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('match');
  const [weeksPerMonth, setWeeksPerMonth] = useState(4);

  useEffect(() => {
    gigAPI.list().then(r => setGigs(r.data)).catch(() => {});
    signalAPI.list().then(r => setSignals(r.data)).catch(() => {});
  }, []);

  // Compute skill match score for each gig against the worker's skills
  const workerSkills = (worker?.skills_summary || '').toLowerCase();
  const workerTarget = (worker?.target_role || '').toLowerCase();

  const scoredGigs = gigs.map(gig => {
    const needed = (gig.skills_needed || []).map(s => s.toLowerCase());
    const signalMap = {};
    signals.forEach(s => { signalMap[s.skill_name.toLowerCase()] = s.demand_score; });
    const matchCount = needed.filter(s => workerSkills.includes(s.split(' ')[0])).length;
    const matchScore = needed.length > 0 ? Math.round((matchCount / needed.length) * 100) : 0;
    const avgDemand = needed.length > 0
      ? Math.round(needed.reduce((sum, s) => sum + (signalMap[s] || 70), 0) / needed.length)
      : 70;
    const totalEarnings = gig.rate_per_day * (gig.duration_weeks || 4) * 5;
    const monthlyEarnings = gig.rate_per_day * weeksPerMonth * 5;
    return { ...gig, matchScore, avgDemand, totalEarnings, monthlyEarnings };
  });

  const filtered = filter === 'remote' ? scoredGigs.filter(g => g.remote)
                 : filter === 'onsite' ? scoredGigs.filter(g => !g.remote)
                 : scoredGigs;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'match') return b.matchScore - a.matchScore;
    if (sortBy === 'rate') return b.rate_per_day - a.rate_per_day;
    if (sortBy === 'demand') return b.avgDemand - a.avgDemand;
    return 0;
  });

  const totalPotential = sorted.reduce((a, g) => a + g.totalEarnings, 0);
  const avgRate = sorted.length > 0 ? Math.round(sorted.reduce((a, g) => a + g.rate_per_day, 0) / sorted.length) : 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gig Marketplace</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Short-term consulting contracts to keep you earning while you reskill. Skill match score shows how well each gig fits your profile.</p>
      </div>

      {/* Stats banner */}
      <div style={{ background: 'var(--brand)', borderRadius: 14, padding: '20px 28px', marginBottom: 24, color: '#fff', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Total earning potential</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>${totalPotential.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Avg day rate</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>${avgRate}/day</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Weeks per month working</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={1} max={4} value={weeksPerMonth} onChange={e => setWeeksPerMonth(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#7DB3F5' }} />
            <span style={{ fontWeight: 700, minWidth: 24 }}>{weeksPerMonth}w</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Monthly at {weeksPerMonth}w/mo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7DB3F5' }}>${(avgRate * weeksPerMonth * 5).toLocaleString()}</div>
        </div>
      </div>

      {/* Filters + sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', 'All gigs'], ['remote', 'Remote only'], ['onsite', 'On-site']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: filter === v ? 'var(--brand)' : 'var(--gray-200)', background: filter === v ? 'var(--brand)' : '#fff', color: filter === v ? '#fff' : 'var(--gray-600)' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--gray-500)' }}>Sort by:</span>
          {[['match', 'Skill match'], ['rate', 'Day rate'], ['demand', 'Market demand']].map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v)} style={{ padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: sortBy === v ? 600 : 400, border: '1px solid', borderColor: sortBy === v ? 'var(--brand)' : 'var(--gray-200)', background: sortBy === v ? 'var(--brand-light)' : '#fff', color: sortBy === v ? 'var(--brand)' : 'var(--gray-600)', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {sorted.map(gig => (
          <div key={gig.id} style={{ background: '#fff', border: `1px solid ${gig.matchScore >= 60 ? 'rgba(45,155,111,0.3)' : 'var(--gray-200)'}`, borderRadius: 14, padding: 22, position: 'relative' }}>

            {/* Match score badge */}
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: gig.matchScore >= 60 ? 'var(--accent-light)' : gig.matchScore >= 30 ? 'var(--brand-light)' : 'var(--gray-100)', border: `1px solid ${gig.matchScore >= 60 ? 'rgba(45,155,111,0.2)' : 'var(--gray-200)'}` }}>
              <Star size={10} color={gig.matchScore >= 60 ? 'var(--accent)' : gig.matchScore >= 30 ? 'var(--brand)' : 'var(--gray-400)'} />
              <span style={{ fontSize: 11, fontWeight: 700, color: gig.matchScore >= 60 ? 'var(--accent)' : gig.matchScore >= 30 ? 'var(--brand)' : 'var(--gray-500)' }}>{gig.matchScore}% match</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, paddingRight: 80 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={18} color="var(--brand)" />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{gig.title}</h3>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {gig.company}
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: gig.remote ? 'var(--accent-light)' : 'var(--brand-light)', color: gig.remote ? 'var(--accent)' : 'var(--brand)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {gig.remote ? <Wifi size={9} /> : <WifiOff size={9} />} {gig.remote ? 'Remote' : 'On-site'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <DollarSign size={14} color="var(--accent)" />
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${gig.rate_per_day}/day</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--gray-500)' }}>
                <Clock size={14} />{gig.duration_weeks}w contract
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <TrendingUp size={14} color="var(--brand)" />
                <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>{gig.avgDemand}/100 demand</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>Skills needed</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(gig.skills_needed || []).map(s => {
                  const hasSkill = workerSkills.includes(s.toLowerCase().split(' ')[0]);
                  return (
                    <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: hasSkill ? 'var(--accent-light)' : 'var(--gray-100)', color: hasSkill ? 'var(--accent)' : 'var(--gray-700)', fontWeight: hasSkill ? 600 : 400 }}>
                      {hasSkill ? '✓ ' : ''}{s}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Earnings breakdown */}
            <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Total contract value</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>${gig.totalEarnings.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Monthly ({weeksPerMonth}w/mo)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>${gig.monthlyEarnings.toLocaleString()}/mo</span>
              </div>
            </div>

            <button style={{ width: '100%', padding: '10px', borderRadius: 9, background: gig.matchScore >= 60 ? 'var(--accent)' : 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              {gig.matchScore >= 60 ? '⭐ Express interest — strong match' : 'Express interest'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
