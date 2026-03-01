import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting, updateProgress } from '@/lib/settings';
import { Dropbox } from 'dropbox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

        // Dropbox API v2 requires an empty string for the root directory, not "/"
        folderPath = customPath === '/' ? '' : customPath;

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
        const accumulatedCount = body.accumulatedCount || 0;

        // Initialize Progress immediately only for the first request
        if (!cursor) {
            await updateProgress('SYNC_PROGRESS', 0, 0, 'Otváram spojenie s Dropboxom...');
        } else {
            await updateProgress('SYNC_PROGRESS', accumulatedCount, 0, `Sťahujem ďalší blok z Dropboxu... (${accumulatedCount})`);
        }

        let response;

        try {
            if (cursor) {
                console.log("[DropboxSync] Continuing with cursor...", { accumulatedCount });
                response = await dbx.filesListFolderContinue({ cursor });
            } else {
                console.log(`[DropboxSync] Starting new recursive scan in ${folderPath}...`);
                console.log("FINAL DROPBOX API PATH:", folderPath);

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
        // Strictly filter graphic formats to ignore invoices or documents in deep folders
        const graphicExtensions = ['.psd', '.ai', '.psb', '.psdt', '.pdf', '.jpg', '.jpeg', '.png'];

        const validFiles = entries.filter(e => {
            if (e['.tag'] !== 'file') return false;

            const pathLower = e.path_lower || '';
            // Rule: Ignore everything inside the /OUTPUT/ folder
            if (pathLower.includes('/output/')) return false;

            const name = e.name.toLowerCase();
            return graphicExtensions.some(ext => name.endsWith(ext));
        });

        console.log(`[DropboxSync] Checkpoint 3.c: Found ${validFiles.length} potential graphic inbox items.`);

        // 4. Process into FileInbox (Clean Slate mode)
        console.log("[DropboxSync] Checkpoint 4: Processing into FileInbox...");
        let totalCount = accumulatedCount;
        let newInboxItems = 0;

        for (const entry of validFiles) {
            const name = entry.name;
            const pathDisplay = entry.path_display || entry.path_lower || name;
            const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';

            // Auto-Promotion Rule 1
            const isAutoPromoted = name.toLowerCase().startsWith('ad_') ||
                name.toLowerCase().includes('pozvanka') ||
                name.toLowerCase().includes('oznamenie');

            if (isAutoPromoted) {
                const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
                const isInvitation = name.toLowerCase().startsWith('pozvanka na');

                const v2Match = nameWithoutExt.match(/^ad_(.*?)_([OP])_(.*)$/i);
                const skuMatch = nameWithoutExt.match(/(?:^|[_ ])([A-Z0-9]{3,})(_[OP])?$/i); // Generic SKU match

                const sku = v2Match ? v2Match[1].toUpperCase() : (skuMatch ? skuMatch[1].toUpperCase() : nameWithoutExt);
                const variantSuffix = v2Match ? v2Match[2].toUpperCase() : (skuMatch && skuMatch[2] ? skuMatch[2].substring(1).toUpperCase() : 'O');

                const groupKey = isInvitation ? `INVITATION_${sku}` : sku;
                const templateName = isInvitation ? `Pozvánka - ${sku}` : sku;
                const variantType = variantSuffix === 'P' ? 'INVITE' : 'MAIN';

                // Upsert Template
                // @ts-ignore
                let template = await prisma.template.findUnique({ where: { key: groupKey } });
                if (!template) {
                    // @ts-ignore
                    template = await prisma.template.create({
                        data: {
                            key: groupKey,
                            name: templateName,
                            displayName: templateName,
                            status: 'ACTIVE',
                            isVerified: false
                        }
                    });
                    newInboxItems++;
                }

                // Upsert TemplateFile
                // @ts-ignore
                await prisma.templateFile.upsert({
                    where: {
                        templateId_type: {
                            templateId: template.id,
                            type: variantType
                        }
                    },
                    update: {
                        path: pathDisplay,
                        extension: extension
                    },
                    create: {
                        templateId: template.id,
                        type: variantType,
                        path: pathDisplay,
                        extension: extension
                    }
                });

                // Ensure it's not in Inbox
                // @ts-ignore
                await prisma.fileInbox.deleteMany({ where: { path: pathDisplay } });

                totalCount++;
                if (totalCount % 10 === 0) {
                    await updateProgress('SYNC_PROGRESS', totalCount, 0, `Spracovávam súbory... (${totalCount})`);
                }

                continue; // Skip adding to Inbox
            }

            // Auto-Promotion Rule 2 (Web Match)
            const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;

            // Allow matching if the filename CONTAINS the web product title (case-insensitive)
            // To avoid matching very short generic words, we ensure product title is at least 4 chars
            // @ts-ignore
            const webMatch = await prisma.webProduct.findFirst({
                where: {
                    title: {
                        contains: nameWithoutExt,
                        mode: 'insensitive'
                    }
                }
            });

            // If not found by substring, try reverse (if filename contains the web title)
            // E.g. Filename="Pozvanka Futbal 2024", WebTitle="Futbal"
            let finalMatchedProduct: any = webMatch;

            if (!finalMatchedProduct) {
                // @ts-ignore
                const allProducts = await prisma.webProduct.findMany({
                    select: { id: true, title: true, sku: true }
                });

                const lowerName = nameWithoutExt.toLowerCase();
                // Find first product whose title (length > 4) is contained in the filename
                finalMatchedProduct = allProducts.find((p: any) =>
                    p.title.length > 4 && lowerName.includes(p.title.toLowerCase())
                ) || null;
            }

            if (finalMatchedProduct) {
                // Auto-promote based on Web Match
                const sku = finalMatchedProduct.sku || finalMatchedProduct.title;
                const groupKey = `WEB_${sku}`;
                const templateName = finalMatchedProduct.title;
                const variantType = 'MAIN'; // Defaulting to MAIN for web matches unless specified

                // Upsert Template
                // @ts-ignore
                let template = await prisma.template.findUnique({ where: { key: groupKey } });
                if (!template) {
                    // @ts-ignore
                    template = await prisma.template.create({
                        data: {
                            key: groupKey,
                            name: templateName,
                            displayName: templateName,
                            status: 'ACTIVE',
                            isVerified: false
                        }
                    });
                    newInboxItems++;
                }

                // Upsert TemplateFile
                // @ts-ignore
                await prisma.templateFile.upsert({
                    where: {
                        templateId_type: {
                            templateId: template.id,
                            type: variantType
                        }
                    },
                    update: {
                        path: pathDisplay,
                        extension: extension
                    },
                    create: {
                        templateId: template.id,
                        type: variantType,
                        path: pathDisplay,
                        extension: extension
                    }
                });

                // Ensure it's not in Inbox
                // @ts-ignore
                await prisma.fileInbox.deleteMany({ where: { path: pathDisplay } });

                totalCount++;
                if (totalCount % 10 === 0) {
                    await updateProgress('SYNC_PROGRESS', totalCount, 0, `Spracovávam súbory... (${totalCount})`);
                }

                continue; // Skip adding to Inbox
            }

            // Check if it's already in Inbox?
            // @ts-ignore
            const existingInbox = await prisma.fileInbox.findUnique({ where: { path: pathDisplay } });

            if (!existingInbox) {
                // @ts-ignore
                await prisma.fileInbox.create({
                    data: {
                        name: name,
                        path: pathDisplay,
                        extension: extension,
                        status: 'UNCLASSIFIED'
                    }
                });
                newInboxItems++;
            }

            totalCount++;

            if (totalCount % 10 === 0) {
                await updateProgress('SYNC_PROGRESS', totalCount, 0, `Spracovávam súbory... (${totalCount})`);
            }
        }
        console.log(`[DropboxSync] Checkpoint 4.b: Scanned chunk. Created ${newInboxItems} new Inbox items. Total so far: ${totalCount}`);

        // ONLY Update timestamp if finished
        console.log("[DropboxSync] Sync step finished. Updating timestamp.");
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
            hasMore: response.result.has_more,
            cursor: response.result.cursor,
            count: newInboxItems, // Count of NEW items
            scannedCount: entries.length,
            message: `Nájdených ${newInboxItems} nových súborov v Inboxe (celkovo skenovaných ${totalCount}).`
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
