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
export function parseEPO(metaData: any[]) {
    const result: Record<string, string> = {};

    if (!Array.isArray(metaData)) return result;

    // Helper to add to result without overwriting unless necessary
    const addToResult = (key: string, val: any) => {
        const cleanKey = String(key || "").trim();
        const cleanVal = String(val || "").trim();
        if (cleanKey && cleanVal) {
            result[cleanKey] = cleanVal;
        }
    };

    metaData.forEach(meta => {
        const key = meta.key || "";

        // 1. Handle EPO Data (Extra Product Options)
        if (key === '_tmcartepo_data') {
            const epoData = meta.value;
            if (Array.isArray(epoData)) {
                epoData.forEach((item: any) => {
                    // EPO items usually have 'name' and 'value'
                    if (item.name && item.value) {
                        addToResult(item.name, item.value);
                    }
                });
            }
        }

        // 2. Handle Standard/Visible Meta (skip hidden ones except EPO)
        // Meta from Woo API usually has 'display_key' and 'display_value' for UI
        else if (!key.startsWith('_')) {
            const label = meta.display_key || meta.key || meta.label;
            const value = meta.display_value || meta.value;
            addToResult(label, value);
        }
    });

    // 3. Map for internal logic (backward compatibility)
    // We scan the *result* keys now to find material, color, and QUANTITY
    Object.entries(result).forEach(([label, value]) => {
        const l = label.toLowerCase();

        // Material/Color
        if (l.includes("materiál") || l.includes("papier")) result.material = value;
        if (l.includes("farba")) result.color = value;
        if (l.includes("typ metalickej")) result.metalType = value;

        // Custom Quantity (EPO often overrides Woo quantity)
        // We look for "počet" or "kus" but avoid "obálok" if possible to prioritize the main item
        if ((l.includes("počet") || l.includes("kusov")) && !l.includes("obálok")) {
            const num = parseInt(value.toString().replace(/[^0-9]/g, ''));
            if (!isNaN(num)) {
                result.epoQuantity = num.toString();
            }
        }
    });

    return result;
}
