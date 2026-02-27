const API_BASE = "http://localhost:3000";

export async function createWeighEntry(payload: any, tenantId: string) {
    const res = await fetch(
        `${API_BASE}/api/erp/${tenantId}/inventory`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Inventory API failed");
    }

    return res.json();
}

export async function getWeighEntries(tenantId: string) {
    const res = await fetch(
        `${API_BASE}/api/erp/${tenantId}/inventory`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch inventory");
    }

    return res.json();
}

export async function deleteWeighEntry(tenantId: string, batchId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/${batchId}`, {
        method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Failed to delete entry');
    }

    return data;
}

export async function updateWeighEntry(tenantId: string, batchId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/${batchId}`, {
        method: 'PUT', // or PATCH
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    return res.json();
}

// getWeighFieldTemplates: materialId is optional. If missing, returns all.
export async function getWeighFieldTemplates(tenantId: string, materialId?: string) {
    const url = materialId
        ? `${API_BASE}/api/erp/${tenantId}/inventory/fields?material=${materialId}`
        : `${API_BASE}/api/erp/${tenantId}/inventory/fields`;

    const res = await fetch(url);
    return res.json();
}

export async function createWeighFieldTemplate(tenantId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/fields`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create field template");
    }

    return res.json();
}

export async function getInventorySettings(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/settings`);
    return res.json();
}

export async function updateInventorySettings(tenantId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return res.json();
}

export async function deleteWeighFieldTemplate(tenantId: string, fieldId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/fields?fieldId=${fieldId}`, {
        method: "DELETE",
    });

    if (!res.ok) {
        throw new Error("Failed to delete field");
    }
    return res.json();
}

export async function submitQualityControl(tenantId: string, batchId: string, payload: { status: string, notes?: string, checkedBy?: string, acceptedWeight?: number, rejectedWeight?: number, qcData?: any }) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/${batchId}/qc`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "QC Submission Failed");
    }
    return res.json();
}


export async function getStockLots(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/stock`);
    if (!res.ok) throw new Error("Failed to fetch stock");
    return res.json();
}

export async function voidStockLot(tenantId: string, lotId: string, reason: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/stock/${lotId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to void lot");
    }
    return res.json();
}

export async function deleteStockLot(tenantId: string, lotId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/stock/${lotId}`, {
        method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Failed to delete lot');
    }
    return data;
}

export async function splitStock(tenantId: string, payload: { sourceLotId: string, splits: any[], machineId?: string, lossReason?: string }) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Split failed");
    }
    return res.json();
}

export async function getSplitAnalytics(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/split/analytics`);
    if (!res.ok) {
        throw new Error("Failed to fetch analytics");
    }
    return res.json();
}

export async function suggestFIFOAllocation(tenantId: string, material: string, weight: number) {
    const res = await fetch(
        `${API_BASE}/api/erp/${tenantId}/inventory/fifo-suggest?material=${encodeURIComponent(material)}&weight=${weight}`
    );
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'FIFO suggestion failed'); }
    return res.json();
}


// ----------------------------------------------------------------------
// SALES ORDERS
// ----------------------------------------------------------------------

export async function getSalesOrders(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/orders`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch orders'); }
    return res.json();
}

export async function createSalesOrder(tenantId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create order'); }
    return res.json();
}

export async function getSalesOrderById(tenantId: string, soId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/orders/${soId}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Order not found'); }
    return res.json();
}

export async function confirmSalesOrder(tenantId: string, soId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/orders/${soId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to confirm order'); }
    return res.json();
}

export async function fulfillSalesOrder(tenantId: string, soId: string, pickedItems: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/orders/${soId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fulfill', pickedItems })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fulfill order'); }
    return res.json();
}

// ----------------------------------------------------------------------
// CRM — CUSTOMERS
// ----------------------------------------------------------------------

export async function getCustomers(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/customers`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch customers'); }
    return res.json();
}

export async function createCustomer(tenantId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create customer'); }
    return res.json();
}

export async function getOutstandingReport(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/crm/outstanding`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch report'); }
    return res.json();
}

// ----------------------------------------------------------------------
// PAYMENTS
// ----------------------------------------------------------------------

export async function recordPayment(tenantId: string, payload: {
    so_id: string; amount: number; method: string; reference?: string; recorded_by: string;
}) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to record payment'); }
    return res.json();
}

export async function getPaymentsForOrder(tenantId: string, soId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/payments?so_id=${soId}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch payments'); }
    return res.json();
}

// ----------------------------------------------------------------------
// PHASE 4 — SALES CONFIG
// ----------------------------------------------------------------------

export async function getSalesConfig(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/config`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to fetch config'); }
    return res.json();
}

export async function updateSalesConfig(tenantId: string, payload: { sales_mode: 'integrated' | 'external_api' }) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/sales/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to update config'); }
    return res.json();
}

// ----------------------------------------------------------------------
// LEDGER (existing — unchanged)
// ----------------------------------------------------------------------

export async function getInventoryLedger(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/ledger`);
    if (!res.ok) throw new Error('Failed to fetch ledger');
    return res.json();
}

export async function voidInventoryEntry(tenantId: string, type: 'weigh' | 'split', id: string, reason: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/ledger/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, reason }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Void failed'); }
    return res.json();
}


