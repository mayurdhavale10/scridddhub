import { NextResponse } from "next/server";
import { getSalesOrders, createSalesOrder } from "@/core/inventory/sales-service";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { tenantId: string } }) {
    try {
        const orders = await getSalesOrders(params.tenantId);
        return NextResponse.json({ success: true, data: orders });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { tenantId: string } }) {
    try {
        const body = await req.json();
        // Basic validation
        if (!body.items || body.items.length === 0) {
            return NextResponse.json({ error: "Order must have items" }, { status: 400 });
        }

        const order = await createSalesOrder(params.tenantId, body);
        return NextResponse.json({ success: true, data: order });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
