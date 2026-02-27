export const runtime = "nodejs";

import { getDb } from "../../../lib/db/dbConnect";

export async function GET() {
    try {
        // Quick DB check
        const db = await getDb();
        await db.command({ ping: 1 });

        return Response.json({ status: "ok", db: "connected" });
    } catch (e) {
        return Response.json({ status: "error", db: "disconnected" }, { status: 500 });
    }
}
