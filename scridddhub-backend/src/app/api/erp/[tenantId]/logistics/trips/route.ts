import { NextResponse } from "next/server";
import { LogisticsService } from "@/core/logistics/service";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const trips = LogisticsService.getTrips();
        return NextResponse.json({ success: true, data: trips });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const res = LogisticsService.createTrip(body);
        return NextResponse.json({ success: true, data: res });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { tripId, status, endData } = body;
        const res = LogisticsService.updateTripStatus(tripId, status, endData);
        return NextResponse.json({ success: true, data: res });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
