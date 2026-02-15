import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export async function POST(req: Request) {
    console.log("[DropboxSync] STARTing template synchronization...");
    let folderPath = '/TEMPLATES';

    try {
        // 1. Fetch credentials
        console.log("[DropboxSync] Checkpoint 1: Fetching settings...");
        const refreshTokenRaw = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientIdRaw = await getSetting('DROPBOX_APP_KEY');
        const clientSecretRaw = await getSetting('DROPBOX_APP_SECRET');
        const accessTokenRaw = await getSetting('DROPBOX_ACCESS_TOKEN');
        const customPathRaw = await getSetting('DROPBOX_FOLDER_PATH');

        const refreshToken = refreshTokenRaw?.trim();
        const clientId = clientIdRaw?.trim();
        const clientSecret = clientSecretRaw?.trim();
        const accessToken = accessTokenRaw?.trim();

        let customPath = customPathRaw?.trim() || '/TEMPLATES';
        if (!customPath.startsWith('/')) {
            customPath = '/' + customPath;
        }
        folderPath = customPath;

        console.log("[DropboxSync] Checkpoint 1.b: Settings loaded.", { folderPath, hasAccess: !!accessToken, hasRefresh: !!refreshToken });

        let dbx;

        if (refreshToken && clientId && clientSecret) {
            console.log("[DropboxSync] Checkpoint 2: Initializing Refresh Token flow.");
            dbx = new Dropbox({
                clientId,
                clientSecret,
                refreshToken,
                fetch
            });
        } else if (accessToken) {
            console.log("[DropboxSync] Checkpoint 2: Initializing Access Token fallback.");
            dbx = new Dropbox({
                accessToken,
                fetch
            });
        } else {
            console.error("[DropboxSync] Checkpoint 2: Missing required credentials.");
            return NextResponse.json({
                success: false,
                error: 'CREDENTIALS_MISSING',
                message: 'Chýbajú prihlasovacie údaje pre Dropbox (Access Token alebo Refresh Token).'
            }, { status: 400 });
        }

        // 3. Fetch files with pagination (Client-driven loop)
        const body = await req.json().catch(() => ({}));
        const cursor = body.cursor;

        let response;

        try {
            if (cursor) {
                console.log("[DropboxSync] Continuing with cursor...");
                response = await dbx.filesListFolderContinue({ cursor });
            } else {
                console.log(`[DropboxSync] Starting new recursive scan in ${folderPath}...`);
                response = await dbx.filesListFolder({
                    path: folderPath,
                    recursive: true,
                    limit: 200
                });
            }
        } catch (apiError: any) {
            console.error("[DropboxSync] API Call Failed. Raw Error Response:", JSON.stringify(apiError, null, 2));
            throw apiError;
        }

        const entries = response.result.entries;
        console.log(`[DropboxSync] Fetched ${entries.length} entries. Has more: ${response.result.has_more}`);

        // 3. Greedy Filter: We want ALL .psd and .ai files
        const VALID_EXTENSIONS = ['.psd', '.ai'];

        const validTemplates = entries.filter(e => {
            const name = e.name.toLowerCase();
            // Check if it's a file with valid extension
            if (e['.tag'] === 'file') {
                return VALID_EXTENSIONS.some(ext => name.endsWith(ext));
            }
            // Or if it's a folder (we assume folders might contain templates, but for greedy import we focus on files)
            // For now, let's keep folders if they look like templates, but primary focus is files
            return true;
        });

        console.log(`[DropboxSync] Checkpoint 3.c: Found ${validTemplates.length} potential items.`);

        // 4. Upsert into database
        console.log("[DropboxSync] Checkpoint 4: Starting DB upserts...");
        let count = 0;

        for (const entry of validTemplates) {
            // Skip folders for now in this greedy pass, we only want actual files to map
            if (entry['.tag'] !== 'file') continue;

            const name = entry.name;
            const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
            const ext = name.substring(name.lastIndexOf('.')); // .psd or .ai

            // Key is the filename (e.g. "pozvanka_2025_77")
            // We sanitize it a bit to be safe
            const key = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

            // Status: UNMAPPED by default for these greedy imports
            // If it already exists and is ACTIVE, we don't overwrite status to UNMAPPED
            // But we do create new ones as UNMAPPED

            const existing = await prisma.template.findUnique({ where: { key } });

            if (!existing) {
                // Create new UNMAPPED template
                // @ts-ignore
                await prisma.template.create({
                    data: {
                        key: key,
                        name: nameWithoutExt.replace(/_/g, ' '),
                        status: 'UNMAPPED',
                        isVerified: false
                    }
                });
                count++;
            } else {
                // If exists, just ensure it's not deleted? 
                // User didn't specify update logic, but generally we shouldn't overwrite manual changes.
                // We'll just log it.
                // console.log(`[DropboxSync] Template ${key} already exists.`);
            }
        }
        console.log(`[DropboxSync] Checkpoint 4.b: ${count} NEW templates created.`);

        // ONLY Update timestamp if finished
        if (!response.result.has_more) {
            console.log("[DropboxSync] Sync finished. Updating timestamp.");
            // @ts-ignore
            await prisma.setting.upsert({
                where: { id: 'LAST_DROPBOX_SYNC' },
                update: { value: new Date().toISOString(), category: 'SYSTEM' },
                create: { id: 'LAST_DROPBOX_SYNC', value: new Date().toISOString(), category: 'SYSTEM' }
            });

            // @ts-ignore
            await prisma.setting.upsert({
                where: { id: 'LAST_DROPBOX_SYNC_STATUS' },
                update: { value: 'OK', category: 'SYSTEM' },
                create: { id: 'LAST_DROPBOX_SYNC_STATUS', value: 'OK', category: 'SYSTEM' }
            });
        }

        return NextResponse.json({
            success: true,
            hasMore: response.result.has_more,
            cursor: response.result.cursor,
            count: count, // Count for THIS batch
            message: `Spracovaných ${count} šablón (Batch).`
        });

    } catch (error: any) {
        console.error("[DropboxSync] CRITICAL ERROR DETAILS:", error);

        // Detailed error logging for Vercel
        if (error.error) {
            console.error("[DropboxSync] Dropbox API Error Object:", JSON.stringify(error.error, null, 2));
        }

        let errorStatus = typeof error.status === 'number' ? error.status : 500;
        let errorCode = 'SYNC_ERROR';
        // Try to find a message in the object if .message is empty
        let userMessage = error.message || (error.error?.error_summary) || 'Synchronizácia zlyhala (Neznáma chyba SDK).';

        if (errorStatus === 401) {
            errorCode = 'UNAUTHORIZED';
            userMessage = 'Neplatný alebo expirovaný Dropbox token. Skontrolujte kľúč v Nastaveniach.';
        } else if (errorStatus === 409 || (error.error && error.error.error_summary?.includes('path/not_found'))) {
            errorCode = 'PATH_NOT_FOUND';
            userMessage = `Priečinok "${folderPath}" nebol v Dropboxe nájdený. Skontrolujte názov a štruktúru.`;
        } else if (errorStatus === 400) {
            errorCode = 'BAD_REQUEST';
            const details = JSON.stringify(error.error || {});
            userMessage = `Chybná požiadavka na Dropbox (400). Detaily: ${details.substring(0, 100)}...`;
        }

        // Store failure status in DB
        try {
            // @ts-ignore
            await prisma.setting.upsert({
                where: { id: 'LAST_DROPBOX_SYNC_STATUS' },
                update: { value: `ERROR: ${errorCode} (${errorStatus}) - ${userMessage.substring(0, 50)}`, category: 'SYSTEM' },
                create: { id: 'LAST_DROPBOX_SYNC_STATUS', value: `ERROR: ${errorCode} (${errorStatus})`, category: 'SYSTEM' }
            });
        } catch (e) { }

        return NextResponse.json({
            success: false,
            error: errorCode,
            message: userMessage,
            details: error.message || 'Unknown technical error',
            fullError: JSON.stringify(error)
        }, { status: errorStatus === 500 ? 500 : (typeof errorStatus === 'number' ? errorStatus : 500) });
    }
}
