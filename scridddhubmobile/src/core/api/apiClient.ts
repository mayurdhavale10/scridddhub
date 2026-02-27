import axios from 'axios';
import { ENV } from '../config/env';
import { secureStorage } from '../storage/secure';

const apiClient = axios.create({
    baseURL: ENV.API_URL,
    timeout: ENV.TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await secureStorage.get('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 (Refresh Token Logic can go here)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Warning: This is a basic 401 handler. 
        // A full implementation would try to refresh the token here.
        if (error.response?.status === 401) {
            await secureStorage.remove('access_token');
            // Logic to redirect to login or dispatch logout action
        }
        return Promise.reject(error);
    }
);

export default apiClient;
