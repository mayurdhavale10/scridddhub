import { NextResponse } from 'next/server';
import { getCustomers, createCustomer } from '@/core/inventory/sales-service';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/customers
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const customers = await getCustomers(tenantId);
        return NextResponse.json({ success: true, data: customers });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/erp/[tenantId]/sales/customers
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const body = await req.json();
        if (!body.name || !body.contact_phone) {
            return NextResponse.json({ error: 'name and contact_phone are required' }, { status: 400 });
        }
        const customer = await createCustomer(tenantId, body);
        return NextResponse.json({ success: true, data: customer });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
