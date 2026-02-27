
export const runtime = "nodejs";

import { getDb } from "../../../../lib/db/dbConnect";
import { ensureOtpIndexes, otpCollection } from "../../../../models/Otp";
import { usersCollection } from "../../../../models/User";
import { generateNumericOtp, hashOtp } from "../../../../lib/auth/otp";
import { sendEmail } from "../../../../lib/auth/email";

function isValidIdentifier(id: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        let { email } = body || {};
        email = email?.trim();

        if (!email || !isValidIdentifier(email)) {
            return Response.json({ error: "Valid email is required." }, { status: 400 });
        }

        const db = await getDb();
        const users = usersCollection(db);

        // 1. Check if user exists (Must exist for Forgot Password)
        const user = await users.findOne({ email });
        if (!user) {
            // Security: Don't reveal if user exists or not, but for MVP/UX we might want to say "User not found"
            // Let's settle on "If exist, sent." logic but for Debugging User requested specific errors.
            // Returning 404 helps the user know they used the wrong email.
            return Response.json({ error: "User not found with this email." }, { status: 404 });
        }

        if (user.googleSub && !user.passwordHash) {
            return Response.json({ error: "This account uses Google Login. Please sign in with Google." }, { status: 400 });
        }

        await ensureOtpIndexes(db);
        const otps = otpCollection(db);

        // 2. Generate OTP
        const otp = generateNumericOtp(6);
        const hashed = hashOtp(otp);

        // 3. Store to DB (expires in 10 mins for reset)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await otps.insertOne({
            identifier: email,
            purpose: "reset_password",
            otpHash: hashed,
            attempts: 0,
            expiresAt,
            createdAt: new Date(),
        } as any);

        // 4. Send Email
        await sendEmail({
            to: email,
            subject: "Reset Your ScridddHub Password",
            text: `Your Password Reset Code is: ${otp}. It expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        });

        return Response.json({ ok: true, message: "Reset OTP sent to email." });

    } catch (err: any) {
        console.error("forgot-password error:", err);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
