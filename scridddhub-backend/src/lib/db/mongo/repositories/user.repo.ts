import { Db, ObjectId, OptionalId } from "mongodb";
import { IUserRepository } from "../../interfaces/user.repo";
import { User } from "../../../../models/access/user.model";
import { usersCollection } from "../schemas/user.schema";

export class MongoUserRepository implements IUserRepository {
    constructor(private db: Db) { }

    private get collection() {
        return usersCollection(this.db);
    }

    // Convert string ID to ObjectId for Mongo queries
    private toObjectId(id: string): ObjectId {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error("Invalid ID format");
        }
    }

    // Mapper: Mongo Doc (_id: ObjectId) -> Entity (_id: string)
    private mapDoc(doc: any): User | null {
        if (!doc) return null;
        return {
            ...doc,
            _id: doc._id.toString()
        };
    }

    async create(user: Omit<User, "_id" | "createdAt" | "updatedAt">): Promise<User> {
        const now = new Date();
        const doc: OptionalId<User> = {
            ...user,
            createdAt: now,
            updatedAt: now,
            // @ts-ignore: Type mismatch on _id is handled by optionalId
        } as any;

        const res = await this.collection.insertOne(doc as any);

        return {
            ...doc,
            _id: res.insertedId.toString()
        } as User;
    }

    async findById(id: string): Promise<User | null> {
        const doc = await this.collection.findOne({ _id: this.toObjectId(id) } as any);
        return this.mapDoc(doc);
    }

    async findByEmail(email: string): Promise<User | null> {
        const doc = await this.collection.findOne({ email } as any);
        return this.mapDoc(doc);
    }

    async update(id: string, updates: Partial<User>): Promise<User | null> {
        const { _id, ...safeUpdates } = updates; // Prevent _id update
        const res = await this.collection.findOneAndUpdate(
            { _id: this.toObjectId(id) } as any,
            {
                $set: {
                    ...safeUpdates,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );
        return this.mapDoc(res);
    }

    async delete(id: string): Promise<boolean> {
        const res = await this.collection.deleteOne({ _id: this.toObjectId(id) } as any);
        return res.deletedCount === 1;
    }
}
