import { SortingDoc } from "../../../models/inventory/sorting.model";

export interface ISortingRepository {
    create(sorting: Omit<SortingDoc, "_id" | "createdAt" | "updatedAt">): Promise<SortingDoc>;
    findById(id: string): Promise<SortingDoc | null>;
    findByOperator(operatorId: string): Promise<SortingDoc[]>;
    delete(id: string): Promise<boolean>;
    findAll(tenantId: string): Promise<SortingDoc[]>;
}
