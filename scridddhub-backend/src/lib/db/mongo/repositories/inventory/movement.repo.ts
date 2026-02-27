import { Db, ObjectId, OptionalId } from "mongodb";
import { IMovementRepository } from "../../../interfaces/inventory/movement.repo";
import { MovementDoc } from "../../../../models/inventory/movement.model";
import { movementsCollection } from "../schemas/inventory/movement.schema";

export class MongoMovementRepository implements IMovementRepository {
    constructor(private db: Db) { }

    private get collection() {
        return movementsCollection(this.db);
    }

    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    private mapDoc(doc: any): MovementDoc | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(data: Omit<MovementDoc, "_id" | "createdAt" | "updatedAt">): Promise<MovementDoc> {
        const now = new Date();
        const doc: OptionalId<MovementDoc> = {
            ...data,
            createdAt: now,
            updatedAt: now,
        } as any;

        const res = await this.collection.insertOne(doc as any);
        return {
            ...doc,
            _id: res.insertedId.toString()
        } as MovementDoc;
    }

    async findById(id: string): Promise<MovementDoc | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByItem(itemId: string): Promise<MovementDoc[]> {
        const docs = await this.collection.find({ itemId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }

    async findAll(tenantId: string): Promise<MovementDoc[]> {
        const docs = await this.collection.find({ tenantId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }
}
