import { Db } from "mongodb";

export class FinanceService {
    constructor(private db: Db) { }

    async getCashFlow(tenantId: string) {
        return { income: 0, expense: 0 };
    }
}
