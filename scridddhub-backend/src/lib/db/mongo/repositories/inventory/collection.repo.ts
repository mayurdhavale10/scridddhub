import { Db, ObjectId, OptionalId } from "mongodb";
import { ICollectionRepository } from "../../../interfaces/inventory/collection.repo";
import { CollectionDoc } from "../../../../models/inventory/collection.model";
import { collectionsCollection } from "../schemas/inventory/collection.schema";

export class MongoCollectionRepository implements ICollectionRepository {
    constructor(private db: Db) { }

    private get collection() {
        return collectionsCollection(this.db);
    }

    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    private mapDoc(doc: any): CollectionDoc | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(data: Omit<CollectionDoc, "_id" | "createdAt" | "updatedAt">): Promise<CollectionDoc> {
        const now = new Date();
        const doc: OptionalId<CollectionDoc> = {
            ...data,
            createdAt: now,
            updatedAt: now,
        } as any;

        const res = await this.collection.insertOne(doc as any);
        return {
            ...doc,
            _id: res.insertedId.toString()
        } as CollectionDoc;
    }

    async findById(id: string): Promise<CollectionDoc | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByBatchId(batchId: string): Promise<CollectionDoc | null> {
        const doc = await this.collection.findOne({ batchId } as any);
        return this.mapDoc(doc);
    }

    async update(id: string, updates: Partial<CollectionDoc>): Promise<CollectionDoc | null> {
        const { _id, ...safeUpdates } = updates;
        const res = await this.collection.findOneAndUpdate(
            { _id: this.toObjectId(id) } as any,
            {
                $set: { ...safeUpdates, updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );
        return this.mapDoc(res);
    }

    async delete(id: string): Promise<boolean> {
        const res = await this.collection.deleteOne({ _id: this.toObjectId(id) } as any);
        return res.deletedCount === 1;
    }

    async findAll(tenantId: string): Promise<CollectionDoc[]> {
        const docs = await this.collection.find({ tenantId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }
}
