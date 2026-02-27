import { NextResponse } from "next/server";
import { deleteWeighFieldTemplate } from "@/core/inventory/service";

export async function DELETE(
    req: Request,
    { params }: { params: { tenantId: string; fieldId: string } }
) {
    try {
        const success = await deleteWeighFieldTemplate(params.tenantId, params.fieldId);

        if (!success) {
            return NextResponse.json(
                { error: "Field not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Field deleted successfully"
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete field" },
            { status: 500 }
        );
    }
}
