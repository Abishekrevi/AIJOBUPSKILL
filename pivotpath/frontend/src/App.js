import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Coach from './pages/Coach';
import Credentials from './pages/Credentials';
import Signal from './pages/Signal';
import Employers from './pages/Employers';
import HRDashboard from './pages/HRDashboard';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Profile from './pages/Profile';
import ISAPage from './pages/ISAPage';
import GigMarketplace from './pages/GigMarketplace';
import LandingPage from './pages/LandingPage';
import AdminPanel from './pages/AdminPanel';

export const WorkerContext = createContext(null);
export const useWorker = () => useContext(WorkerContext);

export default function App() {
  const [worker, setWorker] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pp_worker')); } catch { return null; }
  });
  const [hrCompany, setHRCompany] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pp_hr')); } catch { return null; }
  });

  const saveWorker = (w) => { setWorker(w); localStorage.setItem('pp_worker', JSON.stringify(w)); };
  const saveHR = (c) => { setHRCompany(c); localStorage.setItem('pp_hr', JSON.stringify(c)); };
  const logout = () => {
    setWorker(null); setHRCompany(null);
    localStorage.removeItem('pp_worker');
    localStorage.removeItem('pp_hr');
    localStorage.removeItem('pp_token');
  };

  return (
    <WorkerContext.Provider value={{ worker, setWorker: saveWorker, hrCompany, setHRCompany: saveHR, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/isa" element={worker ? <Layout><ISAPage /></Layout> : <Navigate to="/login" />} />
          <Route path="/profile" element={worker ? <Layout><Profile /></Layout> : <Navigate to="/login" />} />
          <Route path="/gigs" element={worker ? <Layout><GigMarketplace /></Layout> : <Navigate to="/login" />} />
          <Route path="/hr" element={hrCompany || worker ? <Layout view="hr"><HRDashboard /></Layout> : <Navigate to="/login" />} />
          <Route path="/admin" element={worker ? <Layout view="admin"><AdminPanel /></Layout> : <Navigate to="/login" />} />
          <Route path="/" element={worker ? <Layout><Dashboard /></Layout> : <LandingPage />} />
          <Route path="/coach" element={worker ? <Layout><Coach /></Layout> : <Navigate to="/login" />} />
          <Route path="/credentials" element={worker ? <Layout><Credentials /></Layout> : <Navigate to="/login" />} />
          <Route path="/signal" element={worker ? <Layout><Signal /></Layout> : <Navigate to="/login" />} />
          <Route path="/employers" element={worker ? <Layout><Employers /></Layout> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </WorkerContext.Provider>
  );
}
