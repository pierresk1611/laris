import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * POST /api/settings/save
 * Updates or creates a setting or shop.
 */
export async function POST(req: NextRequest) {
    const correlationId = Math.random().toString(36).substring(7);
    try {
        const body = await req.json();
        const { type, data } = body;

        console.log(`[SaveSettings:${correlationId}] Start processing ${type}`);

        if (type === 'SETTING') {
            const { id, value, category, isSecret } = data;

            // Sanitization
            const cleanId = id.trim();
            let cleanValue = value;

            // Special handling for PATHS
            if (cleanId.includes('PATH')) {
                cleanValue = cleanValue.trim();
                // Ensure paths usually start with / if it looks like a path
                if (cleanValue.length > 0 && !cleanValue.startsWith('/') && !cleanValue.includes(':')) {
                    // Don't force / for potentially windows paths or specific keys, but for Dropbox it's good
                    if (cleanId === 'DROPBOX_FOLDER_PATH') {
                        cleanValue = '/' + cleanValue;
                    }
                }
            }

            if (isSecret && cleanValue === "********") {
                return NextResponse.json({ success: true, message: "Ignored masked secret" });
            }

            const finalValue = isSecret ? encrypt(cleanValue) : cleanValue;

            // Prisma upsert is generally safe, but purely to avoid 409 in edge cases (race conditions), we can catch it.
            try {
                // @ts-ignore
                await prisma.setting.upsert({
                    where: { id: cleanId },
                    update: { value: finalValue, category, isSecret },
                    create: { id: cleanId, value: finalValue, category, isSecret }
                });
            } catch (dbError: any) {
                // Retry once if unique constraint failed (rare for upsert but possible in high concurrency)
                if (dbError.code === 'P2002') {
                    console.warn(`[SaveSettings:${correlationId}] P2002 Conflict on Upsert. Retrying as Update...`);
                    // @ts-ignore
                    await prisma.setting.update({
                        where: { id: cleanId },
                        data: { value: finalValue, category, isSecret }
                    });
                } else {
                    throw dbError;
                }
            }

            console.log(`[SaveSettings:${correlationId}] Saved Setting: ${cleanId}`);
        }
        else if (type === 'SHOP') {
            const { id, name, url, ck, cs } = data;

            let shopId = id;
            if (shopId) {
                // Check if checks out
                // @ts-ignore
                const exists = await prisma.shop.findUnique({ where: { id: shopId } });
                if (!exists) shopId = null; // Treat as new
            }

            const shopData = {
                name: name.trim(),
                url: url.trim(),
                ck: (ck && !ck.includes('*')) ? ck.trim() : ck, // Only update if not masked
                cs: (cs && !cs.includes('*')) ? cs.trim() : cs
            };

            // Remove masked values from update entirely if possible, or handle above
            if (shopData.ck && shopData.ck.includes('*')) delete (shopData as any).ck;
            if (shopData.cs && shopData.cs.includes('*')) delete (shopData as any).cs;

            if (shopId) {
                // @ts-ignore
                await prisma.shop.update({
                    where: { id: shopId },
                    data: shopData
                });
            } else {
                // @ts-ignore
                await prisma.shop.create({
                    data: shopData
                });
            }
            console.log(`[SaveSettings:${correlationId}] Saved Shop`);
        } else {
            return NextResponse.json({ success: false, error: "Invalid Type" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error(`[SaveSettings:${correlationId}] Error:`, e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
