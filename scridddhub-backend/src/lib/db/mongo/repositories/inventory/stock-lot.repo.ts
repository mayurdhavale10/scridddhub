import { Db, ObjectId, OptionalId } from "mongodb";
import { IStockLotRepository } from "../../../interfaces/inventory/stock-lot.repo";
import { StockLotDoc } from "../../../../models/inventory/stock-lot.model";
import { stockLotsCollection } from "../schemas/inventory/stock-lot.schema";

export class MongoStockLotRepository implements IStockLotRepository {
    constructor(private db: Db) { }

    private get collection() {
        return stockLotsCollection(this.db);
    }

    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    private mapDoc(doc: any): StockLotDoc | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(data: Omit<StockLotDoc, "_id" | "createdAt" | "updatedAt">): Promise<StockLotDoc> {
        const now = new Date();
        const doc: OptionalId<StockLotDoc> = {
            ...data,
            createdAt: now,
            updatedAt: now,
        } as any;

        const res = await this.collection.insertOne(doc as any);
        return {
            ...doc,
            _id: res.insertedId.toString()
        } as StockLotDoc;
    }

    async findById(id: string): Promise<StockLotDoc | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByLotNumber(lotNumber: string): Promise<StockLotDoc | null> {
        const doc = await this.collection.findOne({ lotNumber } as any);
        return this.mapDoc(doc);
    }

    async update(id: string, updates: Partial<StockLotDoc>): Promise<StockLotDoc | null> {
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

    async findAll(tenantId: string): Promise<StockLotDoc[]> {
        const docs = await this.collection.find({ tenantId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }
}
