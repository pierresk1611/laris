import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Next.js 15: params is async
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, shopId, note } = body;

        if (!status || !shopId) {
            return NextResponse.json({ success: false, message: 'Missing status or shopId' }, { status: 400 });
        }

        const updatedState = await prisma.localOrderState.upsert({
            where: {
                orderId_shopId: {
                    orderId: id,
                    shopId: shopId
                }
            },
            update: {
                status: status,
                note: note // Optional update
            },
            create: {
                orderId: id,
                shopId: shopId,
                status: status,
                note: note
            }
        });

        return NextResponse.json({ success: true, state: updatedState });
    } catch (error: any) {
        console.error("Failed to update local order status", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
