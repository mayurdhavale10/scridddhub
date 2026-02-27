export type TripStatus = 'scheduled' | 'in-transit' | 'completed' | 'cancelled';
export type VehicleType = 'truck' | 'van' | 'forklift';

export interface Location {
    lat: number;
    lng: number;
    address?: string;
}
