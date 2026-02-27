import { Db, Collection, ObjectId } from "mongodb";
// We import the pure entity to use as a generic, but at DB level we might cast _id to ObjectId
import { User } from "../../../../models/access/user.model";

// Mongo specific type might need _id as ObjectId, but for now we stick to the shape
// We can use a type helper if needed: type MongoUser = Omit<User, '_id'> & { _id: ObjectId }

export const USER_COLLECTION = "users";

export function usersCollection(db: Db): Collection<User> {
    return db.collection<User>(USER_COLLECTION);
}

export async function ensureUserIndexes(db: Db) {
    const col = usersCollection(db);
    await col.createIndex({ email: 1 }, { unique: true });
    await col.createIndex({ googleSub: 1 }, { unique: true, sparse: true });
    await col.createIndex({ tenantId: 1 });
}
