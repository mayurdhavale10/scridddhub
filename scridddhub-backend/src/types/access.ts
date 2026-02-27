export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Resource = 'inventory' | 'users' | 'finance' | 'settings';

export interface Permission {
    action: PermissionAction;
    resource: Resource;
}
