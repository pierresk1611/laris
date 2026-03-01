import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting, updateProgress } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const urlParams = new URL(req.url);
        const page = parseInt(urlParams.searchParams.get('page') || '1', 10);
        const isInit = urlParams.searchParams.get('init') === 'true';

        console.log(`[SyncProducts] Fetching page ${page}...`);

        // Emit initial progress if starting
        if (isInit) {
            await updateProgress('WOO_PRODUCTS_PROGRESS', 0, 100, `Inicializujem sťahovanie produktov...`);
        } else {
            // Keep alive
            await updateProgress('WOO_PRODUCTS_PROGRESS', page, 100, `Sťahujem stranu ${page} z WooCommerce...`);
        }

        const ck = await getSetting('WOO_KEY');
        const cs = await getSetting('WOO_SECRET');
        const urlRaw = await getSetting('WOO_URL');

        let finalUrl = urlRaw;
        let finalCk = ck;
        let finalCs = cs;

        if (!finalCk || !finalCs || !finalUrl) {
            // @ts-ignore
            const shop = await prisma.shop.findFirst();
            if (!shop) {
                return NextResponse.json({ success: false, error: 'Chýbajú WooCommerce kľúče.' }, { status: 400 });
            }
            finalUrl = shop.url;
            finalCk = shop.ck;
            finalCs = shop.cs;
        }

        const baseUrl = finalUrl?.endsWith('/') ? finalUrl.slice(0, -1) : finalUrl;

        // If it's the very first page, optionally clear table
        if (isInit) {
            // @ts-ignore
            await prisma.webProduct.deleteMany({});
            console.log("[SyncProducts] Cleared existing products for fresh sync");
        }

        const endpoint = `${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${finalCk}&consumer_secret=${finalCs}`;
        const res = await fetch(endpoint);

        if (!res.ok) {
            console.error(`[SyncProducts] API Error: ${res.status} ${res.statusText}`);
            return NextResponse.json({ success: false, error: `WooCommerce API Error: ${res.status}` }, { status: 500 });
        }

        const products = await res.json();
        const hasMore = products.length > 0;

        if (products.length > 0) {
            const productsToUpsert = products.map((p: any) => ({
                title: p.name || p.title,
                permalink: p.permalink,
                sku: p.sku || null
            }));

            // @ts-ignore
            const result = await prisma.webProduct.createMany({
                data: productsToUpsert
            });

            console.log(`[SyncProducts] Saved ${result.count} products from page ${page}`);
        } else {
            await updateProgress('WOO_PRODUCTS_PROGRESS', 100, 100, `Synchronizácia produktov dokončená.`, 'COMPLETED');
        }

        return NextResponse.json({
            success: true,
            hasMore: hasMore,
            nextPage: page + 1,
            count: products.length
        });

    } catch (error: any) {
        console.error("[SyncProducts] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
