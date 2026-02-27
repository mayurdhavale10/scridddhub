import { NextResponse } from 'next/server';
import { recordPayment, getPaymentsForOrder } from '@/core/inventory/sales-service';
import { PaymentMethod } from '@/core/inventory/types';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/payments?so_id=SO-1001
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const { searchParams } = new URL(req.url);
        const soId = searchParams.get('so_id');
        if (!soId) return NextResponse.json({ error: 'so_id query param required' }, { status: 400 });
        const payments = await getPaymentsForOrder(tenantId, soId);
        return NextResponse.json({ success: true, data: payments });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/erp/[tenantId]/sales/payments
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const body = await req.json();

        if (!body.so_id || !body.amount || !body.method || !body.recorded_by) {
            return NextResponse.json({ error: 'Required: so_id, amount, method, recorded_by' }, { status: 400 });
        }

        if (!Object.values(PaymentMethod).includes(body.method)) {
            return NextResponse.json({
                error: `Invalid method. Use: ${Object.values(PaymentMethod).join(' | ')}`
            }, { status: 400 });
        }

        const payment = await recordPayment(tenantId, body);
        return NextResponse.json({ success: true, data: payment });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
