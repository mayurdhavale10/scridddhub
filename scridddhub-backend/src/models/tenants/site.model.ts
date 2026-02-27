import { Db, Collection } from "mongodb";
import { BaseDoc } from "../../types/common";

export interface SiteDoc extends BaseDoc {
    name: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
}

export function sitesCollection(db: Db): Collection<SiteDoc> {
    return db.collection<SiteDoc>("sites");
}

export async function ensureSiteIndexes(db: Db) {
    const col = sitesCollection(db);
    await col.createIndex({ tenantId: 1 });
}
