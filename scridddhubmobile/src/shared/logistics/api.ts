const API_BASE = "http://localhost:3000";

export async function getFleet(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics`);
    if (!res.ok) throw new Error("Failed to fetch fleet");
    return res.json();
}

export async function addVehicle(tenantId: string, data: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 'vehicle', data })
    });
    if (!res.ok) throw new Error("Failed to add vehicle");
    return res.json();
}

export async function addDriver(tenantId: string, data: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 'driver', data })
    });
    if (!res.ok) throw new Error("Failed to add driver");
    return res.json();
}

export async function getTrips(tenantId: string) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics/trips`);
    if (!res.ok) throw new Error("Failed to fetch trips");
    return res.json();
}

export async function createTrip(tenantId: string, payload: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to create trip");
    return res.json();
}

export async function updateTripStatus(tenantId: string, tripId: string, status: string, endData?: any) {
    const res = await fetch(`${API_BASE}/api/erp/${tenantId}/logistics/trips`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, status, endData })
    });
    if (!res.ok) throw new Error("Failed to update trip");
    return res.json();
}
