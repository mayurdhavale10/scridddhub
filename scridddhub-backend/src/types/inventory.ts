export type MaterialType = 'plastic' | 'metal' | 'glass' | 'paper' | 'organic' | 'ewaste';
export type CollectionMethod = 'pickup' | 'dropoff';

export interface WeightEntry {
    value: number;
    unit: 'kg' | 'ton';
}
