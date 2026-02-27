
import { NextResponse } from "next/server";
import { getInventoryLedger } from "@/core/inventory/service";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const data = await getInventoryLedger(tenantId);

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to fetch ledger" }, { status: 500 });
    }
}
