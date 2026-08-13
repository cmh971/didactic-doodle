// ?earth4k / ?cinematic — a hero-grade "Earth from space" render. Takes the live
// GOES GeoColor full disk and composites it like a movie poster: deep-space
// starfield, layered atmospheric rim-glow, shadow-lift + saturation colour grade
// (masked to the disk), a limb rim-light, cloud bloom, and a vignette. Rendered
// large and JPEG-tuned to sit under Discord's 8 MB limit.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';

const SATS = { 16: 'GOES16', 18: 'GOES18' };
const cooldown = new Map();

async function fetchDisk(sat) {
  const url = `https://cdn.star.nesdis.noaa.gov/${SATS[sat] || 'GOES16'}/ABI/FD/GEOCOLOR/5424x5424.jpg`;
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`GOES image unavailable (HTTP ${r.status}).`);
  return loadImage(Buffer.from(await r.arrayBuffer()));
}

export function renderCinematic(earth, OUT = 2048) {
  const c = createCanvas(OUT, OUT); const g = c.getContext('2d');
  const cx = OUT / 2, cy = OUT / 2, R = OUT * 0.405;

  // deep-space background + starfield (deterministic so it's stable)
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, OUT * 0.78);
  bg.addColorStop(0, '#0b1430'); bg.addColorStop(1, '#01020a');
  g.fillStyle = bg; g.fillRect(0, 0, OUT, OUT);
  let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const starN = Math.round(OUT * 0.35);
  for (let i = 0; i < starN; i++) {
    const x = rnd() * OUT, y = rnd() * OUT, a = 0.2 + rnd() * 0.8, sz = (rnd() < 0.07 ? 2.6 : rnd() < 0.3 ? 1.5 : 1) * (OUT / 1600);
    g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, sz / 2, 0, 7); g.fill();
  }

  // layered atmospheric glow
  for (const [r0, r1, col] of [[0.9, 1.2, 'rgba(80,150,255,0.5)'], [0.98, 1.34, 'rgba(120,180,255,0.15)']]) {
    const gl = g.createRadialGradient(cx, cy, R * r0, cx, cy, R * r1);
    gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(80,150,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, R * r1, 0, 7); g.fill();
  }

  // the Earth, clipped to a circle
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const D = R * 2.13; g.drawImage(earth, cx - D / 2, cy - D / 2, D, D);

  // colour grade — masked to the disk so it never leaks into space
  const x0 = Math.round(cx - R), y0 = Math.round(cy - R), W = Math.round(R * 2);
  const id = g.getImageData(x0, y0, W, W); const a = id.data;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const dx = px - R, dy = py - R; if (dx * dx + dy * dy > R * R) continue;
    const i = (py * W + px) * 4;
    let r = Math.pow(a[i] / 255, 0.80) * 255 * 1.10, gg = Math.pow(a[i + 1] / 255, 0.80) * 255 * 1.10, b = Math.pow(a[i + 2] / 255, 0.82) * 255 * 1.06;
    const l = 0.3 * r + 0.59 * gg + 0.11 * b, S = 1.28;
    r = l + (r - l) * S; gg = l + (gg - l) * S; b = l + (b - l) * S;
    a[i] = r < 0 ? 0 : r > 255 ? 255 : r; a[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg; a[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  g.putImageData(id, x0, y0); g.restore();

  // limb rim-light
  g.save(); g.strokeStyle = 'rgba(160,205,255,0.6)'; g.lineWidth = OUT / 320; g.filter = `blur(${OUT / 400}px)`;
  g.beginPath(); g.arc(cx, cy, R * 0.99, 0, Math.PI * 2); g.stroke(); g.filter = 'none'; g.restore();

  // cloud/city bloom
  const bloom = createCanvas(OUT, OUT); const bg2 = bloom.getContext('2d');
  bg2.filter = `blur(${OUT / 260}px)`; bg2.drawImage(c, 0, 0); bg2.filter = 'none';
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.22; g.drawImage(bloom, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

  // vignette
  const vg = g.createRadialGradient(cx, cy, OUT * 0.36, cx, cy, OUT * 0.73);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = vg; g.fillRect(0, 0, OUT, OUT);
  return c;
}

async function encodeUnder(canvas, limit) {
  for (const q of [96, 92, 88, 82, 76, 68, 60]) { const buf = await canvas.encode('jpeg', q); if (buf.length <= limit) return { buf, q }; }
  return { buf: await canvas.encode('jpeg', 55), q: 55 };
}

export async function sendCinematicEarth(message, arg = '') {
  const last = cooldown.get(message.author.id) || 0;
  if (Date.now() - last < 15000) { await message.reply(`⏳ Give it ${Math.ceil((15000 - (Date.now() - last)) / 1000)}s.`).catch(() => {}); return; }
  cooldown.set(message.author.id, Date.now());
  const sat = /18|west/i.test(arg) ? 18 : 16;
  try {
    const earth = await fetchDisk(sat);
    const { buf, q } = await encodeUnder(renderCinematic(earth, 2048), 8 * 1024 * 1024 - 200 * 1024);
    const embed = new EmbedBuilder().setColor(0x0b1430)
      .setTitle('🌍 Earth — Cinematic Render')
      .setDescription(`Live **GOES-${sat}** GeoColor full disk, composited on a starfield with atmospheric glow, colour-grade, bloom & rim-light. Rendered at **2048²** (${(buf.length / 1048576).toFixed(1)} MB, q${q}).`)
      .setImage('attachment://earth-cinematic.jpg')
      .setFooter({ text: 'NOAA GOES · cinematic composite by Sentinel' });
    await message.reply({ embeds: [embed], files: [new AttachmentBuilder(buf, { name: 'earth-cinematic.jpg' })] }).catch(() => {});
  } catch (e) {
    await message.reply(`⚠️ ${e.message}`).catch(() => {});
  }
}
