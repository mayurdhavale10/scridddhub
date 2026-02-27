import { NextResponse } from 'next/server';
import { getOutstandingReport } from '@/core/inventory/sales-service';

export const dynamic = 'force-dynamic';

// GET /api/erp/[tenantId]/sales/crm/outstanding
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    try {
        const { tenantId } = await params;
        const report = await getOutstandingReport(tenantId);
        return NextResponse.json({ success: true, data: report });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
