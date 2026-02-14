const { PrismaClient } = require('@prisma/client');
const { Dropbox } = require('dropbox');

const prisma = new PrismaClient();

// Use node-fetch if global fetch is missing (Node < 18)
const fetch = global.fetch || require('node-fetch');

async function getSetting(key) {
    const s = await prisma.setting.findUnique({ where: { id: key } });
    if (s && s.value) return s.value;
    return process.env[key];
}

async function main() {
    try {
        console.log("Fetching credentials...");
        const accessToken = await getSetting('DROPBOX_ACCESS_TOKEN');
        const refreshToken = await getSetting('DROPBOX_REFRESH_TOKEN');
        const clientId = await getSetting('DROPBOX_APP_KEY');
        const clientSecret = await getSetting('DROPBOX_APP_SECRET');
        const customPath = await getSetting('DROPBOX_FOLDER_PATH');
        const folderPath = customPath || '/TEMPLATES';

        console.log("Using path:", folderPath);

        let dbx;
        if (refreshToken && clientId && clientSecret) {
            console.log("Using Refresh Token");
            dbx = new Dropbox({ clientId, clientSecret, refreshToken, fetch });
        } else if (accessToken) {
            console.log("Using Access Token");
            dbx = new Dropbox({ accessToken, fetch });
        } else {
            console.error("No valid Dropbox credentials found in DB or ENV.");
            process.exit(1);
        }

        console.log(`Listing ${folderPath} recursively...`);
        const response = await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 100
        });

        console.log(`--- ENTRIES (First 100) ---`);
        response.result.entries.forEach(e => {
            console.log(`[${e['.tag']}] ${e.name} (${e.path_lower})`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
