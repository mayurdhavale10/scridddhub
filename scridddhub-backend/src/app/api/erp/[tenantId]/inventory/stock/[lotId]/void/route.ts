
import { NextResponse } from "next/server";
import { voidStockLot } from "@/core/inventory/service";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string; lotId: string }> }
) {
    try {
        const { tenantId, lotId } = await params;
        const { reason, operator } = await req.json();

        if (!reason) {
            return NextResponse.json({ error: "Reason is required to void a lot" }, { status: 400 });
        }

        const success = await voidStockLot(tenantId, lotId, reason, operator);

        if (!success) {
            return NextResponse.json({ error: "Lot not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Lot voided successfully"
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to void lot" }, { status: 500 });
    }
}
