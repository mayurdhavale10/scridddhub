import { NextResponse } from "next/server";
import { splitStock } from "@/core/inventory/service";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const body = await req.json();
        const { sourceLotId, splits } = body;

        if (!sourceLotId || !Array.isArray(splits) || splits.length === 0) {
            return NextResponse.json({ error: "Invalid split request" }, { status: 400 });
        }

        const newLots = await splitStock(tenantId, { sourceLotId, splits });

        return NextResponse.json({
            success: true,
            data: newLots
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Split failed" },
            { status: 500 }
        );
    }
}
