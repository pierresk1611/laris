import { prisma } from '@/lib/prisma';
import { extractTemplateKey, parseEPO, needsInvitation, parseItemQuantities, extractCRMId } from './parser';

export interface ProcessedItem {
    id: number;
    name: string;
    sku: string | null;
    price: string;
    quantity: number;
    templateKey: string | null;
    templateId: string | null;
    templateStatus?: string; // NEW
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

        // 1. Pre-fetch all templates
        const templates = await prisma.template.findMany({}).catch((err: any) => {
            console.error("Prisma Templates fetch error:", err);
            return [];
        });

        interface TemplateInfo { id: string, isVerified: boolean, key: string, status: string };

        // Map by Key (Legacy/Regex fallback)
        const templateMap = new Map<string, TemplateInfo>((templates as any[]).map((t: any) => [
            t.key?.toUpperCase() || "UNKNOWN",
            { id: t.id, isVerified: t.isVerified, key: t.key, status: t.status }
        ]));

        // Map by SKU (Native/Golden Key)
        const skuMap = new Map<string, TemplateInfo>((templates as any[]).filter(t => t.sku).map((t: any) => [
            t.sku.toUpperCase(),
            { id: t.id, isVerified: t.isVerified, key: t.key, status: t.status }
        ]));

        // 2. Pre-fetch all WebProducts to utilize Smart Match logic
        const webProducts = await prisma.webProduct.findMany({
            where: { templateId: { not: null } },
            include: { template: true } // We need the template key and id
        }).catch((err: any) => {
            console.error("Prisma WebProducts fetch error:", err);
            return [];
        });

        const webProductSkuMap = new Map<string, TemplateInfo>((webProducts as any[]).filter(p => p.sku).map((p: any) => [
            p.sku.toUpperCase(),
            { id: p.template.id, isVerified: p.template.isVerified, key: p.template.key, status: p.template.status }
        ]));

        const webProductTitleMap = new Map<string, TemplateInfo>((webProducts as any[]).map((p: any) => [
            p.title.trim().toLowerCase(),
            { id: p.template.id, isVerified: p.template.isVerified, key: p.template.key, status: p.template.status }
        ]));

        const processedOrders: ProcessedOrder[] = [];
        let i = 0;

        for (const order of rawOrders) {
            i++;
            // Report progress every item
            try {
                // Inline import to avoid circular dependencies if any, or just rely on existing imports if added to top.
                // We'll import it at the top of the file in the next step, assuming it's available.
                const { updateProgress } = require('@/lib/settings');
                await updateProgress('WOO_SYNC_PROGRESS', i, rawOrders.length, `Spracovávam objednávku ${i} z ${rawOrders.length}...`);
            } catch (e) {
                // Ignore DB progress errors to not break sync
            }

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

                    processedOrders.push({
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
                    });
                    continue;
                }

                const crmId = extractCRMId(order.meta_data || []);

                // Use flatMap to allow splitting items
                const items = (order.line_items || []).flatMap((item: any) => {
                    if (!item) return [];

                    // 0. Smart Match Engine: Check WebProducts by SKU or Exact Name
                    const itemSku = (item.sku || "").toString().trim().toUpperCase();
                    const itemNameFiltered = (item.name || "").toString().trim().toLowerCase();

                    let templateInfo: TemplateInfo | null = null;

                    // A) First try WebProduct SKU map (Exact Match from shop)
                    if (itemSku) {
                        templateInfo = webProductSkuMap.get(itemSku) as any;
                    }

                    // B) Naming Convention v2: Try to match by Template SKU directly in our DB
                    if (!templateInfo && itemSku) {
                        templateInfo = skuMap.get(itemSku) || null;
                    }

                    // C) FALLBACK: If SKU failed (e.g. wrong SKU on e-shop), try extracting the key from the Product Title
                    if (!templateInfo && itemNameFiltered) {
                        const extractedKeyFromTitle = extractTemplateKey(item.name);
                        if (extractedKeyFromTitle) {
                            // Try to find it in the primary Template Key map
                            templateInfo = templateMap.get(extractedKeyFromTitle) || null;

                            // If exact match fails, do a 'includes' partial match on existing keys
                            if (!templateInfo) {
                                for (const [k, v] of templateMap.entries()) {
                                    if (k.includes(extractedKeyFromTitle)) {
                                        templateInfo = v;
                                        break;
                                    }
                                }
                            }

                            if (!templateInfo) {
                                // Try finding it in WebProduct title map as a last resort
                                templateInfo = webProductTitleMap.get(itemNameFiltered) || null;
                            }
                        }
                    }

                    // D) Extraction: Regex fallback removed to enforce 100% strict matching.
                    // If A, B, or C didn't find an exact match, the item remains unmapped.
                    let templateKey = templateInfo ? templateInfo.key : null;

                    // The original change had a redeclaration of templateInfo here.
                    // Instead, we ensure the existing templateInfo variable is correctly typed and populated.
                    // The instruction was to ensure templateInfo has a status property, which it does now
                    // because it's typed as TemplateInfo.

                    const metaData = item.meta_data || [];
                    const epo = parseEPO(metaData);

                    // Smart Quantity Parsing
                    const quantities = parseItemQuantities(metaData, item.quantity || 1);

                    const baseItem: ProcessedItem = {
                        id: item.id || 0,
                        name: item.name || "Neznáma položka",
                        sku: itemSku || null,
                        price: item.price || "0",
                        quantity: 0, // placeholder, filled later
                        templateKey,
                        templateId: templateInfo?.id || null,
                        templateStatus: templateInfo?.status,
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
                            // Under V2, Invitation shares the exact same Template ID/Key as the Oznámenie.
                            templateKey: templateKey,
                            templateId: templateInfo?.id || null,
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

                processedOrders.push({
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
                });
            } catch (innerErr: any) {
                console.error("Single order processing error:", innerErr);
                processedOrders.push({
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
                });
            }
        }
        return processedOrders;
    } catch (globalErr: any) {
        console.error("Global processOrders error:", globalErr);
        return [];
    }
}
