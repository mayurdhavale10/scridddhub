
import { NextResponse } from "next/server";
import { deleteStockLot } from "@/core/inventory/service";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ tenantId: string; lotId: string }> }
) {
    try {
        const { tenantId, lotId } = await params;
        const success = await deleteStockLot(tenantId, lotId);

        if (!success) {
            return NextResponse.json({ error: "Lot not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Lot deleted successfully"
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to delete lot" }, { status: 500 });
    }
}
