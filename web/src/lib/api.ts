import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

export function setAccessToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export function getStoredRefresh(): string | null {
  return localStorage.getItem('refreshToken');
}

export function storeRefresh(token: string | null) {
  if (token) localStorage.setItem('refreshToken', token);
  else localStorage.removeItem('refreshToken');
}

export default api;
