const TEMPLATE_CODE_REGEX = /\b([A-Z]{2,5}\d{2,4})\b/i;

const testCases = [
    "001 SVADBA",
    "004 PROMOCNE",
    "13.9",
    "20.9",
    "2022_1a",
    "aa_produktova",
    "1",
    "PNO16",
    "PNO16.psd",
    "Folder/PNO16",
    "Svadobne PNO16",
    "Nieco Ine"
];

console.log(`Regex: ${TEMPLATE_CODE_REGEX}`);

testCases.forEach(name => {
    // Logic from route.ts
    const nameWithoutExt = name.includes('.') ? name.split('.')[0] : name;
    const isMatch = TEMPLATE_CODE_REGEX.test(nameWithoutExt);
    console.log(`'${name}' -> Clean: '${nameWithoutExt}' -> Match: ${isMatch}`);
});
