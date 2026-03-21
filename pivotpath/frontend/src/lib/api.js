import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = BASE.replace('https://', 'wss://').replace('http://', 'ws://');

const api = axios.create({ baseURL: BASE });

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

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue = [];
const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) { clearTokens(); window.location.href = '/login'; return Promise.reject(error); }
      if (isRefreshing) {
        return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
          .then(token => { originalRequest.headers.Authorization = `Bearer ${token}`; return api(originalRequest); });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const res = await axios.post(`${BASE}/api/auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token: new_refresh } = res.data;
        setTokens(access_token, new_refresh);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (e) {
        processQueue(e, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(e);
      } finally { isRefreshing = false; }
    }
    return Promise.reject(error);
  }
);

// ─── WebSocket ────────────────────────────────────────────────────────────────
let ws = null;
let wsCallbacks = [];
export const connectNotifications = (workerId, onMessage) => {
  if (ws) ws.close();
  ws = new WebSocket(`${WS_BASE}/ws/${workerId}`);
  wsCallbacks.push(onMessage);
  ws.onmessage = (e) => { try { const d = JSON.parse(e.data); wsCallbacks.forEach(cb => cb(d)); } catch {} };
  ws.onclose = () => { setTimeout(() => { if (workerId) connectNotifications(workerId, onMessage); }, 3000); };
  setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send('ping'); }, 30000);
};
export const disconnectNotifications = () => { if (ws) { ws.close(); ws = null; } wsCallbacks = []; };

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  workerLogin: async (email, password) => {
    const res = await api.post('/api/auth/worker/login', { email, password });
    setTokens(res.data.access_token, res.data.refresh_token);
    return res;
  },
  hrLogin: async (email, password) => {
    const res = await api.post('/api/auth/hr/login', { email, password });
    setTokens(res.data.access_token, res.data.refresh_token);
    return res;
  },
  setPassword: (worker_id, password) => api.post('/api/auth/worker/set-password', { worker_id, password }),
  logout: async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    clearTokens(); disconnectNotifications();
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
  search: (q) => api.get(`/api/credentials/search?q=${encodeURIComponent(q)}`),
  ranked: (top_n = 5) => api.get(`/api/credentials/ranked?top_n=${top_n}`),
  enroll: (worker_id, credential_id) => api.post('/api/credentials/enroll', { worker_id, credential_id }),
  updateProgress: (enrollment_id, progress_pct) =>
    api.patch(`/api/credentials/enrollment/${enrollment_id}/progress`, { progress_pct }),
  workerCredentials: (worker_id) => api.get(`/api/credentials/worker/${worker_id}`),
  recommended: (worker_id) => api.get(`/api/credentials/recommended/${worker_id}`),
  dsaStats: () => api.get('/api/credentials/dsa-stats'),
};

// ─── Signal API ───────────────────────────────────────────────────────────────
export const signalAPI = {
  list: (category) => api.get(`/api/signal/${category ? `?category=${category}` : ''}`),
  top: (limit = 5) => api.get(`/api/signal/top?limit=${limit}`),
  summary: () => api.get('/api/signal/summary'),
  rangeAnalytics: (from_idx, to_idx) =>
    api.get(`/api/signal/range-analytics?from_idx=${from_idx}&to_idx=${to_idx}`),
  cacheStats: () => api.get('/api/signal/cache-stats'),
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

// ─── ML API (upgrades 36-43) ──────────────────────────────────────────────────
export const mlAPI = {
  // Upgrade 36: Semantic skill match
  skillMatch: (worker_id, employer_id) =>
    api.get(`/api/ml/skill-match/${worker_id}/${employer_id}`),

  // Upgrade 37: Demand forecasting
  forecastSkill: (skill_name, weeks = 26) =>
    api.get(`/api/ml/forecast/${encodeURIComponent(skill_name)}?weeks=${weeks}`),
  forecastAll: () => api.get('/api/ml/forecast-all'),

  // Upgrade 39: UCB bandit recommendations
  banditRecommend: (worker_id, n = 3) =>
    api.get(`/api/ml/bandit/recommend/${worker_id}?n=${n}`),
  banditFeedback: (credential_id, outcome) =>
    api.post('/api/ml/bandit/feedback', { credential_id, outcome }),
  banditStats: () => api.get('/api/ml/bandit/stats'),

  // Upgrade 40: SHAP explainability
  explainDropout: (worker_id) => api.get(`/api/ml/explain-dropout/${worker_id}`),

  // Upgrade 42: Neural salary prediction
  predictSalary: (worker_id) => api.get(`/api/ml/salary-predict/${worker_id}`),

  // Upgrade 38: Federated learning
  submitFederated: () => api.post('/api/ml/federated/submit'),
  aggregateFederated: () => api.post('/api/ml/federated/aggregate'),

  // Upgrade 43: Bias audit
  biasAudit: () => api.get('/api/ml/bias-audit'),

  // Autocomplete (Upgrade 27: Trie)
  autocompleteSkills: (q) => api.get(`/api/autocomplete/skills?q=${encodeURIComponent(q)}`),
  autocompleteRoles: (q) => api.get(`/api/autocomplete/roles?q=${encodeURIComponent(q)}`),
};

export default api;
