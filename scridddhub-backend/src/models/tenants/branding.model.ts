import { Db, Collection } from "mongodb";
import { BaseDoc } from "../../types/common";

export interface BrandingDoc extends BaseDoc {
    logoUrl?: string;
    primaryColor?: string;
    companyName: string;
}

export function brandingCollection(db: Db): Collection<BrandingDoc> {
    return db.collection<BrandingDoc>("branding");
}

export async function ensureBrandingIndexes(db: Db) {
    const col = brandingCollection(db);
    await col.createIndex({ tenantId: 1 }, { unique: true });
}
