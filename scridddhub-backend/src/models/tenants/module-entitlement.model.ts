import { Db, Collection } from "mongodb";
import { BaseDoc } from "../../types/common";
import { ModuleId } from "../../types/modules";

export interface ModuleEntitlementDoc extends BaseDoc {
    moduleId: ModuleId;
    isEnabled: boolean;
    config: Record<string, any>;
}

export function moduleEntitlementsCollection(db: Db): Collection<ModuleEntitlementDoc> {
    return db.collection<ModuleEntitlementDoc>("module_entitlements");
}

export async function ensureModuleEntitlementIndexes(db: Db) {
    const col = moduleEntitlementsCollection(db);
    await col.createIndex({ tenantId: 1, moduleId: 1 }, { unique: true });
}
