
import { NextResponse } from "next/server";
import { getInventorySettings, updateInventorySettings } from "@/core/inventory/service";
import { InventorySettings } from "@/core/inventory/types";

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const settings = await getInventorySettings(params.tenantId);
        return NextResponse.json({
            success: true,
            data: settings,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const body = (await req.json()) as Partial<InventorySettings>;
        const updated = await updateInventorySettings(params.tenantId, body);

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to update settings" },
            { status: 500 }
        );
    }
}
