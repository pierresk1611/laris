import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { key, newSku } = await request.json();

        if (!key) {
            return NextResponse.json({ success: false, error: 'Kľúč šablóny je povinný' }, { status: 400 });
        }

        const template = await prisma.template.update({
            where: { key },
            data: {
                sku: newSku ? newSku.trim() : null
            }
        });

        return NextResponse.json({
            success: true,
            template
        });
    } catch (error: any) {
        console.error("[TemplateSKU] POST Error:", error);

        if (error.code === 'P2002') {
            return NextResponse.json({
                success: false,
                error: 'Toto SKU je už priradené inej šablóne'
            }, { status: 400 });
        }

        return NextResponse.json({
            success: false,
            error: 'Nepodarilo sa uložiť SKU',
            details: error?.message || String(error)
        }, { status: 500 });
    }
}
