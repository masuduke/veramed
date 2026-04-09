import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://veramed.onrender.com/api',
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
