import { Dropbox } from 'dropbox';
import { getSetting } from '@/lib/settings';

// Ensure this runs only on server side
if (typeof window !== 'undefined') {
    throw new Error("Dropbox client should only be used on the server.");
}

export async function refreshDropboxToken(clientId: string, clientSecret: string, refreshToken: string) {
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
    } catch (e: any) {
        console.error("Failed to refresh Dropbox token:", e);
        throw e;
    }
}

export async function getRefreshToken() {
    // Try DB Settings first, fall back to ENV
    const clientIdRaw = await getSetting('DROPBOX_APP_KEY') || process.env.DROPBOX_APP_KEY;
    const clientSecretRaw = await getSetting('DROPBOX_APP_SECRET') || process.env.DROPBOX_APP_SECRET;
    const refreshTokenRaw = await getSetting('DROPBOX_REFRESH_TOKEN') || process.env.DROPBOX_REFRESH_TOKEN;

    const clientId = clientIdRaw?.trim();
    const clientSecret = clientSecretRaw?.trim();
    const refreshToken = refreshTokenRaw?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Dropbox Credentials (DB or .env)");
    }

    return refreshDropboxToken(clientId, clientSecret, refreshToken);
}

export async function getDropboxClient() {
    const accessToken = await getRefreshToken();
    return new Dropbox({ accessToken, fetch: fetch });
}
