import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, Award, TrendingUp, Building2, Users, LogOut, User, FileText, Briefcase, Shield, Menu, X } from 'lucide-react';
import { useWorker } from '../App';

const workerNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/coach', icon: MessageCircle, label: 'AI Coach' },
  { to: '/credentials', icon: Award, label: 'Credentials' },
  { to: '/signal', icon: TrendingUp, label: 'Skills Signal' },
  { to: '/employers', icon: Building2, label: 'Employers' },
  { to: '/gigs', icon: Briefcase, label: 'Gig Market' },
  { to: '/isa', icon: FileText, label: 'My ISA' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const hrNav = [{ to: '/hr', icon: Users, label: 'HR Dashboard' }];
const adminNav = [{ to: '/admin', icon: Shield, label: 'Admin Panel' }];

export default function Layout({ children, view }) {
  const { worker, hrCompany, logout } = useWorker();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = view === 'hr' ? hrNav : view === 'admin' ? adminNav : workerNav;
  const displayName = worker?.name || hrCompany?.name || 'User';
  const displayRole = worker?.current_role || hrCompany?.industry || '';

  const SidebarContent = () => (
    <>
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          Pivot<span style={{ color: '#7DB3F5' }}>Path</span>
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{view === 'hr' ? 'HR Company' : 'Worker'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>{displayName}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{displayRole}</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/hr' || to === '/admin'}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 2,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              transition: 'all 0.15s',
              cursor: 'pointer'
            })}
          >
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '12px 12px 24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {view !== 'hr' && view !== 'admin' && (
          <NavLink
            to="/hr"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              marginBottom: 4,
              color: 'rgba(255,255,255,0.55)',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            <Users size={15} /> HR View
          </NavLink>
        )}
        <button
          onClick={() => {
            logout();
            navigate('/landing');
            setMobileOpen(false);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.color = 'rgba(255,255,255,0.8)'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.55)'}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 220,
          background: 'var(--brand)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          height: '100vh',
          zIndex: 10
        }}
        className="desktop-sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 20,
          background: 'var(--brand)',
          border: 'none',
          borderRadius: 8,
          padding: 8,
          color: '#fff',
          cursor: 'pointer'
        }}
        className="mobile-menu-btn"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex' }}>
          <div style={{
            width: 220,
            background: 'var(--brand)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 0' }}>
              <button
                onClick={() => setMobileOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent />
          </div>
          <div
            style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <main
        style={{
          marginLeft: 220,
          flex: 1,
          padding: '32px 36px',
          minHeight: '100vh'
        }}
        className="main-content"
      >
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .main-content { margin-left: 0 !important; padding: 70px 16px 24px !important; }
        }
      `}</style>
    </div>
  );
}