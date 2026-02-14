const { PrismaClient } = require('@prisma/client');
const { Dropbox } = require('dropbox');

const prisma = new PrismaClient();
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
        const folderPathRaw = await getSetting('DROPBOX_FOLDER_PATH');
        const folderPath = folderPathRaw?.trim() ? (folderPathRaw.trim().startsWith('/') ? folderPathRaw.trim() : `/${folderPathRaw.trim()}`) : '/TEMPLATES';

        console.log(`Using path: "${folderPath}"`);

        if (!accessToken) {
            console.error("No valid Dropbox credentials found.");
            process.exit(1);
        }

        const dbx = new Dropbox({ accessToken, fetch });

        // Simulate 1st Request (No Cursor)
        console.log("--- REQUEST 1: Initial Scan ---");
        let response = await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 20 // Small limit to force pagination
        });

        console.log(`Req 1 Success. HasMore: ${response.result.has_more}. Cursor: ${response.result.cursor ? 'YES' : 'NO'}`);

        if (response.result.has_more && response.result.cursor) {
            const cursor = response.result.cursor;
            console.log("--- REQUEST 2: Continue with Cursor ---");
            console.log(`Sending cursor: ${cursor.substring(0, 20)}...`);

            const response2 = await dbx.filesListFolderContinue({ cursor });
            console.log(`Req 2 Success. HasMore: ${response2.result.has_more}`);
        }

    } catch (error) {
        console.error("ERROR CAUGHT:");
        if (error.status) console.error("Status:", error.status);
        if (error.error) console.error("Error Body:", JSON.stringify(error.error, null, 2));
        else console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
