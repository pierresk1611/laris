import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { shopId, items, isVerified } = body;

        if (!shopId) {
            return NextResponse.json({ success: false, error: "Missing shopId" }, { status: 400 });
        }

        // Upsert LocalOrderState
        // We are saving the ENTIRE verified items structure into orderData.

        const localState = await (prisma as any).localOrderState.upsert({
            where: {
                orderId_shopId: {
                    orderId: id,
                    shopId: shopId
                }
            },
            update: {
                isVerified: isVerified === true, // Explicit true
                orderData: items // Save the items array
            },
            create: {
                orderId: id,
                shopId: shopId,
                isVerified: isVerified === true,
                orderData: items,
                status: 'PROCESSING'
            }
        });

        return NextResponse.json({ success: true, localState });

    } catch (error: any) {
        console.error("Order Update Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
