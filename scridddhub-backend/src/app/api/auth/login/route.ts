export const runtime = "nodejs";

import bcrypt from "bcryptjs";
import { getDb } from "../../../../lib/db/dbConnect";
import { MongoUserRepository } from "../../../../lib/db/mongo/repositories/user.repo";
import { signAccessToken } from "../../../../lib/auth/jwt";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        let { email, password } = body || {};
        email = email?.trim();

        if (!email || !password) {
            return Response.json({ error: "Email and password are required." }, { status: 400 });
        }

        const db = await getDb();
        const userRepo = new MongoUserRepository(db);

        const user = await userRepo.findByEmail(email);

        // 1. Check if user exists
        if (!user) {
            return Response.json({ error: "Account not found. Please Sign Up." }, { status: 404 });
        }

        // 2. Check if it's a Google-only account
        if (user.googleSub && !user.passwordHash) {
            return Response.json({ error: "This email uses Google Sign-In. Please use that." }, { status: 400 });
        }

        // 3. Check if password exists (edge case)
        if (!user.passwordHash) {
            return Response.json({ error: "No password set for this account." }, { status: 400 });
        }

        // 4. Check Password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return Response.json({ error: "Incorrect password." }, { status: 401 });
        }

        // Issue Token
        const accessToken = signAccessToken({
            userId: user._id,
            email: user.email,
            // @ts-ignore: role might be missing in pure entity if optional, but it's string[] usually
            role: user.roleIds?.[0] || 'owner',
            tenantId: user.tenantId,
        });

        return Response.json({
            ok: true,
            accessToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.roleIds?.[0] || 'owner',
                isVerified: user.isVerified
            }
        });

    } catch (err: any) {
        console.error("Login error:", err);
        return Response.json({ error: "Internal Server Error", message: err.message, stack: err.stack }, { status: 500 });
    }
}

