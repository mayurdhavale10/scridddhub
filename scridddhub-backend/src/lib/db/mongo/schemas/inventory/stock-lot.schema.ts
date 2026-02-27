import { Db, Collection } from "mongodb";
import { StockLotDoc } from "../../../../models/inventory/stock-lot.model";

export const STOCK_LOT_COLLECTION = "stock_lots";

export function stockLotsCollection(db: Db): Collection<StockLotDoc> {
    return db.collection<StockLotDoc>(STOCK_LOT_COLLECTION);
}

export async function ensureStockLotIndexes(db: Db) {
    const col = stockLotsCollection(db);
    await col.createIndex({ tenantId: 1, lotNumber: 1 }, { unique: true });
}
