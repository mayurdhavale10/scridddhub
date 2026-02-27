export const runtime = "nodejs";

import { getDb } from "../../../../lib/db/dbConnect";
import { otpCollection } from "../../../../models/Otp";
import { usersCollection, createUser } from "../../../../models/User";
import { signAccessToken } from "../../../../lib/auth/jwt";
import { hashOtp } from "../../../../lib/auth/otp";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const { email, otp, password } = body || {};

        if (!email || !otp) {
            return Response.json({ error: "Email and OTP are required." }, { status: 400 });
        }

        const db = await getDb();
        const otps = otpCollection(db);
        const users = usersCollection(db);

        // 1. Find OTP record
        const record = await otps.findOne(
            { identifier: email, purpose: "signup" },
            { sort: { createdAt: -1 } } // Get latest
        );

        if (!record) {
            return Response.json({ error: "Invalid or expired OTP." }, { status: 400 });
        }

        // 2. Verify Hash
        const hashed = hashOtp(otp);
        if (hashed !== record.otpHash) {
            return Response.json({ error: "Invalid OTP code." }, { status: 400 });
        }

        // 3. OTP is valid. Check if User exists. Hash password if provided.
        let passwordHash = undefined;
        if (password) {
            passwordHash = await bcrypt.hash(password, 12);
        }

        let user = await users.findOne({ email });
        let userId = user?._id;

        if (!user) {
            // Create user if not exists (Lazy Signup) with Password
            userId = await createUser(db, {
                email,
                passwordHash,
                isVerified: true,
                role: "owner"
            });
        } else {
            // User exists: Mark verified AND update password if provided
            const updateFields: any = { isVerified: true };
            if (passwordHash) {
                updateFields.passwordHash = passwordHash;
            }
            await users.updateOne({ _id: user._id }, { $set: updateFields });

            // Refresh user object for token
            if (passwordHash) user.passwordHash = passwordHash;
        }

        // 4. Issue Token
        const accessToken = signAccessToken({
            userId: userId!.toString(),
            email,
            role: user?.role || "owner",
            tenantId: user?.tenantId,
        });

        // 5. Cleanup used OTP
        await otps.deleteOne({ _id: record._id });

        return Response.json({
            ok: true,
            accessToken,
            user: {
                id: userId!.toString(),
                email,
                role: user?.role || "owner",
                isVerified: true
            }
        });

    } catch (err) {
        console.error("verify-otp error:", err);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
