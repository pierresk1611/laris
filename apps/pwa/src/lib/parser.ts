/**
 * Extracted template key from product title using Regex.
 * Example: "Pozvánka na oslavu 70. narodenín JSO 15" -> "JSO 15"
 */
export function extractTemplateKey(productName: string): string | null {
    if (!productName) return null;
    // Regex looks for common patterns like JSO 15, VSO 02, etc.
    const regex = /([A-Z]{3}\s\d{2,3})/i;
    const match = String(productName).match(regex);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Checks if the order involves an invitation to the table.
 * If yes, it should trigger the addition of _P.psd files.
 */
export function needsInvitation(productName: string, metaData: any[]): boolean {
    const safeName = String(productName || "").toLowerCase();
    const hasInvitationInTitle = safeName.includes("pozvánka k stolu");

    const hasInvitationInMeta = Array.isArray(metaData) && metaData.some(m => {
        const label = String(m?.label || "").toLowerCase();
        const value = String(m?.value || "").toLowerCase();
        return label.includes("pozvánka k stolu") || value.includes("áno");
    });

    return hasInvitationInTitle || hasInvitationInMeta;
}

/**
 * Simple parser for EPO data from WooCommerce.
 */
/**
 * EXTRACTS CRM ID from Order Meta Data.
 * User typically stores it in '_crm_id', '_order_number_formatted', or similar.
 */
export function extractCRMId(metaData: any[]): string | null {
    if (!Array.isArray(metaData)) return null;

    // Priority keys
    const keysToCheck = ['_crm_id', '_order_number_formatted', 'crm_id', 'variable_symbol'];

    for (const k of keysToCheck) {
        const found = metaData.find(m => m.key === k);
        if (found && found.value) return String(found.value);
    }

    // Fallback: Check for value containing specific format? (e.g. 2025...)
    return null;
}

/**
 * Parses EPO data to find sub-items like Invitations or Envelopes.
 * Returns a breakdown of quantities.
 */
export function parseItemQuantities(metaData: any[], defaultQty: number = 1) {
    const breakdown = {
        main: 0,
        invitations: 0,
        envelopes: 0
    };

    let mainFound = false;

    // Helper regex to grab the first number in a string "40 23,60 €" -> 40
    const extractNum = (val: string) => {
        const match = String(val).match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    };

    if (Array.isArray(metaData)) {
        metaData.forEach(meta => {
            // Check EPO Data inside _tmcartepo_data or direct meta
            let label = (meta.display_key || meta.key || meta.label || "").toLowerCase();
            let value = (meta.display_value || meta.value || "").toString();

            // Handle nested EPO
            if (meta.key === '_tmcartepo_data' && Array.isArray(meta.value)) {
                meta.value.forEach((epoItem: any) => {
                    const l = (epoItem.section_label || epoItem.name || "").toLowerCase();
                    const v = (epoItem.value || "").toString();

                    if (l.includes("počet oznámení") || l.includes("počet kusov")) {
                        const q = extractNum(v);
                        if (q > 0) { breakdown.main = q; mainFound = true; }
                    }
                    else if (l.includes("počet pozvánok") || l.includes("pozvánky")) {
                        const q = extractNum(v);
                        if (q > 0) breakdown.invitations = q;
                    }
                    else if (l.includes("počet obálok") || l.includes("obálky")) {
                        const q = extractNum(v);
                        if (q > 0) breakdown.envelopes = q;
                    }
                });
            } else {
                // Direct Meta checks
                if (label.includes("počet oznámení") || label.includes("počet kusov")) {
                    const q = extractNum(value);
                    if (q > 0) { breakdown.main = q; mainFound = true; }
                }
                else if (label.includes("počet pozvánok")) {
                    const q = extractNum(value);
                    if (q > 0) breakdown.invitations = q;
                }
            }
        });
    }

    // Default fallback if no specific main quantity found
    if (!mainFound) {
        breakdown.main = defaultQty;
    }

    return breakdown;
}

/**
 * Simple parser for EPO data from WooCommerce.
 * (Modified to be lighter, logic moved to parseItemQuantities for splitting)
 */
export function parseEPO(metaData: any[]) {
    const result: Record<string, string> = {};

    if (!Array.isArray(metaData)) return result;

    const addToResult = (key: string, val: any) => {
        const cleanKey = String(key || "").trim();
        const cleanVal = String(val || "").trim();
        if (cleanKey && cleanVal) {
            result[cleanKey] = cleanVal;
        }
    };

    metaData.forEach(meta => {
        const key = meta.key || "";

        // 1. Handle EPO Data
        if (key === '_tmcartepo_data') {
            const epoData = meta.value;
            if (Array.isArray(epoData)) {
                epoData.forEach((item: any) => {
                    const label = item.section_label || item.name || "";
                    const value = item.value;
                    if (label && value) addToResult(label, value);

                    if (item.element?.type === "upload" && item.file?.url) {
                        if (!result.downloads) (result as any).downloads = [];
                        (result as any).downloads.push({
                            label: label || "Súbor",
                            url: item.file.url,
                            name: item.file.name || "Súbor"
                        });
                    }
                });
            }
        }
        // 2. Standard Meta
        else if (!key.startsWith('_')) {
            const label = meta.display_key || meta.key || meta.label;
            const value = meta.display_value || meta.value;
            addToResult(label, value);
        }
    });

    // Extract basic material info
    Object.entries(result).forEach(([label, value]) => {
        const l = label.toLowerCase();
        if (l.includes("materiál") || l.includes("papier")) result.material = value;
        if (l.includes("farba")) result.color = value;
    });

    return result;
}
