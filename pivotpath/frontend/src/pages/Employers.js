import React, { useEffect, useState } from 'react';
import { Building2, Briefcase, CheckCircle, Calendar, Star, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { employerAPI } from '../lib/api';
import { useWorker } from '../App';

const SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i + 3);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
});

const INTERVIEW_PREP = {
  'Stripe': [
    'Research Stripe\'s latest product launches (Stripe Tax, Stripe Climate)',
    'Be ready to discuss payment infrastructure and fintech trends',
    'Prepare a story about working with data at scale',
    'Know the difference between issuing and acquiring in payments',
    'Review their engineering blog at stripe.com/blog',
  ],
  'Salesforce': [
    'Understand Salesforce Einstein AI and its use in CRM',
    'Prepare examples of how AI improves sales workflows',
    'Be ready to discuss prompt engineering in enterprise contexts',
    'Study the Salesforce Platform and AppExchange ecosystem',
    'Know Trailhead and how they approach training',
  ],
  'Deloitte': [
    'Understand consulting frameworks: MECE, issue trees',
    'Prepare a case study on AI transformation for a client',
    'Be ready for behavioural questions (STAR format)',
    'Research Deloitte AI Institute publications',
    'Know the difference between advisory, risk, and tax services',
  ],
};

export default function Employers() {
  const { worker } = useWorker();
  const [employers, setEmployers] = useState([]);
  const [matchedEmployers, setMatchedEmployers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [booking, setBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [expandedPrep, setExpandedPrep] = useState(null);
  const [viewMode, setViewMode] = useState('matched');

  useEffect(() => {
    employerAPI.list().then(r => setEmployers(r.data)).catch(() => { });
    if (worker) {
      employerAPI.bookings(worker.id).then(r => setBookings(r.data)).catch(() => { });
      employerAPI.match(worker.id).then(r => setMatchedEmployers(r.data)).catch(() => { });
    }
  }, [worker]);

  const displayEmployers = viewMode === 'matched' && matchedEmployers.length > 0 ? matchedEmployers : employers;
  const bookedIds = new Set(bookings.map(b => b.employer_id));
  const totalSlots = employers.reduce((a, e) => a + (e.interview_slots || 0), 0);
  const workerSkills = (worker?.skills_summary || '').toLowerCase();

  const confirmBooking = async () => {
    if (!selectedDate || !selectedTime || !booking) return;
    setLoading(true);
    try {
      await employerAPI.book({ worker_id: worker.id, employer_id: booking.id, slot_date: selectedDate, slot_time: selectedTime });
      const res = await employerAPI.bookings(worker.id);
      setBookings(res.data);
      const empRes = await employerAPI.list();
      setEmployers(empRes.data);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setBooking(null); setSelectedDate(''); setSelectedTime(''); }, 3000);
    } catch (e) {
      alert(e.response?.data?.detail || 'Booking failed');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Employer Pipeline</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Pre-committed interview slots ranked by your skill match. Each card includes interview prep guidance.</p>
      </div>

      {/* Banner */}
      <div style={{ background: 'var(--brand)', borderRadius: 14, padding: '22px 28px', marginBottom: 24, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Available interview slots</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>{totalSlots}</div>
        </div>
        <div style={{ fontSize: 14, opacity: 0.85, maxWidth: 340, lineHeight: 1.6 }}>
          Employers have pre-agreed to interview PivotPath graduates. Your skill match score tells you which to prioritise.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['matched', '✦ Best match'], ['all', 'All employers']].map(([v, l]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.4)', background: viewMode === v ? 'rgba(255,255,255,0.2)' : 'transparent', color: '#fff', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* My bookings */}
      {bookings.length > 0 && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid rgba(45,155,111,0.2)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--accent)' }}>My booked interviews</h3>
          {bookings.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(45,155,111,0.1)' }}>
              <CheckCircle size={18} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.employer_name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{b.slot_date} at {b.slot_time}</div>
              </div>
              <button onClick={() => setExpandedPrep(expandedPrep === b.employer_name ? null : b.employer_name)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-light)', border: 'none', borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>
                <BookOpen size={12} /> Prep guide
              </button>
            </div>
          ))}
          {/* Inline prep guide */}
          {expandedPrep && INTERVIEW_PREP[expandedPrep] && (
            <div style={{ marginTop: 16, background: '#fff', borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--brand)' }}>{expandedPrep} — Interview prep checklist</div>
              {INTERVIEW_PREP[expandedPrep].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, fontSize: 13 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: '1.5px solid var(--gray-200)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: 'var(--gray-700)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking modal */}
      {booking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Book interview — {booking.name}</h3>
            <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 24 }}>Select a date and time for your interview.</p>
            {success ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={48} color="var(--accent)" style={{ margin: '0 auto 16px', display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>Interview booked!</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>{selectedDate} at {selectedTime}</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Select date</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {DATES.map(d => (
                      <button key={d} onClick={() => setSelectedDate(d)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: selectedDate === d ? 'var(--brand)' : 'var(--gray-200)', background: selectedDate === d ? 'var(--brand-light)' : '#fff', color: selectedDate === d ? 'var(--brand)' : 'var(--gray-700)', fontWeight: selectedDate === d ? 600 : 400 }}>{d}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Select time</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SLOTS.map(t => (
                      <button key={t} onClick={() => setSelectedTime(t)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid', borderColor: selectedTime === t ? 'var(--brand)' : 'var(--gray-200)', background: selectedTime === t ? 'var(--brand-light)' : '#fff', color: selectedTime === t ? 'var(--brand)' : 'var(--gray-700)', fontWeight: selectedTime === t ? 600 : 400 }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setBooking(null); setSelectedDate(''); setSelectedTime(''); }} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={confirmBooking} disabled={!selectedDate || !selectedTime || loading} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', fontWeight: 600, cursor: selectedDate && selectedTime ? 'pointer' : 'not-allowed', background: selectedDate && selectedTime ? 'var(--brand)' : 'var(--gray-200)', color: selectedDate && selectedTime ? '#fff' : 'var(--gray-400)' }}>
                    {loading ? 'Booking...' : 'Confirm interview'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {displayEmployers.map(e => {
          const isBooked = bookedIds.has(e.id);
          const matchScore = e.match_score ?? null;
          const hasPrep = !!INTERVIEW_PREP[e.name];
          const isPrepOpen = expandedPrep === e.name + '_card';

          return (
            <div key={e.id} style={{ background: '#fff', border: `1.5px solid ${isBooked ? 'var(--accent)' : matchScore >= 60 ? 'rgba(31,77,140,0.3)' : 'var(--gray-200)'}`, borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} color="var(--brand)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16 }}>{e.name}</h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{e.industry}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{e.interview_slots}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>slots left</div>
                </div>
              </div>

              {/* Match score */}
              {matchScore !== null && (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: matchScore >= 60 ? 'var(--accent-light)' : matchScore >= 30 ? 'var(--brand-light)' : 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Star size={13} color={matchScore >= 60 ? 'var(--accent)' : matchScore >= 30 ? 'var(--brand)' : 'var(--gray-400)'} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: matchScore >= 60 ? 'var(--accent)' : matchScore >= 30 ? 'var(--brand)' : 'var(--gray-500)' }}>
                    {matchScore}% skill match
                  </span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${matchScore}%`, background: matchScore >= 60 ? 'var(--accent)' : 'var(--brand)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Briefcase size={12} /> Open roles</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(e.open_roles || []).map(r => (
                    <span key={r} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 500 }}>{r}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>Skills hiring for</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(e.skills_needed || []).map(s => {
                    const hasIt = workerSkills.includes(s.toLowerCase().split(' ')[0]);
                    return (
                      <span key={s} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: hasIt ? 'var(--accent-light)' : 'var(--gray-100)', color: hasIt ? 'var(--accent)' : 'var(--gray-600)', fontWeight: hasIt ? 600 : 400 }}>
                        {hasIt ? '✓ ' : ''}{s}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Interview prep toggle */}
              {hasPrep && (
                <>
                  <button onClick={() => setExpandedPrep(isPrepOpen ? null : e.name + '_card')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', cursor: 'pointer', marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> Interview prep checklist</span>
                    {isPrepOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isPrepOpen && (
                    <div style={{ background: 'var(--brand-light)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                      {INTERVIEW_PREP[e.name].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, fontSize: 12 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 3, border: '1.5px solid var(--brand)', flexShrink: 0, marginTop: 1 }} />
                          <span style={{ color: 'var(--gray-700)', lineHeight: 1.5 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <button onClick={() => !isBooked && e.interview_slots > 0 && setBooking(e)}
                disabled={isBooked || e.interview_slots === 0}
                style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', fontWeight: 600, fontSize: 13, cursor: isBooked || e.interview_slots === 0 ? 'default' : 'pointer', background: isBooked ? 'var(--accent-light)' : e.interview_slots === 0 ? 'var(--gray-100)' : matchScore >= 60 ? 'var(--accent)' : 'var(--brand)', color: isBooked ? 'var(--accent)' : e.interview_slots === 0 ? 'var(--gray-400)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isBooked ? <><CheckCircle size={14} /> Booked</> : e.interview_slots === 0 ? 'No slots available' : <><Calendar size={14} /> {matchScore >= 60 ? 'Book — strong match' : 'Book interview slot'}</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}