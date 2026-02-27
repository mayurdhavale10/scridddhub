import { Db, Collection } from "mongodb";
import { BaseDoc } from "../../types/common";

export interface TenantDoc extends BaseDoc {
    name: string;
    slug: string;
    ownerId: string; // userId
    status: 'active' | 'suspended';
}

export function tenantsCollection(db: Db): Collection<TenantDoc> {
    return db.collection<TenantDoc>("tenants");
}

export async function ensureTenantIndexes(db: Db) {
    const col = tenantsCollection(db);
    await col.createIndex({ slug: 1 }, { unique: true });
}
