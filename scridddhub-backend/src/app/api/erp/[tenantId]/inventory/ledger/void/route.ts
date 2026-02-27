
import { NextResponse } from "next/server";
import { voidInventoryEntry } from "@/core/inventory/service";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const { type, id, reason } = await req.json();

        if (!type || !id || !reason) {
            return NextResponse.json({ error: "Missing type, id or reason" }, { status: 400 });
        }

        const success = await voidInventoryEntry(tenantId, type, id, reason);

        if (!success) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Entry voided successfully"
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to void entry" }, { status: 500 });
    }
}
