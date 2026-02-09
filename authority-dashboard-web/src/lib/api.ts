import axios from 'axios';
import { env } from './env';
import { useAuthStore } from './authStore';

export const api = axios.create({
  baseURL: env.backendBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
