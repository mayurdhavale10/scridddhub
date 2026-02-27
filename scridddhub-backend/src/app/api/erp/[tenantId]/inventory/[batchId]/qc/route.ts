
import { NextResponse } from "next/server";
import { submitQC } from "@/core/inventory/service";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ tenantId: string; batchId: string }> }
) {
    try {
        const { tenantId, batchId } = await params;
        const body = await req.json();
        const { status, notes, checkedBy, acceptedWeight, rejectedWeight, qcData } = body;

        if (!status) {
            return NextResponse.json(
                { error: "QC Status is required" },
                { status: 400 }
            );
        }

        const updatedEntry = await submitQC(tenantId, batchId, {
            status,
            notes,
            checkedBy,
            acceptedWeight,
            rejectedWeight,
            qcData
        });

        if (!updatedEntry) {
            return NextResponse.json(
                { error: "Batch not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: updatedEntry
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "QC Submission failed" },
            { status: 500 }
        );
    }
}
