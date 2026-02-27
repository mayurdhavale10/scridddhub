// ----------------------------------------------------------------------
// ENUMS
// ----------------------------------------------------------------------

export enum WeighMethod {
    DigitalScale = "digital_scale",
    Manual = "manual",
    BridgeScale = "bridge_scale",
}

export enum IntakeType {
    Purchase = "purchase",
    Internal = "internal",
    Return = "return",
}

export enum QCStatus {
    Pending = "pending",
    Pass = "pass",
    Reject = "reject",
}

export enum SyncStatus {
    Local = "local",
    Synced = "synced",
    Error = "error",
}

export enum MaterialCategory {
    Raw = "raw",
    Wip = "wip",
    Finished = "finished",
}

export enum StockStatus {
    Stored = "stored",
    Allocated = "allocated",
    Sold = "sold",
    Split = "split",
}

export enum VehicleType {
    Truck = "truck",
    Tempo = "tempo",
    Van = "van",
    Other = "other",
}

export enum EmployeeRole {
    Operator = "operator",
    YardManager = "yard_manager",
    Owner = "owner",
}

// ----------------------------------------------------------------------
// CORE ENTITIES (DATABASE MODELS)
// ----------------------------------------------------------------------

export interface WeighEntry {
    entry_id: string;
    batch_id: string;

    gross_weight: number;
    tare_weight: number;
    net_weight: number;

    accepted_weight?: number; // V2
    rejected_weight?: number; // V2

    material_id: string;
    supplier_id: string;
    supplier_contact?: string;
    vehicle_id: string;
    employee_id: string;

    yard_id: string;
    zone_id?: string;

    weigh_method: WeighMethod;
    intake_type: IntakeType;

    qc_status: QCStatus;
    sync_status: SyncStatus;

    remarks?: string;
    custom_values?: Record<string, any>;

    device_id: string;
    shift_id?: string;

    weighed_at: Date;
    created_at: Date;

    trust_score?: number;
}

export interface WeighEntryInput {
    materialId: string;
    supplierId: string;
    supplierContact?: string;
    yardId: string;
    employeeId: string;

    grossWeight: number;
    tareWeight?: number;

    weighMethod: WeighMethod;
    intakeType: IntakeType;

    customValues?: Record<string, any>;

    vehicleId?: string;
    vehicleNumber?: string;
    vehicleType?: VehicleType;

    remarks?: string;
    zoneId?: string;
}

// ----------------------------------------------------------------------
// DYNAMIC FIELD TEMPLATES
// ----------------------------------------------------------------------

export interface WeighFieldTemplate {
    field_id: string;
    label: string;
    field_type: 'number' | 'text' | 'boolean' | 'dropdown' | 'group';
    required: boolean;
    material_scope: string[];
    description?: string;
    options?: string[];
    sub_fields?: WeighFieldTemplate[];
}

// ----------------------------------------------------------------------
// STOCK LOTS
// ----------------------------------------------------------------------

export interface StockLot {
    lot_id: string;
    batch_id: string;
    material_id: string;
    yard_id: string;
    zone_id?: string;

    available_weight: number;
    status: StockStatus;

    days_in_yard?: number;
    risk_level?: "low" | "medium" | "high";

    // V2 Traceability
    parent_lot_id?: string;
    created_at?: string;
    created_by?: string;
}

export interface SplitTransaction {
    split_id: string;
    parent_lot_id: string;
    input_weight: number;
    output_weight: number;
    loss_weight: number;
    outputs: { lot_id: string; weight: number; material_id: string }[];
    created_at: string;
    created_by: string;
    machine_id?: string; // V2
    supplier_id?: string; // V2 Supplier
    loss_reason?: string; // V3
}

export interface SplitAnalytics {
    globalYield: number;
    totalProcessed: number;
    totalLoss: number;
    machineStats: { machineId: string; processed: number; yield: number }[];
    supplierStats: { supplierId: string; processed: number; yield: number; loss: number }[]; // V2
    recentSplits: SplitTransaction[];
}

export enum InventoryEventType {
    WEIGH_IN = "WEIGH_IN",
    QC_PASS = "QC_PASS",
    QC_REJECT = "QC_REJECT",
    SPLIT = "SPLIT",
    VOID = "VOID"
}

export interface InventoryLedgerEntry {
    id: string;
    batchId: string;
    type: InventoryEventType;
    materialId: string;
    weightChange: number;
    timestamp: string;
    operator: string;
    status: string;
    reason?: string;
    metadata?: any;
}

export interface DailyLedgerSummary {
    totalWeighed: number;
    totalApproved: number;
    totalSplit: number;
    netInventoryDelta: number;
}

// ----------------------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------------------

export interface InventorySettings {
    materials: string[];
    suppliers: string[];
    units: string[];
    deleted_materials?: string[];
    deleted_suppliers?: string[];
    deleted_units?: string[];
    machines?: string[]; // V2
    loss_reasons?: string[]; // V3
    hidden_sections?: string[];
}

// ----------------------------------------------------------------------
// SALES & ORDERS
// ----------------------------------------------------------------------

export enum SOStatus {
    Draft = "draft",
    Confirmed = "confirmed",
    Picked = "picked",
    Dispatched = "dispatched",
    Cancelled = "cancelled"
}

export interface SalesOrderItem {
    item_id: string;
    material_id: string;
    ordered_weight: number;
    rate_per_kg: number;
    picked_lots?: {
        lot_id: string;
        weight_picked: number;
    }[];
}

export interface SalesOrder {
    so_id: string;
    customer_id?: string;
    customer_name: string;
    customer_gst?: string;
    customer_contact?: string;
    so_date: string;
    status: SOStatus;

    items: SalesOrderItem[];

    total_amount: number;
    currency: string;
    amount_paid: number;
    payment_status: 'unpaid' | 'partial' | 'paid';

    notes?: string;
    created_at: string;
    updated_at: string;
}
