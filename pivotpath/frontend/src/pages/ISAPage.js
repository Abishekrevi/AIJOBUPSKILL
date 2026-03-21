import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, FileText, DollarSign, Shield, AlertCircle, Calculator } from 'lucide-react';
import { useWorker } from '../App';
import { workerAPI } from '../lib/api';

export default function ISAPage() {
  const { worker, setWorker } = useWorker();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [simSalary, setSimSalary] = useState(worker?.current_salary || 55000);
  const [simNewSalary, setSimNewSalary] = useState((worker?.current_salary || 55000) + 22000);
  const alreadySigned = worker?.isa_signed;

  const uplift = Math.max(0, simNewSalary - simSalary);
  const monthlyPayment = uplift > 0 ? Math.round((uplift * 0.12) / 12) : 0;
  const totalPayment = monthlyPayment * 24;
  const maxPayment = Math.round(uplift * 1.5);
  const aboveThreshold = simNewSalary >= 40000;

  const sign = async () => {
    setLoading(true);
    try {
      const res = await workerAPI.update(worker.id, { isa_signed: true });
      setWorker(res.data);
      setSigned(true);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  if (alreadySigned || signed) return (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <CheckCircle size={36} color="var(--accent)" />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>ISA Signed ✓</h1>
      <p style={{ color: 'var(--gray-600)', fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
        Your Income Share Agreement is active. You pay nothing until you're earning more in your new role.
      </p>
      <div style={{ background: 'var(--accent-light)', border: '1px solid rgba(45,155,111,0.2)', borderRadius: 14, padding: 24, marginBottom: 32, display: 'inline-block' }}>
        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Your ISA terms</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>12% of salary uplift · 24 months · $40K minimum</div>
      </div>
      <br />
      <button onClick={() => navigate('/')} style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Income Share Agreement</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Review your ISA terms and use the simulator to understand exactly what you'll pay.</p>
      </div>

      {/* Key terms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: DollarSign, color: 'var(--accent)', bg: 'var(--accent-light)', title: 'Zero upfront cost', desc: 'Pay nothing to start' },
          { icon: Shield, color: 'var(--brand)', bg: 'var(--brand-light)', title: 'No placement, no pay', desc: "Owe nothing if not placed" },
          { icon: FileText, color: '#7C3AED', bg: '#F5F3FF', title: '12% for 24 months', desc: 'Of salary uplift only' },
          { icon: AlertCircle, color: '#D97706', bg: '#FFFBEB', title: '$40K minimum', desc: 'Payments pause below this' },
        ].map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={18} color={color} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Payment simulator */}
      <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 14, padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Calculator size={18} color="var(--brand)" />
          <h3 style={{ fontWeight: 600, fontSize: 16 }}>ISA payment simulator</h3>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>drag sliders to see your payments</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
              Current salary: <span style={{ color: 'var(--brand)' }}>${simSalary.toLocaleString()}</span>
            </label>
            <input type="range" min={20000} max={120000} step={1000} value={simSalary}
              onChange={e => { setSimSalary(Number(e.target.value)); if (Number(e.target.value) >= simNewSalary) setSimNewSalary(Number(e.target.value) + 5000); }}
              style={{ width: '100%', accentColor: 'var(--brand)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              <span>$20K</span><span>$120K</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 8 }}>
              New salary after transition: <span style={{ color: 'var(--accent)' }}>${simNewSalary.toLocaleString()}</span>
            </label>
            <input type="range" min={simSalary + 1000} max={200000} step={1000} value={simNewSalary}
              onChange={e => setSimNewSalary(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              <span>${(simSalary + 1000).toLocaleString()}</span><span>$200K</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Salary uplift', value: `+$${uplift.toLocaleString()}`, color: 'var(--accent)', bg: 'var(--accent-light)' },
            { label: 'Monthly payment', value: aboveThreshold ? `$${monthlyPayment.toLocaleString()}` : 'Paused', color: aboveThreshold ? 'var(--brand)' : 'var(--gray-400)', bg: aboveThreshold ? 'var(--brand-light)' : 'var(--gray-100)' },
            { label: 'Total over 24 months', value: `$${totalPayment.toLocaleString()}`, color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'You keep (net)', value: `+$${(uplift * 12 * 2 - totalPayment).toLocaleString()}`, color: 'var(--accent)', bg: 'var(--accent-light)' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {!aboveThreshold && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#D97706' }}>
            ⚠ Payments are paused when your new salary is below $40,000. No payment is due until you earn above this threshold.
          </div>
        )}
      </div>

      {/* Full agreement */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 28, marginBottom: 24, maxHeight: 360, overflowY: 'auto' }}>
        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>PivotPath Income Share Agreement</h3>
        {[
          ['1. Parties', `This agreement is between PivotPath ("the Platform") and ${worker?.name} ("the Worker").`],
          ['2. Service', 'PivotPath provides AI-powered career coaching, a credential marketplace, and employer pipeline access to help the Worker transition to a new in-demand role.'],
          ['3. Cost', 'There is no upfront fee. The Worker pays nothing during the programme.'],
          ['4. Income Share', 'Upon successful placement in a new role earning above $40,000 USD annually, the Worker agrees to pay 12% of their annual salary uplift for a period of 24 months.'],
          ['5. No placement, no payment', 'If PivotPath does not facilitate a job placement within 18 months of programme start, no payment is due.'],
          ['6. Payment cap', 'Total payments shall not exceed 1.5x the average cost of the credential pathway undertaken.'],
          ['7. Minimum earnings threshold', 'Payments only commence once the Worker earns above $40,000 USD annually. Payments pause automatically if income falls below this threshold.'],
          ['8. Credential completion', 'The Worker agrees to complete at least one employer-endorsed credential pathway and participate in the employer interview pipeline in good faith.'],
          ['9. Governing law', 'This agreement is governed by the laws of the jurisdiction in which the Worker resides at the time of signing.'],
          ['10. Amendments', 'Any changes to this agreement must be agreed in writing by both parties.'],
        ].map(([title, text]) => (
          <div key={title} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.7 }}>{text}</div>
          </div>
        ))}
      </div>

      {/* Signature */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <input type="checkbox" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand)', marginTop: 2, flexShrink: 0 }} />
          <label htmlFor="agree" style={{ fontSize: 14, color: 'var(--gray-700)', cursor: 'pointer', lineHeight: 1.6 }}>
            I have read and understood the Income Share Agreement above. I agree to the terms and confirm that my name, <strong>{worker?.name}</strong>, serves as my digital signature.
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--gray-50)', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Digital signature:</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: 'var(--brand)', fontStyle: 'italic' }}>{worker?.name}</div>
          {agreed && <CheckCircle size={18} color="var(--accent)" style={{ marginLeft: 'auto' }} />}
        </div>
        <button onClick={sign} disabled={!agreed || loading} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15, cursor: agreed ? 'pointer' : 'not-allowed', background: agreed ? 'var(--brand)' : 'var(--gray-200)', color: agreed ? '#fff' : 'var(--gray-400)' }}>
          {loading ? 'Signing...' : agreed ? 'Sign my Income Share Agreement →' : 'Check the box above to sign'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
        This is a legally binding agreement. By signing you confirm you have read and understood all terms.
      </p>
    </div>
  );
}