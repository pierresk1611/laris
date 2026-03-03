import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateProgress } from '@/lib/settings';

export const dynamic = 'force-dynamic';
// We still max out Vercel just in case
export const maxDuration = 300;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: any, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            if (res.status === 404) return res; // Non-retryable
            console.warn(`Attempt ${i + 1} failed for ${url}: ${res.statusText}`);
        } catch (err: any) {
            console.warn(`Attempt ${i + 1} threw error for ${url}: ${err.message}`);
        }
        await sleep(1000 * (i + 1)); // Exponential backoff
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function fetchWooCommercePage(baseUrl: string, endpoint: string, ck: string, cs: string, page: number, perPage: number = 20) {
    const url = `${baseUrl}/wp-json/wc/v3/${endpoint}?consumer_key=${ck}&consumer_secret=${cs}&per_page=${perPage}&page=${page}`;
    const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'Laris-PWA/1.0', 'Accept': 'application/json' } });

    if (!res.ok) {
        throw new Error(`WooCommerce API Error for ${url}: ${res.statusText}`);
    }

    const totalPagesHeader = res.headers.get('x-wp-totalpages');
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
    const data = await res.json();
    return { data, totalPages };
}

async function upsertWebProducts(items: any[], shopId: string, shopName: string) {
    let count = 0;
    for (const item of items) {
        const sku = item.sku || '';
        const title = item.name || '';
        if (!sku && !title) continue;

        const permalink = item.permalink || '';
        const imageUrl = item.images && item.images.length > 0 ? item.images[0].src : (item.image?.src || null);

        const existing = await prisma.webProduct.findFirst({
            where: {
                shopId: shopId,
                OR: [
                    sku ? { sku: sku } : undefined,
                    { title: title }
                ].filter(Boolean) as any
            }
        });

        let templateId = null;
        let matchConfidence = null;

        if (sku) {
            const template = await prisma.template.findUnique({ where: { sku: sku } });
            if (template) {
                templateId = template.id;
                matchConfidence = 1.0;
            }
        }

        if (existing) {
            await prisma.webProduct.update({
                where: { id: existing.id },
                data: {
                    title: title || existing.title,
                    sku: sku || existing.sku,
                    imageUrl: imageUrl || existing.imageUrl,
                    permalink: permalink || existing.permalink,
                    shopId: shopId,
                    shopName: shopName,
                    templateId: templateId || existing.templateId,
                    matchConfidence: matchConfidence || existing.matchConfidence
                }
            });
        } else {
            await prisma.webProduct.create({
                data: {
                    shopId: shopId,
                    shopName: shopName,
                    title: title,
                    sku: sku,
                    imageUrl: imageUrl,
                    permalink: permalink,
                    templateId: templateId,
                    matchConfidence: matchConfidence
                }
            });
        }
        count++;
    }
    return count;
}

// Background Job Function
async function runSync(shop: any) {
    const rawUrl = (shop.url || "").toString().trim();
    const baseUrl = rawUrl.replace(/\/$/, "");
    const perPage = 20; // Chunk size
    let upsertedCount = 0;

    try {
        await updateProgress('CATALOG_SYNC', 2, 100, 'Zisťujem veľkosť katalógu...');

        // 1. Initial fetch to get total pages
        const { totalPages } = await fetchWooCommercePage(baseUrl, 'products', shop.ck, shop.cs, 1, perPage);

        // Ensure we don't divide by zero
        const safeTotalPages = Math.max(1, totalPages);

        for (let page = 1; page <= safeTotalPages; page++) {
            const percentage = Math.floor((page / safeTotalPages) * 90) + 5; // Reserve 5% at start, 5% at end
            await updateProgress('CATALOG_SYNC', percentage, 100, `Sťahujem stranu ${page} z ${safeTotalPages}...`);

            // Fetch Products
            const { data: products } = await fetchWooCommercePage(baseUrl, 'products', shop.ck, shop.cs, page, perPage);
            if (!Array.isArray(products) || products.length === 0) break;

            // Fetch Variations for Variable products on this page
            const variableProducts = products.filter((p: any) => p.type === 'variable');
            let variations: any[] = [];

            for (const vp of variableProducts) {
                // If it's a huge product, we might need variation pagination too, but usually it's <100
                const vpRes = await fetchWithRetry(`${baseUrl}/wp-json/wc/v3/products/${vp.id}/variations?consumer_key=${shop.ck}&consumer_secret=${shop.cs}&per_page=100`, { headers: { 'User-Agent': 'Laris-PWA/1.0', 'Accept': 'application/json' } });
                if (vpRes.ok) {
                    const vpData = await vpRes.json();
                    if (Array.isArray(vpData)) variations = variations.concat(vpData);
                }
            }

            const allPageItems = [...products, ...variations];

            // Save immediately chunk-by-chunk
            const chunkCount = await upsertWebProducts(allPageItems, shop.id, shop.name || "E-shop");
            upsertedCount += chunkCount;
        }

        await updateProgress('CATALOG_SYNC', 100, 100, `Hotovo! Uložených ${upsertedCount} položiek.`, 'DONE');
        console.log(`[Job Success] Catalog sync finished. Upserted ${upsertedCount} items.`);
    } catch (e: any) {
        console.error("[Job Error] Catalog sync failed:", e);
        await updateProgress('CATALOG_SYNC', 0, 100, `Chyba: ${e.message}`, 'ERROR');
    }
}

export async function POST(request: Request) {
    try {
        // Kick off progress tracking immediately
        await updateProgress('CATALOG_SYNC', 0, 100, 'Inicializácia pozadia...');

        const shop = await prisma.shop.findFirst({ orderBy: { createdAt: 'desc' } });
        if (!shop) {
            return NextResponse.json({ success: false, error: "Shop not configured" }, { status: 400 });
        }

        // FIRE AND FORGET: Execute in background
        runSync(shop).catch(console.error);

        // Return 200 immediately to prevent Vercel Timeout on the browser UI
        return NextResponse.json({ success: true, message: "Job started in background" });
    } catch (e: any) {
        console.error("API route trigger error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
