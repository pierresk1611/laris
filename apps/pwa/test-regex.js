const TEMPLATE_CODE_REGEX = /\b([A-Z]{2,5}\d{2,4})\b/i;

const testEntries = [
    { name: "001 SVADBA", '.tag': 'folder' },
    { name: "PNO16", '.tag': 'folder' },
    { name: "PNO16.psd", '.tag': 'file' },
    { name: "Svadobné oznámenie KSO15.psd", '.tag': 'file' },
    { name: "random_file.txt", '.tag': 'file' },
    { name: "Obrazok.jpg", '.tag': 'file' },
    { name: "Cennik 2025.pdf", '.tag': 'file' }
];

console.log("Testing Regex Logic...");

const validTemplates = testEntries.filter(e => {
    const name = e.name.toUpperCase();
    const nameWithoutExt = name.includes('.') ? name.split('.')[0] : name;

    const match = TEMPLATE_CODE_REGEX.test(nameWithoutExt);
    console.log(`'${e.name}' -> ${match ? 'MATCH' : 'NO MATCH'}`);
    if (match) {
        const m = nameWithoutExt.match(TEMPLATE_CODE_REGEX);
        console.log(`   Extracted Key: ${m[0]}`);
    }
    return match;
});

console.log(`\nTotal Valid: ${validTemplates.length}`);
