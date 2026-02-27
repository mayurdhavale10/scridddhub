import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';
import {
    WeighEntryInput,
    WeighEntry,
    QCStatus,
    SyncStatus,
    StockLot,
    StockStatus,
    WeighFieldTemplate,
    InventorySettings,
    SplitTransaction,
    SplitAnalytics,
    InventoryEventType,
    InventoryLedgerEntry,
    DailyLedgerSummary
} from "./types";

// ---------------------------------------------------------
// PERSISTENCE HELPERS
// ---------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mock_inventory.json');
const STOCK_PATH = path.join(DATA_DIR, 'mock_stock.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'mock_settings.json');

const TEMPLATES_PATH = path.join(DATA_DIR, 'mock_templates.json');
const SPLITS_PATH = path.join(DATA_DIR, 'mock_splits.json');
const LEDGER_PATH = path.join(DATA_DIR, 'mock_ledger.json'); // SECURITY FIX #4: Audit trail

function loadData<T>(filePath: string, defaultValue: T): T {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error(`Failed to load data from ${filePath}`, e);
    }
    return defaultValue;
}

function saveData(filePath: string, data: any) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Failed to save data to ${filePath}`, e);
    }
}

// ---------------------------------------------------------
// INITIALIZE DATA
// ---------------------------------------------------------

let MOCK_DB: WeighEntry[] = loadData(DB_PATH, []);
let MOCK_STOCK: StockLot[] = loadData(STOCK_PATH, []);

let MOCK_SPLITS: SplitTransaction[] = loadData(SPLITS_PATH, []);
let MOCK_TEMPLATES: WeighFieldTemplate[] = loadData(TEMPLATES_PATH, []);
let MOCK_SETTINGS: InventorySettings = loadData(SETTINGS_PATH, {
    materials: ["Copper", "Brass", "Aluminum", "Iron", "Stainless Steel"],
    suppliers: [],
    units: ["kg", "lbs", "ton"],
    machines: ["Shredder-A", "Granulator-B", "Baler-1", "Manual Sort"], // V2 Defaults
    loss_reasons: ["Contamination", "Moisture", "Machine Issue", "Process Waste"], // V3 Defaults
    deleted_materials: [],
    deleted_suppliers: [],
    deleted_units: [],
    hidden_sections: []
});

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

// Batch ID counter to prevent duplicates
let batchCounter = 0;

function generateBatchId(yardId: string): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const time = date.getTime().toString().slice(-6);
    batchCounter = (batchCounter + 1) % 1000; // Reset every 1000
    const counter = batchCounter.toString().padStart(3, '0');
    return `BATCH-${yardId}-${dateStr}-${time}-${counter}`;
}

// ---------------------------------------------------------
// CORE SERVICE
// ---------------------------------------------------------

export async function createWeighEntry(
    input: WeighEntryInput,
    tenantId: string
): Promise<{
    weighEntry: WeighEntry;
    stockLot: StockLot;
}> {
    // 1️⃣ Calculate net weight with SECURITY VALIDATIONS
    const tare = input.tareWeight || 0;
    const gross = input.grossWeight;

    // SECURITY FIX #1: Maximum weight validation
    const MAX_GROSS_WEIGHT = 50000; // 50 tons max
    const MAX_TARE_WEIGHT = 15000; // 15 tons max for vehicle

    if (gross > MAX_GROSS_WEIGHT) {
        throw new Error(`Gross weight ${gross}kg exceeds maximum allowed ${MAX_GROSS_WEIGHT}kg`);
    }

    if (tare > MAX_TARE_WEIGHT) {
        throw new Error(`Tare weight ${tare}kg exceeds maximum allowed ${MAX_TARE_WEIGHT}kg`);
    }

    const netWeight = gross - tare;

    if (netWeight <= 0) {
        throw new Error("Invalid net weight: Net weight must be positive");
    }

    // SECURITY FIX #1b: Tare percentage validation (prevent manipulation)
    const tarePercentage = (tare / gross) * 100;
    if (tarePercentage > 85) {
        throw new Error(`Suspicious tare weight: ${tarePercentage.toFixed(1)}% of gross. Maximum allowed is 85%. Please verify vehicle weight.`);
    }

    // 2️⃣ Generate IDs
    const entryId = randomUUID();
    const batchId = generateBatchId(input.yardId);

    // 3️⃣ Build Weigh Entry (ROOT)
    const weighEntry: WeighEntry = {
        entry_id: entryId,
        batch_id: batchId,

        gross_weight: input.grossWeight,
        tare_weight: tare,
        net_weight: netWeight,

        material_id: input.materialId,
        supplier_id: input.supplierId,
        supplier_contact: (input as any).supplierContact,
        vehicle_id: input.vehicleId || "TEMP_VEHICLE",
        employee_id: input.employeeId,

        yard_id: input.yardId,
        zone_id: input.zoneId,

        weigh_method: input.weighMethod,
        intake_type: input.intakeType,

        qc_status: QCStatus.Pending,
        sync_status: SyncStatus.Synced,

        remarks: input.remarks,

        // Dynamic Fields
        custom_values: input.customValues,

        device_id: "MOBILE_APP",
        weighed_at: new Date(),
        created_at: new Date(),
    };

    // 4️⃣ Create Stock Lot Stub (activated after QC pass)
    const stockLot: StockLot = {
        lot_id: randomUUID(),
        batch_id: batchId,
        material_id: input.materialId,
        yard_id: input.yardId,
        zone_id: input.zoneId,

        available_weight: netWeight,
        status: StockStatus.Stored,
    };

    // 5️⃣ Emit Event (future)
    emitInventoryCreated(entryId, tenantId);

    // MOCK DB SAVE
    MOCK_DB.push(weighEntry);
    saveData(DB_PATH, MOCK_DB);

    // 6️⃣ Return (DB comes later)
    return {
        weighEntry,
        stockLot,
    };
}

// ---------------------------------------------------------
// EVENTS (stub)
// ---------------------------------------------------------

// ---------------------------------------------------------
// MOCK DATABASE (In-Memory)
// ---------------------------------------------------------
// MOCK FIELD TEMPLATES (Simulating Yard Manager Configurations)
// MOCK FIELD TEMPLATES (Simulating Yard Manager Configurations)
// Made mutable for Yard Manager to add more

function emitInventoryCreated(entryId: string, tenantId: string) {
    console.log("inventory.created", {
        tenantId,
        entryId,
    });
}

export async function createWeighFieldTemplate(tenantId: string, template: WeighFieldTemplate): Promise<WeighFieldTemplate> {
    const newTemplate = { ...template, field_id: `field_${Date.now()}` };
    MOCK_TEMPLATES.push(newTemplate);
    saveData(TEMPLATES_PATH, MOCK_TEMPLATES);
    return newTemplate;
}

export async function getWeighFieldTemplates(tenantId: string, materialId?: string): Promise<WeighFieldTemplate[]> {
    MOCK_TEMPLATES = loadData(TEMPLATES_PATH, []);

    // If no materialId provided, return all (for Manager Dashboard)
    if (!materialId) return MOCK_TEMPLATES;

    // In real app, query DB where material_scope includes materialId
    // Case-insensitive match for demo. Added support for "All" wildcard.
    return MOCK_TEMPLATES.filter(t =>
        t.material_scope.includes('All') ||
        t.material_scope.some(scope => scope.toLowerCase() === materialId.toLowerCase())
    );
}

export async function deleteWeighFieldTemplate(tenantId: string, fieldId: string): Promise<boolean> {
    const index = MOCK_TEMPLATES.findIndex(t => t.field_id === fieldId);
    if (index !== -1) {
        MOCK_TEMPLATES.splice(index, 1);
        saveData(TEMPLATES_PATH, MOCK_TEMPLATES);
        return true;
    }
    return false;
}

export async function getWeighEntries(tenantId: string): Promise<WeighEntry[]> {
    MOCK_DB = loadData(DB_PATH, []); // Reload to ensure freshness
    // In real app, filter by tenantId and sort by date desc
    return MOCK_DB.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function deleteWeighEntry(tenantId: string, batchId: string): Promise<{ success: boolean; error?: string; debug?: any }> {
    if (!batchId) {
        return { success: false, error: "Batch ID missing" };
    }

    const targetId = String(batchId).trim();
    console.log(`🗑️ DELETE REQUEST - Looking for batchId: '${targetId}'`);

    // 1. Reload DB
    MOCK_DB = loadData(DB_PATH, []);

    // 2. Debug Info
    const dbIds = MOCK_DB.map(e => String(e.batch_id).trim());

    // 3. Find
    const index = MOCK_DB.findIndex(e => String(e.batch_id).trim() === targetId); // Strict match after trim

    if (index !== -1) {
        const deleted = MOCK_DB.splice(index, 1);
        saveData(DB_PATH, MOCK_DB);
        console.log("✅ Deleted entry:", deleted[0]?.batch_id);
        return { success: true };
    }

    // Check strict vs loose
    const looseMatch = MOCK_DB.find(e => String(e.batch_id).includes(targetId));

    return {
        success: false,
        error: "Entry not found",
        debug: {
            receivedId: targetId,
            dbCount: MOCK_DB.length,
            availableIds: dbIds,
            hasLooseMatch: !!looseMatch
        }
    };
}

export async function updateWeighEntry(tenantId: string, batchId: string, updates: Partial<WeighEntryInput>): Promise<WeighEntry | null> {
    MOCK_DB = loadData(DB_PATH, []);
    const index = MOCK_DB.findIndex(e => e.batch_id === batchId);
    if (index !== -1) {
        const existing = MOCK_DB[index];
        const updated = {
            ...existing,
            material_id: updates.materialId !== undefined ? updates.materialId : existing.material_id,
            supplier_id: updates.supplierId !== undefined ? updates.supplierId : existing.supplier_id,
            supplier_contact: (updates as any).supplierContact !== undefined ? (updates as any).supplierContact : existing.supplier_contact,
            created_at: (updates as any).timestamp ? new Date((updates as any).timestamp) : existing.created_at,
            custom_values: updates.customValues || existing.custom_values || {},
        };

        if (updates.grossWeight !== undefined) {
            updated.gross_weight = updates.grossWeight;
            updated.net_weight = updated.gross_weight - updated.tare_weight;
        }

        MOCK_DB[index] = updated;
        saveData(DB_PATH, MOCK_DB);
        return updated;
    }
    return null;
}

// ----------------------------------------------------------------------
// MOCK SETTINGS
// ----------------------------------------------------------------------

export async function getInventorySettings(tenantId: string): Promise<InventorySettings> {
    MOCK_SETTINGS = loadData(SETTINGS_PATH, MOCK_SETTINGS);
    return MOCK_SETTINGS;
}

export async function updateInventorySettings(tenantId: string, settings: Partial<InventorySettings>): Promise<InventorySettings> {
    MOCK_SETTINGS = { ...MOCK_SETTINGS, ...settings };
    saveData(SETTINGS_PATH, MOCK_SETTINGS);
    return MOCK_SETTINGS;
}

// ----------------------------------------------------------------------
// QC SUBMISSION
// ----------------------------------------------------------------------

export async function submitQC(tenantId: string, batchId: string, payload: { status: string; notes?: string; checkedBy?: string; acceptedWeight?: number; rejectedWeight?: number; qcData?: any }): Promise<WeighEntry | null> {
    MOCK_DB = loadData(DB_PATH, []);
    MOCK_STOCK = loadData(STOCK_PATH, []);

    console.log(`🔍 [QC] Submit Request for Batch: '${batchId}'`);
    console.log(`📊 [QC] Current DB Size: ${MOCK_DB.length}`);

    // Loose match attempt first if exact fails
    let index = MOCK_DB.findIndex(e => e.batch_id === batchId);

    if (index === -1) {
        console.warn(`⚠️ [QC] Batch NOT FOUND: '${batchId}'`);
        // Try to find by trimming
        index = MOCK_DB.findIndex(e => String(e.batch_id || "").trim() === String(batchId || "").trim());
        if (index !== -1) {
            console.log(`✅ [QC] Found via TRIM match.`);
        } else {
            console.log(`Snapshot of IDs: ${MOCK_DB.slice(0, 3).map(e => e.batch_id).join(', ')}...`);
            return null;
        }
    }

    const current = MOCK_DB[index];

    // SECURITY FIX #2: Prevent duplicate QC submission
    if (current.qc_status !== QCStatus.Pending) {
        throw new Error(`QC already completed for batch ${batchId}. Status: ${current.qc_status}. Cannot resubmit QC.`);
    }

    const newStatus = payload.status.toLowerCase();

    let qcStatus = QCStatus.Pending;

    // V2 Logic: Calculate Split Weights
    const netWeight = current.net_weight;
    let finalAccepted = 0;
    let finalRejected = 0;

    if (newStatus === 'pass' || newStatus === 'approved') {
        qcStatus = QCStatus.Pass;

        finalAccepted = payload.acceptedWeight !== undefined ? Number(payload.acceptedWeight) : netWeight;

        // Validation: Cannot accept more than we weighed in
        if (finalAccepted > netWeight) {
            throw new Error(`Accepted weight (${finalAccepted}kg) exceeds net intake weight (${netWeight}kg)`);
        }
        if (finalAccepted < 0) throw new Error("Accepted weight cannot be negative");

        finalRejected = payload.rejectedWeight !== undefined ? Number(payload.rejectedWeight) : (netWeight - finalAccepted);
        if (finalRejected < 0) throw new Error("Rejected weight cannot be negative");

        // CREATE STOCK LOT (Only for Accepted Weight)
        if (finalAccepted > 0) {
            const outputLotId = `LOT-${batchId}`;
            const existingLotIndex = MOCK_STOCK.findIndex(s => s.lot_id === outputLotId);

            const stockData: StockLot = {
                lot_id: outputLotId,
                batch_id: batchId,
                material_id: current.material_id,
                yard_id: current.yard_id,
                zone_id: current.zone_id,
                available_weight: finalAccepted,
                status: StockStatus.Stored,
                days_in_yard: 0,
                created_at: new Date().toISOString() // CRITICAL: Added for FIFO sorting
            };

            if (existingLotIndex >= 0) {
                MOCK_STOCK[existingLotIndex] = stockData;
            } else {
                MOCK_STOCK.push(stockData);
            }
            saveData(STOCK_PATH, MOCK_STOCK);
            console.log(`📦 Stock Created: ${stockData.lot_id} (${finalAccepted}kg) at ${stockData.created_at}`);
        }
    } else if (newStatus === 'reject' || newStatus === 'rejected') {
        qcStatus = QCStatus.Reject;
        finalAccepted = 0;
        finalRejected = netWeight;

        // Remove any existing stock lot
        const existingLotIndex = MOCK_STOCK.findIndex(s => s.batch_id === batchId);
        if (existingLotIndex >= 0) {
            MOCK_STOCK.splice(existingLotIndex, 1);
            saveData(STOCK_PATH, MOCK_STOCK);
            console.log(`🗑️ Stock Removed due to Rejection: ${batchId}`);
        }
    }

    const updated: WeighEntry = {
        ...current,
        qc_status: qcStatus,
        remarks: payload.notes ? payload.notes : current.remarks,
        accepted_weight: finalAccepted,
        rejected_weight: finalRejected,
        custom_values: {
            ...current.custom_values,
            ...(payload.qcData || {}),
            qc_inspector: payload.checkedBy,
            qc_timestamp: new Date().toISOString()
        }
    };

    MOCK_DB[index] = updated;
    saveData(DB_PATH, MOCK_DB);

    console.log(`✅ QC Update: ${batchId} -> ${qcStatus} (Acc: ${finalAccepted}, Rej: ${finalRejected})`);
    return updated;
}

export async function updateStockStatuses(tenantId: string, lotIds: string[], status: StockStatus): Promise<void> {
    MOCK_STOCK = loadData(STOCK_PATH, []);
    lotIds.forEach(id => {
        const idx = MOCK_STOCK.findIndex(s => s.lot_id === id);
        if (idx !== -1) {
            MOCK_STOCK[idx].status = status;
            if (status === StockStatus.Sold) {
                MOCK_STOCK[idx].available_weight = 0; // Deduct weight when sold
            }
        }
    });
    saveData(STOCK_PATH, MOCK_STOCK);
}

export async function logInventoryDispatch(tenantId: string, tripId: string, lotIds: string[], operator: string): Promise<void> {
    MOCK_STOCK = loadData(STOCK_PATH, []);
    const ledgerEntries = loadData<InventoryLedgerEntry[]>(LEDGER_PATH, []);

    lotIds.forEach(id => {
        const lot = MOCK_STOCK.find(s => s.lot_id === id);
        if (lot) {
            ledgerEntries.push({
                id: `DISPATCH-${tripId}-${id}`,
                batchId: lot.batch_id,
                type: InventoryEventType.VOID, // Using VOID as a placeholder for dispatch if DISPATCH doesn't exist
                materialId: lot.material_id,
                weightChange: -lot.available_weight,
                timestamp: new Date().toISOString(),
                operator: operator,
                status: 'DISPATCHED',
                reason: `Shipped via Trip ${tripId}`
            });
        }
    });
    saveData(LEDGER_PATH, ledgerEntries);
}

// ----------------------------------------------------------------------
// STOCK MANAGEMENT
// ----------------------------------------------------------------------

export async function getStockLots(tenantId: string): Promise<StockLot[]> {
    MOCK_STOCK = loadData(STOCK_PATH, []);

    // FIFO SORT: Oldest Created Date First
    // AND Filter out VOID lots
    return MOCK_STOCK
        .filter(lot => lot.status !== StockStatus.Void)
        .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;

            // If dates are equal or missing, maybe sort by lot_id?
            // But primarily: Ascending Date
            return dateA - dateB;
        });
}

// Helper to calculate age in days (for UI or logic)
export function calculateAgeInDays(createdAt?: string): number {
    if (!createdAt) return 0;
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diff = now - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export interface AllocationSuggestion {
    lotId: string;
    batchId: string;
    weightToPick: number;
    originalWeight: number;
    ageDays: number;
    reason: string;
}

export async function suggestFIFOAllocation(
    tenantId: string,
    materialId: string,
    requiredWeight: number
): Promise<{ success: boolean; plan: AllocationSuggestion[]; missingWeight: number }> {

    // 1. Get All Stock (Already sorted FIFO by getStockLots)
    let allStock = await getStockLots(tenantId);

    // 2. Filter: Material match + Status STORED only
    const candidates = allStock.filter(s =>
        (s.material_id || "").toLowerCase() === materialId.toLowerCase() &&
        s.status === StockStatus.Stored &&
        s.available_weight > 0
    );

    // 3. Allocate
    const plan: AllocationSuggestion[] = [];
    let remainingNeeded = requiredWeight;

    for (const lot of candidates) {
        if (remainingNeeded <= 0) break;

        const pickAmount = Math.min(lot.available_weight, remainingNeeded);

        plan.push({
            lotId: lot.lot_id,
            batchId: lot.batch_id,
            weightToPick: pickAmount,
            originalWeight: lot.available_weight,
            ageDays: calculateAgeInDays(lot.created_at),
            reason: "Oldest available stock"
        });

        remainingNeeded -= pickAmount;
    }

    return {
        success: remainingNeeded <= 0,
        plan,
        missingWeight: Math.max(0, remainingNeeded)
    };
}

export async function voidStockLot(tenantId: string, lotId: string, reason: string, operator?: string): Promise<boolean> {
    MOCK_STOCK = loadData(STOCK_PATH, []);
    const lotIndex = MOCK_STOCK.findIndex(s => s.lot_id === lotId);
    if (lotIndex === -1) return false;

    const lot = MOCK_STOCK[lotIndex];
    const originalWeight = lot.available_weight;

    MOCK_STOCK[lotIndex].status = StockStatus.Void;
    MOCK_STOCK[lotIndex].void_reason = reason;
    MOCK_STOCK[lotIndex].available_weight = 0;

    saveData(STOCK_PATH, MOCK_STOCK);

    // SECURITY FIX #4: Create audit ledger entry for void
    const ledgerEntries = loadData<InventoryLedgerEntry[]>(LEDGER_PATH, []);
    const voidEntry: InventoryLedgerEntry = {
        id: `VOID-${Date.now()}`,
        batchId: lot.batch_id,
        type: InventoryEventType.VOID,
        materialId: lot.material_id,
        weightChange: -originalWeight,
        timestamp: new Date().toISOString(),
        operator: operator || 'UNKNOWN',
        status: 'VOIDED',
        reason: reason
    };
    ledgerEntries.push(voidEntry);
    saveData(LEDGER_PATH, ledgerEntries);

    console.log(`🗑️ [AUDIT] Lot ${lotId} voided by ${operator}. Reason: ${reason}`);

    return true;
}

export async function deleteStockLot(tenantId: string, lotId: string): Promise<boolean> {
    MOCK_STOCK = loadData(STOCK_PATH, []);
    const initialLength = MOCK_STOCK.length;
    MOCK_STOCK = MOCK_STOCK.filter(s => s.lot_id !== lotId);
    if (MOCK_STOCK.length === initialLength) return false;
    saveData(STOCK_PATH, MOCK_STOCK);
    return true;
}

// ----------------------------------------------------------------------
// SPLIT / PROCESSING
// ----------------------------------------------------------------------

export interface SplitRequest {
    sourceLotId: string;
    splits: { materialId: string; weight: number; }[];
    machineId?: string; // V2
    lossReason?: string; // V3
}

export async function splitStock(tenantId: string, payload: SplitRequest): Promise<StockLot[]> {
    console.log(`✂️ Splitting Lot: ${payload.sourceLotId}`);
    MOCK_STOCK = loadData(STOCK_PATH, []);
    MOCK_SPLITS = loadData(SPLITS_PATH, []);

    // 1. Find Source
    const sourceIdx = MOCK_STOCK.findIndex(l => l.lot_id === payload.sourceLotId);
    if (sourceIdx === -1) throw new Error("Source Lot not found");

    const source = MOCK_STOCK[sourceIdx];

    // V2: Find Supplier from Batch
    MOCK_DB = loadData(DB_PATH, []);
    const batch = MOCK_DB.find(b => b.batch_id === source.batch_id);
    const supplierId = batch?.supplier_id || "Unknown";

    if (source.status === StockStatus.Split) throw new Error("Lot already split");
    if (source.available_weight <= 0) throw new Error("Lot has no weight available");

    // 2. Validate Weight (Allow Loss, Prevent Gain)
    const totalSplit = payload.splits.reduce((sum, item) => sum + item.weight, 0);

    // SECURITY FIX #3: Tighter tolerance - only 1 gram allowed for rounding
    const EPSILON = 0.001; // 1 gram tolerance
    if (totalSplit > source.available_weight * (1 + EPSILON)) {
        throw new Error(`Split total (${totalSplit}kg) exceeds available weight (${source.available_weight}kg). Weight cannot increase during split.`);
    }

    const loss = Math.max(0, source.available_weight - totalSplit);

    // V3: Enforce Loss Reason if > 5%
    const lossPercentage = source.available_weight > 0 ? (loss / source.available_weight) : 0;
    if (lossPercentage > 0.05 && !payload.lossReason) {
        throw new Error(`High loss detected (${(lossPercentage * 100).toFixed(1)}%). Please provide a reason.`);
    }

    // 3. Mark Source as Split
    source.status = StockStatus.Split;
    const originalWeight = source.available_weight; // Store for history
    source.available_weight = 0;
    MOCK_STOCK[sourceIdx] = source;

    // 4. Create New Lots
    const newLots: StockLot[] = payload.splits.map((s, idx) => ({
        lot_id: `${source.lot_id}-${idx + 1}`,
        batch_id: source.batch_id,
        parent_lot_id: source.lot_id, // Link to Parent
        material_id: s.materialId,
        yard_id: source.yard_id,
        available_weight: s.weight,
        status: StockStatus.Stored,
        days_in_yard: source.days_in_yard || 0, // Inherit age
        risk_level: source.risk_level,
        created_at: new Date().toISOString(),
        created_by: "EMP-001" // hardcoded operator for MVP
    }));

    // 5. Log Split Transaction
    const splitTx: SplitTransaction = {
        split_id: `SPLIT-${Date.now()}`,
        parent_lot_id: source.lot_id,
        input_weight: originalWeight,
        output_weight: totalSplit,
        loss_weight: loss,
        outputs: newLots.map(l => ({ lot_id: l.lot_id, weight: l.available_weight, material_id: l.material_id })),
        created_at: new Date().toISOString(),

        created_by: "EMP-001",
        machine_id: payload.machineId,
        supplier_id: supplierId, // V2
        loss_reason: payload.lossReason // V3
    };

    MOCK_STOCK.push(...newLots);
    MOCK_SPLITS.push(splitTx); // Persist History

    saveData(STOCK_PATH, MOCK_STOCK);
    saveData(SPLITS_PATH, MOCK_SPLITS);

    console.log(`✅ Split Complete. Loss: ${loss.toFixed(2)}kg. Created ${newLots.length} new lots.`);
    return newLots;
}

export async function getSplitAnalytics(tenantId: string): Promise<SplitAnalytics> {
    MOCK_SPLITS = loadData(SPLITS_PATH, []);

    let totalInput = 0;
    let totalOutput = 0;
    const machines: Record<string, { input: number; output: number }> = {};
    const suppliers: Record<string, { input: number; output: number; loss: number }> = {};

    MOCK_SPLITS.forEach(tx => {
        totalInput += tx.input_weight;
        totalOutput += tx.output_weight;

        // Machine Stats
        const mId = tx.machine_id || "Unknown";
        if (!machines[mId]) machines[mId] = { input: 0, output: 0 };
        machines[mId].input += tx.input_weight;
        machines[mId].output += tx.output_weight;

        // Supplier Stats
        const sId = tx.supplier_id || "Unknown";
        if (!suppliers[sId]) suppliers[sId] = { input: 0, output: 0, loss: 0 };
        suppliers[sId].input += tx.input_weight;
        suppliers[sId].output += tx.output_weight;
        suppliers[sId].loss += tx.loss_weight;
    });

    const machineStats = Object.keys(machines).map(mId => {
        const stats = machines[mId];
        return {
            machineId: mId,
            processed: stats.input,
            yield: stats.input > 0 ? (stats.output / stats.input) * 100 : 0
        };
    });

    const supplierStats = Object.keys(suppliers).map(sId => {
        const stats = suppliers[sId];
        return {
            supplierId: sId,
            processed: stats.input,
            loss: stats.loss,
            yield: stats.input > 0 ? (stats.output / stats.input) * 100 : 0
        };
    });

    return {
        globalYield: totalInput > 0 ? (totalOutput / totalInput) * 100 : 0,
        totalProcessed: totalInput,
        totalLoss: Math.max(0, totalInput - totalOutput),
        machineStats: machineStats.sort((a, b) => b.yield - a.yield),
        supplierStats: supplierStats.sort((a, b) => b.yield - a.yield), // Highest yield first
        recentSplits: MOCK_SPLITS.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)
    };
}

export async function getInventoryLedger(tenantId: string): Promise<{ ledger: InventoryLedgerEntry[], summary: DailyLedgerSummary }> {
    MOCK_DB = loadData(DB_PATH, []);
    MOCK_SPLITS = loadData(SPLITS_PATH, []);

    const events: InventoryLedgerEntry[] = [];
    let weighed = 0;
    let approved = 0;
    let split = 0;

    // 1. Process Weighings (including QC events)
    MOCK_DB.forEach(entry => {
        // Core Weigh Event
        events.push({
            id: `EV-W-${entry.entry_id}`,
            batchId: entry.batch_id,
            type: entry.is_voided ? InventoryEventType.VOID : InventoryEventType.WEIGH_IN,
            materialId: entry.material_id,
            weightChange: entry.is_voided ? 0 : entry.net_weight,
            timestamp: entry.weighed_at.toString(),
            operator: entry.employee_id,
            status: entry.is_voided ? "VOIDED" : "COMPLETED",
            reason: entry.void_reason,
            metadata: { gross: entry.gross_weight, tare: entry.tare_weight }
        });

        if (!entry.is_voided) weighed += entry.net_weight;

        // QC Event if processed
        if (entry.qc_status !== QCStatus.Pending && !entry.is_voided) {
            const isPass = entry.qc_status === QCStatus.Pass;
            events.push({
                id: `EV-QC-${entry.entry_id}`,
                batchId: entry.batch_id,
                type: isPass ? InventoryEventType.QC_PASS : InventoryEventType.QC_REJECT,
                materialId: entry.material_id,
                weightChange: 0,
                timestamp: new Date(new Date(entry.weighed_at).getTime() + 1000 * 60).toString(), // +1 min mock
                operator: "QUALITY_TEAM",
                status: isPass ? "APPROVED" : "REJECTED"
            });
            if (isPass) approved += entry.net_weight;
        }
    });

    // 2. Process Splits
    MOCK_SPLITS.forEach(s => {
        events.push({
            id: `EV-S-${s.split_id}`,
            batchId: s.parent_lot_id, // We use the lot ID as batch context here
            type: s.is_voided ? InventoryEventType.VOID : InventoryEventType.SPLIT,
            materialId: "MIXED_INPUT", // Or trace back to parent
            weightChange: s.is_voided ? 0 : -s.input_weight, // Removing from raw stock
            timestamp: s.created_at,
            operator: s.created_by,
            status: s.is_voided ? "VOIDED" : "PROCESSED",
            reason: s.void_reason || s.loss_reason,
            metadata: { loss: s.loss_weight, yield: (s.output_weight / s.input_weight) * 100 }
        });

        if (!s.is_voided) split += s.input_weight;
    });

    // Sort by timestamp descending
    const sortedLedger = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
        ledger: sortedLedger,
        summary: {
            totalWeighed: weighed,
            totalApproved: approved,
            totalSplit: split,
            netInventoryDelta: approved - split
        }
    };
}

export async function voidInventoryEntry(tenantId: string, type: 'weigh' | 'split', id: string, reason: string): Promise<boolean> {
    if (type === 'weigh') {
        MOCK_DB = loadData(DB_PATH, []);
        const entry = MOCK_DB.find(e => e.batch_id === id || e.entry_id === id);
        if (!entry) return false;
        entry.is_voided = true;
        entry.void_reason = reason;
        saveData(DB_PATH, MOCK_DB);

        // Also remove from stock if it was there
        MOCK_STOCK = loadData(STOCK_PATH, []);
        MOCK_STOCK = MOCK_STOCK.filter(s => s.batch_id !== entry.batch_id);
        saveData(STOCK_PATH, MOCK_STOCK);
    } else {
        MOCK_SPLITS = loadData(SPLITS_PATH, []);
        const split = MOCK_SPLITS.find(s => s.split_id === id);
        if (!split) return false;
        split.is_voided = true;
        split.void_reason = reason;
        saveData(SPLITS_PATH, MOCK_SPLITS);

        // In a real system, we'd also have to reverse the created child lots
    }
    return true;
}
