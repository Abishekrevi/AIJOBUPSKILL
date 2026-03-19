import React, { useState, useContext, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import AICoach from './pages/AICoach';
import Employers from './pages/Employers';
import Gigs from './pages/Gigs';
import Profile from './pages/Profile';
import AIInsights from './pages/AIInsights';
import Analytics from './pages/Analytics';
import Landing from './pages/Landing';

const WorkerContext = createContext();
export const useWorker = () => useContext(WorkerContext);

export default function App() {
  const [worker, setWorker] = useState(null);
  const [hrCompany, setHRCompany] = useState(null);
  const [view, setView] = useState('worker');

  const logout = () => {
    setWorker(null);
    setHRCompany(null);
    setView('worker');
  };

  return (
    <WorkerContext.Provider value={{ worker, setWorker, hrCompany, setHRCompany, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          
          <Route path="/" element={worker ? <Layout view="worker"><Dashboard /></Layout> : <Navigate to="/landing" />} />
          <Route path="/credentials" element={worker ? <Layout view="worker"><Credentials /></Layout> : <Navigate to="/landing" />} />
          <Route path="/coach" element={worker ? <Layout view="worker"><AICoach /></Layout> : <Navigate to="/landing" />} />
          <Route path="/insights" element={worker ? <Layout view="worker"><AIInsights /></Layout> : <Navigate to="/landing" />} />
          <Route path="/analytics" element={worker ? <Layout view="worker"><Analytics /></Layout> : <Navigate to="/landing" />} />
          <Route path="/employers" element={worker ? <Layout view="worker"><Employers /></Layout> : <Navigate to="/landing" />} />
          <Route path="/gigs" element={worker ? <Layout view="worker"><Gigs /></Layout> : <Navigate to="/landing" />} />
          <Route path="/profile" element={worker ? <Layout view="worker"><Profile /></Layout> : <Navigate to="/landing" />} />
          
          <Route path="*" element={<Navigate to="/landing" />} />
        </Routes>
      </BrowserRouter>
    </WorkerContext.Provider>
  );
}
