import React, { useEffect, useState } from 'react';
import { Building2, Briefcase, CheckCircle, Calendar, Clock } from 'lucide-react';
import { employerAPI } from '../lib/api';
import { useWorker } from '../App';

const SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i + 3);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
});

export default function Employers() {
  const { worker } = useWorker();
  const [employers, setEmployers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [booking, setBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    employerAPI.list().then(r => setEmployers(r.data)).catch(() => {});
    if (worker) employerAPI.bookings(worker.id).then(r => setBookings(r.data)).catch(() => {});
  }, [worker]);

  const bookedIds = new Set(bookings.map(b => b.employer_id));
  const totalSlots = employers.reduce((a, e) => a + (e.interview_slots || 0), 0);

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
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Pre-committed interview slots from top employers. Book yours when you're ready.</p>
      </div>

      <div style={{ background: 'var(--brand)', borderRadius: 14, padding: '22px 28px', marginBottom: 24, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Available interview slots</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{totalSlots}</div>
        </div>
        <div style={{ fontSize: 14, opacity: 0.85, maxWidth: 340, lineHeight: 1.6 }}>
          These employers have pre-agreed to interview PivotPath graduates. Complete your credential pathway, then book your slot.
        </div>
      </div>

      {/* My bookings */}
      {bookings.length > 0 && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid rgba(45,155,111,0.2)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--accent)' }}>My booked interviews</h3>
          {bookings.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(45,155,111,0.1)' }}>
              <CheckCircle size={18} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.employer_name}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{b.slot_date} at {b.slot_time}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#fff', color: 'var(--accent)' }}>Confirmed</span>
            </div>
          ))}
        </div>
      )}

      {/* Booking modal */}
      {booking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480 }}>
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
                      <button key={d} onClick={() => setSelectedDate(d)} style={{
                        padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                        borderColor: selectedDate === d ? 'var(--brand)' : 'var(--gray-200)',
                        background: selectedDate === d ? 'var(--brand-light)' : '#fff',
                        color: selectedDate === d ? 'var(--brand)' : 'var(--gray-700)', fontWeight: selectedDate === d ? 600 : 400
                      }}>{d}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>Select time</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SLOTS.map(t => (
                      <button key={t} onClick={() => setSelectedTime(t)} style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid',
                        borderColor: selectedTime === t ? 'var(--brand)' : 'var(--gray-200)',
                        background: selectedTime === t ? 'var(--brand-light)' : '#fff',
                        color: selectedTime === t ? 'var(--brand)' : 'var(--gray-700)', fontWeight: selectedTime === t ? 600 : 400
                      }}>{t}</button>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {employers.map(e => {
          const isBooked = bookedIds.has(e.id);
          return (
            <div key={e.id} style={{ background: '#fff', border: `1px solid ${isBooked ? 'var(--accent)' : 'var(--gray-200)'}`, borderRadius: 14, padding: 24, boxShadow: isBooked ? '0 0 0 2px var(--accent-light)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} color="var(--brand)" />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 17 }}>{e.name}</h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{e.industry}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{e.interview_slots}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>slots left</div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Briefcase size={12} /> Open roles</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(e.open_roles || []).map(r => (
                    <span key={r} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 500 }}>{r}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle size={12} color="var(--accent)" /> Skills they're hiring for</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(e.skills_needed || []).map(s => (
                    <span key={s} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 500 }}>{s}</span>
                  ))}
                </div>
              </div>

              <button onClick={() => !isBooked && e.interview_slots > 0 && setBooking(e)}
                disabled={isBooked || e.interview_slots === 0}
                style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', fontWeight: 600, fontSize: 13, cursor: isBooked || e.interview_slots === 0 ? 'default' : 'pointer',
                  background: isBooked ? 'var(--accent-light)' : e.interview_slots === 0 ? 'var(--gray-100)' : 'var(--brand)',
                  color: isBooked ? 'var(--accent)' : e.interview_slots === 0 ? 'var(--gray-400)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isBooked ? <><CheckCircle size={14} /> Booked</> : e.interview_slots === 0 ? 'No slots available' : <><Calendar size={14} /> Book interview slot</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
