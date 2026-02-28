const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clean() {
    console.log('--- DB CLEANUP SCRIPT (Templates & FileInbox Only) ---');

    try {
        // 1. Delete all Jobs related to those Templates if there's any cascade issue, 
        // although they aren't strictly linked via foreign keys in schema right now.

        // 2. Delete all records in Template
        console.log('Vymazávam staré tabuľky Template...');
        const delTemplates = await prisma.template.deleteMany({});
        console.log(`Vymazaných záznamov Template: ${delTemplates.count}`);

        // 3. Delete all records in FileInbox
        console.log('Vymazávam starú doručenú poštu (FileInbox)...');
        const delInbox = await prisma.fileInbox.deleteMany({});
        console.log(`Vymazaných záznamov FileInbox: ${delInbox.count}`);

        console.log('Hotovo. Tabuľky pre šablóny a súbory z Dropboxu sú úplne čisté.');

    } catch (err) {
        console.error('Chyba pri vymazávaní!', err);
    } finally {
        await prisma.$disconnect();
    }
}

clean();
