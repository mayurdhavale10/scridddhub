import { MongoClient, Db } from "mongodb";
import { initIndexes } from "./indexes"; // Import init function

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error("❌ Missing MONGODB_URI in .env.local");
}

type GlobalWithMongo = typeof globalThis & {
    __mongoClientPromise?: Promise<MongoClient>;
    __mongoClient?: MongoClient;
};

const g = globalThis as GlobalWithMongo;

let clientPromise: Promise<MongoClient>;

if (!g.__mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
    });
    // Initialize indexes on connection
    g.__mongoClientPromise = client.connect().then(async (c) => {
        try {
            await initIndexes(c.db());
        } catch (e) {
            console.error("Index init failed:", e);
        }
        return c;
    });
}

clientPromise = g.__mongoClientPromise;

export async function getMongoClient() {
    return clientPromise;
}

export async function getDb(dbName?: string): Promise<Db> {
    const client = await getMongoClient();
    return client.db(dbName);
}

