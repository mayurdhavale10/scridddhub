import { TraceabilityDoc } from "../../../models/inventory/traceability.model";

export interface ITraceabilityRepository {
    create(record: Omit<TraceabilityDoc, "_id" | "createdAt" | "updatedAt">): Promise<TraceabilityDoc>;
    findById(id: string): Promise<TraceabilityDoc | null>;
    findByEntity(entityId: string): Promise<TraceabilityDoc | null>;
    appendEvent(id: string, event: TraceabilityDoc['chainOfCustody'][0]): Promise<TraceabilityDoc | null>;
    findAll(tenantId: string): Promise<TraceabilityDoc[]>;
}
