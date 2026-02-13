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
        console.log(`[SaveSettings:${correlationId}] Incoming request body:`, JSON.stringify(body, null, 2));
        const { type, data } = body;

        if (type === 'SETTING') {
            const { id, value, category, isSecret } = data;
            const safeLogValue = isSecret ? `[SECRET:${value.length} chars]` : value;
            console.log(`[SaveSettings:${correlationId}] SAVING SETTING: ${id}, category=${category}, isSecret=${isSecret}, value=${safeLogValue}`);

            if (isSecret && value === "********") {
                console.log(`[SaveSettings:${correlationId}] Secret value detected as masked (********). Skipping update.`);
                return NextResponse.json({ success: true, message: "Secret unchanged" });
            }

            const finalValue = isSecret ? encrypt(value) : value;
            console.log(`[SaveSettings:${correlationId}] Value prepared for DB (len: ${finalValue.length})`);

            // @ts-ignore
            const upsertResult = await prisma.setting.upsert({
                where: { id },
                update: { value: finalValue, category, isSecret },
                create: { id, value: finalValue, category, isSecret }
            });
            console.log(`[SaveSettings:${correlationId}] DB UPSERT SUCCESS for ${id}:`, JSON.stringify(upsertResult));
        }
        else if (type === 'SHOP') {
            const { id, name, url, ck, cs } = data;
            console.log(`[SaveSettings:${correlationId}] SAVING SHOP: ${name} (id: ${id || 'NEW'})`);

            // @ts-ignore
            const existing = id ? await prisma.shop.findUnique({ where: { id } }) : null;
            if (id && !existing) {
                console.warn(`[SaveSettings:${correlationId}] SHOP ID ${id} provided but not found in DB!`);
            }

            const finalCK = (ck && ck.includes("********")) ? existing?.ck : ck;
            const finalCS = (cs && cs === "********") ? existing?.cs : cs;

            if (id && existing) {
                // @ts-ignore
                const updateResult = await prisma.shop.update({
                    where: { id },
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
                console.log(`[SaveSettings:${correlationId}] SHOP UPDATE SUCCESS:`, JSON.stringify(updateResult));
            } else {
                // @ts-ignore
                const createResult = await prisma.shop.create({
                    data: { name, url, ck: finalCK, cs: finalCS }
                });
                console.log(`[SaveSettings:${correlationId}] SHOP CREATE SUCCESS, NEW ID: ${createResult.id}`);
            }
        } else {
            console.error(`[SaveSettings:${correlationId}] UNKNOWN TYPE: ${type}`);
            return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
        }

        console.log(`[SaveSettings:${correlationId}] REQUEST COMPLETED SUCCESSFULLY`);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error(`[SaveSettings:${correlationId}] CRITICAL ERROR:`, e.stack || e.message);
        return NextResponse.json({
            success: false,
            error: e.message,
            stack: e.stack
        }, { status: 500 });
    }
}
