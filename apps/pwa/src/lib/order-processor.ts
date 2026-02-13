import { prisma } from '@/lib/prisma';
import { extractTemplateKey, parseEPO, needsInvitation } from './parser';

export interface ProcessedItem {
    id: number;
    name: string;
    price: string;
    quantity: number;
    templateKey: string | null;
    templateId: string | null;
    hasInvitation: boolean;
    material: string | null;
    options: any;
}

export interface ProcessedOrder {
    id: number;
    number: string;
    status: string;
    customer: string;
    total: string;
    currency: string;
    date: string;
    shopSource: string;
    shopName: string;
    items: ProcessedItem[];
}

/**
 * Enriches raw WooCommerce orders with template information and metadata.
 */
export async function processOrders(rawOrders: any[], shopSource: string, shopName: string): Promise<ProcessedOrder[]> {
    try {
        if (!Array.isArray(rawOrders)) {
            console.error("processOrders: rawOrders is not an array:", rawOrders);
            return [];
        }

        // 1. Pre-fetch all active templates to avoid N+1 queries
        // Use a safe wrapper to prevent database issues from killing the whole page
        const templates = await prisma.template.findMany({
            where: { status: 'ACTIVE' }
        }).catch((err: any) => {
            console.error("Prisma Templates fetch error:", err);
            return []; // Fail gracefully with no templates
        });

        // Create a map for fast lookup
        const templateMap = new Map(templates.map((t: any) => [t.key?.toUpperCase() || "UNKNOWN", t.id]));

        return rawOrders.map(order => {
            try {
                if (!order) throw new Error("Order object is null or undefined");

                const items = (order.line_items || []).map((item: any) => {
                    const templateKey = extractTemplateKey(item.name || "");
                    const templateId = templateKey ? templateMap.get(templateKey) || null : null;
                    const metaData = item.meta_data || [];
                    const epo = parseEPO(metaData);

                    return {
                        id: item.id || 0,
                        name: item.name || "Neznáma položka",
                        price: item.price || "0",
                        quantity: item.quantity || 1,
                        templateKey,
                        templateId,
                        hasInvitation: needsInvitation(item.name || "", metaData),
                        material: epo.material || null,
                        options: epo
                    };
                });

                // Robust Shop Name / Hostname extraction
                const cleanSource = (() => {
                    const s = (shopSource || "").toLowerCase().trim();
                    if (!s || s === "url" || s.includes("woocommerce") || s.includes("localhost")) {
                        return "Môj E-shop";
                    }
                    try {
                        const url = new URL(shopSource.startsWith('http') ? shopSource : `https://${shopSource}`);
                        return url.hostname.replace('www.', '');
                    } catch (e) {
                        return shopSource;
                    }
                })();

                return {
                    id: order.id,
                    number: order.number?.toString() || order.id?.toString() || "N/A",
                    status: order.status || 'unknown',
                    customer: order.billing
                        ? `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() || "Bez mena"
                        : "Bez mena",
                    total: order.total || "0",
                    currency: order.currency || "EUR",
                    date: order.date_created || new Date().toISOString(),
                    shopSource: cleanSource,
                    shopName: shopName || cleanSource,
                    items
                };
            } catch (err: any) {
                console.error("Single order processing error:", err, order);
                return {
                    id: order?.id || 0,
                    number: "ERROR",
                    status: "error",
                    customer: `CHYBA: ${err.message}`, // Diagnostic visible in UI
                    total: "0",
                    currency: "EUR",
                    date: new Date().toISOString(),
                    shopSource: "Môj E-shop",
                    shopName: shopName || "Môj E-shop",
                    items: []
                };
            }
        });
    } catch (globalErr: any) {
        console.error("Global processOrders error:", globalErr);
        // We still want to return an empty array if everything fails globally
        return [];
    }
}
