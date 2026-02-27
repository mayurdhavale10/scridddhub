export type MachineStatus = 'active' | 'maintenance' | 'offline' | 'error';
export type SensorType = 'vibration' | 'temperature' | 'throughput' | 'power';

export interface SensorReading {
    timestamp: Date;
    value: number;
    sensorId: string;
}
