export type WasteCategory = 'hazardous' | 'recyclable' | 'general';
export type DisposalMethod = 'landfill' | 'incineration' | 'recycled';

export interface ComplianceStatus {
    isCompliant: boolean;
    issues?: string[];
}
