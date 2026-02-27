export const runtime = "nodejs";

import bcrypt from "bcryptjs";
import { getDb } from "../../../../lib/db/dbConnect";
import { MongoUserRepository } from "../../../../lib/db/mongo/repositories/user.repo";
import { signAccessToken } from "../../../../lib/auth/jwt";

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        const email = String(body?.email ?? "").trim().toLowerCase();
        const password = String(body?.password ?? "");
        const name = body?.name ? String(body.name).trim() : undefined;

        if (!email || !password) {
            return Response.json({ error: "Email and password are required." }, { status: 400 });
        }
        if (!isValidEmail(email)) {
            return Response.json({ error: "Invalid email format." }, { status: 400 });
        }
        if (password.length < 8) {
            return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }

        const db = await getDb();
        const userRepo = new MongoUserRepository(db);

        // pre-check
        const existing = await userRepo.findByEmail(email);
        if (existing) {
            return Response.json({ error: "Email already in use." }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        // Create with new Repo
        const user = await userRepo.create({
            email,
            passwordHash,
            name,
            roleIds: ["owner"], // Default role
            isVerified: false,
            tenantId: "pending_assignment", // Explicitly set pending
        });

        const accessToken = signAccessToken({
            userId: user._id,
            email,
            role: "owner",
            tenantId: user.tenantId,
        });

        return Response.json(
            {
                ok: true,
                otpRequired: true,
                user: {
                    id: user._id,
                    email,
                    name,
                    role: "owner",
                    isVerified: false,
                },
                accessToken,
            },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("Signup error:", err);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
