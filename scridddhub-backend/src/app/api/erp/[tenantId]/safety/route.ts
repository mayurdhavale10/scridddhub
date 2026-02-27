import { NextRequest, NextResponse } from 'next/server';
import { SafetyService } from '@/core/safety/service';

export async function GET(
    req: NextRequest,
    { params }: { params: { tenantId: string } }
) {
    try {
        const status = await SafetyService.getEmergencyStatus();
        return NextResponse.json(status);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch safety status' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: { tenantId: string } }
) {
    try {
        const body = await req.json();
        await SafetyService.updateStaffLocation(body);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { tenantId: string } }
) {
    try {
        const { employeeId } = await req.json();
        await SafetyService.triggerSOS(employeeId);
        return NextResponse.json({ success: true, message: 'SOS Triggered' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to trigger SOS' }, { status: 500 });
    }
}
