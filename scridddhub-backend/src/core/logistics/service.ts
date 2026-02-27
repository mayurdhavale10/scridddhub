import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';
import { updateStockStatuses, logInventoryDispatch } from "../inventory/service";
import { StockStatus } from "../inventory/types";

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export enum VehicleType {
    Truck_6_Wheeler = "truck_6w",
    Truck_10_Wheeler = "truck_10w",
    Tempo = "tempo",
    Pickup = "pickup",
    Tractor = "tractor",
}

export enum TripStatus {
    Scheduled = "scheduled",
    EnRoute = "en_route",
    Completed = "completed",
    Cancelled = "cancelled",
}

export interface Vehicle {
    vehicle_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    owned_by_tenant: boolean;
    active: boolean;
    is_busy?: boolean;
    last_maintenance?: string;
}

export interface Driver {
    driver_id: string;
    name: string;
    phone: string;
    license_number: string;
    active: boolean;
}

export interface Trip {
    trip_id: string;
    vehicle_id: string;
    driver_id: string;
    origin: string;
    destination: string;
    stops?: string[]; // Intermediate waypoints

    status: TripStatus;

    // Payload Link (Important for AI traceability)
    linked_batch_ids: string[]; // Batches being carried

    start_time?: string;
    end_time?: string;

    odometer_start?: number;
    odometer_end?: number;

    dispatch_weight?: number; // Weight when leaving yard
    delivery_weight?: number; // Weight at destination
    shortage_weight?: number; // (Delivery - Dispatch)

    // Financials & Fleet
    estimated_distance?: number; // in km
    estimated_fuel_qty?: number; // in Liters
    driver_charge?: number;
    toll_expected?: number;

    fuel_cost?: number; // Actual cost recorded at end
    toll_cost?: number; // Actual toll recorded

    created_at: string;
}

// ----------------------------------------------------------------------
// STORAGE
// ----------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), 'data');
const VEHICLES_PATH = path.join(DATA_DIR, 'mock_vehicles.json');
const DRIVERS_PATH = path.join(DATA_DIR, 'mock_drivers.json');
const TRIPS_PATH = path.join(DATA_DIR, 'mock_trips.json');

function loadData<T>(filePath: string, defaultValue: T): T {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error(`Failed to load logistics data: ${filePath}`, e);
    }
    return defaultValue;
}

function saveData(filePath: string, data: any) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ----------------------------------------------------------------------
// SERVICE
// ----------------------------------------------------------------------

export const LogisticsService = {
    // Vehicles
    getVehicles: () => loadData<Vehicle[]>(VEHICLES_PATH, []),
    addVehicle: (v: Omit<Vehicle, 'vehicle_id'>) => {
        const vehicles = LogisticsService.getVehicles();
        const newVehicle = { ...v, vehicle_id: `VEH-${randomUUID().slice(0, 8)}` };
        vehicles.push(newVehicle);
        saveData(VEHICLES_PATH, vehicles);
        return newVehicle;
    },

    // Drivers
    getDrivers: () => loadData<Driver[]>(DRIVERS_PATH, []),
    addDriver: (d: Omit<Driver, 'driver_id'>) => {
        const drivers = LogisticsService.getDrivers();
        const newDriver = { ...d, driver_id: `DRV-${randomUUID().slice(0, 8)}` };
        drivers.push(newDriver);
        saveData(DRIVERS_PATH, drivers);
        return newDriver;
    },

    // Trips
    getTrips: () => loadData<Trip[]>(TRIPS_PATH, []),
    createTrip: (t: Omit<Trip, 'trip_id' | 'status' | 'created_at'>) => {
        const trips = LogisticsService.getTrips();
        const newTrip: Trip = {
            ...t,
            trip_id: `TRP-${randomUUID().slice(0, 10)}`,
            status: TripStatus.Scheduled,
            created_at: new Date().toISOString()
        };
        trips.push(newTrip);
        saveData(TRIPS_PATH, trips);
        return newTrip;
    },

    updateTripStatus: (tripId: string, status: TripStatus, endData?: {
        odometer_end?: number;
        fuel_cost?: number;
        delivery_weight?: number;
    }) => {
        const trips = LogisticsService.getTrips();
        const trip = trips.find(t => t.trip_id === tripId);
        if (trip) {
            trip.status = status;

            // Handle Vehicle & Stock Status Updates
            const vehicles = LogisticsService.getVehicles();
            const vehIdx = vehicles.findIndex(v => v.vehicle_id === trip.vehicle_id);

            if (status === TripStatus.Completed && endData) {
                trip.end_time = new Date().toISOString();
                if (endData.odometer_end) trip.odometer_end = endData.odometer_end;
                if (endData.fuel_cost) trip.fuel_cost = endData.fuel_cost;
                if (endData.delivery_weight !== undefined) {
                    trip.delivery_weight = endData.delivery_weight;
                    trip.shortage_weight = (trip.dispatch_weight || 0) - endData.delivery_weight;
                }

                // 1. Free the vehicle
                if (vehIdx !== -1) {
                    vehicles[vehIdx].is_busy = false;
                    saveData(VEHICLES_PATH, vehicles);
                }

                // 2. Finalize Stock (Mark as Sold)
                updateStockStatuses('TENANT-001', trip.linked_batch_ids, StockStatus.Sold);

                // 3. Log Audit Trail
                logInventoryDispatch('TENANT-001', trip.trip_id, trip.linked_batch_ids, 'LOGISTICS_SYSTEM');

            } else if (status === TripStatus.EnRoute) {
                trip.start_time = new Date().toISOString();

                // 1. Lock the vehicle
                if (vehIdx !== -1) {
                    vehicles[vehIdx].is_busy = true;
                    saveData(VEHICLES_PATH, vehicles);
                }

                // 2. Allocate Stock
                updateStockStatuses('TENANT-001', trip.linked_batch_ids, StockStatus.Allocated);
            }
            saveData(TRIPS_PATH, trips);
        }
        return trip;
    }
};
