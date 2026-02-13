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
        // 1. Try to find structured EPO data first
        const epoMeta = metaData.find(m => m.key === '_tmcartepo_data');
        let dataToScan = metaData;

        if (epoMeta && Array.isArray(epoMeta.value)) {
            dataToScan = epoMeta.value;
        }

        // 2. Scan available data (either flat meta or deep EPO)
        dataToScan.forEach(meta => {
            // EPO uses 'name' and 'value', standard meta uses 'label'/'key' and 'value'
            const label = String(meta?.name || meta?.label || meta?.display_key || "").trim();
            const value = String(meta?.value || "").trim();

            if (!label) return;

            // Store raw value with label key for display
            result[label] = value;

            // Map known keys for easier access in code
            if (label.includes("Materiál") || label.includes("Papier")) result.material = value;
            if (label.includes("Farba")) result.color = value;
            if (label.includes("Typ metalickej")) result.metalType = value;
        });
    }

    return result;
}
