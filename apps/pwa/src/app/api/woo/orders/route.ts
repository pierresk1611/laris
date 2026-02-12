import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shopId = searchParams.get('shopId');

        let shop;
        if (shopId) {
            shop = await prisma.shop.findUnique({ where: { id: shopId } });
        } else {
            shop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });
        }

        if (!shop) {
            return NextResponse.json({ success: true, orders: [] });
        }

        // Validation: If shop is empty or missing credentials
        if (!shop.url || !shop.ck || !shop.cs) {
            return NextResponse.json({
                success: true,
                orders: [],
                message: "Shop configuration incomplete (URL or Keys missing)"
            });
        }

        // Remove trailing slash if present
        const baseUrl = shop.url.replace(/\/$/, "");
        const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=10`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`WooCommerce API error: ${response.statusText}`);
        }

        const orders = await response.json();

        // Transform WooCommerce orders
        const transformedOrders = orders.map((order: any) => ({
            id: order.id,
            number: order.number,
            status: order.status,
            customer: `${order.billing.first_name} ${order.billing.last_name}`,
            total: order.total,
            currency: order.currency,
            date: order.date_created,
            items: order.line_items.map((item: any) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            }))
        }));

        return NextResponse.json({ success: true, orders: transformedOrders });
    } catch (error: any) {
        console.error("WooCommerce fetch error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to fetch orders from WooCommerce",
            details: error.message
        }, { status: 500 });
    }
}
