import { NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const dbx = await getDropboxClient();

        // Recursively fetch templates
        // For now, let's just list the root or configured folder
        const folderPath = '/TEMPLATES'; // TODO: Configurable?

        const response = await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 1000 // Get as many as possible
        });

        // Filter only folders or relevant files if needed
        const templates = response.result.entries
            .filter(e => e['.tag'] === 'folder' || e.name.endsWith('.psd'))
            .map(e => ({
                name: e.name,
                path: e.path_lower,
                lastModified: (e as any).client_modified || new Date().toISOString()
            }));

        return NextResponse.json({
            success: true,
            templates: templates
        });
    } catch (error: any) {
        console.error("Dropbox API Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to fetch from Dropbox"
        }, { status: 500 });
    }
}
