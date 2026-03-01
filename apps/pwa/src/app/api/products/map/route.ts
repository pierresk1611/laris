import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { productId, templateId } = body;

        if (!productId) {
            return NextResponse.json({ success: false, error: 'Chýba ID produktu' }, { status: 400 });
        }

        // Ak templateId je null/undefined, robíme unmap
        const updatedProduct = await prisma.webProduct.update({
            where: { id: productId },
            data: {
                templateId: templateId || null,
                matchConfidence: templateId ? 1.0 : null // 1.0 is Manual Confirmed
            },
            include: { template: true }
        });

        return NextResponse.json({ success: true, product: updatedProduct });
    } catch (error: any) {
        console.error('[Manual Mapping] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
