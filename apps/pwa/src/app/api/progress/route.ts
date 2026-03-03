import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export async function GET(req: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            const poll = async () => {
                try {
                    const [
                        sync,
                        ai,
                        bulk,
                        wooSync,
                        wooProducts,
                        templateScan
                    ] = await Promise.all([
                        getSetting('SYNC_PROGRESS'),
                        getSetting('AI_ANALYSIS_PROGRESS'),
                        getSetting('BULK_MAP_PROGRESS'),
                        getSetting('WOO_SYNC_PROGRESS'),
                        getSetting('WOO_PRODUCTS_PROGRESS'),
                        getSetting('TEMPLATE_SCAN')
                    ]);

                    const parseProgress = (json: string | null, expiryMs: number = 300000) => {
                        if (!json) return null;
                        try {
                            const data = JSON.parse(json);
                            const updatedAt = new Date(data.updatedAt);
                            if (Date.now() - updatedAt.getTime() > expiryMs) return null;
                            return data;
                        } catch (e) { return null; }
                    };

                    const syncData = parseProgress(sync);
                    const aiData = parseProgress(ai, 60000);
                    const bulkData = parseProgress(bulk);
                    const wooSyncData = parseProgress(wooSync);
                    const wooProductsData = parseProgress(wooProducts);
                    const templateScanData = parseProgress(templateScan);

                    // Send active ones
                    if (syncData) send({ type: 'CATALOG_SYNC', ...syncData });
                    if (aiData) send({ type: 'AI_ANALYSIS', ...aiData });
                    if (bulkData) send({ type: 'BULK_MAP', ...bulkData });
                    if (wooSyncData) send({ type: 'WOO_SYNC', ...wooSyncData });
                    if (wooProductsData) send({ type: 'WOO_PRODUCTS', ...wooProductsData });
                    if (templateScanData) send({ type: 'TEMPLATE_SCAN', ...templateScanData });

                } catch (e) {
                    console.error("[SSE] Poll error:", e);
                }
            };

            // Initial poll
            await poll();

            // Setup interval
            const interval = setInterval(poll, 2000);

            // Cleanup
            req.signal.addEventListener('abort', () => {
                clearInterval(interval);
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
