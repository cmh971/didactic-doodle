// Canvas renderers for the data-heavy API commands (?quake, ?neo) — a picture
// of the data alongside the embed. Uses @napi-rs/canvas (same as the games).
import { createCanvas } from '@napi-rs/canvas';

const bgGradient = (g, w, h, a, b) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
const trim = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

// ---- Earthquake card: a magnitude bar chart of recent quakes ---------------
export function renderQuakeCard(quakes, feedLabel) {
  const rows = quakes.slice(0, 8);
  const W = 900, H = 120 + rows.length * 54;
  const c = createCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = bgGradient(g, W, H, '#0d1117', '#241a12'); g.fillRect(0, 0, W, H);
  g.fillStyle = '#e67e22'; g.fillRect(0, 0, W, 6);

  g.fillStyle = '#fff'; g.font = 'bold 30px Arial';
  g.fillText('Recent Earthquakes', 32, 52);
  g.fillStyle = '#8b94b3'; g.font = '18px Arial';
  g.fillText(`USGS  ·  ${feedLabel}`, 34, 80);

  const maxMag = Math.max(7, ...rows.map((q) => q.properties.mag || 0));
  let y = 108;
  for (const q of rows) {
    const p = q.properties; const mag = p.mag || 0;
    const depth = Math.round((q.geometry?.coordinates?.[2]) || 0);
    const col = mag >= 6 ? '#e74c3c' : mag >= 4.5 ? '#e67e22' : '#f1c40f';
    // magnitude bar
    const barX = 120, barW = (W - 160) * (mag / maxMag);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(barX, y, W - 160, 34);
    g.fillStyle = col; g.fillRect(barX, y, barW, 34);
    // mag number
    g.fillStyle = col; g.font = 'bold 30px Arial'; g.textAlign = 'left';
    g.fillText(mag.toFixed(1), 32, y + 28);
    // place + depth
    g.fillStyle = '#fff'; g.font = 'bold 17px Arial';
    g.fillText(trim(p.place || 'Unknown location', 52), barX + 10, y + 15);
    g.fillStyle = p.tsunami ? '#4db8ff' : '#cbd2e0'; g.font = '13px Arial';
    g.fillText(`depth ${depth} km${p.tsunami ? '   ·   TSUNAMI ALERT' : ''}`, barX + 10, y + 30);
    y += 54;
  }
  g.textAlign = 'right'; g.fillStyle = '#5b6478'; g.font = '14px Arial';
  g.fillText('Earthquake Hazards Program', W - 24, H - 16);
  return c.toBuffer('image/png');
}

// ---- NEO card: asteroids with size + hazard, scaled dots -------------------
export function renderNeoCard(data) {
  const rows = data.objects.slice(0, 8);
  const W = 900, H = 130 + rows.length * 56;
  const c = createCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = bgGradient(g, W, H, '#05060f', '#0b1a2e'); g.fillRect(0, 0, W, H);
  // starfield
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 60; i++) g.fillRect(Math.random() * W, Math.random() * H, Math.random() < 0.2 ? 2 : 1, 1);
  g.fillStyle = '#3fa7ff'; g.fillRect(0, 0, W, 6);

  g.fillStyle = '#fff'; g.font = 'bold 30px Arial'; g.textAlign = 'left';
  g.fillText('Near-Earth Objects', 32, 52);
  g.fillStyle = '#8b94b3'; g.font = '18px Arial';
  g.fillText(`NASA NeoWs  ·  ${data.date}  ·  ${data.count} tracked`, 34, 80);

  const maxDia = Math.max(50, ...rows.map((o) => o.diaMax));
  let y = 110;
  for (const o of rows) {
    const r = 8 + 16 * (o.diaMax / maxDia);
    const cx = 60;
    g.beginPath(); g.arc(cx, y + 20, r, 0, Math.PI * 2);
    g.fillStyle = o.hazardous ? '#e74c3c' : '#3fb0ff'; g.fill();
    if (o.hazardous) { g.strokeStyle = '#ff9a9a'; g.lineWidth = 2; g.stroke(); }

    g.fillStyle = o.hazardous ? '#ff8080' : '#fff'; g.font = 'bold 18px Arial';
    g.fillText(trim(o.name, 34) + (o.hazardous ? '   [ HAZARDOUS ]' : ''), 100, y + 14);
    g.fillStyle = '#cbd2e0'; g.font = '13px Arial';
    g.fillText(`Ø ${o.diaMin}–${o.diaMax} m   ·   ${o.velocityKmh.toLocaleString()} km/h   ·   ${o.missLunar.toFixed(1)} LD miss`, 100, y + 33);
    y += 56;
  }
  g.textAlign = 'right'; g.fillStyle = '#5b6478'; g.font = '14px Arial';
  g.fillText('LD = Lunar Distances · red = potentially hazardous', W - 24, H - 16);
  return c.toBuffer('image/png');
}

// ---- 3D-ish "approach" scene: Earth + tilted orbit rings + asteroids -------
export function renderAsteroidApproach(data) {
  const W = 960, H = 620;
  const c = createCanvas(W, H); const g = c.getContext('2d');
  // deep-space background
  g.fillStyle = bgGradient(g, W, H, '#02030a', '#0a1226'); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`; g.fillRect(Math.random() * W, Math.random() * H, Math.random() < 0.15 ? 2 : 1, 1); }

  const ex = W / 2, ey = H / 2 + 20, tilt = 0.42; // vertical squash = perspective
  const objs = data.objects.slice().sort((a, b) => a.missLunar - b.missLunar).slice(0, 7);
  const minLD = Math.max(0.2, objs[0]?.missLunar || 1);
  const maxLD = Math.max(minLD + 1, objs[objs.length - 1]?.missLunar || 10);
  const innerR = 120, outerR = Math.min(W, H) / 2 - 40;
  const mapR = (ld) => innerR + (outerR - innerR) * ((ld - minLD) / (maxLD - minLD || 1));

  // tilted distance rings (this is what sells the 3D look)
  const rings = [{ ld: minLD, label: `${minLD.toFixed(1)} LD` }, { ld: (minLD + maxLD) / 2, label: `${((minLD + maxLD) / 2).toFixed(0)} LD` }, { ld: maxLD, label: `${maxLD.toFixed(0)} LD` }];
  for (const ring of rings) {
    const r = mapR(ring.ld);
    g.beginPath(); g.ellipse(ex, ey, r, r * tilt, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(120,150,220,0.25)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = 'rgba(150,170,220,0.5)'; g.font = '12px Arial'; g.textAlign = 'center';
    g.fillText(ring.label, ex, ey - r * tilt - 4);
  }
  // Moon's orbit reference (1 LD) if it fits inside
  if (1 >= minLD && 1 <= maxLD) {
    const mr = mapR(1); g.beginPath(); g.ellipse(ex, ey, mr, mr * tilt, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(200,200,200,0.35)'; g.setLineDash([4, 5]); g.stroke(); g.setLineDash([]);
  }

  // Earth — shaded sphere with atmosphere glow
  const glow = g.createRadialGradient(ex, ey, 10, ex, ey, 60);
  glow.addColorStop(0, 'rgba(90,160,255,0.5)'); glow.addColorStop(1, 'rgba(90,160,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(ex, ey, 60, 0, Math.PI * 2); g.fill();
  const earth = g.createRadialGradient(ex - 12, ey - 12, 4, ex, ey, 34);
  earth.addColorStop(0, '#7ec8ff'); earth.addColorStop(0.5, '#2a72c8'); earth.addColorStop(1, '#0b2a55');
  g.fillStyle = earth; g.beginPath(); g.arc(ex, ey, 34, 0, Math.PI * 2); g.fill();

  // asteroids — placed on their ring at a spread angle, dot sized by diameter
  const maxDia = Math.max(50, ...objs.map((o) => o.diaMax));
  objs.forEach((o, i) => {
    const ang = (-Math.PI / 2) + (i / objs.length) * Math.PI * 2 + 0.4;
    const r = mapR(o.missLunar);
    const x = ex + Math.cos(ang) * r, y = ey + Math.sin(ang) * r * tilt;
    // trajectory line
    g.strokeStyle = o.hazardous ? 'rgba(231,76,60,0.35)' : 'rgba(120,180,255,0.25)';
    g.lineWidth = 1; g.beginPath(); g.moveTo(ex, ey); g.lineTo(x, y); g.stroke();
    const rad = 4 + 12 * (o.diaMax / maxDia);
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = o.hazardous ? '#e74c3c' : '#9ad0ff'; g.fill();
    if (o.hazardous) { g.strokeStyle = '#ffb3b3'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#e8eefc'; g.font = 'bold 12px Arial'; g.textAlign = x < ex ? 'right' : 'left';
    const lx = x + (x < ex ? -rad - 4 : rad + 4);
    g.fillText(trim(o.name, 22), lx, y - 2);
    g.fillStyle = '#9fb0cc'; g.font = '11px Arial';
    g.fillText(`${o.missLunar.toFixed(1)} LD · ${o.diaMax} m`, lx, y + 12);
  });

  // header + legend
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'bold 26px Arial';
  g.fillText('Near-Earth Approach', 28, 42);
  g.fillStyle = '#8b94b3'; g.font = '15px Arial';
  g.fillText(`NASA NeoWs · ${data.date} · ${data.count} objects · rings = distance in Lunar Distances`, 28, 66);
  return c.toBuffer('image/png');
}
