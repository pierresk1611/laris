const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { getDropboxClient } = require('./dropbox');

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const AGENT_TOKEN = process.env.AGENT_ACCESS_TOKEN;
const LOCAL_ROOT_PATH = process.env.LOCAL_ROOT_PATH;

async function updateProgress(label, current, total) {
    try {
        await axios.post(`${API_URL}/agent/progress`, {
            key: 'TEMPLATE_SCAN',
            current,
            total,
            label
        }, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });
    } catch (e) {
        console.warn(`[ProgressUpdate] Failed: ${e.message}`);
    }
}

/**
 * Scans the local filesystem for templates and syncs to DB.
 * Follows Naming v2: ad_SKU_TYPE_NAME.psd
 */
async function processSystemScan(job) {
    console.log(`[SystemScan] Starting scan of ${LOCAL_ROOT_PATH}...`);
    await updateProgress('Spúšťam skenovanie...', 0, 100);

    const templatesDir = path.join(LOCAL_ROOT_PATH, 'TEMPLATES');
    const targetDir = (await fs.exists(templatesDir)) ? templatesDir : LOCAL_ROOT_PATH;

    console.log(`[SystemScan] Target Directory: ${targetDir}`);

    const allFiles = await getFilesRecursive(targetDir);
    const regex = /^ad_(.*?)_([OP])_(.*)\.(psd|ai)$/i;

    const skuGroups = {};

    // 1. Parse and group files by SKU
    for (const filePath of allFiles) {
        const filename = path.basename(filePath);
        const match = filename.match(regex);

        if (match) {
            const sku = match[1];
            const typeLetter = match[2].toUpperCase(); // O or P
            const originalName = match[3];
            const type = typeLetter === 'O' ? 'MAIN' : 'INVITE';

            if (!skuGroups[sku]) {
                skuGroups[sku] = {
                    sku: sku,
                    name: originalName,
                    files: []
                };
            }

            skuGroups[sku].files.push({
                localPath: filePath,
                filename: filename,
                type: type
            });
        }
    }

    const skus = Object.keys(skuGroups);
    console.log(`[SystemScan] Found ${skus.length} unique templates (SKUs) based on naming convention.`);
    await updateProgress(`Nájdených ${skus.length} šablón. Pripravujem náhľady...`, 5, 100);

    // 2. Prepare Data & Dropbox Links
    const dbx = await getDropboxClient();
    const updates = [];

    let processed = 0;
    for (const sku of skus) {
        try {
            const group = skuGroups[sku];
            const templateUpdate = {
                sku: group.sku,
                key: group.sku,
                name: group.name,
                files: []
            };

            for (const fileItem of group.files) {
                // Look for a corresponding Preview Image (.jpg, .png)
                const jpgPath = fileItem.localPath.replace(/\.(psd|ai|psdt)$/i, '.jpg');
                const pngPath = fileItem.localPath.replace(/\.(psd|ai|psdt)$/i, '.png');

                let previewPath = null;
                if (await fs.exists(jpgPath)) previewPath = jpgPath;
                else if (await fs.exists(pngPath)) previewPath = pngPath;

                let sharedLink = null;
                if (previewPath) {
                    const relativePath = path.relative(LOCAL_ROOT_PATH, previewPath);
                    const dbxPath = '/' + relativePath.split(path.sep).join('/');
                    sharedLink = await getSharedLink(dbx, dbxPath);
                }

                // Get shared link for the PSD/AI file itself for the PWA path reference
                const fileRelPath = path.relative(LOCAL_ROOT_PATH, fileItem.localPath);
                const fileDbxPath = '/' + fileRelPath.split(path.sep).join('/');

                templateUpdate.files.push({
                    type: fileItem.type,
                    path: fileDbxPath,
                    imageUrl: sharedLink
                });

                // If this is the MAIN file (O), use its thumbnail for the main Template record
                if (fileItem.type === 'MAIN') {
                    templateUpdate.imageUrl = sharedLink;
                }
            }

            // Fallback if no MAIN file but has INVITE
            if (!templateUpdate.imageUrl && templateUpdate.files.length > 0) {
                templateUpdate.imageUrl = templateUpdate.files[0].imageUrl;
            }

            updates.push(templateUpdate);
            processed++;

            if (processed % 5 === 0 || processed === skus.length) {
                const progressVal = Math.floor((processed / skus.length) * 80) + 10;
                await updateProgress(`Spracovávam ${processed}/${skus.length}: ${sku}...`, progressVal, 100);
            }

        } catch (err) {
            console.warn(`[SystemScan] Skipping SKU ${sku}: ${err.message}`);
        }
    }

    // 3. Send to API
    if (updates.length > 0) {
        console.log(`[SystemScan] Sending ${updates.length} templates to API...`);
        await updateProgress(`Odosielam ${updates.length} položiek do databázy...`, 95, 100);

        // Send in chunks of 20 - grouping makes objects larger
        const chunkSize = 20;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await axios.post(`${API_URL}/templates`, { templates: chunk }, {
                headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
            });
        }
    }

    await updateProgress('Skenovanie dokončené!', 100, 100);
    console.log(`[SystemScan] Completed.`);
}

/**
 * Helper to get or create a shared link for a file
 */
async function getSharedLink(dbx, dbxPath) {
    try {
        // 1. List valid existing links
        const listRes = await dbx.sharingListSharedLinks({
            path: dbxPath,
            direct_only: true
        });

        if (listRes.result.links && listRes.result.links.length > 0) {
            // Return the first valid link
            // Transform 'www.dropbox.com' to 'dl.dropboxusercontent.com' for direct access if needed, 
            // or use 'raw=1' param. 'raw=1' enables direct download/render.
            let url = listRes.result.links[0].url;
            return formatDropboxLink(url);
        }

        // 2. Create new link if none exist
        const createRes = await dbx.sharingCreateSharedLinkWithSettings({
            path: dbxPath,
            settings: {
                requested_visibility: { '.tag': 'public' }
            }
        });

        return formatDropboxLink(createRes.result.url);

    } catch (e) {
        // If it says 'shared_link_already_exists' but list failed? Should handle gracefully
        if (e.error && e.error['.tag'] === 'shared_link_already_exists') {
            // Retry list? or ignore
            // Actually if we list first, this shouldn't happen often.
            console.warn(`[Dropbox] Link exists check failed or race condition for ${dbxPath}`);
        }
        console.warn(`[Dropbox] Failed to get link for ${dbxPath}:`, e.message);
        return null;
    }
}

function formatDropboxLink(url) {
    // Convert standard link to direct image link
    // https://www.dropbox.com/s/xyz/img.jpg?dl=0 -> https://dl.dropboxusercontent.com/s/xyz/img.jpg
    // Or just append &raw=1 which redirects to content

    // Most robust for images in <img> tags:
    // replace 'www.dropbox.com' with 'dl.dropboxusercontent.com' and remove ?dl=0

    let newUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    newUrl = newUrl.replace('?dl=0', '');
    return newUrl;
}


// Recursive file walker
async function getFilesRecursive(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFilesRecursive(res) : res;
    }));
    return Array.prototype.concat(...files);
}

module.exports = { processSystemScan };
