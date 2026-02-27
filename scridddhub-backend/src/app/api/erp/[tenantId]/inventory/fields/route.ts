import { NextResponse } from "next/server";
import { getWeighFieldTemplates, createWeighFieldTemplate } from "@/core/inventory/service";
import { WeighFieldTemplate } from "@/core/inventory/types";

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const materialId = searchParams.get("material");

        // If materialId is null, service returns all templates (good for Manager Dashboard)
        const templates = await getWeighFieldTemplates(params.tenantId, materialId || undefined);

        return NextResponse.json({
            success: true,
            data: templates,
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch fields" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const body = (await req.json()) as WeighFieldTemplate;

        // Basic validation
        if (!body.label || !body.type || !body.material_scope) {
            return NextResponse.json(
                { error: "Missing required fields (label, type, material_scope)" },
                { status: 400 }
            );
        }

        const newTemplate = await createWeighFieldTemplate(params.tenantId, body);

        return NextResponse.json({
            success: true,
            data: newTemplate,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to create field" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { tenantId: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const fieldId = searchParams.get("fieldId");

        if (!fieldId) {
            return NextResponse.json(
                { error: "Missing fieldId" },
                { status: 400 }
            );
        }

        const success = await import("@/core/inventory/service").then(m => m.deleteWeighFieldTemplate(params.tenantId, fieldId));

        if (!success) {
            return NextResponse.json(
                { error: "Field not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete field" },
            { status: 500 }
        );
    }
}
