import { NextResponse } from 'next/server';
import { validateApiKey } from '@/core/inventory/sales-service';
import { getStockLots } from '@/core/inventory/service';

export const dynamic = 'force-dynamic';

/**
 * PHASE 3: External API — Public stock read endpoint
 * Used by external ERP systems (Tally, SAP, Custom) to check available stock.
 *
 * Authentication: Pass header  X-API-Key: sk_live_xxxxx
 * Example: GET /api/public/[tenantId]/stock
 */
export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId } = await params;

    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 });
    }

    if (!validateApiKey(tenantId, apiKey)) {
        return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 403 });
    }

    try {
        const lots = await getStockLots(tenantId);
        return NextResponse.json({
            success: true,
            tenant_id: tenantId,
            fetched_at: new Date().toISOString(),
            total_lots: lots.length,
            data: lots.map(l => ({
                lot_id: l.lot_id,
                material_id: l.material_id,
                available_weight_kg: l.available_weight,
                status: l.status,
                age_days: l.days_in_yard ?? null
            }))
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
