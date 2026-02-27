import { Db, ObjectId, OptionalId } from "mongodb";
import { ITraceabilityRepository } from "../../../interfaces/inventory/traceability.repo";
import { TraceabilityDoc } from "../../../../models/inventory/traceability.model";
import { traceabilityCollection } from "../schemas/inventory/traceability.schema";

export class MongoTraceabilityRepository implements ITraceabilityRepository {
    constructor(private db: Db) { }

    private get collection() {
        return traceabilityCollection(this.db);
    }

    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    private mapDoc(doc: any): TraceabilityDoc | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(data: Omit<TraceabilityDoc, "_id" | "createdAt" | "updatedAt">): Promise<TraceabilityDoc> {
        const now = new Date();
        const doc: OptionalId<TraceabilityDoc> = {
            ...data,
            createdAt: now,
            updatedAt: now,
        } as any;

        const res = await this.collection.insertOne(doc as any);
        return {
            ...doc,
            _id: res.insertedId.toString()
        } as TraceabilityDoc;
    }

    async findById(id: string): Promise<TraceabilityDoc | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByEntity(entityId: string): Promise<TraceabilityDoc | null> {
        const doc = await this.collection.findOne({ entityId } as any);
        return this.mapDoc(doc);
    }

    async appendEvent(id: string, event: TraceabilityDoc['chainOfCustody'][0]): Promise<TraceabilityDoc | null> {
        const res = await this.collection.findOneAndUpdate(
            { _id: this.toObjectId(id) } as any,
            {
                $push: { chainOfCustody: event } as any,
                $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );
        return this.mapDoc(res);
    }

    async findAll(tenantId: string): Promise<TraceabilityDoc[]> {
        const docs = await this.collection.find({ tenantId }).toArray();
        return docs.map(d => this.mapDoc(d)!);
    }
}
