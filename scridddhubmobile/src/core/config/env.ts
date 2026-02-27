export const ENV = {
    // Proxied via adb reverse tcp:3000 tcp:3000
    // Proxied via adb reverse tcp:3000 tcp:3000
    // Use 'localhost' for Physical Device (with reverse) OR Emulator (with reverse).
    API_URL: 'http://10.0.2.2:3000/api',

    // App Config
    APP_NAME: 'ScridddHub Mobile',
    VERSION: '1.0.0',

    // Network Timeouts
    TIMEOUT: 15000, // 15 seconds

    // Environment Flags
    IS_DEV: __DEV__,
};

export const ENDPOINTS = {
    // Auth Flow
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',

    // User
    GET_PROFILE: '/user/profile',
};
