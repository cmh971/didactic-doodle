// Generates ANIMATED (.gif) custom emojis into assets/emojis/ using @napi-rs/canvas
// for the frames and gifenc for the GIF encoding. Re-run any time:
//   node tools/gen-anim-emojis.js
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { GIFEncoder, quantize, applyPalette } = createRequire(import.meta.url)('gifenc');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'emojis');
mkdirSync(OUT, { recursive: true });
const S = 128;
const FRAMES = 18;
const DELAY = 55; // ms per frame

function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  return g;
}
function star(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2; const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
  }
  ctx.closePath();
}
function heart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx, cy, cx - s, cy - s * 0.1, cx - s, cy - s * 0.55);
  ctx.bezierCurveTo(cx - s, cy - s * 1.05, cx - s * 0.35, cy - s * 1.15, cx, cy - s * 0.65);
  ctx.bezierCurveTo(cx + s * 0.35, cy - s * 1.15, cx + s, cy - s * 1.05, cx + s, cy - s * 0.55);
  ctx.bezierCurveTo(cx + s, cy - s * 0.1, cx, cy, cx, cy + s * 0.35);
  ctx.closePath();
}

function encodeGif(name, drawFrame) {
  const gif = GIFEncoder();
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  for (let f = 0; f < FRAMES; f++) {
    ctx.clearRect(0, 0, S, S);
    drawFrame(ctx, f / FRAMES, f);
    const { data } = ctx.getImageData(0, 0, S, S);
    const palette = quantize(data, 256, { format: 'rgba4444' });
    const index = applyPalette(data, palette, 'rgba4444');
    gif.writeFrame(index, S, S, { palette, delay: DELAY, transparent: true, dispose: 2 });
  }
  gif.finish();
  writeFileSync(join(OUT, name + '.gif'), Buffer.from(gif.bytes()));
  return name;
}

const made = [];

// 🌀 spinning loader ring
made.push(encodeGif('spin_ring', (ctx, t) => {
  ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(88,101,242,0.22)';
  ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#5865f2';
  const a = t * Math.PI * 2;
  ctx.beginPath(); ctx.arc(64, 64, 44, a, a + Math.PI * 0.7); ctx.stroke();
}));

// 💓 pulsing heart
made.push(encodeGif('pulse_heart', (ctx, t) => {
  const scale = 1 + 0.14 * Math.sin(t * Math.PI * 2);
  ctx.save(); ctx.translate(64, 64); ctx.scale(scale, scale); ctx.translate(-64, -64);
  ctx.fillStyle = radial(ctx, 64, 60, 60, '#ff9a8b', '#dc2626');
  heart(ctx, 64, 78, 46); ctx.fill();
  ctx.restore();
}));

// 🟢 bouncing orb
made.push(encodeGif('bounce_orb', (ctx, t) => {
  const y = 78 - 34 * Math.abs(Math.sin(t * Math.PI));
  ctx.fillStyle = radial(ctx, 64, y, 28, '#7bffb0', '#16a34a');
  ctx.beginPath(); ctx.arc(64, y, 28, 0, Math.PI * 2); ctx.fill();
}));

// ⭐ spinning star
made.push(encodeGif('spin_star', (ctx, t) => {
  ctx.save(); ctx.translate(64, 64); ctx.rotate(t * Math.PI * 2);
  ctx.fillStyle = radial(ctx, 0, -6, 60, '#fff3b0', '#f59e0b');
  star(ctx, 0, 0, 5, 52, 23); ctx.fill();
  ctx.restore();
}));

// 🌈 rainbow orb (hue cycle)
made.push(encodeGif('rainbow_orb', (ctx, t) => {
  const hue = Math.round(t * 360);
  const g = ctx.createRadialGradient(54, 54, 6, 64, 64, 56);
  g.addColorStop(0, `hsl(${hue},100%,75%)`);
  g.addColorStop(1, `hsl(${hue},90%,45%)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
}));

console.log(`✅ Generated ${made.length} animated emojis → ${made.map((n) => n + '.gif').join(', ')}`);
