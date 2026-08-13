// ?earthspin — generate a VIDEO of Earth rotating, stitched from a full day of
// NASA EPIC (DSCOVR) whole-disk photos. Each frame is composited "professionally"
// onto a starfield with an atmospheric glow, then ffmpeg encodes an MP4 (tuned to
// stay under Discord's 8 MB limit). This is a real rotation — EPIC shoots the
// sunlit face repeatedly through the day as the planet turns.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getEpicDay } from './funApis.js';

const cooldown = new Map();
const COOLDOWN = 60000; // heavy job — one per user per minute
const OUT = 1024;
const MAX_FRAMES = 22;

// A fixed starfield we reuse for every frame (so stars don't twinkle randomly).
function makeStarfield() {
  const c = createCanvas(OUT, OUT); const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, OUT, OUT); bg.addColorStop(0, '#02030a'); bg.addColorStop(1, '#080d1c');
  g.fillStyle = bg; g.fillRect(0, 0, OUT, OUT);
  let seed = 1337; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 340; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; const s = rnd() < 0.12 ? 2 : 1; g.fillRect(rnd() * OUT, rnd() * OUT, s, s); }
  return c;
}

function composeFrame(stars, epic) {
  const c = createCanvas(OUT, OUT); const g = c.getContext('2d');
  g.drawImage(stars, 0, 0);
  const cx = OUT / 2, cy = OUT / 2, R = OUT * 0.46;
  const glow = g.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.18);
  glow.addColorStop(0, 'rgba(90,150,255,0.35)'); glow.addColorStop(1, 'rgba(90,150,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, R * 1.18, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const D = R * 2.16; // EPIC disk is ~90% of its frame → oversize slightly to fill
  g.drawImage(epic, cx - D / 2, cy - D / 2, D, D);
  g.restore();
  return c;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code))));
  });
}

export async function sendEarthSpin(message, arg = '') {
  const last = cooldown.get(message.author.id) || 0;
  if (Date.now() - last < COOLDOWN) { await message.reply(`⏳ Rendering a spin is heavy — try again in ${Math.ceil((COOLDOWN - (Date.now() - last)) / 1000)}s.`).catch(() => {}); return; }
  cooldown.set(message.author.id, Date.now());

  const status = await message.reply('🌍 **Rendering Earth’s rotation…** downloading frames + encoding video (this takes ~15–30s).').catch(() => null);
  const dir = path.join(os.tmpdir(), `earthspin-${Date.now()}`);
  try {
    const { date, frames } = await getEpicDay(/^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : '');
    const use = frames.slice(0, MAX_FRAMES);
    if (use.length < 4) throw new Error('not enough frames for that day — try another date');
    await fsp.mkdir(dir, { recursive: true });
    const stars = makeStarfield();

    let n = 0;
    for (const url of use) {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (!r?.ok) continue;
      const epic = await loadImage(Buffer.from(await r.arrayBuffer())).catch(() => null);
      if (!epic) continue;
      const frame = composeFrame(stars, epic);
      await fsp.writeFile(path.join(dir, `f${String(n).padStart(3, '0')}.png`), frame.toBuffer('image/png'));
      n++;
      await new Promise((r) => setTimeout(r, 120)); // be gentle on NASA's CDN
    }
    if (n < 4) throw new Error('frame download failed — try again in a moment');

    // Encode. Boomerang-loop feel via a modest framerate; tuned CRF for <8 MB.
    const out = path.join(dir, 'earth.mp4');
    for (const crf of [22, 26, 30, 34]) {
      await ffmpeg(['-y', '-framerate', '8', '-i', path.join(dir, 'f%03d.png'),
        '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-movflags', '+faststart', out]);
      const size = (await fsp.stat(out)).size;
      if (size <= 8 * 1024 * 1024 - 128 * 1024) break;
    }
    const buf = await fsp.readFile(out);

    const embed = new EmbedBuilder().setColor(0x0b3d91)
      .setTitle('🌍 Earth’s Rotation — EPIC Timelapse')
      .setDescription(
        `**${n} whole-Earth photos** from **${date}**, stitched into a video. NASA's **EPIC** camera on the **DSCOVR** ` +
        `satellite (1,000,000 mi away at L1) shoots the sunlit face repeatedly as the planet **rotates** through the day — ` +
        `so this is a *real* spinning Earth, composited on a starfield and rendered to MP4.`,
      )
      .setFooter({ text: 'NASA EPIC / DSCOVR · pro-composited & encoded by Sentinel' });
    await message.reply({ embeds: [embed], files: [new AttachmentBuilder(buf, { name: 'earth-spin.mp4' })] }).catch(() => {});
    if (status) await status.delete().catch(() => {});
  } catch (e) {
    const hint = /rate limit/i.test(e.message) && !process.env.NASA_API_KEY
      ? '\n💡 This needs a free **NASA API key** (the shared demo key is rate-limited). Get one at https://api.nasa.gov and add `NASA_API_KEY=...` to `.env`.'
      : '';
    if (status) await status.edit(`⚠️ Couldn’t build the spin: ${e.message}${hint}`).catch(() => {});
    else await message.reply(`⚠️ ${e.message}${hint}`).catch(() => {});
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
