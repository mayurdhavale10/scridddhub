
export const runtime = "nodejs";

import bcrypt from "bcryptjs";
import { getDb } from "../../../../lib/db/dbConnect";
import { otpCollection } from "../../../../models/Otp";
import { usersCollection } from "../../../../models/User";
import { hashOtp, verifyOtpHash } from "../../../../lib/auth/otp";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        let { email, otp, newPassword } = body || {};
        email = email?.trim();

        if (!email || !otp || !newPassword) {
            return Response.json({ error: "Email, OTP, and new password are required." }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
        }

        const db = await getDb();
        const otps = otpCollection(db);
        const users = usersCollection(db);

        // 1. Verify OTP
        // Find the latest OTP for this user purpose="reset_password"
        // (Since multiple might exist, findOne with sort desc createdAt usually best, 
        // but our hash check has to serve)
        // Here we just look for *any* valid unexpired OTP matching the hash

        // Optimally, we fetch by identifier + purpose first
        const pendingOtps = await otps.find({
            identifier: email,
            purpose: "reset_password",
            expiresAt: { $gt: new Date() }
        }).toArray();

        let validDoc = null;
        for (const doc of pendingOtps) {
            // We stored hash(otp)
            // We need to compare hash(input_otp) == stored_hash
            // Wait, our hashOtp uses salt? lib/otp shows 'crypto.update(otp).digest(hex)'. No random salt per hash?
            // Let's assume hashOtp is deterministic.
            // Checking lib/otp usages -> verifyOtpHash(otp, hash)
            if (verifyOtpHash(otp, doc.otpHash)) {
                validDoc = doc;
                break;
            }
        }

        if (!validDoc) {
            return Response.json({ error: "Invalid or expired OTP." }, { status: 400 });
        }

        // 2. Hash New Password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // 3. Update User
        const result = await users.updateOne(
            { email },
            { $set: { passwordHash, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return Response.json({ error: "User not found." }, { status: 404 });
        }

        // 4. Delete used OTP
        await otps.deleteOne({ _id: validDoc._id });

        return Response.json({ ok: true, message: "Password updated successfully. Please login." });

    } catch (err: any) {
        console.error("reset-password error:", err);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
