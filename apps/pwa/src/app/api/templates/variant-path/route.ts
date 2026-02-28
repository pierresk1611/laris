import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { templateId, type, path } = await req.json();

        if (!templateId || !type || !path) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const template = await prisma.template.findUnique({
            where: { key: templateId }
        });

        if (!template) {
            return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
        }

        // Update TemplateFile record
        console.log(`[ManualPath] Updating ${templateId} ${type} to path: ${path}`);
        await prisma.templateFile.upsert({
            where: {
                templateId_type: {
                    templateId: template.id,
                    type: type
                }
            },
            update: { path },
            create: {
                templateId: template.id,
                type: type,
                path: path
            }
        });

        // Update legacy variants JSON
        const variants = Array.isArray(template.variants) ? [...(template.variants as any[])] : [];
        const vIndex = variants.findIndex(v => v.type === type);
        if (vIndex !== -1) {
            variants[vIndex].path = path;
        } else {
            variants.push({ type, path, extension: path.split('.').pop() || '', mapping: {} });
        }

        await prisma.template.update({
            where: { id: template.id },
            data: { variants: variants }
        });

        return NextResponse.json({ success: true, message: 'Path updated successfully' });
    } catch (error: any) {
        console.error("[ManualPath] Update Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
