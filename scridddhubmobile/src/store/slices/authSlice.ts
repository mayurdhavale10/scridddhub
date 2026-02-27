import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../core/api/auth.api';
import { secureStorage } from '../../core/storage/secure';
import { User } from '../../types/user';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: '859561397633-687utev602o3sitvg1llj1urqqbdruqi.apps.googleusercontent.com', // Web Client ID
    offlineAccess: true, // Required for serverAuthCode
});

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    otpSent: boolean;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    otpSent: false,
};

// --- Thunks ---

export const sendOtp = createAsyncThunk(
    'auth/sendOtp',
    async (email: string, { rejectWithValue }) => {
        try {
            await authApi.sendOtp(email.trim());
            return { email };
        } catch (err: any) {
            // Normalize error message
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send OTP';
            return rejectWithValue(msg);
        }
    }
);

export const verifyOtp = createAsyncThunk(
    'auth/verifyOtp',
    async ({ identifier, otp, password }: { identifier: string; otp: string, password?: string }, { rejectWithValue }) => {
        try {
            const data = await authApi.verifyOtp(identifier, otp, password);

            // Store tokens
            if (data.accessToken) {
                await secureStorage.set('access_token', data.accessToken);
            }
            if (data.refreshToken) {
                await secureStorage.set('refresh_token', data.refreshToken);
            }

            return { user: data.user };
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Verification failed';
            return rejectWithValue(msg);
        }
    }
);

export const loginWithPassword = createAsyncThunk(
    'auth/loginWithPassword',
    async ({ email, password }: any, { rejectWithValue }) => {
        try {
            const data = await authApi.login({ email: email.trim(), password });

            // Store tokens
            if (data.accessToken) {
                await secureStorage.set('access_token', data.accessToken);
            }
            if (data.refreshToken) {
                await secureStorage.set('refresh_token', data.refreshToken);
            }

            return { user: data.user };
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed';
            return rejectWithValue(msg);
        }
    }
);

export const loginWithGoogle = createAsyncThunk(
    'auth/loginWithGoogle',
    async (_, { rejectWithValue }) => {
        try {
            await GoogleSignin.hasPlayServices();
            try {
                await GoogleSignin.signOut();
            } catch (error) {
                // Ignore if not signed in
            }
            const userInfo = await GoogleSignin.signIn();

            // Get the server auth code
            // Note: serverAuthCode might be null if offlineAccess is false
            if (!userInfo.data?.serverAuthCode) {
                throw new Error('Google Sign-In failed: No serverAuthCode received');
            }

            const data = await authApi.googleLogin(userInfo.data.serverAuthCode);

            // Store tokens
            if (data.accessToken) {
                await secureStorage.set('access_token', data.accessToken);
            }
            if (data.refreshToken) {
                await secureStorage.set('refresh_token', data.refreshToken);
            }

            return { user: data.user };
        } catch (err: any) {
            console.error('Google Signin Error', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Google Login failed';
            return rejectWithValue(msg);
        }
    }
);

export const forgotPassword = createAsyncThunk(
    'auth/forgotPassword',
    async (email: string, { rejectWithValue }) => {
        try {
            await authApi.forgotPassword(email.trim());
            return { email };
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send reset email';
            return rejectWithValue(msg);
        }
    }
);

export const resetPassword = createAsyncThunk(
    'auth/resetPassword',
    async ({ email, otp, newPassword }: any, { rejectWithValue }) => {
        try {
            const data = await authApi.resetPassword(email.trim(), otp, newPassword);
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Reset failed';
            return rejectWithValue(msg);
        }
    }
);

export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { dispatch }) => {
        try {
            await authApi.logout();
        } catch (e) {
            console.warn('Logout API failed, clearing local state anyway');
        }
        await secureStorage.remove('access_token');
        await secureStorage.remove('refresh_token');
        return;
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        resetError: (state) => {
            state.error = null;
        },
        setDemoRole: (state, action) => {
            if (state.user) {
                state.user.role = action.payload;
            }
        }
    },
    extraReducers: (builder) => {
        builder
            // Send OTP
            .addCase(sendOtp.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(sendOtp.fulfilled, (state) => {
                state.isLoading = false;
                state.otpSent = true;
            })
            .addCase(sendOtp.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Verify OTP
            .addCase(verifyOtp.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(verifyOtp.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.otpSent = false;
            })
            .addCase(verifyOtp.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Login with Password
            .addCase(loginWithPassword.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginWithPassword.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.otpSent = false;
            })
            .addCase(loginWithPassword.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Forgot Password
            .addCase(forgotPassword.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(forgotPassword.fulfilled, (state) => {
                state.isLoading = false;
                // We might want a separate flag like 'resetOtpSent' or just re-use specific loading states in UI
            })
            .addCase(forgotPassword.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Reset Password
            .addCase(resetPassword.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(resetPassword.fulfilled, (state) => {
                state.isLoading = false;
                // Success! The UI should redirect to Login
            })
            .addCase(resetPassword.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Google Login
            .addCase(loginWithGoogle.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginWithGoogle.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.otpSent = false;
            })
            .addCase(loginWithGoogle.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })

            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.isAuthenticated = false;
                state.otpSent = false;
            });
    },
});

export const { resetError, setDemoRole } = authSlice.actions;
export default authSlice.reducer;

