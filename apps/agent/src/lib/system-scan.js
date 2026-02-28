const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { getDropboxClient } = require('./dropbox');

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const AGENT_TOKEN = process.env.AGENT_ACCESS_TOKEN;
const LOCAL_ROOT_PATH = process.env.LOCAL_ROOT_PATH;

/**
 * Scans the local filesystem for templates and syncs to DB.
 * Generates Dropbox Shared Links for previews.
 */
async function processSystemScan(job) {
    console.log(`[SystemScan] Starting scan of ${LOCAL_ROOT_PATH}...`);

    // 1. Scan Local Files
    // We assume templates are in a specific folder structure or just flattened?
    // Based on previous context, they seem to be in directories like 'TEMPLATES' or root.
    // Let's scan recursively or just specific known folders if configured.
    // For now, let's scan the 'TEMPLATES' directory if it exists, otherwise root.

    const templatesDir = path.join(LOCAL_ROOT_PATH, 'TEMPLATES');
    const targetDir = (await fs.exists(templatesDir)) ? templatesDir : LOCAL_ROOT_PATH;

    console.log(`[SystemScan] Target Directory: ${targetDir}`);

    const files = await getFilesRecursive(targetDir);
    const psdFiles = files.filter(f => f.toLowerCase().endsWith('.psd') || f.toLowerCase().endsWith('.psdt'));

    console.log(`[SystemScan] Found ${psdFiles.length} PSD templates.`);

    // 2. Prepare Data & Dropbox Links
    const dbx = await getDropboxClient();
    const updates = [];

    // Batch processing to avoid rate limits?
    // We'll process sequentially for safety in this first version

    for (const psdPath of psdFiles) {
        try {
            const filename = path.basename(psdPath);
            const key = filename.replace(/\.(psd|psdt)$/i, ''); // Simple key extraction

            // Look for a corresponding Preview Image (.jpg, .png)
            // Usually same name: '001.psd' -> '001.jpg'
            const jpgPath = psdPath.replace(/\.(psd|psdt)$/i, '.jpg');
            const pngPath = psdPath.replace(/\.(psd|psdt)$/i, '.png');

            let previewPath = null;
            if (await fs.exists(jpgPath)) previewPath = jpgPath;
            else if (await fs.exists(pngPath)) previewPath = pngPath;

            let sharedLink = null;

            if (previewPath) {
                // Convert local path to Dropbox Path
                // This requires knowing the relative path from the Dropbox Root
                const relativePath = path.relative(LOCAL_ROOT_PATH, previewPath);
                // Ensure dropbox style path (forward slashes, leading slash)
                const dbxPath = '/' + relativePath.split(path.sep).join('/');

                // Get or Create Shared Link
                sharedLink = await getSharedLink(dbx, dbxPath);
            }

            updates.push({
                key: key,
                name: key, // Use key as name for now
                imageUrl: sharedLink,
                // We could send local path too if needed for agent internal use, but DB is for UI
            });

            if (updates.length % 5 === 0) {
                console.log(`[SystemScan] Processed ${updates.length}/${psdFiles.length}...`);
            }

        } catch (err) {
            console.warn(`[SystemScan] Skipping ${psdPath}: ${err.message}`);
        }
    }

    // 3. Send to API
    if (updates.length > 0) {
        console.log(`[SystemScan] Sending ${updates.length} templates to API...`);
        // Send in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await axios.post(`${API_URL}/templates`, { templates: chunk }, {
                headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
            });
        }
    }

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
