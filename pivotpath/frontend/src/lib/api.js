import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE });

export const authAPI = {
  workerLogin: (email, password) => api.post('/api/auth/worker/login', { email, password }),
  hrLogin: (email, password) => api.post('/api/auth/hr/login', { email, password }),
  setPassword: (worker_id, password) => api.post('/api/auth/worker/set-password', { worker_id, password }),
};

export const workerAPI = {
  create: (data) => api.post('/api/workers/', data),
  get: (id) => api.get(`/api/workers/${id}`),
  update: (id, data) => api.patch(`/api/workers/${id}`, data),
  list: () => api.get('/api/workers/'),
};

export const coachAPI = {
  chat: (worker_id, message) => api.post('/api/coach/chat', { worker_id, message }),
  history: (worker_id) => api.get(`/api/coach/history/${worker_id}`),
  roadmap: (worker_id) => api.post(`/api/coach/roadmap/${worker_id}`),
  status: () => api.get('/api/coach/status'),
};

export const credentialAPI = {
  list: () => api.get('/api/credentials/'),
  enroll: (worker_id, credential_id) => api.post('/api/credentials/enroll', { worker_id, credential_id }),
  updateProgress: (enrollment_id, progress_pct) => api.patch(`/api/credentials/enrollment/${enrollment_id}/progress`, { progress_pct }),
  workerCredentials: (worker_id) => api.get(`/api/credentials/worker/${worker_id}`),
};

export const signalAPI = {
  list: () => api.get('/api/signal/'),
  top: (limit = 5) => api.get(`/api/signal/top?limit=${limit}`),
};

export const employerAPI = {
  list: () => api.get('/api/employers/'),
  book: (data) => api.post('/api/employers/book', data),
  bookings: (worker_id) => api.get(`/api/employers/bookings/${worker_id}`),
};

export const hrAPI = {
  dashboard: () => api.get('/api/hr/dashboard'),
  companies: () => api.get('/api/hr/companies'),
  createCompany: (data) => api.post('/api/hr/companies', data),
  companyWorkers: (id) => api.get(`/api/hr/companies/${id}/workers`),
};

export const gigAPI = {
  list: () => api.get('/api/gigs/'),
};

export default api;
