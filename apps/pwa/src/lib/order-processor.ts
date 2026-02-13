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
    items: ProcessedItem[];
}

/**
 * Enriches raw WooCommerce orders with template information and metadata.
 */
export async function processOrders(rawOrders: any[]): Promise<ProcessedOrder[]> {
    // 1. Pre-fetch all active templates to avoid N+1 queries
    const templates = await prisma.template.findMany({
        where: { status: 'ACTIVE' }
    });

    // Create a map for fast lookup
    const templateMap = new Map(templates.map((t: { key: string; id: string }) => [t.key.toUpperCase(), t.id]));

    return rawOrders.map(order => {
        const items = order.line_items.map((item: any) => {
            const templateKey = extractTemplateKey(item.name);
            const templateId = templateKey ? templateMap.get(templateKey) || null : null;
            const metaData = item.meta_data || [];
            const epo = parseEPO(metaData);

            return {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                templateKey,
                templateId,
                hasInvitation: needsInvitation(item.name, metaData),
                material: epo.material || null,
                options: epo
            };
        });

        return {
            id: order.id,
            number: order.number,
            status: order.status,
            customer: `${order.billing.first_name} ${order.billing.last_name}`,
            total: order.total,
            currency: order.currency,
            date: order.date_created,
            items
        };
    });
}
