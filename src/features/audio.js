// Audio pipeline: take an uploaded video (screen-share recording, clip, etc.),
// strip the video track, and keep just the audio as an mp3. Uses the bundled
// ffmpeg-static binary (no system ffmpeg needed). Files land in data/audio so
// the dashboard app can list + play them, and /play can stream them to voice.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

export const AUDIO_DIR = join(process.cwd(), 'data', 'audio');
mkdirSync(AUDIO_DIR, { recursive: true });

// Let prism-media / @discordjs/voice find the same bundled ffmpeg for playback.
if (ffmpegPath && !process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = ffmpegPath;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg binary not found (ffmpeg-static missing)'));
    const p = spawn(ffmpegPath, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`))));
  });
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

const slug = (s) => (s || 'audio').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 40) || 'audio';

// Strip video from a remote file (Discord attachment URL) → mp3 on disk.
// Returns { path, name }. Throws on failure (caller shows the message).
export async function extractAudioFromUrl(url, originalName = 'audio') {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const base = slug(originalName);
  const inPath = join(AUDIO_DIR, `.in_${id}`);
  const name = `${base}_${id}.mp3`;
  const outPath = join(AUDIO_DIR, name);
  await download(url, inPath);
  try {
    // -vn drops video; libmp3lame @ VBR quality 2 (~190kbps) is small + clean.
    await runFfmpeg(['-y', '-i', inPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', outPath]);
  } finally {
    unlink(inPath).catch(() => {});
  }
  return { path: outPath, name };
}

// Newest-first list of extracted tracks, for the dashboard + /play autocomplete.
export function listAudio() {
  if (!existsSync(AUDIO_DIR)) return [];
  return readdirSync(AUDIO_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .map((f) => { const s = statSync(join(AUDIO_DIR, f)); return { name: f, size: s.size, mtime: s.mtimeMs }; })
    .sort((a, b) => b.mtime - a.mtime);
}

// Resolve a saved track name to an absolute path (guards against traversal).
export function resolveTrack(name) {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  const p = join(AUDIO_DIR, name);
  return existsSync(p) ? p : null;
}
