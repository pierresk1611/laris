import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// We use a fallback secret if the environment variable is not set.
// The user should set ENCRYPTION_SECRET in their .env for production.
const SECRET = process.env.ENCRYPTION_SECRET || 'laris-default-secret-32-chars-long-!!!';

export function encrypt(text: string): string {
    if (!text) return "";

    // Ensure secret is 32 bytes
    const key = crypto.createHash('sha256').update(SECRET).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function isFallbackSecret(): boolean {
    return !process.env.ENCRYPTION_SECRET;
}

export function decrypt(hash: string): string {
    if (!hash || !hash.includes(':')) return hash;

    try {
        const [ivHex, authTagHex, encryptedHex] = hash.split(':');
        const key = crypto.createHash('sha256').update(SECRET).digest();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (e: any) {
        console.error("Decryption failed:", e.message);
        return "DECRYPTION_ERROR:" + e.message;
    }
}
