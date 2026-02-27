import { User } from './user';

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export interface LoginPayload {
    email: string;
    password?: string;
    otp?: string;
}

export interface SignupPayload {
    email: string;
    password?: string;
    otp?: string;
}
