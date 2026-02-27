import { NextResponse } from 'next/server';
import { getSalesConfig, updateSalesConfig } from '@/core/inventory/sales-service';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/config
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const config = getSalesConfig(tenantId);
        // Never return the raw API key over GET — return masked version
        return NextResponse.json({
            success: true,
            data: {
                ...config,
                external_api_key: config.external_api_key
                    ? `sk_live_${'*'.repeat(20)}${config.external_api_key.slice(-4)}`
                    : null
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/erp/[tenantId]/sales/config
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const body = await req.json();
        const config = updateSalesConfig(tenantId, body);
        return NextResponse.json({ success: true, data: config });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
