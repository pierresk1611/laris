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

    if (Array.isArray(metaData)) {
        metaData.forEach(meta => {
            const label = String(meta?.label || "");
            const value = String(meta?.value || "");

            if (label.includes("Materiál")) result.material = value;
            if (label.includes("Farba")) result.color = value;
            if (label.includes("Typ metalickej")) result.metalType = value;
        });
    }

    return result;
}
