import { ItemModel, ItemCategory } from "../../../../models/inventory/item.model";
import { InventoryMovementModel } from "../../../../models/inventory/movement.model";
import { AlertModel } from "../../../../models/inventory/alert.model";

export interface IInventoryRepository {
    // Core Item CRUD
    createItem(item: ItemModel): Promise<ItemModel>;
    getItemById(id: string): Promise<ItemModel | null>;
    getItemBySku(sku: string): Promise<ItemModel | null>;
    updateItem(id: string, updates: Partial<ItemModel>): Promise<ItemModel | null>;
    deleteItem(id: string): Promise<boolean>;

    // Queries
    listItems(filter: { category?: ItemCategory; tenantId: string; page: number; limit: number }): Promise<ItemModel[]>;

    // Feature: Stock Management
    updateStock(itemId: string, quantityChange: number): Promise<void>;
    recordMovement(movement: InventoryMovementModel): Promise<InventoryMovementModel>;

    // Feature: Intelligence
    createAlert(alert: AlertModel): Promise<AlertModel>;
    checkReorderPolicy(itemId: string, currentStock: number): Promise<void>; // Logic placeholder

    // Aggregates
    getLowStockItems(tenantId: string): Promise<ItemModel[]>;
}
