// Emoji pack #2 — a big batch of NEW shapes × all palette colors, dropped into
// assets/emojis/ in the same style as gen-emoji-pack.js. Re-run any time:
//   node tools/gen-emoji-pack2.js
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'emojis');
mkdirSync(OUT, { recursive: true });
const S = 128;

// Same palette as pack #1: name -> [innerHighlight, outerColor]
const PAL = {
  red: ['#ff9a8b', '#dc2626'], orange: ['#ffd0a0', '#ea580c'], gold: ['#fff3b0', '#f59e0b'],
  yellow: ['#fff6a0', '#eab308'], lime: ['#d9ff9e', '#65a30d'], green: ['#7bffb0', '#16a34a'],
  teal: ['#9affe6', '#0d9488'], cyan: ['#a5f3ff', '#0891b2'], blue: ['#a5c8ff', '#2563eb'],
  blurple: ['#8b95ff', '#4b5bd9'], purple: ['#d0a5ff', '#7c3aed'], pink: ['#ffb3e6', '#db2777'],
  white: ['#ffffff', '#cbd5e1'], dark: ['#64748b', '#0f172a'],
};

function ctxNew() { const c = createCanvas(S, S); return { c, ctx: c.getContext('2d') }; }
function save(name, c) { writeFileSync(join(OUT, name + '.png'), c.toBuffer('image/png')); }
function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer); return g;
}
const grad = (ctx, inner, outer) => radial(ctx, 64, 58, 60, inner, outer);
function outline(ctx) { ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke(); }

// ---- path primitives ----
function star(ctx, cx, cy, spikes, outR, inR) {
  let rot = -Math.PI / 2; const step = Math.PI / spikes; ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outR, cy + Math.sin(rot) * outR); rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inR, cy + Math.sin(rot) * inR); rot += step;
  }
  ctx.closePath();
}
function poly(ctx, n, rot = -Math.PI / 2, r = 54) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath();
}

// ---- single-path shapes (filled with a radial gradient + soft outline) ----
const PATHS = {
  crown: (ctx) => { ctx.beginPath(); ctx.moveTo(24, 46); ctx.lineTo(36, 88); ctx.lineTo(92, 88); ctx.lineTo(104, 46); ctx.lineTo(84, 62); ctx.lineTo(64, 30); ctx.lineTo(44, 62); ctx.closePath(); },
  bolt: (ctx) => { ctx.beginPath(); ctx.moveTo(72, 14); ctx.lineTo(36, 70); ctx.lineTo(58, 70); ctx.lineTo(50, 114); ctx.lineTo(94, 54); ctx.lineTo(70, 54); ctx.lineTo(84, 14); ctx.closePath(); },
  sparkle: (ctx) => star(ctx, 64, 64, 4, 56, 16),
  hexagram: (ctx) => star(ctx, 64, 64, 6, 54, 30),
  burst: (ctx) => star(ctx, 64, 64, 12, 54, 40),
  gem: (ctx) => { ctx.beginPath(); ctx.moveTo(40, 30); ctx.lineTo(88, 30); ctx.lineTo(108, 52); ctx.lineTo(64, 114); ctx.lineTo(20, 52); ctx.closePath(); },
  flame: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 14); ctx.bezierCurveTo(94, 44, 98, 66, 84, 88); ctx.bezierCurveTo(82, 74, 74, 68, 72, 60); ctx.bezierCurveTo(64, 76, 56, 76, 58, 96); ctx.bezierCurveTo(42, 86, 34, 70, 44, 52); ctx.bezierCurveTo(46, 64, 54, 64, 54, 54); ctx.bezierCurveTo(54, 38, 60, 26, 64, 14); ctx.closePath(); },
  leaf: (ctx) => { ctx.beginPath(); ctx.moveTo(28, 100); ctx.quadraticCurveTo(16, 38, 100, 24); ctx.quadraticCurveTo(108, 88, 28, 100); ctx.closePath(); },
  plus: (ctx) => { const a = 44, b = 84; ctx.beginPath(); ctx.moveTo(a, 24); ctx.lineTo(b, 24); ctx.lineTo(b, 44); ctx.lineTo(104, 44); ctx.lineTo(104, 84); ctx.lineTo(b, 84); ctx.lineTo(b, 104); ctx.lineTo(a, 104); ctx.lineTo(a, 84); ctx.lineTo(24, 84); ctx.lineTo(24, 44); ctx.lineTo(a, 44); ctx.closePath(); },
  octagon: (ctx) => poly(ctx, 8, -Math.PI / 8),
  arrow_right: (ctx) => { ctx.beginPath(); ctx.moveTo(24, 46); ctx.lineTo(70, 46); ctx.lineTo(70, 26); ctx.lineTo(106, 64); ctx.lineTo(70, 102); ctx.lineTo(70, 82); ctx.lineTo(24, 82); ctx.closePath(); },
  arrow_left: (ctx) => { ctx.beginPath(); ctx.moveTo(104, 46); ctx.lineTo(58, 46); ctx.lineTo(58, 26); ctx.lineTo(22, 64); ctx.lineTo(58, 102); ctx.lineTo(58, 82); ctx.lineTo(104, 82); ctx.closePath(); },
  spade: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 20); ctx.bezierCurveTo(96, 52, 110, 66, 90, 86); ctx.bezierCurveTo(80, 94, 70, 90, 66, 84); ctx.quadraticCurveTo(70, 100, 82, 108); ctx.lineTo(46, 108); ctx.quadraticCurveTo(58, 100, 62, 84); ctx.bezierCurveTo(58, 90, 48, 94, 38, 86); ctx.bezierCurveTo(18, 66, 32, 52, 64, 20); ctx.closePath(); },
  chevron: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 22); ctx.lineTo(106, 60); ctx.lineTo(90, 76); ctx.lineTo(64, 52); ctx.lineTo(38, 76); ctx.lineTo(22, 60); ctx.closePath(); ctx.moveTo(64, 60); ctx.lineTo(106, 98); ctx.lineTo(90, 114); ctx.lineTo(64, 90); ctx.lineTo(38, 114); ctx.lineTo(22, 98); ctx.closePath(); },
};

function simple(name, colorName, drawer) {
  const { c, ctx } = ctxNew();
  const [inner, outer] = PAL[colorName];
  ctx.fillStyle = grad(ctx, inner, outer);
  drawer(ctx); ctx.fill(); outline(ctx);
  save(name, c);
}

// ---- composite shapes (paint themselves) ----
const CUSTOM = {
  ring(ctx, inner, outer) {
    ctx.fillStyle = grad(ctx, inner, outer);
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, 7); ctx.arc(64, 64, 26, 0, 7, true); ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, 7); ctx.stroke();
  },
  moon(ctx, inner, outer) {
    ctx.fillStyle = grad(ctx, inner, outer);
    ctx.beginPath(); ctx.arc(58, 64, 50, 0, 7); ctx.arc(82, 56, 44, 0, 7, true); ctx.fill('evenodd');
  },
  gear(ctx, inner, outer) {
    ctx.save(); ctx.translate(64, 64);
    const teeth = 9, rOut = 54, rIn = 42;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a = i * Math.PI / teeth; const r = i % 2 ? rIn : rOut; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = radial(ctx, 0, -6, 58, inner, outer); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    ctx.restore();
  },
  cloud(ctx, inner, outer) {
    ctx.fillStyle = radial(ctx, 64, 54, 62, inner, outer);
    ctx.beginPath();
    ctx.arc(44, 74, 22, 0, 7); ctx.arc(64, 60, 28, 0, 7); ctx.arc(88, 74, 20, 0, 7);
    ctx.rect(44, 74, 44, 20); ctx.fill();
  },
  sun(ctx, inner, outer) {
    ctx.save(); ctx.translate(64, 64);
    ctx.fillStyle = radial(ctx, 0, -6, 48, inner, outer);
    const rays = 12; ctx.beginPath();
    for (let i = 0; i < rays; i++) { const a = i * 2 * Math.PI / rays, a1 = a - 0.13, a2 = a + 0.13, rIn = 40, rOut = 58; ctx.moveTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn); ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut); ctx.lineTo(Math.cos(a2) * rIn, Math.sin(a2) * rIn); }
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.stroke();
    ctx.restore();
  },
  flower(ctx, inner, outer) {
    ctx.save(); ctx.translate(64, 64);
    ctx.fillStyle = radial(ctx, 0, -6, 54, inner, outer);
    const petals = 6;
    for (let i = 0; i < petals; i++) { const a = i * 2 * Math.PI / petals; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 30, Math.sin(a) * 30, 20, 28, a, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.restore();
  },
  bell(ctx, inner, outer) {
    ctx.fillStyle = grad(ctx, inner, outer);
    ctx.beginPath(); ctx.moveTo(30, 96); ctx.quadraticCurveTo(34, 50, 64, 42); ctx.quadraticCurveTo(94, 50, 98, 96); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 106, 8, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 38, 7, 0, 7); ctx.fill();
  },
  coin(ctx, inner, outer) {
    ctx.fillStyle = grad(ctx, inner, outer);
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, 7); ctx.fill(); outline(ctx);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(64, 64, 40, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; star(ctx, 64, 64, 5, 20, 9); ctx.fill();
  },
};

let n = 0;
for (const [shape, drawer] of Object.entries(PATHS)) {
  for (const color of Object.keys(PAL)) { simple(`${shape}_${color}`, color, drawer); n++; }
}
for (const [shape, paint] of Object.entries(CUSTOM)) {
  for (const color of Object.keys(PAL)) {
    const { c, ctx } = ctxNew(); const [inner, outer] = PAL[color];
    paint(ctx, inner, outer); save(`${shape}_${color}`, c); n++;
  }
}
const shapes = Object.keys(PATHS).length + Object.keys(CUSTOM).length;
console.log(`✅ Generated ${n} new emojis (${shapes} shapes × ${Object.keys(PAL).length} colors) into assets/emojis/`);
