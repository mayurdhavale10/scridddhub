import { NextResponse } from 'next/server';
import { getSalesOrders, createSalesOrder } from '@/core/inventory/sales-service';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/orders
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const orders = await getSalesOrders(tenantId);
        return NextResponse.json({ success: true, data: orders });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/erp/[tenantId]/sales/orders
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const body = await req.json();
        const order = await createSalesOrder(tenantId, body);
        return NextResponse.json({ success: true, data: order });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
