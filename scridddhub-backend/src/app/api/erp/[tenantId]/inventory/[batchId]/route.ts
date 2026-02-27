import { NextResponse } from "next/server";
import { deleteWeighEntry } from "@/core/inventory/service";
import { NextRequest } from "next/server";

// DELETE /api/erp/{tenantId}/inventory/{batchId}
export async function DELETE(
    request: NextRequest,
    context: any
) {
    try {
        // Handle Next.js 15+ where params might be a Promise
        const params = context.params ? (await context.params) : context;
        const { tenantId, batchId } = params || {};

        console.log("🚀 API ROUTE HIT: DELETE");
        console.log("Context keys:", Object.keys(context));
        console.log("Extracted params:", params);
        console.log("Target batchId:", batchId);

        const result = await deleteWeighEntry(tenantId, batchId);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error || "Entry not found",
                    debug: result.debug
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Deleted successfully"
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete" },
            { status: 500 }
        );
    }
}

// PUT /api/erp/{tenantId}/inventory/{batchId}
export async function PUT(
    req: Request,
    { params }: { params: { tenantId: string; batchId: string } }
) {
    try {
        const { tenantId, batchId } = params;
        const body = await req.json();
        const { updateWeighEntry } = await import("@/core/inventory/service");

        const result = await updateWeighEntry(tenantId, batchId, body);

        if (!result) {
            return NextResponse.json(
                { error: "Entry not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to update" },
            { status: 500 }
        );
    }
}
