export const runtime = "nodejs";

import { google } from "googleapis";
import { getDb } from "../../../../lib/db/dbConnect";
import { usersCollection, createUser } from "../../../../models/User";
import { signAccessToken } from "../../../../lib/auth/jwt";

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID as string,
    process.env.GOOGLE_CLIENT_SECRET as string,
    process.env.GOOGLE_REDIRECT_URI as string
);

// GET: Initiates the login flow
export async function GET(req: Request) {
    // Generate a secure URL to Google's consent page
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
    });

    // In a real app we might redirect, but for API we return the URL
    // The frontend (or mobile app) opens this URL.
    return Response.json({ url });
}

// POST: Handles the callback (Code exchange)
// Mobile App sends { code } here after user signs in.
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const { code } = body || {};

        if (!code) {
            return Response.json({ error: "Missing authorization code." }, { status: 400 });
        }

        // 1. Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // 2. Fetch User Info
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();

        if (!data.email) {
            return Response.json({ error: "Google account has no email." }, { status: 400 });
        }

        // 3. Find or Create User in DB
        const db = await getDb();
        const users = usersCollection(db);
        let user = await users.findOne({ email: data.email });

        let userId = user?._id;

        if (!user) {
            // STRICT MODE: Do not auto-create.
            return Response.json({ error: "No account found. Please Sign Up first." }, { status: 404 });
        } else {
            // Update existing user with google info if needed
            if (!user.googleSub) {
                await users.updateOne(
                    { _id: user._id },
                    { $set: { googleSub: (data.id ?? undefined) as string, picture: (data.picture ?? undefined) as string, isVerified: true } }
                );
            }
        }

        // 4. Issue App Token
        const accessToken = signAccessToken({
            userId: userId!.toString(),
            email: user!.email,
            role: user!.role,
            tenantId: user!.tenantId,
        });

        return Response.json({
            ok: true,
            accessToken,
            user: {
                id: userId!.toString(),
                email: user!.email,
                name: user!.name,
                picture: user!.picture,
                role: user!.role,
            }
        });

    } catch (err: any) {
        console.error("GOOGLE_AUTH_ERROR_START");
        console.error("Step: Failed processing request");
        console.error("Error Message:", err.message);
        console.error("Full Error:", JSON.stringify(err, null, 2));
        console.error("GOOGLE_AUTH_ERROR_END");
        return Response.json({ error: "Google authentication failed: " + err.message }, { status: 500 });
    }
}
