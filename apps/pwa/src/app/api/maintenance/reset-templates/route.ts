import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ success: false, error: 'Unauthorized. Super Admin only.' }, { status: 403 });
        }

        console.log(`[Maintenance] Resetting all templates requested by ${session.user.email}`);

        // We delete templates, which will cascade to TemplateFile and set templateId to null in WebProduct
        // (WebProduct.templateId is a relation fields: [templateId], references: [id])
        // If we want to clear mappings too, we should update WebProduct set templateId = null

        await prisma.webProduct.updateMany({
            data: { templateId: null, matchConfidence: null }
        });

        await prisma.template.deleteMany({});

        return NextResponse.json({ success: true, message: 'Všetky šablóny a ich mapovania boli úspešne vymazané.' });
    } catch (error: any) {
        console.error("[ResetTemplates] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
