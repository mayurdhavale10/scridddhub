export type AiModel = 'gpt-4o' | 'claude-3-5-sonnet';
export type InsightCategory = 'efficiency' | 'anomaly' | 'prediction';

export interface AiPrediction {
    confidence: number;
    predictedValue: number;
    horizon: string; // e.g., '24h'
}
