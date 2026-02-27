import apiClient from './apiClient';
import { ENDPOINTS } from '../config/env';
import { AuthResponse, LoginPayload } from '../../types/auth';

export const authApi = {
    sendOtp: async (email: string) => {
        // POST /auth/send-otp { email }
        return apiClient.post(ENDPOINTS.SEND_OTP, { email });
    },

    verifyOtp: async (email: string, otp: string, password?: string) => {
        // POST /auth/verify-otp { email, otp, password }
        // Expected response: { user, accessToken, refreshToken }
        const response = await apiClient.post<AuthResponse>(ENDPOINTS.VERIFY_OTP, { email, otp, password });
        return response.data;
    },

    forgotPassword: async (email: string) => {
        // POST /auth/forgot-password { email }
        return apiClient.post('/auth/forgot-password', { email });
    },

    resetPassword: async (email: string, otp: string, newPassword: string) => {
        // POST /auth/reset-password { email, otp, newPassword }
        return apiClient.post('/auth/reset-password', { email, otp, newPassword });
    },

    // Placeholder for email/password login if needed
    login: async (payload: LoginPayload) => {
        // POST /auth/login { email, password }
        const response = await apiClient.post<AuthResponse>('/auth/login', payload);
        return response.data;
    },

    googleLogin: async (code: string) => {
        // POST /auth/google { code }
        const response = await apiClient.post<AuthResponse>('/auth/google', { code });
        return response.data;
    },

    logout: async () => {
        return apiClient.post(ENDPOINTS.LOGOUT);
    }
};
