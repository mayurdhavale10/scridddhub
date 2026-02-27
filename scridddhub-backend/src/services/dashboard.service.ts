import { Db } from "mongodb";

export class DashboardService {
    constructor(private db: Db) { }

    async getTenantDashboard(tenantId: string) {
        // Aggregate data from other services
        return { message: "Dashboard data" };
    }
}
