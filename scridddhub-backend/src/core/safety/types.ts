export interface SafetyPacket {
    employeeId: string;
    employeeName: string;
    role: string;
    timestamp: string;
    status: 'safe' | 'emergency' | 'inactive';
    location: {
        zone: string; // "Yard-A", "Office-Floor-2", "Storage-Shed"
        lat?: number;
        lng?: number;
        lastBeaconId?: string;
    };
    deviceStats: {
        battery: number;
        isOnline: boolean;
    };
}

export interface MusterReport {
    timestamp: string;
    totalStaff: number;
    accountedFor: number;
    missing: number;
    locations: SafetyPacket[];
}
