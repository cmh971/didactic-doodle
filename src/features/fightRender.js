// Canvas renderer for the !fight battle royale — draws a full arena image
// (fighter portraits, weapon chips, animated-style HP bars, KO overlays, and a
// winner banner). Same @napi-rs/canvas engine the UNO cards use.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';

// Remote avatars are fetched once and cached (keyed by URL).
const avatarCache = new Map();
async function loadAvatar(url) {
  if (!url) return null;
  if (avatarCache.has(url)) return avatarCache.get(url);
  let img = null;
  try { img = await loadImage(Buffer.from(await (await fetch(url)).arrayBuffer())); } catch { img = null; }
  avatarCache.set(url, img);
  return img;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initials(name) {
  return String(name || '?').replace(/[^a-z0-9 ]/gi, '').split(/\s+/).map((s) => s[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

// Draw one fighter cell.
function drawFighter(ctx, f, avatarImg, x, y, w, h) {
  const dead = !f.alive;
  // panel
  ctx.save();
  roundRect(ctx, x, y, w, h, 16);
  const pg = ctx.createLinearGradient(x, y, x, y + h);
  if (dead) { pg.addColorStop(0, '#161616'); pg.addColorStop(1, '#0c0c0c'); }
  else { pg.addColorStop(0, '#232734'); pg.addColorStop(1, '#161a24'); }
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = dead ? '#3a1414' : 'rgba(255,255,255,0.10)'; ctx.stroke();
  ctx.clip();

  // avatar circle
  const av = 74; const ax = x + 16; const ay = y + (h - av) / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (avatarImg) { ctx.drawImage(avatarImg, ax, ay, av, av); }
  else {
    const cg = ctx.createLinearGradient(ax, ay, ax + av, ay + av);
    cg.addColorStop(0, f.ai ? '#6b46c1' : '#2563eb'); cg.addColorStop(1, f.ai ? '#9f7aea' : '#60a5fa');
    ctx.fillStyle = cg; ctx.fillRect(ax, ay, av, av);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.ai ? 'AI' : initials(f.name), ax + av / 2, ay + av / 2 + 2);
  }
  ctx.restore();
  // ring
  ctx.beginPath(); ctx.arc(ax + av / 2, ay + av / 2, av / 2, 0, Math.PI * 2);
  ctx.lineWidth = 3; ctx.strokeStyle = dead ? '#7f1d1d' : (f.ai ? '#9f7aea' : '#60a5fa'); ctx.stroke();

  const tx = ax + av + 16;
  // name
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = dead ? '#8a8a8a' : '#ffffff'; ctx.font = 'bold 22px sans-serif';
  const name = f.name.length > 14 ? f.name.slice(0, 13) + '…' : f.name;
  ctx.fillText(name, tx, y + 34);

  // weapon chip
  const wp = f.weapon || { name: 'Fists', color: '#888' };
  ctx.font = '13px sans-serif';
  const chipW = ctx.measureText(wp.name).width + 22;
  roundRect(ctx, tx, y + 44, chipW, 22, 11); ctx.fillStyle = dead ? '#333' : wp.color + '33'; ctx.fill();
  ctx.strokeStyle = dead ? '#444' : wp.color; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = dead ? '#777' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(wp.name, tx + chipW / 2, y + 59);

  // HP bar
  const bx = tx; const by = y + h - 30; const bw = w - (tx - x) - 18; const bh = 16;
  roundRect(ctx, bx, by, bw, bh, 8); ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
  const pct = Math.max(0, Math.min(1, f.hp / f.maxHp));
  if (pct > 0) {
    roundRect(ctx, bx, by, Math.max(8, bw * pct), bh, 8);
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    const col = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
    hg.addColorStop(0, col); hg.addColorStop(1, col + 'cc'); ctx.fillStyle = hg; ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(dead ? 'KO' : `${f.hp}/${f.maxHp}`, bx + bw - 4, by + 12);

  ctx.restore();

  // KO overlay
  if (dead) {
    ctx.save(); roundRect(ctx, x, y, w, h, 16); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.12); ctx.font = 'bold 40px sans-serif'; ctx.fillText('K.O.', 0, 0); ctx.restore();
    ctx.restore();
  }
}

export async function renderArena(fight) {
  const n = fight.fighters.length;
  const cols = n <= 2 ? 1 : n <= 8 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const pad = 22; const cellW = 360; const cellH = 118; const headerH = 96;
  const W = cols * cellW + pad * (cols + 1);
  const H = headerH + rows * cellH + pad * (rows + 1);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a0a0a'); bg.addColorStop(0.5, '#12101c'); bg.addColorStop(1, '#0a0a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // subtle vignette dots
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 40; i++) { const rx = Math.random() * W, ry = Math.random() * H; ctx.beginPath(); ctx.arc(rx, ry, Math.random() * 2, 0, 7); ctx.fill(); }

  // header
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const title = fight.over ? `${fight.winner.toUpperCase()}  WINS!` : (!fight.started ? 'BATTLE ROYALE  —  LOBBY' : `BATTLE ROYALE  —  ROUND ${fight.round}`);
  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = fight.over ? '#ffd23f' : '#ff5a5a';
  ctx.shadowColor = fight.over ? 'rgba(255,210,63,0.6)' : 'rgba(255,60,60,0.5)'; ctx.shadowBlur = 20;
  ctx.fillText(title, W / 2, 56);
  ctx.shadowBlur = 0;
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#9aa7b4';
  const aliveN = fight.fighters.filter((f) => f.alive).length;
  ctx.fillText(fight.over ? `${n} entered · 1 survived` : (!fight.started ? `${n} fighters ready — press START` : `${aliveN} still standing`), W / 2, 82);

  // preload avatars
  const imgs = await Promise.all(fight.fighters.map((f) => loadAvatar(f.avatar)));

  for (let i = 0; i < n; i++) {
    const c = i % cols; const r = Math.floor(i / cols);
    const x = pad + c * (cellW + pad);
    const y = headerH + pad + r * (cellH + pad);
    drawFighter(ctx, fight.fighters[i], imgs[i], x, y, cellW, cellH);
  }

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'arena.png' });
}
