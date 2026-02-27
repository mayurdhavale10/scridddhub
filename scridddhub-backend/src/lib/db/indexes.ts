import { Db } from "mongodb";
import { ensureUserIndexes } from "./mongo/schemas/user.schema";
import { ensureCollectionIndexes } from "./mongo/schemas/inventory/collection.schema";
import { ensureSortingIndexes } from "./mongo/schemas/inventory/sorting.schema";
import { ensureStockLotIndexes } from "./mongo/schemas/inventory/stock-lot.schema";
import { ensureMovementIndexes } from "./mongo/schemas/inventory/movement.schema";
import { ensureTraceabilityIndexes } from "./mongo/schemas/inventory/traceability.schema";

export async function initIndexes(db: Db) {
    console.log("Initializing Indexes...");
    await Promise.all([
        ensureUserIndexes(db),
        ensureCollectionIndexes(db),
        ensureSortingIndexes(db),
        ensureStockLotIndexes(db),
        ensureMovementIndexes(db),
        ensureTraceabilityIndexes(db),
    ]);
    console.log("Indexes initialized.");
}
