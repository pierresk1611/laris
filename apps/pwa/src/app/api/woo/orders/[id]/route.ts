import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processOrders } from '@/lib/order-processor';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const orderId = params.id;
    let shop;
    let apiUrl: string | undefined;

    try {
        // For now, use the first/default shop. 
        // In the future, we might want to store which shop an order belongs to in our DB.
        shop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });

        if (!shop) {
            return NextResponse.json({ success: false, error: "Shop not configured" }, { status: 404 });
        }

        const rawUrl = (shop.url || "").toString().trim();
        const rawCk = (shop.ck || "").toString().trim();
        const rawCs = (shop.cs || "").toString().trim();

        const baseUrl = rawUrl.replace(/\/$/, "");
        apiUrl = `${baseUrl}/wp-json/wc/v3/orders/${orderId}?consumer_key=${rawCk}&consumer_secret=${rawCs}`;

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Laris-PWA/1.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`WooCommerce API error: ${response.statusText}`);
        }

        const order = await response.json();

        // Use our processor (wrap in array because processOrders expects an array)
        const processed = await processOrders([order], shop.url);

        return NextResponse.json({ success: true, order: processed[0] });

    } catch (error: any) {
        console.error("Single order fetch error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch order",
            details: error.message
        }, { status: 500 });
    }
}
