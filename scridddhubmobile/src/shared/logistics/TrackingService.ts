import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = "http://localhost:3030";
const BUFFER_KEY = "@tracking_buffer";

class TrackingService {
    private socket: Socket | null = null;
    private isTracking = false;
    private tripId: string | null = null;

    constructor() {
        this.socket = io(SOCKET_URL);
        this.socket.on('connect', () => {
            console.log("Connected to Tracking Hub");
            this.flushBuffer();
        });
    }

    startTracking(tripId: string) {
        this.tripId = tripId;
        this.isTracking = true;
        console.log(`Starting High-Precision tracking for ${tripId}`);
        // In a real app, this would hook into BackgroundGeolocation.onLocation()
    }

    stopTracking() {
        this.isTracking = false;
        this.tripId = null;
    }

    async updateLocation(coords: { latitude: number, longitude: number }, destination?: string) {
        if (!this.isTracking || !this.tripId) return;

        const data = {
            tripId: this.tripId,
            destination,
            coords,
            timestamp: new Date().toISOString(),
        };

        if (this.socket?.connected) {
            this.socket.emit('location_update', data);
        } else {
            console.log("Network Dead Zone: Buffering location...");
            await this.bufferLocation(data);
        }
    }

    private async bufferLocation(data: any) {
        const existing = await AsyncStorage.getItem(BUFFER_KEY);
        const buffer = existing ? JSON.parse(existing) : [];
        buffer.push(data);
        await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
    }

    private async flushBuffer() {
        const existing = await AsyncStorage.getItem(BUFFER_KEY);
        if (!existing) return;

        const buffer = JSON.parse(existing);
        if (buffer.length > 0 && this.socket?.connected) {
            console.log(`Syncing ${buffer.length} buffered locations...`);
            buffer.forEach((data: any) => {
                this.socket?.emit('location_update', data);
            });
            await AsyncStorage.removeItem(BUFFER_KEY);
        }
    }
}

export const trackingService = new TrackingService();
