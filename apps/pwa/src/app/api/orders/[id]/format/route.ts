import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { sheetFormat, shopId } = body;

        if (!shopId || !sheetFormat) {
            return NextResponse.json({ success: false, message: 'Missing shopId or sheetFormat' }, { status: 400 });
        }

        // Upsert LocalOrderState
        const updated = await prisma.localOrderState.upsert({
            where: {
                orderId_shopId: {
                    orderId: id,
                    shopId: shopId
                }
            },
            create: {
                orderId: id,
                shopId: shopId,
                status: 'READY_FOR_PRINT', // Assuming if we set format, it's ready? No, keep existing logic or default.
                // Actually if it doesn't exist, it implies it wasn't approved? 
                // But this endpoint might be called on approved orders.
                sheetFormat
            },
            update: {
                sheetFormat
            }
        });

        return NextResponse.json({ success: true, state: updated });
    } catch (error: any) {
        console.error("Update format error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
