// Generates a big pack of custom emojis (static PNG + animated GIF) into
// assets/emojis/. Shapes × colors + a batch of animations. Re-run any time:
//   node tools/gen-emoji-pack.js
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { GIFEncoder, quantize, applyPalette } = createRequire(import.meta.url)('gifenc');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'emojis');
mkdirSync(OUT, { recursive: true });
const S = 128;

// ---- palette: name -> [innerHighlight, outerColor] ----
const PAL = {
  red: ['#ff9a8b', '#dc2626'], orange: ['#ffd0a0', '#ea580c'], gold: ['#fff3b0', '#f59e0b'],
  yellow: ['#fff6a0', '#eab308'], lime: ['#d9ff9e', '#65a30d'], green: ['#7bffb0', '#16a34a'],
  teal: ['#9affe6', '#0d9488'], cyan: ['#a5f3ff', '#0891b2'], blue: ['#a5c8ff', '#2563eb'],
  blurple: ['#8b95ff', '#4b5bd9'], purple: ['#d0a5ff', '#7c3aed'], pink: ['#ffb3e6', '#db2777'],
  white: ['#ffffff', '#cbd5e1'], dark: ['#64748b', '#0f172a'],
};
const ALL = Object.keys(PAL);
const some = (n) => ALL.slice(0, n);

function ctxNew() { const c = createCanvas(S, S); return { c, ctx: c.getContext('2d') }; }
function save(name, c) { writeFileSync(join(OUT, name + '.png'), c.toBuffer('image/png')); }
function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer); return g;
}

// ---- shape paths (centered ~64,64, radius ~54) ----
const P = {
  circle: (ctx) => { ctx.beginPath(); ctx.arc(64, 64, 54, 0, 7); },
  star: (ctx, spikes = 5) => { let rot = -Math.PI / 2, step = Math.PI / spikes; ctx.beginPath(); for (let i = 0; i < spikes; i++) { ctx.lineTo(64 + Math.cos(rot) * 54, 64 + Math.sin(rot) * 54); rot += step; ctx.lineTo(64 + Math.cos(rot) * 24, 64 + Math.sin(rot) * 24); rot += step; } ctx.closePath(); },
  heart: (ctx) => { const cx = 64, cy = 78, s = 46; ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.35); ctx.bezierCurveTo(cx, cy, cx - s, cy - s * 0.1, cx - s, cy - s * 0.55); ctx.bezierCurveTo(cx - s, cy - s * 1.05, cx - s * 0.35, cy - s * 1.15, cx, cy - s * 0.65); ctx.bezierCurveTo(cx + s * 0.35, cy - s * 1.15, cx + s, cy - s * 1.05, cx + s, cy - s * 0.55); ctx.bezierCurveTo(cx + s, cy - s * 0.1, cx, cy, cx, cy + s * 0.35); ctx.closePath(); },
  diamond: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 12); ctx.lineTo(108, 64); ctx.lineTo(64, 116); ctx.lineTo(20, 64); ctx.closePath(); },
  poly: (ctx, n, rot = -Math.PI / 2) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; const x = 64 + Math.cos(a) * 54, y = 64 + Math.sin(a) * 54; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); },
  square: (ctx) => { const r = 18, x = 16, y = 16, w = 96, h = 96; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
  droplet: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 16); ctx.bezierCurveTo(96, 60, 104, 82, 64, 112); ctx.bezierCurveTo(24, 82, 32, 60, 64, 16); ctx.closePath(); },
  shield: (ctx) => { ctx.beginPath(); ctx.moveTo(64, 14); ctx.lineTo(108, 30); ctx.lineTo(108, 66); ctx.bezierCurveTo(108, 96, 88, 110, 64, 118); ctx.bezierCurveTo(40, 110, 20, 96, 20, 66); ctx.lineTo(20, 30); ctx.closePath(); },
};

function fillShape(name, colorName, drawer) {
  const { c, ctx } = ctxNew();
  const [inner, outer] = PAL[colorName];
  ctx.fillStyle = radial(ctx, 64, 60, 60, inner, outer);
  drawer(ctx);
  ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
  save(name, c);
}

// White-icon-on-colored-circle badges
function badge(name, colorName, drawIcon) {
  const { c, ctx } = ctxNew();
  const [inner, outer] = PAL[colorName];
  ctx.fillStyle = radial(ctx, 64, 64, 56, inner, outer);
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawIcon(ctx); ctx.stroke();
  save(name, c);
}

let n = 0;

// ---- static shapes x colors ----
const SPECS = [
  ['circle', ALL, (ctx) => P.circle(ctx)],
  ['star', some(10), (ctx) => P.star(ctx)],
  ['heart', some(10), (ctx) => P.heart(ctx)],
  ['diamond', some(9), (ctx) => P.diamond(ctx)],
  ['square', some(9), (ctx) => P.square(ctx)],
  ['triangle', some(8), (ctx) => P.poly(ctx, 3)],
  ['pentagon', some(7), (ctx) => P.poly(ctx, 5)],
  ['hexagon', some(8), (ctx) => P.poly(ctx, 6)],
  ['droplet', some(8), (ctx) => P.droplet(ctx)],
  ['shield', some(7), (ctx) => P.shield(ctx)],
];
for (const [shape, colors, drawer] of SPECS) {
  for (const cn of colors) { fillShape(`${shape}_${cn}`, cn, drawer); n++; }
}

// ---- badges ----
const CHECK = (ctx) => { ctx.beginPath(); ctx.moveTo(42, 66); ctx.lineTo(58, 82); ctx.lineTo(90, 46); };
const CROSS = (ctx) => { ctx.beginPath(); ctx.moveTo(44, 44); ctx.lineTo(84, 84); ctx.moveTo(84, 44); ctx.lineTo(44, 84); };
const PLUS = (ctx) => { ctx.beginPath(); ctx.moveTo(64, 40); ctx.lineTo(64, 88); ctx.moveTo(40, 64); ctx.lineTo(88, 64); };
const MINUS = (ctx) => { ctx.beginPath(); ctx.moveTo(40, 64); ctx.lineTo(88, 64); };
const UP = (ctx) => { ctx.beginPath(); ctx.moveTo(40, 74); ctx.lineTo(64, 46); ctx.lineTo(88, 74); };
const DOWN = (ctx) => { ctx.beginPath(); ctx.moveTo(40, 54); ctx.lineTo(64, 82); ctx.lineTo(88, 54); };
for (const [nm, cn, ic] of [
  ['check', 'green', CHECK], ['check', 'blue', CHECK], ['cross', 'red', CROSS], ['cross', 'dark', CROSS],
  ['plus', 'green', PLUS], ['minus', 'red', MINUS], ['arrow_up', 'green', UP], ['arrow_down', 'red', DOWN],
  ['arrow_up', 'blurple', UP], ['arrow_down', 'orange', DOWN],
]) { badge(`${nm}_${cn}`, cn, ic); n++; }

console.log(`✅ ${n} static emojis`);

// ---- animated GIFs ----
const FR = 18, DELAY = 55;
function anim(name, draw) {
  const gif = GIFEncoder();
  const { c, ctx } = ctxNew();
  for (let f = 0; f < FR; f++) {
    ctx.clearRect(0, 0, S, S);
    draw(ctx, f / FR);
    const { data } = ctx.getImageData(0, 0, S, S);
    const pal = quantize(data, 256, { format: 'rgba4444' });
    gif.writeFrame(applyPalette(data, pal, 'rgba4444'), S, S, { palette: pal, delay: DELAY, transparent: true, dispose: 2 });
  }
  gif.finish();
  writeFileSync(join(OUT, name + '.gif'), Buffer.from(gif.bytes()));
}
let a = 0;
const spin = (drawer) => (ctx, t) => { ctx.save(); ctx.translate(64, 64); ctx.rotate(t * Math.PI * 2); ctx.translate(-64, -64); drawer(ctx, t); ctx.restore(); };
const grad = (ctx, cn) => { ctx.fillStyle = radial(ctx, 64, 60, 60, PAL[cn][0], PAL[cn][1]); };
anim('spin_ring2', (ctx, t) => { ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(139,149,255,0.25)'; ctx.beginPath(); ctx.arc(64, 64, 44, 0, 7); ctx.stroke(); ctx.strokeStyle = '#8b95ff'; ctx.beginPath(); ctx.arc(64, 64, 44, t * 7, t * 7 + 2); ctx.stroke(); }); a++;
anim('spin_diamond', spin((ctx) => { grad(ctx, 'cyan'); P.diamond(ctx); ctx.fill(); })); a++;
anim('spin_hexagon', spin((ctx) => { grad(ctx, 'purple'); P.poly(ctx, 6); ctx.fill(); })); a++;
anim('spin_star2', spin((ctx) => { grad(ctx, 'gold'); P.star(ctx); ctx.fill(); })); a++;
anim('spin_shield', spin((ctx) => { grad(ctx, 'blue'); P.shield(ctx); ctx.fill(); })); a++;
anim('pulse_orb', (ctx, t) => { const r = 48 + 8 * Math.sin(t * Math.PI * 2); ctx.fillStyle = radial(ctx, 64, 64, r, PAL.green[0], PAL.green[1]); ctx.beginPath(); ctx.arc(64, 64, r, 0, 7); ctx.fill(); }); a++;
anim('pulse_heart2', (ctx, t) => { const s = 1 + 0.14 * Math.sin(t * Math.PI * 2); ctx.save(); ctx.translate(64, 64); ctx.scale(s, s); ctx.translate(-64, -64); grad(ctx, 'pink'); P.heart(ctx); ctx.fill(); ctx.restore(); }); a++;
anim('pulse_star', (ctx, t) => { const s = 1 + 0.13 * Math.sin(t * Math.PI * 2); ctx.save(); ctx.translate(64, 64); ctx.scale(s, s); ctx.translate(-64, -64); grad(ctx, 'gold'); P.star(ctx); ctx.fill(); ctx.restore(); }); a++;
anim('bounce_orb2', (ctx, t) => { const y = 78 - 34 * Math.abs(Math.sin(t * Math.PI)); ctx.fillStyle = radial(ctx, 64, y, 28, PAL.cyan[0], PAL.cyan[1]); ctx.beginPath(); ctx.arc(64, y, 28, 0, 7); ctx.fill(); }); a++;
anim('rainbow_ring', (ctx, t) => { ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.strokeStyle = `hsl(${Math.round(t * 360)},90%,55%)`; ctx.beginPath(); ctx.arc(64, 64, 44, 0, 7); ctx.stroke(); }); a++;
anim('rainbow_star', (ctx, t) => { ctx.fillStyle = `hsl(${Math.round(t * 360)},90%,58%)`; P.star(ctx); ctx.fill(); }); a++;
anim('rainbow_heart', (ctx, t) => { ctx.fillStyle = `hsl(${Math.round(t * 360)},85%,58%)`; P.heart(ctx); ctx.fill(); }); a++;
anim('blink_check', (ctx, t) => { const on = t < 0.5; ctx.fillStyle = radial(ctx, 64, 64, 56, on ? PAL.green[0] : '#334155', on ? PAL.green[1] : '#1e293b'); ctx.beginPath(); ctx.arc(64, 64, 56, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; CHECK(ctx); ctx.stroke(); }); a++;

console.log(`✅ ${a} animated emojis`);
console.log(`🎉 TOTAL generated this run: ${n + a}`);
