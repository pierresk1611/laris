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

        if (!accessToken) {
            console.error("No valid Dropbox credentials found.");
            process.exit(1);
        }

        const dbx = new Dropbox({ accessToken, fetch });
        const folderPath = '/TEMPLATES';
        // Or '/LARIS PODKLADY' based on debug output which showed "Using path: /LARIS PODKLADY" earlier

        console.log(`Listing ${folderPath} recursively...`);
        let allEntries = [];
        let response = await dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            limit: 100
        });
        allEntries.push(...response.result.entries);

        while (response.result.has_more) {
            process.stdout.write(".");
            response = await dbx.filesListFolderContinue({ cursor: response.result.cursor });
            allEntries.push(...response.result.entries);
        }
        console.log(`\nTotal Entries: ${allEntries.length}`);

        const TEMPLATE_CODE_REGEX = /\b([A-Z]{2,5}\d{2,4})\b/i;
        let matched = 0;

        for (const e of allEntries) {
            const name = e.name;
            const nameWithoutExt = name.includes('.') ? name.split('.')[0] : name;

            const match = TEMPLATE_CODE_REGEX.exec(nameWithoutExt);
            if (match) {
                matched++;
                if (matched <= 10) console.log(`MATCH: ${name} -> Key: ${match[1].toUpperCase()}`);
            }
        }
        console.log(`Total Matched Templates: ${matched}`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
