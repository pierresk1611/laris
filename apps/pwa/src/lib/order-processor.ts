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
        if (!rawOrders || !Array.isArray(rawOrders)) {
            return [];
        }

        // 1. Pre-fetch all active templates
        const templates = await prisma.template.findMany({
            where: { status: 'ACTIVE' }
        }).catch((err: any) => {
            console.error("Prisma Templates fetch error:", err);
            return [];
        });

        const templateMap = new Map(templates.map((t: any) => [t.key?.toUpperCase() || "UNKNOWN", t.id]));

        return rawOrders.map(order => {
            try {
                if (!order || typeof order !== 'object') {
                    throw new Error("Order data is not an object");
                }

                const items = (order.line_items || []).map((item: any) => {
                    if (!item) return null;
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
                }).filter((i: any) => i !== null);

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
                    id: order.id || 0,
                    number: order.number?.toString() || order.id?.toString() || "0000",
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
            } catch (innerErr: any) {
                console.error("Single order processing error:", innerErr);
                return {
                    id: order?.id || 0,
                    number: "ERROR",
                    status: "error",
                    customer: `CHYBA: ${innerErr.message || 'Neznáma chyba v procesore'}`,
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
        return [];
    }
}
