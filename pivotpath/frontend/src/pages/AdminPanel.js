import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Activity, Database, Lock, Users } from 'lucide-react';

const BASE = process.env.REACT_APP_API_URL || '';

export default function AdminPanel() {
    const [auditLogs, setAuditLogs] = useState([]);
    const [chainStatus, setChainStatus] = useState(null);
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('health');

    const token = localStorage.getItem('pp_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        // Fetch system health
        fetch(`${BASE}/health`).then(r => r.json()).then(setHealth).catch(() => { });

        // Fetch audit logs
        fetch(`${BASE}/api/audit/logs`, { headers })
            .then(r => r.json()).then(setAuditLogs).catch(() => { });

        // Verify audit chain
        fetch(`${BASE}/api/audit/verify`, { headers })
            .then(r => r.json()).then(setChainStatus).catch(() => { });

        setLoading(false);
    }, []);

    const EVENT_COLORS = {
        LOGIN_SUCCESS: { bg: 'var(--accent-light)', color: 'var(--accent)' },
        LOGIN_FAILED: { bg: '#FEF2F2', color: '#DC2626' },
        WORKER_CREATED: { bg: 'var(--brand-light)', color: 'var(--brand)' },
        PASSWORD_CHANGED: { bg: '#FFF7ED', color: '#D97706' },
        ISA_SIGNED: { bg: '#F5F3FF', color: '#7C3AED' },
        CREDENTIAL_ENROLLED: { bg: 'var(--accent-light)', color: 'var(--accent)' },
        CREDENTIAL_COMPLETED: { bg: '#ECFDF5', color: '#059669' },
        INTERVIEW_BOOKED: { bg: 'var(--brand-light)', color: 'var(--brand)' },
    };

    const tabs = ['health', 'audit', 'security'];

    return (
        <div>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={20} color="#7C3AED" />
                </div>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin Panel</h1>
                    <p style={{ color: 'var(--gray-600)', fontSize: 13 }}>System health, audit log, and security monitoring</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--gray-200)' }}>
                {[['health', 'System Health'], ['audit', 'Audit Log'], ['security', 'Security']].map(([id, label]) => (
                    <button key={id} onClick={() => setActiveTab(id)} style={{
                        padding: '9px 18px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid', borderBottom: activeTab === id ? '1px solid #fff' : '1px solid var(--gray-200)',
                        marginBottom: activeTab === id ? '-1px' : 0,
                        borderColor: activeTab === id ? 'var(--gray-200)' : 'transparent',
                        background: activeTab === id ? '#fff' : 'transparent',
                        color: activeTab === id ? 'var(--brand)' : 'var(--gray-500)',
                    }}>{label}</button>
                ))}
            </div>

            {/* HEALTH TAB */}
            {activeTab === 'health' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                        {[
                            { label: 'API status', value: health ? 'Healthy' : 'Unknown', ok: !!health, icon: Activity },
                            { label: 'Active WS connections', value: health?.active_connections ?? '—', ok: true, icon: Users },
                            { label: 'API version', value: health?.version || '—', ok: true, icon: Database },
                            { label: 'Audit chain', value: chainStatus?.intact ? 'Intact ✓' : chainStatus ? 'Broken ⚠' : 'Checking...', ok: chainStatus?.intact !== false, icon: Lock },
                        ].map(({ label, value, ok, icon: Icon }) => (
                            <div key={label} style={{ background: '#fff', border: `1px solid ${ok ? 'var(--gray-200)' : '#FCA5A5'}`, borderRadius: 12, padding: '16px 18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{label}</span>
                                    <Icon size={15} color={ok ? 'var(--accent)' : '#DC2626'} />
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: ok ? 'var(--gray-800)' : '#DC2626' }}>{value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Audit chain status */}
                    {chainStatus && (
                        <div style={{ background: chainStatus.intact ? 'var(--accent-light)' : '#FEF2F2', border: `1px solid ${chainStatus.intact ? 'rgba(45,155,111,0.2)' : '#FCA5A5'}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                {chainStatus.intact
                                    ? <CheckCircle size={20} color="var(--accent)" />
                                    : <AlertTriangle size={20} color="#DC2626" />}
                                <h3 style={{ fontWeight: 700, fontSize: 15, color: chainStatus.intact ? 'var(--accent)' : '#DC2626' }}>
                                    Audit chain {chainStatus.intact ? 'verified — no tampering detected' : 'INTEGRITY FAILURE DETECTED'}
                                </h3>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                                {chainStatus.entries} log entries verified.
                                {chainStatus.broken_at !== null && ` Integrity broken at entry #${chainStatus.broken_at}.`}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8, lineHeight: 1.6 }}>
                                Each audit log entry contains the SHA-256 hash of the previous entry. Any modification to historical records would break this chain and be immediately detectable here.
                            </div>
                        </div>
                    )}

                    <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 20 }}>
                        <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Architecture overview</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                            {[
                                { label: 'Auth', desc: 'bcrypt + JWT HS256', color: '#7C3AED' },
                                { label: 'Rate limiting', desc: '5/min on login, 200/min global', color: '#D97706' },
                                { label: 'RAG memory', desc: 'ChromaDB + MiniLM-L6', color: '#1F4D8C' },
                                { label: 'Career graph', desc: "Dijkstra's shortest path", color: '#2D9B6F' },
                                { label: 'Recommender', desc: 'Collaborative filtering CSR', color: '#059669' },
                                { label: 'Dropout AI', desc: 'Isolation Forest', color: '#DC2626' },
                            ].map(({ label, desc, color }) => (
                                <div key={label} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${color}30`, background: `${color}08` }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* AUDIT LOG TAB */}
            {activeTab === 'audit' && (
                <div>
                    <div style={{ background: 'var(--brand-light)', border: '1px solid rgba(31,77,140,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--brand)' }}>
                        Every sensitive action is recorded in a tamper-evident audit log. Each entry is cryptographically linked to the previous one using SHA-256 chain hashing.
                    </div>
                    {auditLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)', fontSize: 14 }}>
                            {loading ? 'Loading audit logs...' : 'No audit logs yet — actions will appear here as users interact with the system.'}
                        </div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 14, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
                                        {['Event', 'Actor', 'Role', 'IP', 'Time', 'Hash'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--gray-600)', fontSize: 12, textAlign: 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.slice(0, 50).map((log, i) => {
                                        const style = EVENT_COLORS[log.event_type] || { bg: 'var(--gray-100)', color: 'var(--gray-600)' };
                                        return (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--gray-100)', background: i % 2 === 0 ? '#fff' : 'var(--gray-50)' }}>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: style.bg, color: style.color }}>{log.event_type}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--gray-500)' }}>{log.actor_id?.slice(0, 8) || '—'}</td>
                                                <td style={{ padding: '10px 14px', fontSize: 12 }}>{log.actor_role || '—'}</td>
                                                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray-500)' }}>{log.ip_address || '—'}</td>
                                                <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                                                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                                </td>
                                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 10, color: 'var(--gray-400)' }}>
                                                    {log.this_hash?.slice(0, 12)}...
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {auditLogs.length > 50 && (
                                <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-500)' }}>
                                    Showing 50 of {auditLogs.length} entries
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { title: 'Password hashing', status: 'Active', detail: 'All passwords hashed with bcrypt (cost factor 12). No plain-text or reversible storage.', ok: true },
                            { title: 'JWT authentication', status: 'Active', detail: 'HS256 signed tokens with 24-hour expiry. Token verified on every protected endpoint.', ok: true },
                            { title: 'Rate limiting', status: 'Active', detail: 'Login endpoints limited to 5 requests/minute per IP. Global limit of 200 requests/minute.', ok: true },
                            { title: 'Input validation', status: 'Active', detail: 'All inputs validated with Pydantic. HTML stripped from text fields. Email format enforced.', ok: true },
                            { title: 'CORS policy', status: 'Locked', detail: 'Only your frontend domain is allowed. Wildcard * origin was removed in the security upgrade.', ok: true },
                            { title: 'Security headers', status: 'Active', detail: 'HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, XSS-Protection all set.', ok: true },
                            { title: 'Timing attack protection', status: 'Active', detail: 'Login always runs bcrypt verify even for non-existent users, preventing username enumeration.', ok: true },
                            { title: 'Audit chain integrity', status: chainStatus?.intact ? 'Verified' : 'Unknown', detail: 'Append-only log with SHA-256 chain linking. Tampering breaks the chain immediately.', ok: chainStatus?.intact !== false },
                        ].map(({ title, status, detail, ok }) => (
                            <div key={title} style={{ background: '#fff', border: `1px solid ${ok ? 'var(--gray-200)' : '#FCA5A5'}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                {ok ? <CheckCircle size={18} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} /> : <AlertTriangle size={18} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: ok ? 'var(--accent-light)' : '#FEF2F2', color: ok ? 'var(--accent)' : '#DC2626' }}>{status}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>{detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}