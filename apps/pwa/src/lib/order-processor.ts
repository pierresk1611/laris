import { prisma } from '@/lib/prisma';
import { extractTemplateKey, parseEPO, needsInvitation, parseItemQuantities, extractCRMId } from './parser';

export interface ProcessedItem {
    id: number;
    name: string;
    price: string;
    quantity: number;
    templateKey: string | null;
    templateId: string | null;
    hasInvitation: boolean;
    material: string | null;
    options: Record<string, any>;
    rawMetaData: any[];
    downloads?: { label: string; url: string; name: string }[];
    isVerified?: boolean;
    isSplitItem?: boolean; // Flag to indicate generated item
}

export interface ProcessedOrder {
    id: number;
    number: string;
    crmId: string | null; // NEW: CRM ID
    status: string;
    customer: string;
    total: string;
    currency: string;
    date: string;
    shopSource: string;
    shopName: string;
    shopId: string;
    items: ProcessedItem[];
}

/**
 * Enriches raw WooCommerce orders with template information and modified metadata.
 */
export async function processOrders(rawOrders: any[], shopSource: string, shopName: string, shopId: string, localStatesMap?: Map<string, any>): Promise<ProcessedOrder[]> {
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

        const templateMap = new Map(templates.map((t: any) => [
            t.key?.toUpperCase() || "UNKNOWN",
            { id: t.id, isVerified: t.isVerified }
        ]));

        return rawOrders.map(order => {
            try {
                if (!order || typeof order !== 'object') {
                    throw new Error("Order data is not an object");
                }

                // CHECK FOR VERIFIED LOCAL DATA FIRST
                const localKey = `${shopId}-${order.id}`;
                const localState = localStatesMap?.get(localKey);

                if (localState && localState.isVerified && localState.orderData) {
                    // Return the verified data directly!
                    // We trust the local data completely for the items structure.
                    // However, we might want to keep some dynamic fields from Woo like current Status if needed?
                    // Implementation Plan said: "Updates from Woo ... will be ignored in favor of locally saved data" for CONTENT.
                    // But maybe we still want to update Status (e.g. Cancelled)?
                    // For now, let's mix: Base info from Woo (status, total), Items from Local.

                    const verifiedItems = localState.orderData as ProcessedItem[];

                    return {
                        id: order.id || 0,
                        number: order.number?.toString() || order.id?.toString() || "0000",
                        crmId: extractCRMId(order.meta_data || []), // Keep pulling CRM ID dynamically or use saved? Let's use dynamic to be safe, or saved if we want strict lock.
                        // Let's stick to dynamic for Order Level Metadata, but LOCKED for Item Content.
                        status: order.status || 'unknown', // Allow status updates from Woo (e.g. Cancelled)
                        customer: (() => {
                            const billName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim();
                            if (billName) return billName;
                            return "Bez mena";
                        })(),
                        total: order.total || "0",
                        currency: order.currency || "EUR",
                        date: order.date_created || new Date().toISOString(),
                        shopSource: shopName, // Use passed shop name
                        shopName: shopName,
                        shopId: shopId,
                        items: verifiedItems // USED VERIFIED ITEMS
                    };
                }

                const crmId = extractCRMId(order.meta_data || []);

                // Use flatMap to allow splitting items
                const items = (order.line_items || []).flatMap((item: any) => {
                    if (!item) return [];

                    const templateKey = extractTemplateKey(item.name || "");
                    const templateInfo = templateKey ? templateMap.get(templateKey) : null;
                    const metaData = item.meta_data || [];
                    const epo = parseEPO(metaData);

                    // Smart Quantity Parsing
                    const quantities = parseItemQuantities(metaData, item.quantity || 1);

                    const baseItem = {
                        id: item.id || 0,
                        name: item.name || "Neznáma položka",
                        price: item.price || "0",
                        templateKey,
                        templateId: templateInfo?.id || null,
                        hasInvitation: needsInvitation(item.name || "", metaData),
                        material: epo.material || null,
                        options: epo,
                        rawMetaData: metaData || [],
                        downloads: (epo as any).downloads || [],
                        isVerified: templateInfo?.isVerified || false
                    };

                    const resultItems: ProcessedItem[] = [];

                    // 1. Main Item
                    if (quantities.main > 0) {
                        resultItems.push({
                            ...baseItem,
                            quantity: quantities.main,
                            isSplitItem: false
                        });
                    }

                    // 2. Invitation Item (if detected)
                    if (quantities.invitations > 0) {
                        resultItems.push({
                            ...baseItem,
                            id: (item.id || 0) + 999000, // Fake ID to avoid key collision
                            name: `Pozvánka k stolu (${item.name})`,
                            quantity: quantities.invitations,
                            templateKey: null, // Invitation usually has diff template
                            templateId: null,
                            hasInvitation: false, // It IS an invitation
                            isSplitItem: true,
                            material: epo.material // Usually same paper
                        });
                    }

                    // 3. Envelopes (optional, maybe not needed for print but good to have)
                    // We don't print envelopes usually? Let's skip adding them to Print List for now unless requested.

                    return resultItems;
                });

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
                    crmId,
                    status: order.status || 'unknown',
                    customer: (() => {
                        const billName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim();
                        if (billName) return billName;

                        const shipName = `${order.shipping?.first_name || ''} ${order.shipping?.last_name || ''}`.trim();
                        if (shipName) return shipName;

                        const billCompany = (order.billing?.company || '').trim();
                        if (billCompany) return billCompany;

                        return "Bez mena";
                    })(),
                    total: order.total || "0",
                    currency: order.currency || "EUR",
                    date: order.date_created || new Date().toISOString(),
                    shopSource: cleanSource,
                    shopName: shopName || cleanSource,
                    shopId: shopId || "",
                    items
                };
            } catch (innerErr: any) {
                console.error("Single order processing error:", innerErr);
                return {
                    id: order?.id || 0,
                    number: "ERROR",
                    crmId: null,
                    status: "error",
                    customer: `CHYBA: ${innerErr.message || 'Neznáma chyba v procesore'}`,
                    total: "0",
                    currency: "EUR",
                    date: new Date().toISOString(),
                    shopSource: "Môj E-shop",
                    shopName: shopName || "Môj E-shop",
                    shopId: shopId || "",
                    items: []
                };
            }
        });
    } catch (globalErr: any) {
        console.error("Global processOrders error:", globalErr);
        return [];
    }
}
