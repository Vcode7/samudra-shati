import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG_URL = 'https://vcode7.github.io/middelware-endpoint/url.json';

let API_BASE_URL: string | null = null;
let api: ReturnType<typeof axios.create> | null = null;

export async function loadApiBaseUrl() {
  if (!API_BASE_URL) {
    const res = await fetch(CONFIG_URL);
    const json = await res.json();
    API_BASE_URL = json.API_BASE_URL;
    console.log('Loaded API_BASE_URL:', API_BASE_URL);
  }
  return API_BASE_URL!;
}

export async function initApi() {
  const baseURL = await loadApiBaseUrl();

  api = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  api.interceptors.request.use(
    async (config) => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Error getting auth token:', error);
      }

      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log('Using API_BASE_URL:', API_BASE_URL);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      console.log(`API Response: ${response.config.url} - ${response.status}`);
      return response;
    },
    async (error) => {
      if (error.response) {
        console.error(
          `API Error: ${error.response.status} - ${error.response.data?.detail || error.message}`
        );

        if (error.response.status === 401) {
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('user_type');
        }
      } else if (error.request) {
        console.error('API Error: No response received', error.message);
      } else {
        console.error('API Error:', error.message);
      }

      return Promise.reject(error);
    }
  );

  return api;
}

export function getApi() {
  if (!api) {
    throw new Error('API not initialized. Call initApi() once at app startup.');
  }
  return api;
}
export async function apiClient() {
  if (!api) {
    await initApi();   // fallback init
  }
  return api!;
}

// If you really need the URL string elsewhere
export async function getAPIBaseURL() {
  return await loadApiBaseUrl();
}
