
import { NextResponse } from "next/server";
import { getStockLots } from "@/core/inventory/service";

// POST /api/erp/{tenantId}/inventory/stock (Actually GET)
export async function GET(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const data = await getStockLots(params.tenantId);
        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to fetch stock" }, { status: 500 });
    }
}
