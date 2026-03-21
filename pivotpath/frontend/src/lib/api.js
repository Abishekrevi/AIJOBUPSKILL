import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = BASE.replace('https://', 'wss://').replace('http://', 'ws://');

const api = axios.create({ baseURL: BASE });

// ─── Token helpers ────────────────────────────────────────────────────────────
const getAccessToken = () => localStorage.getItem('pp_token');
const getRefreshToken = () => localStorage.getItem('pp_refresh_token');
const setTokens = (access, refresh) => {
  localStorage.setItem('pp_token', access);
  if (refresh) localStorage.setItem('pp_refresh_token', refresh);
};
const clearTokens = () => {
  localStorage.removeItem('pp_token');
  localStorage.removeItem('pp_refresh_token');
  localStorage.removeItem('pp_worker');
  localStorage.removeItem('pp_hr');
};

// ─── Request interceptor — attach access token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor — auto-refresh on 401 ──────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Upgrade 2: Auto-refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${BASE}/api/auth/refresh`, {
          refresh_token: refreshToken
        });
        const { access_token, refresh_token: new_refresh } = res.data;
        setTokens(access_token, new_refresh);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── WebSocket Notifications ──────────────────────────────────────────────────
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
    setTimeout(() => { if (workerId) connectNotifications(workerId, onMessage); }, 3000);
  };
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
  workerLogin: async (email, password) => {
    const res = await api.post('/api/auth/worker/login', { email, password });
    // Upgrade 2: store both access + refresh tokens
    setTokens(res.data.access_token, res.data.refresh_token);
    return res;
  },
  hrLogin: async (email, password) => {
    const res = await api.post('/api/auth/hr/login', { email, password });
    setTokens(res.data.access_token, res.data.refresh_token);
    return res;
  },
  setPassword: (worker_id, password) =>
    api.post('/api/auth/worker/set-password', { worker_id, password }),
  // Upgrade 1: server-side token blacklist logout
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // Continue with local cleanup even if server call fails
    }
    clearTokens();
    disconnectNotifications();
  },
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
  summary: () => api.get('/api/signal/summary'),
};

// ─── Employer API ─────────────────────────────────────────────────────────────
export const employerAPI = {
  list: () => api.get('/api/employers/'),
  book: (data) => api.post('/api/employers/book', data),
  bookings: (worker_id) => api.get(`/api/employers/bookings/${worker_id}`),
  match: (worker_id) => api.get(`/api/employers/match/${worker_id}`),
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