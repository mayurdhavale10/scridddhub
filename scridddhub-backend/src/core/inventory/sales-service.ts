import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
    SalesOrder, SOStatus, StockLot, StockStatus,
    Customer, CustomerType, PaymentRecord, PaymentMethod,
    TenantSalesConfig, SalesMode
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SALES_PATH = path.join(DATA_DIR, 'mock_sales.json');
const STOCK_PATH = path.join(DATA_DIR, 'mock_stock.json');
const CUSTOMERS_PATH = path.join(DATA_DIR, 'mock_customers.json');
const PAYMENTS_PATH = path.join(DATA_DIR, 'mock_payments.json');
const SALES_CONFIG_PATH = path.join(DATA_DIR, 'mock_sales_config.json');

function loadData<T>(filePath: string, defaultValue: T): T {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error(`Failed to load ${filePath}`, e);
    }
    return defaultValue;
}

function saveData(filePath: string, data: any) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Failed to save ${filePath}`, e);
    }
}

// ----------------------------------------------------------------------
// PHASE 4: TENANT SALES CONFIGURATION
// ----------------------------------------------------------------------

export function getSalesConfig(tenantId: string): TenantSalesConfig {
    return loadData<TenantSalesConfig>(SALES_CONFIG_PATH, {
        sales_mode: 'integrated'
    });
}

export function updateSalesConfig(tenantId: string, updates: Partial<TenantSalesConfig>): TenantSalesConfig {
    const current = getSalesConfig(tenantId);
    const updated: TenantSalesConfig = { ...current, ...updates };

    // If switching to external_api, auto-generate an API key if none exists
    if (updated.sales_mode === 'external_api' && !updated.external_api_key) {
        updated.external_api_key = `sk_live_${randomUUID().replace(/-/g, '')}`;
    }

    saveData(SALES_CONFIG_PATH, updated);
    console.log(`[CONFIG] Sales mode updated to: ${updated.sales_mode}`);
    return updated;
}

// ----------------------------------------------------------------------
// PHASE 2: CRM — CUSTOMER MANAGEMENT
// ----------------------------------------------------------------------

export async function createCustomer(tenantId: string, payload: {
    name: string;
    contact_phone: string;
    contact_email?: string;
    gst_number?: string;
    address?: string;
    type?: CustomerType;
    credit_limit?: number;
}): Promise<Customer> {
    const customers: Customer[] = loadData(CUSTOMERS_PATH, []);

    // Prevent duplicate phone numbers
    const existing = customers.find(c => c.contact_phone === payload.contact_phone);
    if (existing) {
        throw new Error(`A customer with phone ${payload.contact_phone} already exists: ${existing.name}`);
    }

    const now = new Date().toISOString();
    const customer: Customer = {
        customer_id: `CUS-${1000 + customers.length + 1}`,
        name: payload.name,
        contact_phone: payload.contact_phone,
        contact_email: payload.contact_email,
        gst_number: payload.gst_number,
        address: payload.address,
        type: payload.type || CustomerType.Trader,
        credit_limit: payload.credit_limit || 0,
        outstanding_balance: 0,
        created_at: now,
        updated_at: now
    };

    customers.push(customer);
    saveData(CUSTOMERS_PATH, customers);
    console.log(`[CRM] Customer created: ${customer.customer_id} — ${customer.name}`);
    return customer;
}

export async function getCustomers(tenantId: string): Promise<Customer[]> {
    return loadData<Customer[]>(CUSTOMERS_PATH, []);
}

export async function getCustomerById(tenantId: string, customerId: string): Promise<Customer | null> {
    const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
    return customers.find(c => c.customer_id === customerId) || null;
}

export async function updateCustomer(
    tenantId: string,
    customerId: string,
    updates: Partial<Omit<Customer, 'customer_id' | 'outstanding_balance' | 'created_at'>>
): Promise<Customer | null> {
    const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
    const idx = customers.findIndex(c => c.customer_id === customerId);
    if (idx === -1) return null;
    customers[idx] = { ...customers[idx], ...updates, updated_at: new Date().toISOString() };
    saveData(CUSTOMERS_PATH, customers);
    return customers[idx];
}

// ----------------------------------------------------------------------
// PHASE 1: SALES ORDERS
// ----------------------------------------------------------------------

export async function createSalesOrder(tenantId: string, payload: {
    customer_id?: string;
    customer_name: string;
    customer_gst?: string;
    customer_contact?: string;
    notes?: string;
    items: { item_id?: string; material_id: string; ordered_weight: number; rate_per_kg: number }[];
}): Promise<SalesOrder> {
    const orders: SalesOrder[] = loadData(SALES_PATH, []);

    // Validate items
    if (!payload.items || payload.items.length === 0) {
        throw new Error('Sales order must have at least one item.');
    }

    // If customer_id provided, validate credit limit
    if (payload.customer_id) {
        const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
        const customer = customers.find(c => c.customer_id === payload.customer_id);
        if (customer && customer.credit_limit > 0) {
            const totalAmount = payload.items.reduce((s, i) => s + i.ordered_weight * i.rate_per_kg, 0);
            if (customer.outstanding_balance + totalAmount > customer.credit_limit) {
                throw new Error(
                    `Credit limit exceeded for ${customer.name}. ` +
                    `Outstanding: ₹${customer.outstanding_balance}, ` +
                    `Order: ₹${totalAmount}, ` +
                    `Limit: ₹${customer.credit_limit}`
                );
            }
        }
    }

    const totalAmount = payload.items.reduce((s, i) => s + i.ordered_weight * i.rate_per_kg, 0);
    const now = new Date().toISOString();

    const newOrder: SalesOrder = {
        so_id: `SO-${1000 + orders.length + 1}`,
        customer_id: payload.customer_id,
        customer_name: payload.customer_name,
        customer_gst: payload.customer_gst,
        customer_contact: payload.customer_contact,
        so_date: now,
        status: SOStatus.Draft,
        items: payload.items.map(i => ({
            item_id: i.item_id || `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            material_id: i.material_id,
            ordered_weight: i.ordered_weight,
            rate_per_kg: i.rate_per_kg,
        })),
        total_amount: totalAmount,
        currency: 'INR',
        amount_paid: 0,
        payment_status: 'unpaid',
        notes: payload.notes,
        created_at: now,
        updated_at: now
    };

    orders.push(newOrder);
    saveData(SALES_PATH, orders);
    console.log(`[SALES] Created: ${newOrder.so_id} — ₹${totalAmount.toLocaleString('en-IN')}`);
    return newOrder;
}

export async function getSalesOrders(tenantId: string): Promise<SalesOrder[]> {
    return loadData<SalesOrder[]>(SALES_PATH, []);
}

export async function getSalesOrderById(tenantId: string, soId: string): Promise<SalesOrder | null> {
    const orders: SalesOrder[] = loadData(SALES_PATH, []);
    return orders.find(o => o.so_id === soId) || null;
}

export async function confirmSalesOrder(tenantId: string, soId: string): Promise<SalesOrder> {
    const orders: SalesOrder[] = loadData(SALES_PATH, []);
    const idx = orders.findIndex(o => o.so_id === soId);
    if (idx === -1) throw new Error('Order not found');
    if (orders[idx].status !== SOStatus.Draft) throw new Error('Only draft orders can be confirmed');
    orders[idx].status = SOStatus.Confirmed;
    orders[idx].updated_at = new Date().toISOString();
    saveData(SALES_PATH, orders);
    return orders[idx];
}

// ----------------------------------------------------------------------
// PHASE 1: FIFO-ENFORCED FULFILLMENT
// ----------------------------------------------------------------------

export interface FulfillmentRequest {
    soId: string;
    pickedItems: {
        itemId: string;
        pickedLots: { lot_id: string; weight_picked: number }[];
    }[];
}

export async function fulfillSalesOrder(tenantId: string, payload: FulfillmentRequest): Promise<SalesOrder> {
    const orders: SalesOrder[] = loadData(SALES_PATH, []);
    const stock: StockLot[] = loadData(STOCK_PATH, []);

    const orderIdx = orders.findIndex(o => o.so_id === payload.soId);
    if (orderIdx === -1) throw new Error('Order not found');

    const order = orders[orderIdx];
    if (order.status === SOStatus.Dispatched || order.status === SOStatus.Cancelled) {
        throw new Error('Order is already closed');
    }

    // SECURITY: Validate that each picked lot has sufficient weight
    for (const pick of payload.pickedItems) {
        for (const lotInfo of pick.pickedLots) {
            const lot = stock.find(l => l.lot_id === lotInfo.lot_id);
            if (!lot) throw new Error(`Lot ${lotInfo.lot_id} not found`);
            if (lot.status !== StockStatus.Stored) throw new Error(`Lot ${lotInfo.lot_id} is not available (status: ${lot.status})`);
            if (lot.available_weight < lotInfo.weight_picked) {
                throw new Error(`Lot ${lotInfo.lot_id} has only ${lot.available_weight}kg, cannot pick ${lotInfo.weight_picked}kg`);
            }
        }
    }

    // Deduct weight from each lot
    for (const pick of payload.pickedItems) {
        const item = order.items.find(i => i.item_id === pick.itemId);
        if (item) item.picked_lots = pick.pickedLots;

        for (const lotInfo of pick.pickedLots) {
            const lotIdx = stock.findIndex(l => l.lot_id === lotInfo.lot_id);
            const lot = stock[lotIdx];
            const remaining = lot.available_weight - lotInfo.weight_picked;
            stock[lotIdx] = {
                ...lot,
                available_weight: remaining,
                status: remaining <= 0 ? StockStatus.Sold : StockStatus.Stored
            };
        }
    }

    order.status = SOStatus.Dispatched;
    order.updated_at = new Date().toISOString();
    orders[orderIdx] = order;

    // Update customer outstanding balance
    if (order.customer_id) {
        const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
        const custIdx = customers.findIndex(c => c.customer_id === order.customer_id);
        if (custIdx !== -1) {
            customers[custIdx].outstanding_balance += (order.total_amount - order.amount_paid);
            customers[custIdx].updated_at = new Date().toISOString();
            saveData(CUSTOMERS_PATH, customers);
        }
    }

    saveData(SALES_PATH, orders);
    saveData(STOCK_PATH, stock);
    console.log(`[SALES] Dispatched: ${order.so_id}`);
    return order;
}

// ----------------------------------------------------------------------
// PHASE 1: PAYMENT RECORDING
// ----------------------------------------------------------------------

export async function recordPayment(tenantId: string, payload: {
    so_id: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    recorded_by: string;
}): Promise<PaymentRecord> {
    const orders: SalesOrder[] = loadData(SALES_PATH, []);
    const payments: PaymentRecord[] = loadData(PAYMENTS_PATH, []);

    const orderIdx = orders.findIndex(o => o.so_id === payload.so_id);
    if (orderIdx === -1) throw new Error('Order not found');

    const order = orders[orderIdx];

    if (payload.amount <= 0) throw new Error('Payment amount must be positive');
    if (payload.amount > (order.total_amount - order.amount_paid)) {
        throw new Error(`Payment ₹${payload.amount} exceeds outstanding amount ₹${order.total_amount - order.amount_paid}`);
    }

    const payment: PaymentRecord = {
        payment_id: `PAY-${1000 + payments.length + 1}`,
        so_id: payload.so_id,
        customer_id: order.customer_id,
        amount: payload.amount,
        method: payload.method,
        reference: payload.reference,
        paid_at: new Date().toISOString(),
        recorded_by: payload.recorded_by
    };

    // Update order
    order.amount_paid += payload.amount;
    order.payment_status = order.amount_paid >= order.total_amount ? 'paid'
        : order.amount_paid > 0 ? 'partial'
            : 'unpaid';
    order.updated_at = new Date().toISOString();
    orders[orderIdx] = order;

    // Update customer outstanding balance
    if (order.customer_id) {
        const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
        const custIdx = customers.findIndex(c => c.customer_id === order.customer_id);
        if (custIdx !== -1) {
            customers[custIdx].outstanding_balance = Math.max(0, customers[custIdx].outstanding_balance - payload.amount);
            customers[custIdx].updated_at = new Date().toISOString();
            saveData(CUSTOMERS_PATH, customers);
        }
    }

    payments.push(payment);
    saveData(PAYMENTS_PATH, payments);
    saveData(SALES_PATH, orders);

    console.log(`[PAYMENT] ${payment.payment_id} — ₹${payload.amount} for ${payload.so_id}`);
    return payment;
}

export async function getPaymentsForOrder(tenantId: string, soId: string): Promise<PaymentRecord[]> {
    const payments: PaymentRecord[] = loadData(PAYMENTS_PATH, []);
    return payments.filter(p => p.so_id === soId);
}

// ----------------------------------------------------------------------
// PHASE 2: CRM DASHBOARD DATA
// ----------------------------------------------------------------------

export async function getOutstandingReport(tenantId: string): Promise<{
    total_outstanding: number;
    customers: { customer: Customer; orders: SalesOrder[] }[];
}> {
    const customers: Customer[] = loadData(CUSTOMERS_PATH, []);
    const orders: SalesOrder[] = loadData(SALES_PATH, []);

    const unpaidOrders = orders.filter(o => o.payment_status !== 'paid' && o.status !== SOStatus.Cancelled);

    const report = customers
        .filter(c => c.outstanding_balance > 0)
        .map(c => ({
            customer: c,
            orders: unpaidOrders.filter(o => o.customer_id === c.customer_id)
        }))
        .sort((a, b) => b.customer.outstanding_balance - a.customer.outstanding_balance);

    const totalOutstanding = customers.reduce((s, c) => s + c.outstanding_balance, 0);

    return { total_outstanding: totalOutstanding, customers: report };
}

// ----------------------------------------------------------------------
// PHASE 3: EXTERNAL API — STOCK READ (Public, requires API key)
// ----------------------------------------------------------------------

export function validateApiKey(tenantId: string, apiKey: string): boolean {
    const config = getSalesConfig(tenantId);
    return config.sales_mode === 'external_api' && config.external_api_key === apiKey;
}
