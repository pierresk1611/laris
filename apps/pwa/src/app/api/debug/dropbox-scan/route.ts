import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const refreshToken = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientId = await getSetting('DROPBOX_APP_KEY');
        const clientSecret = await getSetting('DROPBOX_APP_SECRET');
        const accessToken = await getSetting('DROPBOX_ACCESS_TOKEN');
        const customPath = await getSetting('DROPBOX_FOLDER_PATH');
        const folderPath = customPath?.trim() ? (customPath.trim().startsWith('/') ? customPath.trim() : `/${customPath.trim()}`) : '/TEMPLATES';

        let dbx;
        if (refreshToken && clientId && clientSecret) {
            dbx = new Dropbox({ clientId, clientSecret, refreshToken, fetch });
        } else if (accessToken) {
            dbx = new Dropbox({ accessToken, fetch });
        } else {
            return NextResponse.json({ error: 'No credentials' });
        }

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
