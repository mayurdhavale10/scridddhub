import { NextResponse } from 'next/server';
import { suggestFIFOAllocation } from '@/core/inventory/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/erp/[tenantId]/inventory/fifo-suggest?material=Iron&weight=5000
 * Returns an auto FIFO pick plan (oldest lots first).
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    try {
        const { tenantId } = await params;
        const { searchParams } = new URL(req.url);

        const material = searchParams.get('material');
        const weight = parseFloat(searchParams.get('weight') || '0');

        if (!material || weight <= 0) {
            return NextResponse.json(
                { error: 'Required: material (string) and weight (number > 0)' },
                { status: 400 }
            );
        }

        const result = await suggestFIFOAllocation(tenantId, material, weight);

        return NextResponse.json({ success: true, data: result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
