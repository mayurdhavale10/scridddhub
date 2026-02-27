import axios from 'axios';

// Configuration (Replace with actual IP if testing on real device)
// Android Emulator: 10.0.2.2
// iOS Simulator: localhost
// Update to new nested path
const BASE_URL = 'http://10.0.2.2:3001/api/erp';
const INVENTORY_PATH = '/users/yardmanager-coadmin/screens/inventory';

// API Client
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

export const InventoryAPI = {

    // 1. Dashboard
    getDashboard: async (tenantId: string) => {
        const response = await api.get(`/${tenantId}${INVENTORY_PATH}/dashboard`);
        return response.data;
    },

    // 2. Stock List
    getStockSnapshot: async (tenantId: string, filters?: { itemId?: string; warehouseId?: string }) => {
        const response = await api.get(`/${tenantId}${INVENTORY_PATH}/stock`, { params: filters });
        return response.data;
    },

    // 3. Movements
    recordMovement: async (tenantId: string, movement: any) => {
        const response = await api.post(`/${tenantId}${INVENTORY_PATH}/movements`, movement);
        return response.data;
    },

    // 4. AI Recommendations
    getRecommendations: async (tenantId: string) => {
        const response = await api.get(`/${tenantId}${INVENTORY_PATH}/ai/recommendations`);
        return response.data;
    }
};
