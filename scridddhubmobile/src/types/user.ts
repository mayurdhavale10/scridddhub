export interface User {
    id: string;
    email: string;
    fullName?: string;
    role?: 'admin' | 'user' | 'manager' | 'yard_manager' | 'driver';
    avatarUrl?: string;
    createdAt?: string;
}
