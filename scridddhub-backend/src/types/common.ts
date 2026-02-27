export type BaseDoc = {
    _id: string; // Abstracted ID (ObjectId.toString() or UUID)
    createdAt: Date;
    updatedAt: Date;
    tenantId: string; // Multi-tenancy root
};

export type PaginationParams = {
    page?: number;
    limit?: number;
};
