import { NextResponse } from "next/server";
import { LogisticsService } from "@/core/logistics/service";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const vehicles = LogisticsService.getVehicles();
        const drivers = LogisticsService.getDrivers();

        return NextResponse.json({
            success: true,
            data: { vehicles, drivers }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, data } = body; // type: 'vehicle' | 'driver'

        if (type === 'vehicle') {
            const res = LogisticsService.addVehicle(data);
            return NextResponse.json({ success: true, data: res });
        } else if (type === 'driver') {
            const res = LogisticsService.addDriver(data);
            return NextResponse.json({ success: true, data: res });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
