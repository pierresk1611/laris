import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const API_VERSION = "v1.0.2-defensive";
    console.log(`[WooCommerce API ${API_VERSION}] Incoming request`);

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
            return NextResponse.json({
                success: false,
                orders: [],
                error: "Shop not found in database",
                api_version: API_VERSION
            }, { status: 404 });
        }

        // Defensive extraction
        const rawUrl = (shop.url || "").toString().trim();
        const rawCk = (shop.ck || "").toString().trim();
        const rawCs = (shop.cs || "").toString().trim();

        console.log('WooCommerce API Debug:', {
            id: shop.id,
            url: rawUrl,
            ck_len: rawCk.length,
            cs_len: rawCs.length
        });

        // 1. URL Validation
        if (!rawUrl || rawUrl === "" || rawUrl === "/" || !rawUrl.startsWith("http")) {
            return NextResponse.json({
                success: false,
                orders: [],
                error: "Validation Error",
                details: `Shop configuration incomplete or URL invalid. Detected: "${rawUrl}" (Must start with http:// or https://)`,
                api_version: API_VERSION
            }, { status: 400 });
        }

        // 2. Keys Validation
        if (!rawCk || !rawCs) {
            return NextResponse.json({
                success: false,
                orders: [],
                error: "Validation Error",
                details: "Shop configuration incomplete (Consumer Key or Secret missing in database).",
                api_version: API_VERSION
            }, { status: 400 });
        }

        // 3. Construct URL
        const baseUrl = rawUrl.replace(/\/$/, "");
        const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${rawCk}&consumer_secret=${rawCs}&per_page=10`;

        console.log('WooCommerce API: Fetching from:', apiUrl.replace(rawCk, '***').replace(rawCs, '***'));

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

        // Construct a masked URL for the error response
        const maskedUrl = (typeof apiUrl !== 'undefined')
            ? apiUrl.replace(/consumer_key=[^&]+/, 'consumer_key=***').replace(/consumer_secret=[^&]+/, 'consumer_secret=***')
            : 'URL not constructed';

        return NextResponse.json({
            success: false,
            error: "Failed to fetch orders from WooCommerce",
            details: error.message,
            masked_url: maskedUrl,
            api_version: API_VERSION
        }, { status: 500 });
    }
}
