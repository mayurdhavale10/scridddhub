/* ==========================================================
   Inventory Repository
   ScridddHub ERP – Core Inventory Persistence Layer
   Mongo Native Driver (No Mongoose)
========================================================== */

import { ObjectId, Db, Collection, Filter } from "mongodb";

import { ItemModel } from "@/models/inventory/item.model";
import { WarehouseModel } from "@/models/inventory/warehouse.model";
import { StockLotModel } from "@/models/inventory/stock-lot.model";
import { StockBalanceModel } from "@/models/inventory/stock-balance.model";
import { InventoryMovementModel as MovementModel } from "@/models/inventory/movement.model";
import { ReorderPolicyModel } from "@/models/inventory/reorder-policy.model";
import { InventoryAuditModel } from "@/models/inventory/inventory-audit.model";
import { AlertModel } from "@/models/inventory/alert.model";

// Analytics & AI Imports
import { DeadStockModel } from "@/models/inventory/deadstock.model";
import { InventoryForecastModel } from "@/models/inventory/forecast.model";
import { InventoryAnalyticsModel } from "@/models/inventory/analytics.model";

/* ==========================================================
   Repository Class
========================================================== */

export class InventoryRepository {
    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /* ==================== Collections ==================== */

    private items(): Collection<ItemModel> {
        return this.db.collection("inventory_items");
    }

    private warehouses(): Collection<WarehouseModel> {
        return this.db.collection("inventory_warehouses");
    }

    private stockLots(): Collection<StockLotModel> {
        return this.db.collection("inventory_stock_lots");
    }

    private stockBalances(): Collection<StockBalanceModel> {
        return this.db.collection("inventory_stock_balances");
    }

    private movements(): Collection<MovementModel> {
        return this.db.collection("inventory_movements");
    }

    private reorderPolicies(): Collection<ReorderPolicyModel> {
        return this.db.collection("inventory_reorder_policies");
    }

    private audits(): Collection<InventoryAuditModel> {
        return this.db.collection("inventory_audits");
    }

    private alerts(): Collection<AlertModel> {
        return this.db.collection("inventory_alerts");
    }

    // Analytics Collections
    private deadStock(): Collection<DeadStockModel> {
        return this.db.collection("inventory_deadstock");
    }

    private forecasts(): Collection<InventoryForecastModel> {
        return this.db.collection("inventory_forecasts");
    }

    private analytics(): Collection<InventoryAnalyticsModel> {
        return this.db.collection("inventory_analytics");
    }

    /* ==========================================================
       ITEMS
    ========================================================== */

    async createItem(item: ItemModel) {
        return this.items().insertOne({
            ...item,
            createdAt: new Date(),
        });
    }

    async getItemById(tenantId: string, itemId: string) {
        const filter: any = {
            tenantId,
            _id: new ObjectId(itemId),
        };
        return this.items().findOne(filter);
    }

    async listItems(tenantId: string) {
        return this.items().find({ tenantId }).toArray();
    }

    /* ==========================================================
       STOCK
    ========================================================== */

    async upsertStockBalance(balance: StockBalanceModel) {
        return this.stockBalances().updateOne(
            {
                tenantId: balance.tenantId,
                itemId: balance.itemId,
                warehouseId: balance.warehouseId,
            } as any,
            {
                $set: {
                    ...balance,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async getStockBalance(
        tenantId: string,
        itemId: string,
        warehouseId: string
    ) {
        return this.stockBalances().findOne({
            tenantId,
            itemId,
            warehouseId,
        });
    }

    /* ==========================================================
       MOVEMENTS
    ========================================================== */

    async recordMovement(movement: MovementModel) {
        return this.movements().insertOne({
            ...movement,
            createdAt: new Date(),
        });
    }

    async listMovements(tenantId: string, itemId?: string) {
        const filter: any = { tenantId };
        if (itemId) filter.itemId = itemId;

        return this.movements()
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();
    }

    /* ==========================================================
       LOTS
    ========================================================== */

    async createStockLot(lot: StockLotModel) {
        return this.stockLots().insertOne({
            ...lot,
            createdAt: new Date(),
        });
    }

    /* ==========================================================
       REORDER POLICIES
    ========================================================== */

    async setReorderPolicy(policy: ReorderPolicyModel) {
        return this.reorderPolicies().updateOne(
            {
                tenantId: policy.tenantId,
                itemId: policy.itemId,
            } as any,
            {
                $set: {
                    ...policy,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );
    }

    async getReorderPolicy(tenantId: string, itemId: string) {
        return this.reorderPolicies().findOne({ tenantId, itemId });
    }

    async getAllReorderPolicies(tenantId: string) {
        return this.reorderPolicies().find({ tenantId }).toArray();
    }

    /* ==========================================================
       AUDITS
    ========================================================== */

    async createAudit(audit: InventoryAuditModel) {
        return this.audits().insertOne({
            ...audit,
            createdAt: new Date(),
        });
    }

    /* ==========================================================
       ALERTS
    ========================================================== */

    async createAlert(alert: AlertModel) {
        return this.alerts().insertOne({
            ...alert,
            createdAt: new Date(),
        });
    }

    async listAlerts(tenantId: string) {
        return this.alerts()
            .find({ tenantId, status: "open" } as any)
            .sort({ severity: -1 })
            .toArray();
    }

    /* ==========================================================
       ANALYTICS & INTELLIGENCE (Phase 3)
    ========================================================== */

    async getDeadStock(tenantId: string) {
        return this.deadStock()
            .find({ tenantId, status: { $ne: "liquidated" } } as any) // Exclude sold items
            .sort({ "financials.totalLockedValue": -1 }) // Highest value locked first
            .toArray();
    }

    async getForecasts(tenantId: string) {
        return this.forecasts()
            .find({ tenantId })
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
    }

    async getAnalytics(tenantId: string) {
        // Return latest snapshot
        return this.analytics()
            .find({ tenantId })
            .sort({ snapshotDate: -1 })
            .limit(1)
            .toArray();
    }

    async getConsumptionHistory(tenantId: string, itemId: string) {
        const filter: any = {
            tenantId,
            itemId,
            type: "issue",
        };

        return this.movements()
            .find(filter)
            .project({
                quantity: 1,
                createdAt: 1,
            })
            .toArray();
    }

    async getConsumptionAll(tenantId: string) {
        const filter: any = {
            tenantId,
            type: "issue"
        };
        // Simple aggregate for AI input (all time usage)
        // In reality, this would be a detailed aggregation pipeline
        return this.movements()
            .find(filter)
            .project({ itemId: 1, quantity: 1, createdAt: 1 })
            .toArray();
    }

    async getStockSnapshots(tenantId: string) {
        return this.stockBalances()
            .find({ tenantId })
            .project({
                itemId: 1,
                warehouseId: 1,
                quantity: 1,
            })
            .toArray();
    }
}
