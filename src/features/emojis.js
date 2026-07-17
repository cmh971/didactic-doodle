// Custom emoji system — list bundled emoji PNGs (assets/emojis/) and add emojis
// to a guild from a preset, a URL, or an attachment.
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EMOJI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'emojis');

/** Every bundled emoji: [{ name, file, animated }]. Supports .png and .gif. */
export function listBundledEmojis() {
  try {
    return readdirSync(EMOJI_DIR)
      .filter((f) => /\.(png|gif)$/i.test(f))
      .map((f) => ({ name: f.replace(/\.(png|gif)$/i, ''), file: f, animated: /\.gif$/i.test(f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Just the names — handy for validation and command choices. */
export function bundledEmojiNames() {
  return listBundledEmojis().map((e) => e.name);
}

/** Absolute path to a bundled emoji (prefers .gif, then .png). Sanitized. */
export function bundledEmojiPath(name) {
  const safe = String(name || '').replace(/[^a-z0-9_-]/gi, '');
  for (const ext of ['gif', 'png']) {
    const p = join(EMOJI_DIR, `${safe}.${ext}`);
    if (existsSync(p)) return p;
  }
  return join(EMOJI_DIR, `${safe}.png`);
}

/** Add an emoji to a guild. `source` can be a file path, URL, data URI, or Buffer. */
export async function addEmojiToGuild(guild, name, source) {
  const clean = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  if (clean.length < 2) throw new Error('Emoji name must be 2–32 chars (letters, numbers, underscores).');
  if (!source) throw new Error('No image provided.');
  return guild.emojis.create({ attachment: source, name: clean });
}
