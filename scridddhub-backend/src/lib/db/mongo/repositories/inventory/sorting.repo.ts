import { Db, ObjectId, OptionalId } from "mongodb";
import { ISortingRepository } from "../../../interfaces/inventory/sorting.repo";
import { SortingDoc } from "../../../../models/inventory/sorting.model";
import { sortingCollection } from "../schemas/inventory/sorting.schema";

export class MongoSortingRepository implements ISortingRepository {
    constructor(private db: Db) { }

    private get collection() {
        return sortingCollection(this.db);
    }

    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    private mapDoc(doc: any): SortingDoc | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(data: Omit<SortingDoc, "_id" | "createdAt" | "updatedAt">): Promise<SortingDoc> {
        const now = new Date();
        const doc: OptionalId<SortingDoc> = {
            ...data,
            createdAt: now,
            updatedAt: now,
        } as any;

        const res = await this.collection.insertOne(doc as any);
        return {
            ...doc,
            _id: res.insertedId.toString()
        } as SortingDoc;
    }

    async findById(id: string): Promise<SortingDoc | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByOperator(operatorId: string): Promise<SortingDoc[]> {
        const docs = await this.collection.find({ operatorId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }

    async delete(id: string): Promise<boolean> {
        const res = await this.collection.deleteOne({ _id: this.toObjectId(id) } as any);
        return res.deletedCount === 1;
    }

    async findAll(tenantId: string): Promise<SortingDoc[]> {
        const docs = await this.collection.find({ tenantId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }
}
