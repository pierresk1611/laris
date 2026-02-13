import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export async function POST() {
    console.log("[DropboxSync] STARTing template synchronization...");
    try {
        // 1. Fetch credentials
        console.log("[DropboxSync] Checkpoint 1: Fetching settings...");
        const refreshToken = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientId = await getSetting('DROPBOX_APP_KEY');
        const clientSecret = await getSetting('DROPBOX_APP_SECRET');
        const accessToken = await getSetting('DROPBOX_ACCESS_TOKEN');
        const customPath = await getSetting('DROPBOX_FOLDER_PATH');

        const folderPath = customPath ? (customPath.startsWith('/') ? customPath : `/${customPath}`) : '/TEMPLATES';
        console.log("[DropboxSync] Checkpoint 1.b: Settings loaded.", { folderPath, hasAccess: !!accessToken, hasRefresh: !!refreshToken });

        let dbx;

        if (refreshToken && clientId && clientSecret) {
            console.log("[DropboxSync] Checkpoint 2: Initializing Refresh Token flow.");
            dbx = new Dropbox({
                clientId,
                clientSecret,
                refreshToken
            });
        } else if (accessToken) {
            console.log("[DropboxSync] Checkpoint 2: Initializing Access Token fallback.");
            dbx = new Dropbox({ accessToken });
        } else {
            console.error("[DropboxSync] Checkpoint 2: Missing required credentials.");
            return NextResponse.json({
                success: false,
                error: 'CREDENTIALS_MISSING',
                message: 'Chýbajú prihlasovacie údaje pre Dropbox (Access Token alebo Refresh Token).'
            }, { status: 400 });
        }

        // 3. Fetch file list
        console.log(`[DropboxSync] Checkpoint 3: Listing folders in ${folderPath}...`);
        const response = await dbx.filesListFolder({ path: folderPath });
        console.log("[DropboxSync] Checkpoint 3.b: API response received.");

        const dropboxFolders = response.result.entries.filter(e => e['.tag'] === 'folder');
        console.log(`[DropboxSync] Checkpoint 3.c: Found ${dropboxFolders.length} folders.`);

        // 4. Upsert into database
        console.log("[DropboxSync] Checkpoint 4: Starting DB upserts...");
        let count = 0;
        for (const folder of dropboxFolders) {
            // @ts-ignore
            await prisma.template.upsert({
                where: { key: folder.name },
                update: { status: 'ACTIVE' },
                create: {
                    key: folder.name,
                    name: folder.name.replace(/_/g, ' '),
                    status: 'ACTIVE'
                }
            });
            count++;
        }
        console.log(`[DropboxSync] Checkpoint 4.b: ${count} upserts done.`);

        // 5. Store sync timestamp
        console.log("[DropboxSync] Checkpoint 5: Updating last sync meta...");
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
        console.log("[DropboxSync] END: Synchronization successful.");

        return NextResponse.json({
            success: true,
            count,
            message: `Úspešne synchronizovaných ${count} šablón.`
        });

    } catch (error: any) {
        console.error("[DropboxSync] CRITICAL ERROR:", error);

        let errorStatus = error.status || 500;
        let errorCode = 'SYNC_ERROR';
        let userMessage = 'Synchronizácia zlyhala.';

        if (errorStatus === 401) {
            errorCode = 'UNAUTHORIZED';
            userMessage = 'Neplatný alebo expirovaný Dropbox token. Skontrolujte kľúč v Nastaveniach.';
        } else if (errorStatus === 409 || (error.error && error.error.error_summary?.includes('path/not_found'))) {
            errorCode = 'PATH_NOT_FOUND';
            userMessage = 'Priečinok /TEMPLATES nebol v Dropboxe nájdený. Skontrolujte štruktúru priečinkov.';
        } else if (errorStatus === 400) {
            errorCode = 'BAD_REQUEST';
            userMessage = 'Chybná požiadavka (pravdepodobne nesprávny formát tokenu).';
        }

        // Detailed debug info
        const debugInfo = {
            message: error.message,
            status: error.status,
            error_summary: error.error?.error_summary,
            error_details: error.error,
            stack: error.stack
        };

        // Store failure status
        try {
            // @ts-ignore
            await prisma.setting.upsert({
                where: { id: 'LAST_DROPBOX_SYNC_STATUS' },
                update: { value: `ERROR: ${errorCode} (${errorStatus})`, category: 'SYSTEM' },
                create: { id: 'LAST_DROPBOX_SYNC_STATUS', value: `ERROR: ${errorCode} (${errorStatus})`, category: 'SYSTEM' }
            });
        } catch (e) { }

        return NextResponse.json({
            success: false,
            error: errorCode,
            message: userMessage,
            debug: debugInfo,
            details: error.message || 'Unknown error'
        }, { status: errorStatus === 500 ? 500 : errorStatus });
    }
}
