// Dual-guarded secret storage. Every stored secret is protected by TWO independent
// watchdogs — if either one detects tampering or corruption, decryption fails shut:
//
//   Watchdog #1 — AES-256-GCM authentication tag (detects any ciphertext tampering)
//   Watchdog #2 — a separate HMAC-SHA256 over the whole payload (independent integrity)
//
// Keys are derived from APP_SECRET (or SESSION_SECRET) so secrets are useless if the
// DB is stolen without the env. Decrypted secrets are NEVER sent back to the browser.
import crypto from 'node:crypto';

const BASE = process.env.APP_SECRET || process.env.SESSION_SECRET || 'sentinel-insecure-fallback-change-me';
const AES_KEY = crypto.createHash('sha256').update(BASE + '::aes').digest();     // 32 bytes
const HMAC_KEY = crypto.createHash('sha256').update(BASE + '::hmac').digest();   // 32 bytes

/** Encrypt a secret into a self-describing, tamper-evident blob string. */
export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                 // watchdog #1
  const payload = Buffer.concat([iv, tag, ct]);
  const hmac = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest(); // watchdog #2
  return 'v1:' + Buffer.concat([hmac, payload]).toString('base64');
}

/** Decrypt a blob. Returns the plaintext, or null if EITHER watchdog fails. */
export function decryptSecret(blob) {
  try {
    if (typeof blob !== 'string' || !blob.startsWith('v1:')) return null;
    const buf = Buffer.from(blob.slice(3), 'base64');
    if (buf.length < 32 + 12 + 16) return null;
    const hmac = buf.subarray(0, 32);
    const payload = buf.subarray(32);
    // Watchdog #2: verify the outer HMAC in constant time.
    const expected = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest();
    if (hmac.length !== expected.length || !crypto.timingSafeEqual(hmac, expected)) return null;
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ct = payload.subarray(28);
    // Watchdog #1: GCM verifies the auth tag on final().
    const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null; // any failure = fail shut
  }
}

/** A safe masked preview (e.g. "ab••••yz") — never expose the real value. */
export function maskSecret(plaintext) {
  const s = String(plaintext || '');
  if (!s) return '';
  if (s.length <= 4) return '••••';
  return s.slice(0, 2) + '•'.repeat(Math.min(12, s.length - 4)) + s.slice(-2);
}
