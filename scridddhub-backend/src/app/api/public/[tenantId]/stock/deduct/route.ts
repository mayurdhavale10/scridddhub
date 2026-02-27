import { NextResponse } from 'next/server';
import { validateApiKey } from '@/core/inventory/sales-service';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const STOCK_PATH = path.join(DATA_DIR, 'mock_stock.json');
const DEDUCT_LOG_PATH = path.join(DATA_DIR, 'mock_external_deductions.json');

/**
 * POST /api/public/[tenantId]/stock/deduct
 * Header: X-API-Key: sk_live_xxxxx
 * Body: { lot_id: string, weight_kg: number, reference?: string }
 *
 * Used by external ERPs (Tally, SAP) to deduct stock after a sale.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string }> }
) {
    const { tenantId } = await params;

    // ── Auth ──────────────────────────────────────────────────────────
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) return NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 });
    if (!validateApiKey(tenantId, apiKey)) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });

    // ── Validate body ─────────────────────────────────────────────────
    let body: { lot_id: string; weight_kg: number; reference?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.lot_id || !body.weight_kg || body.weight_kg <= 0) {
        return NextResponse.json(
            { error: 'Required: lot_id (string), weight_kg (number > 0)' },
            { status: 400 }
        );
    }

    try {
        // ── Load stock ────────────────────────────────────────────────
        let stock: any[] = [];
        if (fs.existsSync(STOCK_PATH)) {
            stock = JSON.parse(fs.readFileSync(STOCK_PATH, 'utf-8'));
        }

        const lotIdx = stock.findIndex(l => l.lot_id === body.lot_id);
        if (lotIdx === -1) {
            return NextResponse.json({ error: `Lot ${body.lot_id} not found` }, { status: 404 });
        }

        const lot = stock[lotIdx];
        if (lot.status !== 'stored') {
            return NextResponse.json(
                { error: `Lot ${body.lot_id} is not available (status: ${lot.status})` },
                { status: 409 }
            );
        }

        if (lot.available_weight < body.weight_kg) {
            return NextResponse.json({
                error: `Insufficient stock. Available: ${lot.available_weight}kg, Requested: ${body.weight_kg}kg`
            }, { status: 409 });
        }

        // ── Deduct ────────────────────────────────────────────────────
        const remaining = lot.available_weight - body.weight_kg;
        stock[lotIdx] = {
            ...lot,
            available_weight: remaining,
            status: remaining <= 0 ? 'sold' : 'stored'
        };

        fs.writeFileSync(STOCK_PATH, JSON.stringify(stock, null, 2));

        // ── Audit log ─────────────────────────────────────────────────
        let log: any[] = [];
        if (fs.existsSync(DEDUCT_LOG_PATH)) {
            log = JSON.parse(fs.readFileSync(DEDUCT_LOG_PATH, 'utf-8'));
        }
        log.push({
            deduction_id: `EXT-${Date.now()}`,
            tenant_id: tenantId,
            lot_id: body.lot_id,
            weight_deducted_kg: body.weight_kg,
            remaining_kg: remaining,
            reference: body.reference || null,
            deducted_at: new Date().toISOString(),
            source: 'external_api'
        });
        fs.writeFileSync(DEDUCT_LOG_PATH, JSON.stringify(log, null, 2));

        return NextResponse.json({
            success: true,
            deduction_id: log[log.length - 1].deduction_id,
            lot_id: body.lot_id,
            weight_deducted_kg: body.weight_kg,
            remaining_kg: remaining,
            lot_status: stock[lotIdx].status,
            deducted_at: new Date().toISOString()
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
