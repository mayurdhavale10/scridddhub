import { NextResponse } from "next/server";
import { createWeighEntry } from "@/core/inventory/service";
import { WeighEntryInput } from "@/core/inventory/types";

export const dynamic = 'force-dynamic';

// POST /api/erp/{tenantId}/inventory
export async function POST(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const tenantId = params.tenantId;

        const body = (await req.json()) as WeighEntryInput;

        // Basic validation (minimum)
        if (!body.materialId || !body.supplierId || !body.yardId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const result = await createWeighEntry(body, tenantId);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("Inventory POST error:", error);

        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// GET /api/erp/{tenantId}/inventory
export async function GET(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const tenantId = params.tenantId;
        const { getWeighEntries } = await import("@/core/inventory/service");

        const data = await getWeighEntries(tenantId);

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch inventory" },
            { status: 500 }
        );
    }
}
