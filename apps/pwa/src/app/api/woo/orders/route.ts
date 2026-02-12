import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const shops = await prisma.shop.findMany();
        if (shops.length === 0) {
            return NextResponse.json({ success: true, orders: [] });
        }

        // For now, fetch from the first configured shop
        const shop = shops[0];

        // Remove trailing slash if present
        const baseUrl = shop.url.replace(/\/$/, "");
        const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=10`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`WooCommerce API error: ${response.statusText}`);
        }

        const orders = await response.json();

        // Transform WooCommerce orders if needed
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
            error: error.message || "Failed to fetch orders from WooCommerce"
        }, { status: 500 });
    }
}
