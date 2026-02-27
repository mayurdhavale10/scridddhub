
// SECURITY FIX #9: Loss Analytics to detect theft patterns
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SPLITS_PATH = path.join(DATA_DIR, 'mock_splits.json');
const DB_PATH = path.join(DATA_DIR, 'mock_inventory.json');

function loadInventory(): any[] {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (_) { }
    return [];
}

function loadSplits(): any[] {
    try {
        if (fs.existsSync(SPLITS_PATH)) return JSON.parse(fs.readFileSync(SPLITS_PATH, 'utf-8'));
    } catch (_) { }
    return [];
}

export async function getLossAnalytics(tenantId: string): Promise<{
    operators: Record<string, { totalEvents: number; totalLoss: number; avgLossPercentage: number }>;
    suppliers: Record<string, { totalInput: number; totalLoss: number; avgLossPercentage: number }>;
    overall: { totalLoss: number; totalInput: number; avgLossPercentage: number };
    alerts: string[];
}> {
    const splits: any[] = loadSplits();
    const inventory: any[] = loadInventory();

    const operators: Record<string, { totalEvents: number; totalLoss: number; avgLossPercentage: number }> = {};
    const suppliers: Record<string, { totalInput: number; totalLoss: number; avgLossPercentage: number }> = {};

    let overallLoss = 0;
    let overallInput = 0;
    const alerts: string[] = [];

    // 1. Tally QC Rejections (Incoming Quality Loss)
    inventory.forEach((entry: any) => {
        if (entry.qc_status === 'pending') return;

        const supplier = entry.supplier_id || 'UNKNOWN';
        const loss = entry.rejected_weight || 0;
        const input = entry.net_weight || 0;

        if (input > 0) {
            if (!suppliers[supplier]) {
                suppliers[supplier] = { totalInput: 0, totalLoss: 0, avgLossPercentage: 0 };
            }
            suppliers[supplier].totalInput += input;
            suppliers[supplier].totalLoss += loss;
            overallLoss += loss;
            overallInput += input;
        }
    });

    // 2. Tally Split Losses (Processing Waste)
    splits.forEach((split: any) => {
        if (split.is_voided) return;

        const operator = split.created_by || 'UNKNOWN';
        const supplier = split.supplier_id || 'UNKNOWN';
        const loss = split.loss_weight || 0;
        const input = split.input_weight;

        // Track by operator (Processing specifically)
        if (!operators[operator]) {
            operators[operator] = { totalEvents: 0, totalLoss: 0, avgLossPercentage: 0 };
        }
        operators[operator].totalEvents++;
        operators[operator].totalLoss += loss;

        // Track by supplier
        if (!suppliers[supplier]) {
            suppliers[supplier] = { totalInput: 0, totalLoss: 0, avgLossPercentage: 0 };
        }
        suppliers[supplier].totalInput += input;
        suppliers[supplier].totalLoss += loss;

        overallLoss += loss;
        overallInput += input;

        // Alert: Pattern detection for threshold avoidance
        const lossPercentage = (loss / input) * 100;
        if (lossPercentage > 4.5 && lossPercentage < 5.5) {
            if (operators[operator].totalEvents >= 5) {
                const recentAlert = `⚠️ Pattern Alert: Operator ${operator} consistently reports ~5% processing loss. Potential threshold avoidance detected.`;
                if (!alerts.includes(recentAlert)) alerts.push(recentAlert);
            }
        }
    });

    // Calculate averages
    Object.keys(operators).forEach(op => {
        const data = operators[op];
        data.avgLossPercentage = data.totalEvents > 0 ? (data.totalLoss / (data.totalEvents * 500)) * 100 : 0; // Avg 500kg ref
    });

    Object.keys(suppliers).forEach(sup => {
        const data = suppliers[sup];
        data.avgLossPercentage = data.totalInput > 0 ? (data.totalLoss / data.totalInput) * 100 : 0;

        if (data.avgLossPercentage > 15) {
            alerts.push(`🚨 Critical Loss: Supplier ${sup} has a ${data.avgLossPercentage.toFixed(1)}% total shrinkage rate (Incoming rejection + Processing waste).`);
        }
    });

    return {
        operators,
        suppliers,
        overall: {
            totalLoss: overallLoss,
            totalInput: overallInput,
            avgLossPercentage: overallInput > 0 ? (overallLoss / overallInput) * 100 : 0
        },
        alerts
    };
}
