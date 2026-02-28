import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { key, newAlias } = await request.json();

        if (!key) {
            return NextResponse.json({ success: false, error: 'Key required' }, { status: 400 });
        }

        // @ts-ignore
        const updatedTemplate = await prisma.template.update({
            where: { key },
            data: {
                displayName: newAlias,
                alias: newAlias // keep for legacy support
            }
        });

        return NextResponse.json({ success: true, alias: updatedTemplate.displayName });
    } catch (error: any) {
        console.error("[TemplateRename] Error:", error);
        return NextResponse.json({ success: false, error: 'Nepodarilo sa premenovať šablónu', details: error.message }, { status: 500 });
    }
}
