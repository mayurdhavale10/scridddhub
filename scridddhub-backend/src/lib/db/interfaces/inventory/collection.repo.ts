import { CollectionDoc } from "../../../models/inventory/collection.model";

export interface ICollectionRepository {
    create(collection: Omit<CollectionDoc, "_id" | "createdAt" | "updatedAt">): Promise<CollectionDoc>;
    findById(id: string): Promise<CollectionDoc | null>;
    findByBatchId(batchId: string): Promise<CollectionDoc | null>;
    update(id: string, updates: Partial<CollectionDoc>): Promise<CollectionDoc | null>;
    delete(id: string): Promise<boolean>;
    findAll(tenantId: string): Promise<CollectionDoc[]>;
}
