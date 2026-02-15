import { NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dbx = await getDropboxClient();
        const folderPath = '/TEMPLATES'; // Fixed for now or read from query param

        const response = await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 100
        });

        const files = response.result.entries.map(e => ({
            name: e.name,
            path: e.path_lower,
            type: e['.tag']
        }));

        return NextResponse.json({
            path: folderPath,
            count: files.length,
            hasMore: response.result.has_more,
            files
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, details: error });
    }
}
