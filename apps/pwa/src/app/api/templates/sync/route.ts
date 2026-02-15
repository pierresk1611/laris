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

        // 3. Scan ALL files (Greedy Import for Inbox)
        // We no longer filter by extension strictly, we take everything interesting
        // Exclude system files
        const ignoredExtensions = ['.ds_store', '.tmp', '.desktop', '.ini'];

        const validFiles = entries.filter(e => {
            if (e['.tag'] !== 'file') return false;
            const name = e.name.toLowerCase();
            return !ignoredExtensions.some(ext => name.endsWith(ext));
        });

        console.log(`[DropboxSync] Checkpoint 3.c: Found ${validFiles.length} potential inbox items.`);

        // 4. Process into FileInbox
        console.log("[DropboxSync] Checkpoint 4: Processing into FileInbox...");
        let count = 0;
        let newInboxItems = 0;

        for (const entry of validFiles) {
            const name = entry.name;
            const pathDisplay = entry.path_display || entry.path_lower || name;
            const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';

            // Check if this file is already a known TEMPLATE (Active)
            // We use the filename (without ext) as key assumption for check
            const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
            const potentialKey = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();

            // Check 1: Is it already an active template?
            const existingTemplate = await prisma.template.findUnique({ where: { key: potentialKey } });
            if (existingTemplate) {
                // It's already a template, we ignore it for Inbox
                continue;
            }

            // Check 2: Is it already in Inbox?
            // @ts-ignore
            const existingInbox = await prisma.fileInbox.findUnique({ where: { path: pathDisplay } });

            if (!existingInbox) {
                // Create new Inbox Item
                // @ts-ignore
                await prisma.fileInbox.create({
                    data: {
                        name: name,
                        path: pathDisplay,
                        extension: extension,
                        status: 'UNCLASSIFIED'
                        // prediction defaults to null
                    }
                });
                newInboxItems++;
            }
            count++;
        }
        console.log(`[DropboxSync] Checkpoint 4.b: Scanned ${count} files. Created ${newInboxItems} new Inbox items.`);

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
            count: newInboxItems, // Count of NEW items
            message: `Nájdených ${newInboxItems} nových súborov v Inboxe (celkovo skenovaných ${count}).`
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
