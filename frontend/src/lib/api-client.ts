import axios from 'axios';
import { useAuthStore } from './auth-store';

export const api = axios.create({
  baseURL: 'https://veramed.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  try {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = 'Bearer ' + token;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);