import { Db, Collection } from "mongodb";
import { CollectionDoc } from "../../../../models/inventory/collection.model";

export const COLLECTION_COLLECTION = "collections";

export function collectionsCollection(db: Db): Collection<CollectionDoc> {
    return db.collection<CollectionDoc>(COLLECTION_COLLECTION);
}

export async function ensureCollectionIndexes(db: Db) {
    const col = collectionsCollection(db);
    await col.createIndex({ tenantId: 1, batchId: 1 }, { unique: true });
    await col.createIndex({ status: 1 });
}
