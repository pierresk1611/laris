import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        console.log("[SyncProducts] Fetching settings...");

        // Use the same WooCommerce keys as the orders API or try to get them
        const ck = await getSetting('WOO_KEY');
        const cs = await getSetting('WOO_SECRET');
        const urlRaw = await getSetting('WOO_URL');

        // Fallback to active shop if settings not directly available
        let finalUrl = urlRaw;
        let finalCk = ck;
        let finalCs = cs;

        if (!finalCk || !finalCs || !finalUrl) {
            // @ts-ignore
            const shop = await prisma.shop.findFirst();
            if (!shop) {
                return NextResponse.json({ success: false, error: 'Chýbajú WooCommerce kľúče (ck/cs) a žiadny e-shop nie je nastavený.' }, { status: 400 });
            }
            finalUrl = shop.url;
            finalCk = shop.ck;
            finalCs = shop.cs;
        }

        const baseUrl = finalUrl?.endsWith('/') ? finalUrl.slice(0, -1) : finalUrl;

        console.log(`[SyncProducts] Fetching from ${baseUrl}...`);

        let page = 1;
        let totalFetched = 0;
        let hasMore = true;
        const productsToUpsert: any[] = [];

        while (hasMore) {
            const endpoint = `${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${finalCk}&consumer_secret=${finalCs}`;
            const res = await fetch(endpoint);

            if (!res.ok) {
                console.error(`[SyncProducts] API Error: ${res.status} ${res.statusText}`);
                break;
            }

            const products = await res.json();

            if (products.length === 0) {
                hasMore = false;
                break;
            }

            for (const p of products) {
                productsToUpsert.push({
                    title: p.name || p.title,
                    permalink: p.permalink,
                    sku: p.sku || null
                });
            }

            totalFetched += products.length;
            page++;

            // Safety limit (e.g. max 50 pages = 5000 products)
            if (page > 50) break;
        }

        console.log(`[SyncProducts] Fetched ${totalFetched} products. Saving to database...`);

        // Clear existing and insert new (simplest sync strategy for this lookup table)
        // @ts-ignore
        await prisma.webProduct.deleteMany({});

        // Prisma createMany does not return the created objects but it's much faster
        // @ts-ignore
        const result = await prisma.webProduct.createMany({
            data: productsToUpsert
        });

        return NextResponse.json({
            success: true,
            message: `Úspešne synchronizovaných ${result.count} produktov z webu.`,
            count: result.count
        });

    } catch (error: any) {
        console.error("[SyncProducts] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
