import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { webProductId, templateId } = body;

        if (!webProductId) {
            return NextResponse.json({ success: false, error: "Missing webProductId" }, { status: 400 });
        }

        const updated = await prisma.webProduct.update({
            where: { id: webProductId },
            data: { templateId: templateId || null }
        });

        return NextResponse.json({ success: true, product: updated });
    } catch (e: any) {
        console.error("Save mapping error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
