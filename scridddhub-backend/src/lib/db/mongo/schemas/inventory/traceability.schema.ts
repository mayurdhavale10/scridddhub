import { Db, Collection } from "mongodb";
import { TraceabilityDoc } from "../../../../models/inventory/traceability.model";

export const TRACEABILITY_COLLECTION = "traceability";

export function traceabilityCollection(db: Db): Collection<TraceabilityDoc> {
    return db.collection<TraceabilityDoc>(TRACEABILITY_COLLECTION);
}

export async function ensureTraceabilityIndexes(db: Db) {
    const col = traceabilityCollection(db);
    await col.createIndex({ tenantId: 1, entityId: 1 });
}
