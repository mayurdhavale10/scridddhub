
const API_BASE = "http://10.0.2.2:3000";

export async function getStockLots(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/inventory/stock`);
    if (!res.ok) throw new Error("Failed to fetch stock");
    return res.json();
}
