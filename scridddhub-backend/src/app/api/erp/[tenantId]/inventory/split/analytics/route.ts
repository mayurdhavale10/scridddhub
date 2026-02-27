import { NextResponse } from "next/server";
import { getSplitAnalytics } from "@/core/inventory/service";

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const data = await getSplitAnalytics(tenantId);

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
