const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

let token = localStorage.getItem('br_token') || null;
let onUnauthorized = () => {};

export const setToken = (t) => {
  token = t;
  if (t) localStorage.setItem('br_token', t);
  else localStorage.removeItem('br_token');
};
export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch (e) {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    if (res.status === 401 && path !== '/api/auth/login') onUnauthorized();
    throw new ApiError(res.status, e.code || 'SERVER_ERROR', e.message, e.details);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  summary: () => request('/api/dashboard/summary'),
  integrity: () => request('/api/dashboard/integrity'),
  runSweep: () => request('/api/dashboard/run-sweep', { method: 'POST' }),
  contracts: (params = {}) => request('/api/contracts?' + new URLSearchParams(params)),
  contract: (id) => request(`/api/contracts/${id}`),
  createContract: (body) => request('/api/contracts', { method: 'POST', body }),
  recordReturn: (id, form) => request(`/api/contracts/${id}/returns`, { method: 'POST', form }),
  dispute: (id, reason) => request(`/api/contracts/${id}/dispute`, { method: 'PATCH', body: { reason } }),
  resolveDispute: (id) => request(`/api/contracts/${id}/resolve-dispute`, { method: 'PATCH' }),
  damageCharge: (id, amountXAF) => request(`/api/contracts/${id}/damage-charge`, { method: 'PATCH', body: { amountXAF } }),
  assets: (params = {}) => request('/api/assets?' + new URLSearchParams(params)),
  createAsset: (body) => request('/api/assets', { method: 'POST', body }),
  adjustAsset: (id, delta, reason) => request(`/api/assets/${id}/adjust`, { method: 'POST', body: { delta, reason } }),
  repairAsset: (id, qty) => request(`/api/assets/${id}/repair`, { method: 'POST', body: { qty } }),
  audit: () => request('/api/audit'),
  tenant: () => request('/api/tenant'),
  updateTenant: (body) => request('/api/tenant', { method: 'PATCH', body }),
  users: () => request('/api/users'),
  createUser: (body) => request('/api/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method: 'PATCH', body }),
};
