import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { webProductId, webProductIds, templateId, sku } = body;

        const idsToUpdate = webProductIds || (webProductId ? [webProductId] : []);

        if (idsToUpdate.length === 0) {
            return NextResponse.json({ success: false, error: "Missing webProductId(s)" }, { status: 400 });
        }

        const dataToUpdate: any = {};
        if (templateId !== undefined) {
            dataToUpdate.templateId = templateId || null;
        }
        if (sku !== undefined) {
            dataToUpdate.sku = sku || null;
        }

        const updated = await prisma.webProduct.updateMany({
            where: { id: { in: idsToUpdate } },
            data: dataToUpdate
        });

        return NextResponse.json({ success: true, updatedCount: updated.count });
    } catch (e: any) {
        console.error("Save mapping error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
