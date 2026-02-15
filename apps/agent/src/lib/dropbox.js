const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

let cachedConfig = null;

async function getDropboxCredentials() {
    if (cachedConfig) return cachedConfig;

    // 1. Try Env
    if (process.env.DROPBOX_APP_KEY && process.env.DROPBOX_REFRESH_TOKEN) {
        console.log("Using .env Dropbox credentials.");
        return {
            clientId: process.env.DROPBOX_APP_KEY,
            clientSecret: process.env.DROPBOX_APP_SECRET,
            refreshToken: process.env.DROPBOX_REFRESH_TOKEN
        };
    }

    // 2. Try Fetch from PWA
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    const agentToken = process.env.AGENT_ACCESS_TOKEN;

    if (!agentToken) {
        throw new Error("Agent Token missing, cannot fetch config.");
    }

    try {
        console.log(`Fetching Dropbox config from PWA (${apiUrl})...`);
        const res = await fetch(`${apiUrl}/agent/config`, {
            headers: { 'Authorization': `Bearer ${agentToken}` }
        });

        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);

        const data = await res.json();
        if (data.success && data.config && data.config.dropbox) {
            const dbx = data.config.dropbox;
            if (!dbx.appKey || !dbx.refreshToken) {
                throw new Error("Received incomplete Dropbox config from PWA.");
            }
            cachedConfig = {
                clientId: dbx.appKey,
                clientSecret: dbx.appSecret,
                refreshToken: dbx.refreshToken
            };
            console.log("✅ Successfully loaded Dropbox config from PWA.");
            return cachedConfig;
        } else {
            throw new Error(data.error || "Invalid config response");
        }
    } catch (e) {
        console.error("Failed to fetch config from PWA:", e.message);
        throw e;
    }
}

async function refreshDropboxToken(clientId, clientSecret, refreshToken) {
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Dropbox Credentials");
    }

    try {
        const response = await fetch('https://api.dropbox.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'refresh_token',
                'refresh_token': refreshToken,
                'client_id': clientId,
                'client_secret': clientSecret
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Dropbox Token Error: ${data.error_description || data.error || response.statusText}`);
        }

        return data.access_token;
    } catch (e) {
        console.error("Failed to refresh Dropbox token:", e);
        throw e;
    }
}

async function getDropboxClient() {
    const creds = await getDropboxCredentials();
    const accessToken = await refreshDropboxToken(creds.clientId, creds.clientSecret, creds.refreshToken);
    return new Dropbox({ accessToken, fetch: fetch });
}

module.exports = { getDropboxClient };
