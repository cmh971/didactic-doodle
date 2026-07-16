// LEVEL 3 CARD ENGINE — animated feel, prestige, glassmorphism
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';

// ---------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------

async function loadAvatar(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch {
    return null;
  }
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

function addNoise(ctx, W, H, strength = 0.08) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * strength;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }

  ctx.putImageData(imgData, 0, 0);
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.5);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAvatar(ctx, img, cx, cy, r, ringColor, prestige = false) {
  glow(ctx, cx, cy, r, ringColor + '55');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.fillStyle = '#9aa7b4';
    ctx.font = `bold ${r}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
  }

  ctx.restore();

  ctx.lineWidth = prestige ? 8 : 6;
  ctx.strokeStyle = prestige ? '#ffd700' : ringColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (prestige) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function fitText(ctx, text, maxWidth, startSize) {
  let size = startSize;
  while (size > 14) {
    ctx.font = `bold ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function glassPanel(ctx, x, y, w, h, r = 24) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------
// THEMES
// ---------------------------------------------------------

const THEMES = {
  welcome: {
    bg1: '#0f2027',
    bg2: '#2c5364',
    accent: '#2ecc71',
    title: '#7CFC9B'
  },
  goodbye: {
    bg1: '#3a1c1c',
    bg2: '#6b2737',
    accent: '#e74c3c',
    title: '#ff8a8a'
  },
  rank: {
    bg1: '#141e30',
    bg2: '#243b55',
    accent: '#9b59b6'
  }
};

// ---------------------------------------------------------
// WELCOME / GOODBYE CARD
// ---------------------------------------------------------

export async function renderMemberCard({
  username,
  avatarURL,
  guildName,
  memberCount,
  type = 'welcome'
}) {
  const W = 900;
  const H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const theme = THEMES[type];

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  addNoise(ctx, W, H, 0.06);

  glassPanel(ctx, 24, 24, W - 48, H - 48);

  const img = await loadAvatar(avatarURL);
  drawAvatar(ctx, img, 150, H / 2, 90, theme.accent, false);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = theme.title;
  ctx.font = 'bold 44px Arial';
  ctx.fillText(type === 'goodbye' ? 'GOODBYE' : 'WELCOME', 280, 95);

  ctx.fillStyle = '#ffffff';
  const nameSize = fitText(ctx, username, W - 320, 56);
  ctx.font = `bold ${nameSize}px Arial`;
  ctx.fillText(username, 280, 150);

  ctx.fillStyle = '#cfd8e3';
  ctx.font = '24px Arial';
  ctx.fillText(type === 'goodbye' ? `left ${guildName}` : `to ${guildName}`, 280, 200);

  if (memberCount) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(
      type === 'goodbye' ? '👋 See you around!' : `🎉 You're member #${memberCount}`,
      280,
      240
    );
  }

  return new AttachmentBuilder(canvas.toBuffer('image/png'), {
    name: `${type}.png`
  });
}

// ---------------------------------------------------------
// RANK CARD — LEVEL 3
// ---------------------------------------------------------

export async function renderRankCard({
  username,
  avatarURL,
  level,
  xp,
  need,
  rank
}) {
  const W = 900;
  const H = 260;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const theme = THEMES.rank;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  addNoise(ctx, W, H, 0.05);

  glassPanel(ctx, 20, 20, W - 40, H - 40, 22);

  const prestige = level >= 50 || (rank && rank <= 10);

  const img = await loadAvatar(avatarURL);
  drawAvatar(ctx, img, 130, H / 2, 85, theme.accent, prestige);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  const nameSize = fitText(ctx, username, 420, 48);
  ctx.font = `bold ${nameSize}px Arial`;
  ctx.fillText(username, 250, 95);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 34px Arial';
  ctx.fillText(`LEVEL ${level}`, W - 50, 80);

  if (rank) {
    ctx.fillStyle = prestige ? '#ffd700' : '#9aa7b4';
    ctx.font = 'bold 26px Arial';
    ctx.fillText(`RANK #${rank}`, W - 50, 115);
  }

  // Rank icon (trophy / star)
  if (prestige) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd700';
    ctx.font = '32px Arial';
    ctx.fillText('🏆', 250, 80);
  } else if (rank && rank <= 100) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '28px Arial';
    ctx.fillText('⭐', 250, 80);
  }

  const bx = 250;
  const by = 150;
  const bw = W - bx - 50;
  const bh = 40;
  const pct = Math.max(0, Math.min(1, xp / need));

  // XP bar background (glass)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();

  const barGlow = ctx.createLinearGradient(bx, by, bx, by + bh);
  barGlow.addColorStop(0, 'rgba(255,255,255,0.35)');
  barGlow.addColorStop(0.4, 'rgba(255,255,255,0.08)');
  barGlow.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = barGlow;
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.restore();

  const fillW = Math.max(bh, bw * pct);
  const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  fg.addColorStop(0, '#8e2de2');
  fg.addColorStop(0.5, '#a855f7');
  fg.addColorStop(1, '#4a00e0');
  ctx.fillStyle = fg;
  roundRect(ctx, bx, by, fillW, bh, bh / 2);
  ctx.fill();

  // Motion streaks (fake animation feel)
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const sx = bx + fillW * (0.4 + i * 0.08);
    if (sx > bx + fillW - 10) break;
    ctx.beginPath();
    ctx.moveTo(sx, by + 6);
    ctx.lineTo(sx + 18, by + bh - 6);
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#cfd8e3';
  ctx.font = '20px Arial';
  ctx.fillText(
    `XP: ${xp.toLocaleString()} / ${need.toLocaleString()}`,
    bx + 6,
    by + bh + 28
  );

  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(pct * 100)}%`, bx + bw, by + bh + 28);

  return new AttachmentBuilder(canvas.toBuffer('image/png'), {
    name: 'rank.png'
  });
}
