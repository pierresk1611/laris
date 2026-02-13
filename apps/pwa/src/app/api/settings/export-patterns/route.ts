import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings/export-patterns
 * Exports all AiPattern records as a JSON file.
 */
export async function GET() {
    try {
        const patterns = await prisma.aiPattern.findMany();

        const data = JSON.stringify(patterns, null, 2);

        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename=ai_patterns_export.json'
            }
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
