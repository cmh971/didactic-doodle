// Extra CPU-rendered images for the economy / games / fun commands.
// Same @napi-rs/canvas (Skia) approach as the UNO card renderer — no GPU needed.
import { createCanvas } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import { TOKEN } from '../config.js';

// ---- shared helpers ----
export function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
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

function gradientBg(ctx, w, h, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function attach(canvas, name) {
  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name });
}

// ---- a golden UNO token coin ----
export function renderCoin(value, label = 'UNO TOKEN') {
  const size = 320;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = 140;

  const g = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, r);
  g.addColorStop(0, '#fff4a3');
  g.addColorStop(0.5, '#ffd23f');
  g.addColorStop(1, '#c68a00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = '#a06a00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#7a4f00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 90px Arial';
  ctx.fillText('🪙', cx, cy - 30);
  ctx.font = 'bold 40px Arial';
  ctx.fillText(value != null ? fmt(value) : 'UNO', cx, cy + 50);
  ctx.font = 'bold 20px Arial';
  ctx.fillText(label, cx, cy + 95);
  return attach(canvas, 'coin.png');
}

// ---- a player profile / balance card ----
export function renderProfile({ username, wallet, bank, wins, losses, rank }) {
  const W = 720;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, '#1e1f3b', '#3a1c5c');

  // panel
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, 20, 20, W - 40, H - 40, 24);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 38px Arial';
  ctx.fillText(`🪙 ${username}`, 48, 50);

  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('WALLET', 48, 120);
  ctx.fillText('BANK', 360, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial';
  ctx.fillText(`${TOKEN} ${fmt(wallet)}`, 48, 150);
  ctx.fillText(`🏦 ${fmt(bank)}`, 360, 150);

  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#9bffb0';
  ctx.fillText(`Total: ${TOKEN} ${fmt(wallet + bank)}`, 48, 210);
  ctx.fillStyle = '#cfcfff';
  ctx.font = '20px Arial';
  ctx.fillText(`🏆 Wins: ${wins}   💀 Losses: ${losses}`, 48, 248);
  if (rank) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`#${rank}`, W - 50, 60);
  }
  return attach(canvas, 'profile.png');
}

// ---- shop banner ----
export function renderShopBanner() {
  const W = 720;
  const H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, '#0f3460', '#16213e');
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px Arial';
  ctx.fillText('🛒 UNO SHOP', W / 2, H / 2 - 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.fillText('Spend your hard-won tokens 🪙', W / 2, H / 2 + 45);
  return attach(canvas, 'shop.png');
}

// ---- win / lose banners ----
export function renderBanner(text, sub, c1, c2, emoji = '🎉') {
  const W = 720;
  const H = 240;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, c1, c2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 70px Arial';
  ctx.fillText(`${emoji} ${text}`, W / 2, H / 2 - 20);
  ctx.font = 'bold 30px Arial';
  ctx.fillText(sub, W / 2, H / 2 + 55);
  return attach(canvas, 'banner.png');
}

export const renderWinBanner = (sub) => renderBanner('YOU WIN!', sub, '#11998e', '#38ef7d', '🎉');
export const renderLoseBanner = (sub) => renderBanner('YOU LOSE', sub, '#cb2d3e', '#ef473a', '💀');

// ---- leaderboard ----
export function renderLeaderboard(rows) {
  const W = 720;
  const rowH = 56;
  const H = 110 + rows.length * rowH;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, '#232526', '#414345');
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px Arial';
  ctx.textBaseline = 'top';
  ctx.fillText('🏆 RICHEST PLAYERS', W / 2, 30);

  const medals = ['🥇', '🥈', '🥉'];
  rows.forEach((row, i) => {
    const y = 100 + i * rowH;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, 30, y, W - 60, rowH - 8, 12);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.fillText(`${medals[i] || `#${i + 1}`}  ${row.name}`, 50, y + (rowH - 8) / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`${TOKEN} ${fmt(row.total)}`, W - 50, y + (rowH - 8) / 2);
  });
  return attach(canvas, 'leaderboard.png');
}

// ---- slot machine ----
export function renderSlots(reels, won) {
  const W = 520;
  const H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, won ? '#f7971e' : '#434343', won ? '#ffd200' : '#000000');
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, 20, 20, W - 40, H - 80, 20);
  ctx.fill();
  const slotW = (W - 80) / 3;
  reels.forEach((s, i) => {
    const x = 40 + i * (slotW + 10);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, 50, slotW, H - 150, 14);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '90px Arial';
    ctx.fillText(s, x + slotW / 2, 50 + (H - 150) / 2);
  });
  ctx.fillStyle = won ? '#fff700' : '#ff5252';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(won ? '🎉 WINNER! 🎉' : 'try again…', W / 2, H - 35);
  return attach(canvas, 'slots.png');
}

// ---- dice ----
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]] };
function drawDie(ctx, x, y, size, value) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, size, size, size * 0.18);
  ctx.fill();
  ctx.fillStyle = '#222';
  const cell = size / 3;
  for (const [r, c] of PIPS[value] || []) {
    ctx.beginPath();
    ctx.arc(x + cell * c + cell / 2, y + cell * r + cell / 2, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}
export function renderDice(values) {
  const size = 120;
  const gap = 24;
  const W = values.length * size + (values.length + 1) * gap;
  const H = size + gap * 2;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, '#8e2de2', '#4a00e0');
  values.forEach((v, i) => drawDie(ctx, gap + i * (size + gap), gap, size, v));
  return attach(canvas, 'dice.png');
}

// ---- coin flip ----
export function renderCoinFlip(side) {
  const size = 300;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, 130);
  g.addColorStop(0, side === 'Heads' ? '#fff4a3' : '#e0e0e0');
  g.addColorStop(1, side === 'Heads' ? '#c68a00' : '#888');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 90px Arial';
  ctx.fillText(side === 'Heads' ? '👑' : '🦅', cx, cy - 20);
  ctx.font = 'bold 36px Arial';
  ctx.fillText(side.toUpperCase(), cx, cy + 70);
  return attach(canvas, 'coinflip.png');
}

// ---- a solid color swatch ----
export function renderColor(hex) {
  const W = 400;
  const H = 200;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, W, H);
  // pick readable text color
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  ctx.fillStyle = lum > 0.5 ? '#000' : '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(hex.toUpperCase(), W / 2, H / 2);
  return attach(canvas, 'color.png');
}

// ---- a quick meme-style top/bottom text card ----
export function renderMeme(top, bottom) {
  const W = 600;
  const H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  gradientBg(ctx, W, H, '#16222a', '#3a6073');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px Impact, Arial';
  const draw = (text, y) => {
    const t = (text || '').toUpperCase().slice(0, 40);
    ctx.strokeText(t, W / 2, y);
    ctx.fillText(t, W / 2, y);
  };
  ctx.textBaseline = 'top';
  draw(top, 24);
  ctx.font = 'bold 120px Arial';
  ctx.fillText('🃏', W / 2, H / 2 - 60);
  ctx.font = 'bold 44px Impact, Arial';
  ctx.textBaseline = 'bottom';
  draw(bottom, H - 24);
  return attach(canvas, 'meme.png');
}

// ---- loot box ----
export function renderLootBox(reward) {
  return renderBanner('LOOT BOX!', `You found ${TOKEN} ${fmt(reward)}`, '#f12711', '#f5af19', '🎁');
}

// ---- SHIP SIM: a sea scene with a sailing ship ----
// weather: 'calm' | 'sunset' | 'storm' | 'night'
export function renderShip({ weather = 'calm', title = 'Setting sail…', tilt = 0 } = {}) {
  const W = 760;
  const H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const horizon = H * 0.5;

  // ---- sky ----
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  if (weather === 'storm') {
    sky.addColorStop(0, '#2c3e50'); sky.addColorStop(1, '#4b6584');
  } else if (weather === 'sunset') {
    sky.addColorStop(0, '#ff7e5f'); sky.addColorStop(1, '#feb47b');
  } else if (weather === 'night') {
    sky.addColorStop(0, '#0f2027'); sky.addColorStop(1, '#203a43');
  } else {
    sky.addColorStop(0, '#56ccf2'); sky.addColorStop(1, '#a8edea');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // sun / moon / stars
  if (weather === 'night') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = Math.random() * 0.8 + 0.2;
      ctx.fillRect(Math.random() * W, Math.random() * horizon, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f5f3ce';
    ctx.beginPath(); ctx.arc(W - 110, 80, 36, 0, Math.PI * 2); ctx.fill();
  } else if (weather !== 'storm') {
    ctx.fillStyle = weather === 'sunset' ? '#fff2b2' : '#fff3b0';
    ctx.beginPath(); ctx.arc(W - 120, 90, 48, 0, Math.PI * 2); ctx.fill();
  } else {
    // storm clouds + lightning
    ctx.fillStyle = '#1c2833';
    for (const cx of [120, 320, 560]) {
      ctx.beginPath(); ctx.arc(cx, 70, 40, 0, Math.PI * 2); ctx.arc(cx + 45, 70, 50, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#f9ca24'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(330, 95); ctx.lineTo(310, 150); ctx.lineTo(335, 150); ctx.lineTo(315, 210); ctx.stroke();
  }

  // ---- sea ----
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  if (weather === 'storm') { sea.addColorStop(0, '#34495e'); sea.addColorStop(1, '#1b2631'); }
  else if (weather === 'night') { sea.addColorStop(0, '#15485c'); sea.addColorStop(1, '#0a2733'); }
  else if (weather === 'sunset') { sea.addColorStop(0, '#e96443'); sea.addColorStop(1, '#904e95'); }
  else { sea.addColorStop(0, '#2193b0'); sea.addColorStop(1, '#0b486b'); }
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);

  // wave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 6; row++) {
    const y = horizon + 24 + row * 28;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = y + Math.sin((x / 40) + row) * (weather === 'storm' ? 9 : 4);
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // ---- the ship ----
  ctx.save();
  ctx.translate(W / 2, horizon + 36);
  ctx.rotate((tilt * Math.PI) / 180);

  // hull
  ctx.fillStyle = '#6e3b1e';
  ctx.beginPath();
  ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.lineTo(60, 46); ctx.lineTo(-60, 46); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a8714a';
  ctx.fillRect(-90, -8, 180, 10);

  // mast
  ctx.fillStyle = '#4a2c12';
  ctx.fillRect(-4, -120, 8, 120);

  // sails
  ctx.fillStyle = '#f5f0e1';
  ctx.beginPath(); ctx.moveTo(2, -115); ctx.lineTo(2, -20); ctx.lineTo(70, -45); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2, -110); ctx.lineTo(-2, -30); ctx.lineTo(-60, -50); ctx.closePath(); ctx.fill();

  // flag
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.moveTo(4, -120); ctx.lineTo(38, -112); ctx.lineTo(4, -104); ctx.closePath(); ctx.fill();
  ctx.restore();

  // rain for storms
  if (weather === 'storm') {
    ctx.strokeStyle = 'rgba(200,220,255,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke();
    }
  }

  // ---- title banner ----
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 16, 16, W - 32, 46, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(title, W / 2, 40);

  return attach(canvas, 'ship.png');
}
