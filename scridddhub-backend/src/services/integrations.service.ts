import { Db } from "mongodb";

export class IntegrationsService {
    constructor(private db: Db) { }

    async syncWebhook(tenantId: string, event: string, payload: any) {
        // Process webhook
    }
}
