import { NextResponse } from "next/server";
import { fulfillSalesOrder } from "@/core/inventory/sales-service";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; soId: string }> }) {
    try {
        const { tenantId, soId } = await params;
        const body = await req.json();
        // body should be { pickedItems: [{ itemId, pickedLots: [] }] }

        if (!body.pickedItems || !Array.isArray(body.pickedItems)) {
            return NextResponse.json({ error: "Invalid payload: pickedItems missing" }, { status: 400 });
        }

        const order = await fulfillSalesOrder(tenantId, { soId: soId, pickedItems: body.pickedItems });

        return NextResponse.json({ success: true, data: order });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Fulfill failed" }, { status: 500 });
    }
}
