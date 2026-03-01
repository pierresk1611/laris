import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateProgress } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes

async function fetchWooCommerce(baseUrl: string, endpoint: string, ck: string, cs: string) {
    let allData: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const url = `${baseUrl}/wp-json/wc/v3/${endpoint}?consumer_key=${ck}&consumer_secret=${cs}&per_page=${perPage}&page=${page}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Laris-PWA/1.0', 'Accept': 'application/json' } });

        if (!res.ok) {
            console.error(`WooCommerce API Error for ${url}:`, res.statusText);
            break;
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        allData = allData.concat(data);

        // Safety limit (e.g. max 20 pages = 2000 items) to prevent infinite loops
        if (page >= 20 || data.length < perPage) {
            break;
        }
        page++;
    }

    return allData;
}

export async function POST(request: Request) {
    try {
        await updateProgress('CATALOG_SYNC', 0, 100, 'Inicializácia synchronizácie...');

        const shop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });
        if (!shop) {
            return NextResponse.json({ success: false, error: "Shop not configured" }, { status: 400 });
        }

        const rawUrl = (shop.url || "").toString().trim();
        const baseUrl = rawUrl.replace(/\/$/, "");

        await updateProgress('CATALOG_SYNC', 10, 100, 'Sťahujem produkty z WooCommerce...');

        // 1. Fetch main products
        const products = await fetchWooCommerce(baseUrl, 'products', shop.ck, shop.cs);

        await updateProgress('CATALOG_SYNC', 40, 100, `Spracovávam ${products.length} produktov...`);

        // 2. Fetch variations for variable products
        const variableProducts = products.filter(p => p.type === 'variable');
        let variations: any[] = [];

        let i = 0;
        for (const vp of variableProducts) {
            i++;
            if (i % 5 === 0) {
                await updateProgress('CATALOG_SYNC', 40 + Math.floor((i / variableProducts.length) * 30), 100, `Sťahujem variácie (${i}/${variableProducts.length})...`);
            }
            const prodVariations = await fetchWooCommerce(baseUrl, `products/${vp.id}/variations`, shop.ck, shop.cs);
            variations = variations.concat(prodVariations);
        }

        const allItems = [...products, ...variations];

        await updateProgress('CATALOG_SYNC', 80, 100, `Ukladám ${allItems.length} produktov a variácií do databázy...`);

        // 3. Upsert into database
        let upsertedCount = 0;
        for (const item of allItems) {
            // Ignore products without SKU or Title if they don't have enough data to map
            const sku = item.sku || '';
            const title = item.name || '';
            if (!sku && !title) continue;

            const permalink = item.permalink || '';
            const imageUrl = item.images && item.images.length > 0 ? item.images[0].src : (item.image?.src || null);

            // Use a unique composite or unique SKU?
            // The DB currently doesn't have a unique constraint on WebProduct.sku, so we can findFirst by SKU.
            // But variations might have the same SKU as parent if configured poorly.
            // Better to match by WooCommerce ID if we had it, but we don't store it yet.
            // Let's match by SKU because that's our mapping key.

            const existing = await prisma.webProduct.findFirst({
                where: {
                    shopId: shop.id,
                    OR: [
                        sku ? { sku: sku } : undefined,
                        { title: title }
                    ].filter(Boolean) as any
                }
            });

            if (existing) {
                // Update non-destructive fields
                await prisma.webProduct.update({
                    where: { id: existing.id },
                    data: {
                        title: title || existing.title,
                        sku: sku || existing.sku,
                        imageUrl: imageUrl || existing.imageUrl,
                        permalink: permalink || existing.permalink
                    }
                });
            } else {
                await prisma.webProduct.create({
                    data: {
                        shopId: shop.id,
                        shopName: shop.name || "E-shop",
                        title: title,
                        sku: sku,
                        imageUrl: imageUrl,
                        permalink: permalink
                    }
                });
            }
            upsertedCount++;
        }

        await updateProgress('CATALOG_SYNC', 100, 100, `Hotovo! Synchronizovaných ${upsertedCount} položiek.`);

        return NextResponse.json({ success: true, count: upsertedCount });
    } catch (e: any) {
        console.error("Catalog sync error:", e);
        await updateProgress('CATALOG_SYNC', 0, 100, `Chyba: ${e.message}`);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
