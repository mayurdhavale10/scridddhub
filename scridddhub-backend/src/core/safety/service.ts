import fs from 'fs';
import path from 'path';
import { SafetyPacket, MusterReport } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SAFETY_FILE = path.join(DATA_DIR, 'staff_safety.json');

export class SafetyService {
    private static ensureFile() {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
        if (!fs.existsSync(SAFETY_FILE)) {
            fs.writeFileSync(SAFETY_FILE, JSON.stringify([]));
        }
    }

    static async updateStaffLocation(packet: SafetyPacket): Promise<void> {
        this.ensureFile();
        const data = JSON.parse(fs.readFileSync(SAFETY_FILE, 'utf-8'));
        const existingIndex = data.findIndex((p: any) => p.employeeId === packet.employeeId);

        if (existingIndex > -1) {
            data[existingIndex] = { ...data[existingIndex], ...packet, timestamp: new Date().toISOString() };
        } else {
            data.push({ ...packet, timestamp: new Date().toISOString() });
        }

        fs.writeFileSync(SAFETY_FILE, JSON.stringify(data, null, 2));
    }

    static async getEmergencyStatus(): Promise<MusterReport> {
        this.ensureFile();
        const data: SafetyPacket[] = JSON.parse(fs.readFileSync(SAFETY_FILE, 'utf-8'));

        const tenMinutesAgo = new Date();
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

        const activeStaff = data.filter(p => new Date(p.timestamp) > tenMinutesAgo);

        return {
            timestamp: new Date().toISOString(),
            totalStaff: data.length,
            accountedFor: activeStaff.length,
            missing: data.length - activeStaff.length,
            locations: data
        };
    }

    static async triggerSOS(employeeId: string): Promise<void> {
        this.ensureFile();
        const data = JSON.parse(fs.readFileSync(SAFETY_FILE, 'utf-8'));
        const index = data.findIndex((p: any) => p.employeeId === employeeId);
        if (index > -1) {
            data[index].status = 'emergency';
            fs.writeFileSync(SAFETY_FILE, JSON.stringify(data, null, 2));
        }
    }
}
