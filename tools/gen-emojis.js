// Generates a set of clean custom emoji PNGs (128x128, transparent) into
// assets/emojis/. Uses @napi-rs/canvas (already a dependency). Re-run any time:
//   node tools/gen-emojis.js
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'emojis');
mkdirSync(OUT, { recursive: true });
const S = 128;

function newCanvas() {
  const c = createCanvas(S, S);
  return { c, ctx: c.getContext('2d') };
}
function save(name, canvas) {
  writeFileSync(join(OUT, name + '.png'), canvas.toBuffer('image/png'));
}
function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  return g;
}
function star(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
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

const made = [];

// ---- Glossy orbs in a few colors ----
for (const [name, inner, outer] of [
  ['orb_blurple', '#8b95ff', '#4b5bd9'],
  ['orb_green', '#7bffb0', '#16a34a'],
  ['orb_gold', '#fff3b0', '#f59e0b'],
  ['orb_red', '#ff9a8b', '#dc2626'],
  ['orb_pink', '#ffb3e6', '#e91e63'],
  ['orb_cyan', '#a5f3ff', '#06b6d4'],
]) {
  const { c, ctx } = newCanvas();
  ctx.fillStyle = radial(ctx, 64, 64, 56, inner, outer);
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(50, 44, 20, 12, -0.5, 0, Math.PI * 2); ctx.fill();
  save(name, c); made.push(name);
}

// ---- Gold star ----
{
  const { c, ctx } = newCanvas();
  ctx.fillStyle = radial(ctx, 64, 60, 60, '#fff3b0', '#f59e0b');
  star(ctx, 64, 66, 5, 56, 24); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#b45309'; ctx.stroke();
  save('star', c); made.push('star');
}

// ---- Heart ----
{
  const { c, ctx } = newCanvas();
  ctx.fillStyle = radial(ctx, 64, 60, 60, '#ff9a8b', '#dc2626');
  heart(ctx, 64, 78, 46); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(46, 40, 12, 8, -0.6, 0, Math.PI * 2); ctx.fill();
  save('heart', c); made.push('heart');
}

// ---- Diamond ----
{
  const { c, ctx } = newCanvas();
  ctx.save(); ctx.translate(64, 64); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = radial(ctx, 0, 0, 50, '#a5f3ff', '#0891b2');
  ctx.fillRect(-40, -40, 80, 80);
  ctx.restore();
  save('diamond', c); made.push('diamond');
}

// ---- Check (green) & Cross (red) badges ----
for (const [name, color, draw] of [
  ['check', '#16a34a', (ctx) => { ctx.beginPath(); ctx.moveTo(42, 66); ctx.lineTo(58, 82); ctx.lineTo(90, 46); }],
  ['cross', '#dc2626', (ctx) => { ctx.beginPath(); ctx.moveTo(44, 44); ctx.lineTo(84, 84); ctx.moveTo(84, 44); ctx.lineTo(44, 84); }],
]) {
  const { c, ctx } = newCanvas();
  ctx.fillStyle = radial(ctx, 64, 64, 56, '#ffffff33', color);
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  draw(ctx); ctx.stroke();
  save(name, c); made.push(name);
}

// ---- Ring / loading donut ----
{
  const { c, ctx } = newCanvas();
  ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(88,101,242,0.25)';
  ctx.beginPath(); ctx.arc(64, 64, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#5865f2';
  ctx.beginPath(); ctx.arc(64, 64, 44, -Math.PI / 2, Math.PI); ctx.stroke();
  save('ring', c); made.push('ring');
}

console.log(`✅ Generated ${made.length} emojis → assets/emojis/`);
console.log('   ' + made.join(', '));
