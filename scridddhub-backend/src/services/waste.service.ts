import { Db } from "mongodb";

export class WasteService {
    constructor(private db: Db) { }

    async logWaste(tenantId: string, data: any) {
        return { id: "new-waste-log-id" };
    }
}
