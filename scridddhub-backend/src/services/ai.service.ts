import { Db } from "mongodb";

export class AiService {
    constructor(private db: Db) { }

    async generateInsight(tenantId: string, context: any) {
        return { text: "AI Insight" };
    }
}
