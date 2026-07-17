// Custom emoji system — list bundled emoji PNGs (assets/emojis/) and add emojis
// to a guild from a preset, a URL, or an attachment.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EMOJI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'emojis');

/** Names of every bundled emoji (files ending in .png, without the extension). */
export function listBundledEmojis() {
  try {
    return readdirSync(EMOJI_DIR)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => f.replace(/\.png$/i, ''))
      .sort();
  } catch {
    return [];
  }
}

/** Absolute path to a bundled emoji PNG (name is sanitized to prevent traversal). */
export function bundledEmojiPath(name) {
  const safe = String(name || '').replace(/[^a-z0-9_-]/gi, '');
  return join(EMOJI_DIR, safe + '.png');
}

/** Add an emoji to a guild. `source` can be a file path, URL, data URI, or Buffer. */
export async function addEmojiToGuild(guild, name, source) {
  const clean = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  if (clean.length < 2) throw new Error('Emoji name must be 2–32 chars (letters, numbers, underscores).');
  if (!source) throw new Error('No image provided.');
  return guild.emojis.create({ attachment: source, name: clean });
}
