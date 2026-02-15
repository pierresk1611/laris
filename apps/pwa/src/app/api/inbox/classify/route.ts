import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { id, action } = await req.json(); // action: 'TEMPLATE', 'DOCUMENT', 'IGNORE'

        if (!id || !action) {
            return NextResponse.json({ success: false, error: 'Missing id or action' }, { status: 400 });
        }

        // @ts-ignore
        const inboxItem = await prisma.fileInbox.findUnique({ where: { id } });
        if (!inboxItem) {
            return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
        }

        // 1. Handle Logic based on Action
        if (action === 'TEMPLATE') {
            // Create Template
            const name = inboxItem.name;
            const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
            // Key sanitation
            const key = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

            // Check if template exists (maybe verify?)
            const existingTemplate = await prisma.template.findUnique({ where: { key } });

            if (existingTemplate) {
                // Convert existing to active if needed? For now just log
            } else {
                // @ts-ignore
                await prisma.template.create({
                    data: {
                        key: key,
                        name: nameWithoutExt.replace(/_/g, ' '),
                        status: 'ACTIVE', // User explicitly said it's a template
                        isVerified: false
                    }
                });
            }
        } else if (action === 'DOCUMENT') {
            // Future: Link to order? For now just mark processed.
        }

        // 2. Mark Inbox Item as PROCESSED or IGNORED
        const newStatus = action === 'IGNORE' ? 'IGNORED' : 'PROCESSED';
        // @ts-ignore
        await prisma.fileInbox.update({
            where: { id },
            data: { status: newStatus }
        });

        // 3. Learn! (Save to Classification Example)
        // Only if not ignored? Or maybe ignore is also a learning signal? Yes it is.
        const category = action; // TEMPLATE, DOCUMENT, IGNORE

        // Check duplication to avoid spamming examples
        // @ts-ignore
        const existingExample = await prisma.aiClassificationExample.findFirst({
            where: { filename: inboxItem.name }
        });

        if (!existingExample) {
            // @ts-ignore
            await prisma.aiClassificationExample.create({
                data: {
                    filename: inboxItem.name,
                    category: category,
                    reasoning: 'User Manual Action'
                }
            });
        }

        return NextResponse.json({ success: true, message: 'Classified successfully' });

    } catch (error) {
        console.error("[InboxClassify] Error:", error);
        return NextResponse.json({ success: false, error: 'Classification failed' }, { status: 500 });
    }
}
