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

        // Debug logging for Vercel logs
        console.log('WooCommerce API attempt for shop:', {
            id: shop.id,
            url: shop.url,
            has_ck: !!shop.ck,
            has_cs: !!shop.cs
        });

        // Validation: If shop is empty or missing credentials
        if (!shop.url || shop.url.trim() === "" || shop.url === "/" || !shop.url.startsWith("http")) {
            return NextResponse.json({
                success: true,
                orders: [],
                message: "Shop configuration incomplete or URL invalid (must start with http:// or https://)"
            });
        }

        if (!shop.ck || !shop.cs) {
            return NextResponse.json({
                success: true,
                orders: [],
                message: "Shop configuration incomplete (Keys missing)"
            });
        }

        // Remove trailing slash if present
        const baseUrl = shop.url.trim().replace(/\/$/, "");
        const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${shop.ck.trim()}&consumer_secret=${shop.cs.trim()}&per_page=10`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`WooCommerce API error: ${response.statusText}`);
        }

        const orders = await response.json();

        // Validation: WooCommerce might return an error object instead of an array
        if (!Array.isArray(orders)) {
            console.error("WooCommerce error response:", orders);
            throw new Error(orders.message || orders.code || "WooCommerce returned an unexpected response format (not an array)");
        }

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
