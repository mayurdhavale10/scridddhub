import { StockLotDoc } from "../../../models/inventory/stock-lot.model";

export interface IStockLotRepository {
    create(stockLot: Omit<StockLotDoc, "_id" | "createdAt" | "updatedAt">): Promise<StockLotDoc>;
    findById(id: string): Promise<StockLotDoc | null>;
    findByLotNumber(lotNumber: string): Promise<StockLotDoc | null>;
    update(id: string, updates: Partial<StockLotDoc>): Promise<StockLotDoc | null>;
    delete(id: string): Promise<boolean>;
    findAll(tenantId: string): Promise<StockLotDoc[]>;
}
