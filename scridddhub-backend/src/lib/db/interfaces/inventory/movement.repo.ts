import { MovementDoc } from "../../../models/inventory/movement.model";

export interface IMovementRepository {
    create(movement: Omit<MovementDoc, "_id" | "createdAt" | "updatedAt">): Promise<MovementDoc>;
    findById(id: string): Promise<MovementDoc | null>;
    findByItem(itemId: string): Promise<MovementDoc[]>;
    findAll(tenantId: string): Promise<MovementDoc[]>;
}
