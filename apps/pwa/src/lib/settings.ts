import { prisma } from '@/lib/prisma';
import { decrypt } from './crypto';

/**
 * Fetches a single setting by ID and decrypts it if necessary.
 */
export async function getSetting(id: string): Promise<string | null> {
    const setting = await prisma.setting.findUnique({
        where: { id }
    });

    if (!setting) return null;

    if (setting.isSecret) {
        return decrypt(setting.value);
    }

    return setting.value;
}

/**
 * Fetches all settings for a specific category.
 */
export async function getSettingsByCategory(category: string) {
    const settings = await prisma.setting.findMany({
        where: { category }
    });

    return settings.map(s => ({
        id: s.id,
        value: s.isSecret ? decrypt(s.value) : s.value,
        category: s.category,
        isSecret: s.isSecret
    }));
}
