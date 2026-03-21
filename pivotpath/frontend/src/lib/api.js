import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = BASE.replace('https://', 'wss://').replace('http://', 'ws://');

const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pp_token');
      localStorage.removeItem('pp_worker');
      localStorage.removeItem('pp_hr');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── WebSocket Notifications ─────────────────────────────────────────────────
let ws = null;
let wsCallbacks = [];

export const connectNotifications = (workerId, onMessage) => {
  if (ws) ws.close();
  ws = new WebSocket(`${WS_BASE}/ws/${workerId}`);
  wsCallbacks.push(onMessage);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      wsCallbacks.forEach(cb => cb(data));
    } catch (e) { }
  };

  ws.onclose = () => {
    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      if (workerId) connectNotifications(workerId, onMessage);
    }, 3000);
  };

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send('ping');
    else clearInterval(pingInterval);
  }, 30000);
};

export const disconnectNotifications = () => {
  if (ws) { ws.close(); ws = null; }
  wsCallbacks = [];
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  workerLogin: (email, password) =>
    api.post('/api/auth/worker/login', { email, password }).then(res => {
      localStorage.setItem('pp_token', res.data.token);
      return res;
    }),
  hrLogin: (email, password) =>
    api.post('/api/auth/hr/login', { email, password }).then(res => {
      localStorage.setItem('pp_token', res.data.token);
      return res;
    }),
  setPassword: (worker_id, password) =>
    api.post('/api/auth/worker/set-password', { worker_id, password }),
  logout: () => {
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_worker');
    localStorage.removeItem('pp_hr');
    disconnectNotifications();
  }
};

// ─── Worker API ───────────────────────────────────────────────────────────────
export const workerAPI = {
  create: (data) => api.post('/api/workers/', data),
  get: (id) => api.get(`/api/workers/${id}`),
  update: (id, data) => api.patch(`/api/workers/${id}`, data),
  list: () => api.get('/api/workers/'),
};

// ─── Coach API ────────────────────────────────────────────────────────────────
export const coachAPI = {
  chat: (worker_id, message) => api.post('/api/coach/chat', { worker_id, message }),
  history: (worker_id) => api.get(`/api/coach/history/${worker_id}`),
  roadmap: (worker_id) => api.post(`/api/coach/roadmap/${worker_id}`),
  careerPath: (from_role, to_role) =>
    api.get(`/api/coach/career-path?from_role=${encodeURIComponent(from_role)}&to_role=${encodeURIComponent(to_role)}`),
  allRoles: () => api.get('/api/coach/all-roles'),
  status: () => api.get('/api/coach/status'),
};

// ─── Credential API ───────────────────────────────────────────────────────────
export const credentialAPI = {
  list: () => api.get('/api/credentials/'),
  enroll: (worker_id, credential_id) =>
    api.post('/api/credentials/enroll', { worker_id, credential_id }),
  updateProgress: (enrollment_id, progress_pct) =>
    api.patch(`/api/credentials/enrollment/${enrollment_id}/progress`, { progress_pct }),
  workerCredentials: (worker_id) => api.get(`/api/credentials/worker/${worker_id}`),
  recommended: (worker_id) => api.get(`/api/credentials/recommended/${worker_id}`),
};

// ─── Signal API ───────────────────────────────────────────────────────────────
export const signalAPI = {
  list: () => api.get('/api/signal/'),
  top: (limit = 5) => api.get(`/api/signal/top?limit=${limit}`),
};

// ─── Employer API ─────────────────────────────────────────────────────────────
export const employerAPI = {
  list: () => api.get('/api/employers/'),
  book: (data) => api.post('/api/employers/book', data),
  bookings: (worker_id) => api.get(`/api/employers/bookings/${worker_id}`),
};

// ─── HR API ───────────────────────────────────────────────────────────────────
export const hrAPI = {
  dashboard: () => api.get('/api/hr/dashboard'),
  companies: () => api.get('/api/hr/companies'),
  createCompany: (data) => api.post('/api/hr/companies', data),
  companyWorkers: (id) => api.get(`/api/hr/companies/${id}/workers`),
  cohortAnalytics: () => api.get('/api/hr/cohort-analytics'),
  dropoutRisk: () => api.get('/api/hr/dropout-risk'),
  interviewQueue: () => api.get('/api/hr/interview-queue'),
};

// ─── Gig API ──────────────────────────────────────────────────────────────────
export const gigAPI = {
  list: () => api.get('/api/gigs/'),
};

export default api;