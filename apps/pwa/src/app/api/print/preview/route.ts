import { NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox';
import { Buffer } from 'buffer';

// @ts-ignore
import { readPsd } from 'ag-psd';
// Polyfill for HTMLCanvasElement and Path2D in node
import 'ag-psd/initialize-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, itemId, templateKey, data } = body;

        if (!orderId || !itemId || !templateKey) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        const dbx = await getDropboxClient();

        // ---- HELPER: Dropbox Thumbnail Fallback ----
        const generateDropboxThumbnailFallback = async (sourcePath: string) => {
            console.log(`[Preview] Generating fallback thumbnail from Dropbox for ${sourcePath}`);
            const thumbRes = await dbx.filesGetThumbnailV2({
                resource: { '.tag': 'path', path: sourcePath },
                format: { '.tag': 'jpeg' },
                size: { '.tag': 'w1024h768' }
            });

            let thumbBuffer = (thumbRes.result as any).fileBinary;
            if (!thumbBuffer && (thumbRes.result as any).fileBlob) {
                const blob = (thumbRes.result as any).fileBlob;
                thumbBuffer = Buffer.from(await blob.arrayBuffer());
            }

            if (!thumbBuffer) throw new Error("Empty thumbnail buffer");

            const previewFilename = `Preview_Order${orderId}_Item${itemId}_${Date.now()}.jpg`;
            const previewDbxPath = `/AutoDesign_App/PREVIEWS/${previewFilename}`;

            await dbx.filesUpload({
                path: previewDbxPath,
                contents: thumbBuffer,
                mode: { '.tag': 'overwrite' }
            });

            let sharedLink = null;
            try {
                const linkRes = await dbx.sharingCreateSharedLinkWithSettings({
                    path: previewDbxPath,
                    settings: { requested_visibility: { '.tag': 'public' } }
                });
                sharedLink = linkRes.result.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '&raw=1');
            } catch (linkErr: any) {
                if (linkErr.error && linkErr.error['.tag'] === 'shared_link_already_exists') {
                    const listRes = await dbx.sharingListSharedLinks({ path: previewDbxPath, direct_only: true });
                    if (listRes.result.links && listRes.result.links.length > 0) {
                        sharedLink = listRes.result.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '&raw=1');
                    }
                }
            }
            return sharedLink;
        };

        // Check for .ai first (Optimistic check)
        let isAiFile = false;
        let aiPath = `/TEMPLATES/${templateKey}.ai`;
        try {
            const listRes = await dbx.filesSearchV2({
                query: templateKey,
                options: {
                    path: '/TEMPLATES',
                    max_results: 10,
                    file_extensions: ['ai']
                }
            });
            const aiMatch = listRes.result.matches.find(m =>
                m.metadata['.tag'] === 'metadata' &&
                (m.metadata as any).metadata?.name.toLowerCase() === `${templateKey.toLowerCase()}.ai`
            );
            if (aiMatch) {
                isAiFile = true;
                aiPath = (aiMatch.metadata as any).metadata.path_display || aiPath;
            }
        } catch (e) {
            console.warn("Dropbox AI search failed, but continuing:", e);
        }

        if (isAiFile) {
            try {
                const url = await generateDropboxThumbnailFallback(aiPath);
                return NextResponse.json({ success: true, url, isFallback: true });
            } catch (err: any) {
                console.error("[Preview] AI Fallback failed:", err);
                return NextResponse.json({ success: false, error: 'Nepodarilo sa stiahnuť AI náhľad: ' + err.message, requiresAgent: true });
            }
        }

        // 1. Download PSD
        let fileBuffer: Buffer | ArrayBuffer | null = null;
        let psdPath = `/TEMPLATES/${templateKey}.psd`;

        const getBufferFromDbx = async (dbxPath: string) => {
            const dbxResponse = await dbx.filesDownload({ path: dbxPath });
            if ((dbxResponse.result as any).fileBinary) {
                return (dbxResponse.result as any).fileBinary;
            }
            if ((dbxResponse.result as any).fileBlob) {
                const blob = (dbxResponse.result as any).fileBlob;
                return Buffer.from(await blob.arrayBuffer());
            }
            return null;
        };

        try {
            fileBuffer = await getBufferFromDbx(psdPath);
        } catch (err: any) {
            // Try psdt
            try {
                psdPath = `/TEMPLATES/${templateKey}.psdt`;
                fileBuffer = await getBufferFromDbx(psdPath);
            } catch (err2: any) {
                // Return fallback error just in case it's an AI file not caught by search, or missing
                return NextResponse.json({
                    success: false,
                    error: `Šablóna sa nenašla. Skontrolujte cestu k súboru .psd alebo .ai.`,
                    requiresAgent: false // Change to false if it's just a 404
                });
            }
        }

        if (!fileBuffer) {
            return NextResponse.json({ success: false, error: 'Empty file buffer from Dropbox' }, { status: 500 });
        }

        // 2. Parse PSD
        let psd;
        try {
            psd = readPsd(fileBuffer);
        } catch (parseErr: any) {
            console.log(`[Preview] PSD Parse Error (CMYK/Unsupported): ${parseErr.message}`);
            // Fallback to Dropbox thumbnail for CMYK
            try {
                const url = await generateDropboxThumbnailFallback(psdPath);
                return NextResponse.json({ success: true, url, isFallback: true });
            } catch (thumbErr: any) {
                console.error("[Preview] CMYK Fallback failed:", thumbErr);
                return NextResponse.json({
                    success: false,
                    error: 'Šablónu nie je možné renderovať (CMYK/Nepodporovaný formát) a náhľad z Dropboxu zlyhal.',
                    requiresAgent: true
                });
            }
        }

        // 3. Map data to text layers
        const traverseAndReplace = (node: any) => {
            if (node.children) {
                node.children.forEach(traverseAndReplace);
            }
            if (node.name && node.text && node.text.text) {
                const layerName = node.name.toUpperCase();
                let newText = null;

                if (layerName === 'NAME_MAIN' && data.names) newText = data.names;
                else if (layerName === 'DATE_MAIN' && data.date) newText = data.date;
                else if (layerName === 'BODY_FULL' && data.body) newText = data.body;

                if (newText) {
                    node.text.text = newText;
                    if (node.textItem) {
                        node.textItem.contents = newText;
                    }
                }
            }
        };

        if (psd.children) {
            psd.children.forEach(traverseAndReplace);
        }

        // 4. Render composite image
        if (!psd.canvas) {
            return NextResponse.json({ success: false, error: 'PSD rendered canvas is empty (ag-psd issue).' }, { status: 500 });
        }

        const canvas = psd.canvas as any;
        const outBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });

        // 5. Upload to Previews DropBox folder
        // Use a clean filename specific to this generation
        const previewFilename = `Preview_Order${orderId}_Item${itemId}_${Date.now()}.jpg`;
        const previewDbxPath = `/AutoDesign_App/PREVIEWS/${previewFilename}`;

        await dbx.filesUpload({
            path: previewDbxPath,
            contents: outBuffer,
            mode: { '.tag': 'overwrite' }
        });

        // 6. Get Shared Link for UI
        let sharedLink = null;
        try {
            const linkRes = await dbx.sharingCreateSharedLinkWithSettings({
                path: previewDbxPath,
                settings: { requested_visibility: { '.tag': 'public' } }
            });
            sharedLink = linkRes.result.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '&raw=1');
        } catch (linkErr: any) {
            if (linkErr.error && linkErr.error['.tag'] === 'shared_link_already_exists') {
                const listRes = await dbx.sharingListSharedLinks({ path: previewDbxPath, direct_only: true });
                if (listRes.result.links && listRes.result.links.length > 0) {
                    sharedLink = listRes.result.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '&raw=1');
                }
            }
        }

        return NextResponse.json({ success: true, url: sharedLink });

    } catch (error: any) {
        console.error("Preview API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
