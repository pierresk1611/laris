import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { input, output } = body;

        if (!input || !output) {
            return NextResponse.json({ success: false, error: "Missing input or output" }, { status: 400 });
        }

        const pattern = await prisma.aiPattern.create({
            data: {
                input,
                output
            }
        });

        return NextResponse.json({ success: true, pattern });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
