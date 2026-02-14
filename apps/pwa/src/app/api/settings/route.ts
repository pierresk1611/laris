import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings
 * Returns all settings, shops and system stats.
 */
export async function GET() {
    try {
        // @ts-ignore
        const [settings, shops, patternCount, agentStatus] = await Promise.all([
            // @ts-ignore
            prisma.setting.findMany(),
            // @ts-ignore
            prisma.shop.findMany(),
            // @ts-ignore
            prisma.aiPattern.count(),
            prisma.agentStatus.findFirst({ orderBy: { lastSeen: 'desc' } })
        ]);

        const REQUIRED_KEYS = [
            { id: 'GROQ_API_KEY', category: 'AI', isSecret: true },
            { id: 'OPENAI_API_KEY', category: 'AI', isSecret: true },
            { id: 'DROPBOX_ACCESS_TOKEN', category: 'STORAGE', isSecret: true },
            { id: 'AGENT_ACCESS_TOKEN', category: 'AGENT', isSecret: false },
            { id: 'LOCAL_TEMPLATES_PATH', category: 'AGENT', isSecret: false },
            { id: 'LOCAL_OUTPUT_PATH', category: 'AGENT', isSecret: false }
        ];

        // Merge DB settings with required keys to ensure frontend always sees them
        const finalSettings = REQUIRED_KEYS.map(req => {
            const found = settings.find((s: any) => s.id === req.id);
            if (found) {
                return {
                    ...found,
                    value: found.isSecret ? "********" : found.value
                };
            }
            return {
                ...req,
                value: ""
            };
        });

        // Add any other DB settings not in required list
        settings.forEach((s: any) => {
            if (!REQUIRED_KEYS.find(rk => rk.id === s.id)) {
                finalSettings.push({
                    ...s,
                    value: s.isSecret ? "********" : s.value
                });
            }
        });

        const maskedShops = shops.map((s: any) => ({
            ...s,
            cs: "********",
            ck: s.ck ? s.ck.substring(0, 4) + "********" : ""
        }));

        return NextResponse.json({
            success: true,
            settings: finalSettings,
            shops: maskedShops,
            patternCount,
            agentStatus
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
