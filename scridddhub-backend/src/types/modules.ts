export type ModuleId =
    | 'inventory'
    | 'waste'
    | 'machines'
    | 'logistics'
    | 'finance'
    | 'integrations'
    | 'ai';

export interface ModuleConfig {
    enabled: boolean;
    settings?: Record<string, any>;
}
