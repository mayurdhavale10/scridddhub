import { Db } from "mongodb";

export class MachinesService {
    constructor(private db: Db) { }

    async getMachineStatus(tenantId: string) {
        return [];
    }
}
