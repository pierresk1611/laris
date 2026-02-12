/**
 * Extracted template key from product title using Regex.
 * Example: "Pozvánka na oslavu 70. narodenín JSO 15" -> "JSO 15"
 */
export function extractTemplateKey(productName: string): string | null {
    // Regex looks for common patterns like JSO 15, VSO 02, etc.
    const regex = /([A-Z]{3}\s\d{2,3})/i;
    const match = productName.match(regex);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Checks if the order involves an invitation to the table.
 * If yes, it should trigger the addition of _P.psd files.
 */
export function needsInvitation(productName: string, metaData: any[]): boolean {
    const hasInvitationInTitle = productName.toLowerCase().includes("pozvánka k stolu");
    const hasInvitationInMeta = metaData.some(m =>
        m.label?.toLowerCase().includes("pozvánka k stolu") ||
        m.value?.toLowerCase().includes("áno")
    );

    return hasInvitationInTitle || hasInvitationInMeta;
}

/**
 * Simple parser for EPO data from WooCommerce.
 */
export function parseEPO(metaData: any[]) {
    const result: Record<string, string> = {};

    metaData.forEach(meta => {
        if (meta.label?.includes("Materiál")) result.material = meta.value;
        if (meta.label?.includes("Farba")) result.color = meta.value;
        if (meta.label?.includes("Typ metalickej")) result.metalType = meta.value;
    });

    return result;
}
