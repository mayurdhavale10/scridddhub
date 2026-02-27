export const runtime = "nodejs";

import { getDb } from "../../../../lib/db/dbConnect";
import { ensureOtpIndexes, otpCollection } from "../../../../models/Otp";
import { usersCollection } from "../../../../models/User";
import { generateNumericOtp, hashOtp } from "../../../../lib/auth/otp";
import { sendEmail } from "../../../../lib/auth/email";

function isValidIdentifier(id: string) {
    // For now simple email check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
}

export async function POST(req: Request) {
    // Debug entry
    try {
        require('fs').appendFileSync(
            require('path').join(process.cwd(), 'backend-debug.log'),
            `\n${new Date().toISOString()} - Send-OTP Hit\n`
        );
    } catch (e) { }

    try {
        const body = await req.json().catch(() => null);
        const { email } = body || {};

        if (!email || !isValidIdentifier(email)) {
            return Response.json({ error: "Valid email is required." }, { status: 400 });
        }

        const db = await getDb();
        const users = usersCollection(db);

        // Check if user already exists
        const existingUser = await users.findOne({ email });
        if (existingUser && existingUser.isVerified) {
            return Response.json({ error: "User already exists. Please login to continue." }, { status: 409 });
        }

        await ensureOtpIndexes(db);
        const otps = otpCollection(db);

        // 1. Generate OTP
        const otp = generateNumericOtp(6);
        const hashed = hashOtp(otp);

        // 2. Store to DB (expires in 5 mins)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await otps.insertOne({
            identifier: email,
            purpose: "signup", // or login, generic for now
            otpHash: hashed,
            attempts: 0,
            expiresAt,
            createdAt: new Date(),
        } as any);

        // 3. Send via Email (Mock)
        await sendEmail({
            to: email,
            subject: "Your ScridddHub Login OTP",
            text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
        });

        return Response.json({ ok: true, message: "OTP sent." });

    } catch (err: any) {
        console.error("send-otp error detailed:", err);

        // Write to debug log file
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'backend-debug.log');
            fs.appendFileSync(logPath, `${new Date().toISOString()} - ERROR: ${err.message}\n${err.stack}\n\n`);
        } catch (e) { /* ignore log write error */ }

        return Response.json({
            error: "Internal Server Error",
            details: err.message,
            stack: err.stack
        }, { status: 500 });
    }
}
