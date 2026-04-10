import axios from 'axios';
import { useAuthStore } from './auth-store';

export const api = axios.create({
  baseURL: 'https://veramed.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});