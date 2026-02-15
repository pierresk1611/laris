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

        // 2. Fetch Raw Orders from Woo (Parallel)
        // We fetch 'processing' orders as they are candidates for printing
        const rawOrderFetchPromises = shops.map(async (shop) => {
            try {
                const rawUrl = (shop.url || "").toString().trim();
                const rawCk = (shop.ck || "").toString().trim();
                const rawCs = (shop.cs || "").toString().trim();

                if (!rawUrl || !rawCk || !rawCs) return { shop, rawOrders: [] };

                const baseUrl = rawUrl.replace(/\/$/, "");
                const apiUrl = `${baseUrl}/wp-json/wc/v3/orders?consumer_key=${rawCk}&consumer_secret=${rawCs}&per_page=${limit}&status=processing`;

                const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Laris-PWA/1.0' } });
                if (!res.ok) return { shop, rawOrders: [] };

                const rawOrders = await res.json();
                if (!Array.isArray(rawOrders)) return { shop, rawOrders: [] };

                return { shop, rawOrders };
            } catch (e) {
                console.error(`Failed to fetch from shop ${shop.name}`, e);
                return { shop, rawOrders: [] };
            }
        });

        const fetchedShopOrders = await Promise.all(rawOrderFetchPromises);

        // 3. Preliminary gathering of IDs to fetch Local States
        // We need to know which orders we have to fetch their local state
        // BUT processOrders needs the local state to decide whether to use "Verified Data".
        // So we need to fetch local states based on the RAW IDs first.

        const allPotentialOrderIds: string[] = [];
        fetchedShopOrders.forEach(({ rawOrders }) => {
            rawOrders.forEach((o: any) => {
                if (o.id) allPotentialOrderIds.push(o.id.toString());
            });
        });

        const localStates: any[] = await (prisma as any).localOrderState.findMany({
            where: {
                orderId: { in: allPotentialOrderIds }
            }
        });

        const stateMap = new Map();
        localStates.forEach((s: any) => {
            stateMap.set(`${s.shopId}-${s.orderId}`, s);
        });

        // 4. Process Orders with Local State Map
        const finalOrdersPromise = fetchedShopOrders.map(async ({ shop, rawOrders }) => {
            return processOrders(rawOrders, shop.url, shop.name, shop.id, stateMap);
        });

        const processedResults = await Promise.all(finalOrdersPromise);
        let finalOrders: ProcessedOrder[] = processedResults.flat();

        // 5. Final Filtering (e.g. only READY_FOR_PRINT)
        finalOrders = finalOrders.filter(o => {
            const localState = stateMap.get(`${o.shopId}-${o.id}`);
            const status = localState?.status || 'PROCESSING';
            return status === 'READY_FOR_PRINT';
        });

        // Add Local Data (format, note) to the final object if not already present in processed items
        finalOrders = finalOrders.map(o => {
            const localState = stateMap.get(`${o.shopId}-${o.id}`);
            return {
                ...o,
                localStatus: localState?.status || 'PROCESSING',
                sheetFormat: localState?.sheetFormat || 'SRA3',
                note: localState?.note || null
            };
        });

        return NextResponse.json({ success: true, orders: finalOrders });

    } catch (error: any) {
        console.error("Print Orders API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
