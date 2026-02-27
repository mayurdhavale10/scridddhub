import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("❌ Missing JWT_SECRET in .env.local");
}

/**
 * Keep payload small (no sensitive info).
 * Store only what you need to authorize requests.
 */
export type AccessTokenPayload = {
    userId: string;
    email?: string;
    tenantId?: string;
    role?: string;
};

export type RefreshTokenPayload = {
    userId: string;
    tokenVersion?: number; // optional: invalidate all refresh tokens by bumping this
};

const DEFAULT_ACCESS_EXPIRES_IN = "15m";
const DEFAULT_REFRESH_EXPIRES_IN = "30d";

export function signAccessToken(
    payload: AccessTokenPayload,
    options?: Omit<SignOptions, "expiresIn">
) {
    return jwt.sign(payload, JWT_SECRET!, {
        expiresIn: DEFAULT_ACCESS_EXPIRES_IN,
        ...options,
    });
}

export function signRefreshToken(
    payload: RefreshTokenPayload,
    options?: Omit<SignOptions, "expiresIn">
) {
    return jwt.sign(payload, JWT_SECRET!, {
        expiresIn: DEFAULT_REFRESH_EXPIRES_IN,
        ...options,
    });
}

/**
 * Returns payload if valid, otherwise throws.
 */
export function verifyToken<T extends object = JwtPayload>(token: string): T {
    return jwt.verify(token, JWT_SECRET!) as T;
}

/**
 * Safe version: returns null if invalid/expired.
 */
export function tryVerifyToken<T extends object = JwtPayload>(token: string): T | null {
    try {
        return verifyToken<T>(token);
    } catch {
        return null;
    }
}

/**
 * Extract "Bearer <token>" from Authorization header.
 */
export function getBearerToken(req: Request): string | null {
    const auth = req.headers.get("authorization");
    if (!auth) return null;

    const [type, token] = auth.split(" ");
    if (type?.toLowerCase() !== "bearer" || !token) return null;

    return token;
}
