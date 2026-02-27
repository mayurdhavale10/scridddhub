import { Db, Collection } from "mongodb";
import { MovementDoc } from "../../../../models/inventory/movement.model";

export const MOVEMENT_COLLECTION = "movements";

export function movementsCollection(db: Db): Collection<MovementDoc> {
    return db.collection<MovementDoc>(MOVEMENT_COLLECTION);
}

export async function ensureMovementIndexes(db: Db) {
    const col = movementsCollection(db);
    await col.createIndex({ tenantId: 1, itemId: 1 });
}
