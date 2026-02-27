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
    Void = "void",
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

// 1️⃣ WEIGH ENTRY (ROOT TRANSACTION)

export interface WeighEntry {
    entry_id: string;
    batch_id: string;

    gross_weight: number;
    tare_weight: number;
    net_weight: number;

    accepted_weight?: number; // V2: Post-QC
    rejected_weight?: number; // V2: Post-QC

    material_id: string;
    supplier_id: string;
    supplier_contact?: string; // Contact number
    vehicle_id: string;
    employee_id: string;

    yard_id: string;
    zone_id?: string;

    weigh_method: WeighMethod;
    intake_type: IntakeType;

    qc_status: QCStatus;
    sync_status: SyncStatus;

    remarks?: string;

    // Dynamic Fields
    custom_values?: Record<string, any>;

    device_id: string;
    shift_id?: string;

    weighed_at: Date;
    created_at: Date;

    // V3
    trust_score?: number;
    void_reason?: string;
    is_voided?: boolean;
}

// ----------------------------------------------------------------------
// API INPUT DTO (CREATE WEIGH ENTRY)
// ----------------------------------------------------------------------

export interface WeighEntryInput {
    materialId: string;
    supplierId: string;
    supplierContact?: string; // Optional Phone Number
    yardId: string;
    employeeId: string;

    grossWeight: number;
    tareWeight?: number;

    weighMethod: WeighMethod;
    intakeType: IntakeType;

    // Dynamic Fields
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
    type: 'number' | 'text' | 'boolean' | 'dropdown' | 'group';
    required: boolean;
    material_scope: string[]; // List of material IDs this applies to
    options?: string[]; // For 'dropdown' type
    sub_fields?: WeighFieldTemplate[]; // For 'group' type - recursive structure
}

// ----------------------------------------------------------------------
// MATERIALS
// ----------------------------------------------------------------------

export interface Material {
    material_id: string;
    name: string;
    category: MaterialCategory;
    is_mixed: boolean;
    sku?: string;
}

// ----------------------------------------------------------------------
// MATERIAL SPLITS
// ----------------------------------------------------------------------

export interface MaterialSplit {
    split_id: string;
    entry_id: string;
    material_id: string;
    weight: number;
}

// ----------------------------------------------------------------------
// QUALITY CONTROL
// ----------------------------------------------------------------------

export interface QCRecord {
    qc_id: string;
    entry_id: string;

    status: QCStatus;
    hazard_flag: boolean;

    contamination_level?: number;
    moisture_level?: number;

    notes?: string;

    checked_by: string;
    checked_at: Date;
}

// ----------------------------------------------------------------------
// VEHICLES
// ----------------------------------------------------------------------

export interface Vehicle {
    vehicle_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
}

// ----------------------------------------------------------------------
// SUPPLIERS
// ----------------------------------------------------------------------

export interface Supplier {
    supplier_id: string;
    name: string;
    contact: string;
    gst?: string;
    quality_score?: number;
}

// ----------------------------------------------------------------------
// EMPLOYEES
// ----------------------------------------------------------------------

export interface Employee {
    employee_id: string;
    name: string;
    role: EmployeeRole;
    yard_id: string;
}

// ----------------------------------------------------------------------
// PHOTOS
// ----------------------------------------------------------------------

export interface Photo {
    photo_id: string;
    entry_id: string;
    type: "before" | "after";
    url: string;
    captured_at: Date;
}

// ----------------------------------------------------------------------
// STOCK LOTS (POST-QC INVENTORY)
// ----------------------------------------------------------------------

export interface StockLot {
    lot_id: string;
    batch_id: string;
    material_id: string;
    yard_id: string;
    zone_id?: string;

    available_weight: number;
    status: StockStatus;

    // V2
    days_in_yard?: number;
    risk_level?: "low" | "medium" | "high";

    // V2 Traceability
    parent_lot_id?: string;
    created_at?: string;
    created_by?: string;
    void_reason?: string;
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
    loss_reason?: string; // V3 Enforcement
    void_reason?: string;
    is_voided?: boolean;
}

export interface SplitAnalytics {
    globalYield: number;
    totalProcessed: number;
    totalLoss: number;
    machineStats: { machineId: string; processed: number; yield: number }[];
    supplierStats: { supplierId: string; processed: number; yield: number; loss: number }[]; // V2
    recentSplits: SplitTransaction[];
}

// ----------------------------------------------------------------------
// OFFLINE QUEUE (MOBILE)
// ----------------------------------------------------------------------

export interface OfflineQueueItem {
    queue_id: string;
    entry_payload: WeighEntryInput;
    status: "pending" | "syncing" | "failed";
    timestamp: number;
}

// ----------------------------------------------------------------------
// V2 / V3 EXTENSIONS
// ----------------------------------------------------------------------

export interface CycleCount {
    count_id: string;
    lot_id: string;
    counted_weight: number;
    counted_by: string;
    counted_at: Date;
    variance: number;
}

// ----------------------------------------------------------------------
// CONFIGURATION / SETTINGS
// ----------------------------------------------------------------------

export interface InventorySettings {
    materials: string[];
    suppliers: string[];
    units: string[];

    // History / Trash
    deleted_materials?: string[];
    deleted_suppliers?: string[];
    deleted_units?: string[];

    // V2
    machines?: string[];

    // V3
    loss_reasons?: string[]; // ["Contamination", "Moisture", "Machine Issue"]

    hidden_sections?: string[]; // 'materials', 'suppliers', 'units'
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
    customer_id?: string;       // Links to Customer record
    customer_name: string;
    customer_gst?: string;
    customer_contact?: string;
    so_date: string;
    status: SOStatus;

    items: SalesOrderItem[];

    total_amount: number;
    currency: string;           // Always "INR" going forward
    amount_paid: number;        // Cumulative payments received
    payment_status: "unpaid" | "partial" | "paid";

    notes?: string;
    created_at: string;
    updated_at: string;
}

// ----------------------------------------------------------------------
// CRM — CUSTOMER
// ----------------------------------------------------------------------

export enum CustomerType {
    Retailer = "retailer",
    Manufacturer = "manufacturer",
    Trader = "trader",
    WalkIn = "walk_in"
}

export interface Customer {
    customer_id: string;        // CUS-1001
    name: string;
    contact_phone: string;
    contact_email?: string;
    gst_number?: string;
    address?: string;
    type: CustomerType;
    credit_limit: number;       // Max outstanding allowed (INR)
    outstanding_balance: number; // Current unpaid amount (INR)
    created_at: string;
    updated_at: string;
}

// ----------------------------------------------------------------------
// PAYMENTS
// ----------------------------------------------------------------------

export enum PaymentMethod {
    Cash = "cash",
    UPI = "upi",
    BankTransfer = "bank_transfer",
    Cheque = "cheque"
}

export interface PaymentRecord {
    payment_id: string;         // PAY-1001
    so_id: string;              // Linked Sales Order
    customer_id?: string;
    amount: number;             // INR
    method: PaymentMethod;
    reference?: string;         // UPI txn ID / cheque number
    paid_at: string;            // ISO timestamp
    recorded_by: string;        // Operator/Manager ID
}

// ----------------------------------------------------------------------
// PHASE 4 — TENANT SALES CONFIGURATION
// ----------------------------------------------------------------------

export type SalesMode = "integrated" | "external_api";

export interface TenantSalesConfig {
    sales_mode: SalesMode;
    external_api_key?: string;  // Set only when mode = external_api
    external_webhook_url?: string;
}


// ----------------------------------------------------------------------
// LEDGER CORE (UNIFIED AUDIT TRAIL)
// ----------------------------------------------------------------------

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
