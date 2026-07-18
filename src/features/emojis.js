// Custom emoji system — list bundled emojis (assets/emojis/) and add emojis to a
// guild from a preset, a URL, or an attachment. Supports .png / .gif / .webp;
// WebP is auto-converted to PNG on upload because Discord won't accept WebP.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export const EMOJI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'emojis');

/** Every bundled emoji: [{ name, file, animated }]. Supports .png, .gif, .webp. */
export function listBundledEmojis() {
  try {
    return readdirSync(EMOJI_DIR)
      .filter((f) => /\.(png|gif|webp)$/i.test(f))
      .map((f) => ({ name: f.replace(/\.(png|gif|webp)$/i, ''), file: f, animated: /\.gif$/i.test(f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Just the names — handy for validation and command choices. */
export function bundledEmojiNames() {
  return listBundledEmojis().map((e) => e.name);
}

/** Absolute path to a bundled emoji (prefers .gif, then .png, then .webp). Sanitized. */
export function bundledEmojiPath(name) {
  const safe = String(name || '').replace(/[^a-z0-9_-]/gi, '');
  for (const ext of ['gif', 'png', 'webp']) {
    const p = join(EMOJI_DIR, `${safe}.${ext}`);
    if (existsSync(p)) return p;
  }
  return join(EMOJI_DIR, `${safe}.png`);
}

/** Is this buffer a WebP image? (RIFF….WEBP magic bytes.) */
function isWebpBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
}

/** Decode any image source and re-encode as a small (≤128px) PNG buffer. */
async function toPng(src) {
  const img = await loadImage(src);
  const max = 128;
  const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
  const w = Math.max(1, Math.round((img.width || max) * scale));
  const h = Math.max(1, Math.round((img.height || max) * scale));
  const canvas = createCanvas(w, h);
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toBuffer('image/png');
}

/** Convert WebP sources to PNG; pass everything else through untouched. */
async function normalizeSource(source) {
  try {
    if (Buffer.isBuffer(source)) return isWebpBuffer(source) ? await toPng(source) : source;
    if (typeof source === 'string') {
      if (/^data:image\/webp/i.test(source)) return await toPng(Buffer.from(source.split(',')[1] || '', 'base64'));
      if (/^https?:\/\//i.test(source)) {
        if (/\.webp(\?|#|$)/i.test(source)) return await toPng(Buffer.from(await (await fetch(source)).arrayBuffer()));
        return source; // let discord.js fetch png/gif/jpg URLs directly
      }
      if (existsSync(source) && /\.webp$/i.test(source)) return await toPng(source);
    }
  } catch {
    // fall through to the original source; discord will validate it
  }
  return source;
}

/** Add an emoji to a guild. `source` can be a file path, URL, data URI, or Buffer. */
export async function addEmojiToGuild(guild, name, source) {
  const clean = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  if (clean.length < 2) throw new Error('Emoji name must be 2–32 chars (letters, numbers, underscores).');
  if (!source) throw new Error('No image provided.');
  const attachment = await normalizeSource(source);
  return guild.emojis.create({ attachment, name: clean });
}
