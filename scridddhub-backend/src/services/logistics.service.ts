import { Db } from "mongodb";

export class LogisticsService {
    constructor(private db: Db) { }

    async trackFleet(tenantId: string) {
        return [];
    }
}
