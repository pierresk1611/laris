import { prisma } from './prisma';
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
    items: ProcessedItem[];
}

/**
 * Enriches raw WooCommerce orders with template information and metadata.
 */
export async function processOrders(rawOrders: any[], shopSource: string): Promise<ProcessedOrder[]> {
    try {
        // 1. Pre-fetch all active templates to avoid N+1 queries
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

                return {
                    id: order.id,
                    number: order.number?.toString() || order.id?.toString(),
                    status: order.status || 'unknown',
                    customer: order.billing
                        ? `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() || "Bez mena"
                        : "Bez mena",
                    total: order.total || "0",
                    currency: order.currency || "EUR",
                    date: order.date_created || new Date().toISOString(),
                    shopSource: (() => {
                        try {
                            const url = new URL(shopSource);
                            return url.hostname.replace('www.', '');
                        } catch (e) {
                            return shopSource;
                        }
                    })(),
                    items
                };
            } catch (err: any) {
                console.error("Single order processing error:", err, order);
                // Return a "Skeleton" order instead of crashing everything
                return {
                    id: order.id || 0,
                    number: "ERROR",
                    status: "error",
                    customer: "Chyba spracovania",
                    total: "0",
                    currency: "EUR",
                    date: new Date().toISOString(),
                    shopSource: (() => {
                        try {
                            const url = new URL(shopSource);
                            return url.hostname.replace('www.', '');
                        } catch (e) {
                            return shopSource;
                        }
                    })(),
                    items: []
                };
            }
        });
    } catch (globalErr: any) {
        console.error("Global processOrders error:", globalErr);
        throw new Error(`Order Processing Failed: ${globalErr.message}`);
    }
}
