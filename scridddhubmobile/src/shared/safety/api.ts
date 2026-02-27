const API_BASE = 'http://localhost:3000/api/erp';

export const updateStaffSafety = async (tenantId: string, packet: any) => {
    const res = await fetch(`${API_BASE}/${tenantId}/safety`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet)
    });
    return res.json();
};

export const getMusterReport = async (tenantId: string) => {
    const res = await fetch(`${API_BASE}/${tenantId}/safety`);
    return res.json();
};

export const triggerSOS = async (tenantId: string, employeeId: string) => {
    const res = await fetch(`${API_BASE}/${tenantId}/safety`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId })
    });
    return res.json();
};
