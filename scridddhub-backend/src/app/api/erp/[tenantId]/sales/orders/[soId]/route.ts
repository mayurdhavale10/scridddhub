import { NextResponse } from 'next/server';
import { getSalesOrderById, confirmSalesOrder, fulfillSalesOrder } from '@/core/inventory/sales-service';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/orders/[soId]
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string; soId: string }> }) {
    try {
        const { tenantId, soId } = await params;
        const order = await getSalesOrderById(tenantId, soId);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: order });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/erp/[tenantId]/sales/orders/[soId]/confirm  → via query
// POST /api/erp/[tenantId]/sales/orders/[soId]/fulfill  → via query
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; soId: string }> }) {
    try {
        const { tenantId, soId } = await params;
        const { action, ...body } = await req.json();

        if (action === 'confirm') {
            const order = await confirmSalesOrder(tenantId, soId);
            return NextResponse.json({ success: true, data: order });
        }

        if (action === 'fulfill') {
            const order = await fulfillSalesOrder(tenantId, { soId, ...body });
            return NextResponse.json({ success: true, data: order });
        }

        return NextResponse.json({ error: 'Unknown action. Use: confirm | fulfill' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
