const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env manually
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
        env[key] = val;
    }
});

const clientId = env.DROPBOX_APP_KEY;
const clientSecret = env.DROPBOX_APP_SECRET;
const refreshToken = env.DROPBOX_REFRESH_TOKEN;

console.log('Testing Dropbox Auth with:');
console.log('Client ID:', clientId ? 'OK' : 'MISSING');
console.log('Client Secret:', clientSecret ? 'OK' : 'MISSING');
console.log('Refresh Token:', refreshToken ? 'OK' : 'MISSING');

if (!clientId || !clientSecret || !refreshToken) {
    console.error('Missing credentials!');
    process.exit(1);
}

// Function to refresh token
function getAccessToken() {
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken
        }).toString();

        const auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');

        const options = {
            hostname: 'api.dropbox.com',
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + auth,
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(data);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

// Function to list folder
function listFolder(accessToken) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            path: '/TEMPLATES',
            recursive: false,
            limit: 10
        });

        const options = {
            hostname: 'api.dropboxapi.com',
            path: '/2/files/list_folder',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(data);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

(async () => {
    try {
        console.log('1. Refreshing Token...');
        const tokenData = await getAccessToken();
        console.log('NOTE: Token Type:', tokenData.token_type);
        console.log('NOTE: Expires In:', tokenData.expires_in);

        const accessToken = tokenData.access_token;
        console.log('SUCCESS: Got new Access Token!');

        console.log('2. Listing /TEMPLATES...');
        const list = await listFolder(accessToken);
        console.log('SUCCESS: Listed Files!');
        console.log('Entries found:', list.entries.length);
        list.entries.slice(0, 3).forEach(e => console.log(' -', e.name));

    } catch (e) {
        console.error('FAILURE:', e);
        process.exit(1);
    }
})();
