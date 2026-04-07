import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('veramed-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.state?.accessToken;
      if (token) config.headers.Authorization = 'Bearer ' + token;
    }
  }
  return config;
});
