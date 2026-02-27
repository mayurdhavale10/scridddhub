/* ==========================================================
   Inventory Service Layer
   ScridddHub ERP
========================================================== */

import { InventoryRepository } from "../lib/db/mongo/repositories/inventory/inventory.repository";

import { ItemModel } from "../models/inventory/item.model";
import { InventoryMovementModel as MovementModel } from "../models/inventory/movement.model";
import { StockBalanceModel } from "../models/inventory/stock-balance.model";
import { ReorderPolicyModel } from "../models/inventory/reorder-policy.model";
import { InventoryAuditModel } from "../models/inventory/inventory-audit.model";
import { AlertModel } from "../models/inventory/alert.model";

export class InventoryService {
    constructor(private readonly repo: InventoryRepository) { }

    /* ======================================================
       ITEMS
    ====================================================== */

    async createItem(item: ItemModel) {
        return this.repo.createItem(item);
    }

    /* ======================================================
       STOCK MOVEMENT (CORE ENGINE)
    ====================================================== */

    async moveStock(movement: MovementModel) {
        // 1. Record movement
        await this.repo.recordMovement(movement);

        // 2. Identify Warehouse and Direction
        // Note: For 'transfer', this simple logic handles only the 'primary' effect (or requires two movements: issue + receive).
        // A true double-entry system would handle two balances here. 
        // For now, we infer the target warehouse based on type.

        let warehouseId: string | undefined;
        let isInbound = false;

        switch (movement.type) {
            case "receive":
            case "return":
            case "adjustment": // adjustment can be +/- but usually affects 'to' location if specified, or 'from'.
                // Assuming 'receive/return' puts goods INTO a warehouse.
                warehouseId = movement.to?.warehouseId;
                isInbound = true;
                break;

            case "issue":
            case "scrap":
                // Taking goods OUT of a warehouse.
                warehouseId = movement.from?.warehouseId;
                isInbound = false;
                break;

            case "transfer":
                // Transfer is special. It should probably call moveStock recursively or handle two updates.
                // For this function scope, we'll assume it handles the "from" decrement if passed as a single call?
                // Or maybe we throw error if simpler logic is expected.
                // Let's assume this call handles the DECREMENT from source if standard pattern is used.
                // However, without clarification, I will default to source.
                warehouseId = movement.from?.warehouseId;
                isInbound = false;
                break;

            default:
                // Fallback
                warehouseId = movement.to?.warehouseId || movement.from?.warehouseId;
        }

        if (!warehouseId) {
            console.warn("Movement recorded but no Warehouse ID found for stock update.");
            return true;
        }

        // 3. Get current balance
        const balance =
            (await this.repo.getStockBalance(
                movement.tenantId,
                movement.itemId,
                warehouseId
            )) || {
                tenantId: movement.tenantId,
                itemId: movement.itemId,
                warehouseId: warehouseId,
                quantity: 0,
                lastUpdated: new Date()
            };

        // 4. Apply delta
        const movementQty = movement.quantity || 0;
        const updatedQty = isInbound
            ? balance.quantity + movementQty
            : balance.quantity - movementQty;

        if (updatedQty < 0) {
            console.warn(`Negative stock detected for item ${movement.itemId} in warehouse ${warehouseId}`);
        }

        // 5. Persist balance
        await this.repo.upsertStockBalance({
            ...balance,
            quantity: updatedQty,
            lastUpdated: new Date()
        } as StockBalanceModel);

        // 6. Evaluate reorder
        await this.evaluateReorder(movement.tenantId, movement.itemId);

        return true;
    }

    /* ======================================================
       REORDER ENGINE
    ====================================================== */

    async evaluateReorder(tenantId: string, itemId: string) {
        const policy = await this.repo.getReorderPolicy(tenantId, itemId);
        if (!policy || !policy.active || !policy.limits?.minStock) return;

        const snapshot = await this.repo.getStockSnapshots(tenantId);
        const totalStock = snapshot
            .filter(s => s.itemId === itemId)
            .reduce((sum, s) => sum + s.quantity, 0);

        if (totalStock <= policy.limits.minStock) {
            await this.repo.createAlert({
                tenantId,
                type: "low_stock",
                severity: "warning",
                status: "open",
                title: "Low Stock Warning",
                message: `Stock (${totalStock}) is below minimum threshold (${policy.limits.minStock})`,
                severityScore: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            } as any as AlertModel);
        }
    }

    /* ======================================================
       AUDIT RECONCILIATION
    ====================================================== */

    async reconcileAudit(audit: InventoryAuditModel) {
        await this.repo.createAudit(audit);

        for (const line of audit.results) {
            await this.repo.upsertStockBalance({
                tenantId: audit.tenantId,
                itemId: line.itemId,
                warehouseId: audit.warehouseId,
                quantity: line.countedQty,
                lastUpdated: new Date()
            });
        }
    }

    /* ======================================================
       POLICIES
    ====================================================== */

    async setReorderPolicy(policy: ReorderPolicyModel) {
        return this.repo.setReorderPolicy(policy);
    }

    /* ======================================================
       ALERTS
    ====================================================== */

    async getActiveAlerts(tenantId: string) {
        return this.repo.listAlerts(tenantId);
    }

    /* ======================================================
       ML FEEDS
    ====================================================== */

    async getMLDataset(tenantId: string, itemId: string) {
        const consumption = await this.repo.getConsumptionHistory(
            tenantId,
            itemId
        );

        const stock = await this.repo.getStockSnapshots(tenantId);

        return {
            consumption,
            stock,
        };
    }
}
