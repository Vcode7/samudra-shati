import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Update this with your backend URL
// const API_BASE_URL = 'http://192.168.1.100:8000';
const API_BASE_URL = 'http://172.16.9.15:8000';

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add JWT token
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
        console.log(API_BASE_URL)
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.config.url} - ${response.status}`);
        return response;
    },
    async (error) => {
        if (error.response) {
            console.error(`API Error: ${error.response.status} - ${error.response.data?.detail || error.message}`);

            // Handle 401 Unauthorized - Clear token and redirect to login
            if (error.response.status === 401) {
                await AsyncStorage.removeItem('auth_token');
                await AsyncStorage.removeItem('user_type');
                // Navigation will be handled by AuthContext
            }
        } else if (error.request) {
            console.error('API Error: No response received', error.message);
        } else {
            console.error('API Error:', error.message);
        }

        return Promise.reject(error);
    }
);



export default api;

// Export base URL for image URLs
export { API_BASE_URL };
