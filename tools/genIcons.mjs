import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'web', 'public');

function draw(size) {
  const c = createCanvas(size, size);
  const x = c.getContext('2d');
  // rounded-square gradient background
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#5865f2');
  g.addColorStop(1, '#8b5cf6');
  const r = size * 0.22;
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(r, 0); x.arcTo(size, 0, size, size, r); x.arcTo(size, size, 0, size, r);
  x.arcTo(0, size, 0, 0, r); x.arcTo(0, 0, size, 0, r); x.closePath(); x.fill();
  // white shield
  const cx = size / 2, top = size * 0.20, w = size * 0.30, botY = size * 0.82;
  x.fillStyle = 'rgba(255,255,255,0.96)';
  x.beginPath();
  x.moveTo(cx, top);
  x.lineTo(cx + w, top + size * 0.08);
  x.lineTo(cx + w, size * 0.52);
  x.quadraticCurveTo(cx + w, botY - size * 0.02, cx, botY);
  x.quadraticCurveTo(cx - w, botY - size * 0.02, cx - w, size * 0.52);
  x.lineTo(cx - w, top + size * 0.08);
  x.closePath(); x.fill();
  // checkmark
  x.strokeStyle = '#5865f2';
  x.lineWidth = size * 0.07;
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(cx - w * 0.5, size * 0.50);
  x.lineTo(cx - w * 0.08, size * 0.62);
  x.lineTo(cx + w * 0.6, size * 0.36);
  x.stroke();
  return c.toBuffer('image/png');
}

for (const s of [192, 512]) {
  writeFileSync(join(OUT, `icon-${s}.png`), draw(s));
  console.log('wrote icon-' + s + '.png');
}
// maskable (extra padding is baked into the shield already)
writeFileSync(join(OUT, 'icon-maskable-512.png'), draw(512));
console.log('wrote icon-maskable-512.png');
