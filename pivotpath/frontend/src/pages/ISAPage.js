import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, FileText, DollarSign, Shield, AlertCircle } from 'lucide-react';
import { useWorker } from '../App';
import { workerAPI } from '../lib/api';

export default function ISAPage() {
  const { worker, setWorker } = useWorker();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const alreadySigned = worker?.isa_signed;

  const sign = async () => {
    setLoading(true);
    try {
      const res = await workerAPI.update(worker.id, { isa_signed: true });
      setWorker(res.data);
      setSigned(true);
    } catch (e) {
      alert('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  if (alreadySigned || signed) return (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <CheckCircle size={36} color="var(--accent)" />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>ISA Signed</h1>
      <p style={{ color: 'var(--gray-600)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
        Your Income Share Agreement is in place. You pay nothing until you're earning more in your new role.
      </p>
      <button onClick={() => navigate('/')} style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Income Share Agreement</h1>
        <p style={{ color: 'var(--gray-600)', marginTop: 4 }}>Review and sign your ISA before starting your credential pathway.</p>
      </div>

      {/* Key terms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { icon: DollarSign, color: 'var(--accent)', bg: 'var(--accent-light)', title: 'Zero upfront cost', desc: 'You pay nothing to start' },
          { icon: Shield, color: 'var(--brand)', bg: 'var(--brand-light)', title: 'No placement, no pay', desc: 'If we don\'t place you, you owe nothing' },
          { icon: FileText, color: '#7C3AED', bg: '#F5F3FF', title: '12% for 24 months', desc: 'Of salary uplift only, not full salary' },
          { icon: AlertCircle, color: '#D97706', bg: '#FFFBEB', title: '$40K minimum', desc: 'Payments only begin above this threshold' },
        ].map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={18} color={color} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Full agreement */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 28, marginBottom: 24, maxHeight: 400, overflowY: 'auto' }}>
        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>PivotPath Income Share Agreement</h3>
        {[
          ['1. Parties', `This agreement is between PivotPath ("the Platform") and ${worker?.name} ("the Worker").`],
          ['2. Service', 'PivotPath provides AI-powered career coaching, a credential marketplace, and employer pipeline access to help the Worker transition to a new in-demand role.'],
          ['3. Cost', 'There is no upfront fee. The Worker pays nothing during the programme.'],
          ['4. Income Share', 'Upon successful placement in a new role earning above $40,000 USD annually, the Worker agrees to pay 12% of their annual salary uplift (the difference between their new salary and their salary at the time of registration) for a period of 24 months.'],
          ['5. No placement, no payment', 'If PivotPath does not facilitate a job placement for the Worker within 18 months of programme start, no payment is due under this agreement.'],
          ['6. Payment cap', 'Total payments under this agreement shall not exceed 1.5x the average cost of the credential pathway undertaken by the Worker.'],
          ['7. Minimum earnings threshold', 'Payments only commence once the Worker is earning above $40,000 USD annually. If income falls below this threshold, payments pause automatically.'],
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
      <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <input type="checkbox" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand)' }} />
          <label htmlFor="agree" style={{ fontSize: 14, color: 'var(--gray-700)', cursor: 'pointer', lineHeight: 1.6 }}>
            I have read and understood the Income Share Agreement above. I agree to the terms and confirm that my name,{' '}
            <strong>{worker?.name}</strong>, serves as my digital signature.
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>Digital signature:</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: 'var(--brand)', fontStyle: 'italic' }}>{worker?.name}</div>
        </div>
        <button onClick={sign} disabled={!agreed || loading} style={{
          width: '100%', padding: '13px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15, cursor: agreed ? 'pointer' : 'not-allowed',
          background: agreed ? 'var(--brand)' : 'var(--gray-200)',
          color: agreed ? '#fff' : 'var(--gray-400)'
        }}>
          {loading ? 'Signing...' : 'Sign my Income Share Agreement'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
        This is a legally binding agreement. By signing you confirm you have read and understood all terms.
      </p>
    </div>
  );
}
