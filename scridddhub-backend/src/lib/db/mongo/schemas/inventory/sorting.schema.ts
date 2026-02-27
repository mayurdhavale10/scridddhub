import { Db, Collection } from "mongodb";
import { SortingDoc } from "../../../../models/inventory/sorting.model";

export const SORTING_COLLECTION = "sorting_logs";

export function sortingCollection(db: Db): Collection<SortingDoc> {
    return db.collection<SortingDoc>(SORTING_COLLECTION);
}

export async function ensureSortingIndexes(db: Db) {
    const col = sortingCollection(db);
    await col.createIndex({ tenantId: 1, createdAt: -1 });
    await col.createIndex({ operatorId: 1 });
}
