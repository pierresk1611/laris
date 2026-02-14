import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processOrders, ProcessedOrder } from '@/lib/order-processor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '50';

        // 1. Fetch ALL shops
        const shops = await prisma.shop.findMany();
        if (shops.length === 0) {
            return NextResponse.json({ success: true, orders: [] });
        }

        // 2. Fetch Orders from Woo (Parallel)
        // We fetch 'processing' orders as they are candidates for printing
        const orderPromises = shops.map(async (shop) => {
            try {
                const rawUrl = (shop.url || "").toString().trim();
                const rawCk = (shop.ck || "").toString().trim();
                const rawCs = (shop.cs || "").toString().trim();

                if (!rawUrl || !rawCk || !rawCs) return [];

                const baseUrl = rawUrl.replace(/\/$/, "");
                const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${rawCk}&consumer_secret=${rawCs}&per_page=${limit}&status=processing`;

                const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Laris-PWA/1.0' } });
                if (!res.ok) return [];

                const rawOrders = await res.json();
                if (!Array.isArray(rawOrders)) return [];

                return processOrders(rawOrders, shop.url, shop.name, shop.id);
            } catch (e) {
                console.error(`Failed to fetch from shop ${shop.name}`, e);
                return [];
            }
        });

        const results = await Promise.all(orderPromises);
        let allOrders: ProcessedOrder[] = results.flat();

        // 3. Fetch Local States
        // Let's get all local states for these remote orders
        const orderIds = allOrders.map(o => o.id.toString());
        const localStates = await prisma.localOrderState.findMany({
            where: {
                orderId: { in: orderIds }
            }
        });

        const stateMap = new Map(localStates.map(s => [`${s.shopId}-${s.orderId}`, s]));

        // 4. Transform and Filter
        const finalOrders = allOrders.map(order => {
            const localState = stateMap.get(`${order.shopId}-${order.id}`);
            return {
                ...order,
                localStatus: localState?.status || 'PROCESSING', // Default to PROCESSING if no record
                note: localState?.note || null
            };
        }).filter(o => o.localStatus === 'READY_FOR_PRINT'); // ONLY show approved orders

        // Optional: Filter by local status if requested
        // const statusFilter = searchParams.get('localStatus');
        // if (statusFilter) {
        //     finalOrders = finalOrders.filter(o => o.localStatus === statusFilter);
        // }

        return NextResponse.json({ success: true, orders: finalOrders });

    } catch (error: any) {
        console.error("Print Orders API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
