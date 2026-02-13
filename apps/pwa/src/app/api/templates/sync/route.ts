import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export async function POST() {
    console.log("[DropboxSync] Starting template synchronization...");
    try {
        // 1. Fetch credentials
        const refreshToken = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientId = await getSetting('DROPBOX_APP_KEY');
        const clientSecret = await getSetting('DROPBOX_APP_SECRET');

        if (!refreshToken || !clientId || !clientSecret) {
            console.error("[DropboxSync] Missing required credentials:", {
                hasToken: !!refreshToken,
                hasId: !!clientId,
                hasSecret: !!clientSecret
            });
            return NextResponse.json({
                success: false,
                error: 'CREDENTIALS_MISSING',
                message: 'Chýbajú prihlasovacie údaje pre Dropbox (Refresh Token, App Key alebo Secret). Skontrolujte Nastavenia.'
            }, { status: 400 });
        }

        // 2. Initialize Dropbox
        const dbx = new Dropbox({
            clientId,
            clientSecret,
            refreshToken
        });

        // 3. Fetch file list from /TEMPLATES
        console.log("[DropboxSync] Listing folders in /TEMPLATES...");
        const response = await dbx.filesListFolder({ path: '/TEMPLATES' });

        const dropboxFolders = response.result.entries.filter(e => e['.tag'] === 'folder');
        console.log(`[DropboxSync] Found ${dropboxFolders.length} folders in Dropbox.`);

        // 4. Upsert into database
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

        // 5. Store sync timestamp
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

        return NextResponse.json({
            success: true,
            count,
            message: `Úspešne synchronizovaných ${count} šablón.`
        });

    } catch (error: any) {
        console.error("[DropboxSync] Error:", error);

        let errorStatus = 500;
        let errorCode = 'INTERNAL_ERROR';
        let userMessage = 'Nastala neočakávaná chyba pri synchronizácii s Dropboxom.';

        if (error.status === 401) {
            errorStatus = 401;
            errorCode = 'UNAUTHORIZED';
            userMessage = 'Neplatný alebo expirovaný Dropbox token. Skontrolujte kľúč v Nastaveniach.';
        } else if (error.status === 409 || (error.error && error.error.error_summary?.includes('path/not_found'))) {
            errorStatus = 409;
            errorCode = 'PATH_NOT_FOUND';
            userMessage = 'Priečinok /TEMPLATES nebol v Dropboxe nájdený. Skontrolujte štruktúru priečinkov.';
        }

        // Store failure status
        try {
            // @ts-ignore
            await prisma.setting.upsert({
                where: { id: 'LAST_DROPBOX_SYNC_STATUS' },
                update: { value: `ERROR: ${errorCode}`, category: 'SYSTEM' },
                create: { id: 'LAST_DROPBOX_SYNC_STATUS', value: `ERROR: ${errorCode}`, category: 'SYSTEM' }
            });
        } catch (e) { }

        return NextResponse.json({
            success: false,
            error: errorCode,
            message: userMessage,
            details: error.message
        }, { status: errorStatus });
    }
}
