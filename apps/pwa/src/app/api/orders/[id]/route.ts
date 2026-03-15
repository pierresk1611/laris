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

        // --- AI Pattern Auto-Learning ---
        // If the user modified the AI extracted text (body !== originalBody), save it as a pattern
        for (const item of items) {
            if (item.aiData && item.aiData.originalBody && item.aiData.body) {
                if (item.aiData.originalBody.trim() !== item.aiData.body.trim()) {
                    try {
                        // Store the original snippet we sent to AI, and the expected output the user just corrected

                        const inputStr = `names: ${item.aiData.names || ""}\ndate: ${item.aiData.date || ""}\nlocation: ${item.aiData.location || ""}\nbody: ${item.aiData.originalBody}`;

                        // Let's form the expected corrected output
                        const expectedOutput = {
                            names: item.aiData.names || "",
                            date: item.aiData.date || "",
                            location: item.aiData.location || "",
                            body: item.aiData.body // The corrected version
                        };

                        await (prisma as any).aiPattern.create({
                            data: {
                                input: inputStr,
                                output: expectedOutput
                            }
                        });
                        console.log(`[AI Learning] Saved user correction for order ${id}, item ${item.id}`);
                    } catch (e) {
                        console.error("[AI Learning] Failed to save pattern:", e);
                    }
                }
            }
        }
        // --------------------------------

        return NextResponse.json({ success: true, localState });

    } catch (error: any) {
        console.error("Order Update Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
