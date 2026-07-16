// CPU-based card image rendering with @napi-rs/canvas.
// @napi-rs/canvas uses prebuilt native binaries (Skia) and renders entirely
// on the CPU — no GPU and no system build tools required.
import { createCanvas } from '@napi-rs/canvas';

const COLOR_HEX = {
  // light side
  red: '#d72600',
  green: '#379711',
  blue: '#0956bf',
  yellow: '#ecd407',
  // dark side (Flip)
  pink: '#e84393',
  teal: '#00b894',
  orange: '#e17055',
  purple: '#6c5ce7',
  wild: '#111111',
};

const TEXT_FOR = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip: 'SKIP',
  reverse: 'REV',
  draw1: '+1',
  draw2: '+2',
  draw4: '+4',
  draw5: '+5',
  draw6: '+6',
  draw10: '+10',
  skipall: 'SKIP ALL',
  discardall: 'DISCARD',
  flip: 'FLIP',
  wild: 'WILD',
  wild2: '+2',
  wild4: '+4',
  wild6: '+6',
  wild10: '+10',
  wildcolor: 'ROULETTE',
  wildskip: 'SKIP',
  wildreverse: 'REV',
};

// Wild cards whose quarters should use the dark-side palette.
const DARK_WILD_VALUES = new Set(['wildcolor']);

function fontSize(label) {
  if (label.length === 1) return 78;
  if (label.length === 2) return 54;
  if (label.length === 3) return 40;
  if (label.length <= 5) return 32;
  if (label.length <= 7) return 24;
  return 19;
}

const CARD_W = 150;
const CARD_H = 220;
const RADIUS = 16;
const GAP = 14;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draw a single card onto ctx at (x, y).
function drawCard(ctx, card, x, y) {
  const base = COLOR_HEX[card.color] || '#111111';

  // Card body
  ctx.save();
  ctx.fillStyle = base;
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();

  // White border
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  roundRect(ctx, x + 3, y + 3, CARD_W - 6, CARD_H - 6, RADIUS - 3);
  ctx.stroke();

  // White oval in the middle
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, CARD_W * 0.62, CARD_H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // For wild cards, draw the 4 color quarters in the oval
  if (card.color === 'wild') {
    const quarters = DARK_WILD_VALUES.has(card.value)
      ? ['pink', 'teal', 'orange', 'purple']
      : ['red', 'yellow', 'green', 'blue'];
    const cx = x + CARD_W / 2;
    const cy = y + CARD_H / 2;
    const rx = CARD_W * 0.42;
    const ry = CARD_H * 0.30;
    quarters.forEach((q, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
      ctx.closePath();
      ctx.fillStyle = COLOR_HEX[q];
      ctx.fill();
      ctx.restore();
    });
  }

  // Center text
  const label = TEXT_FOR[card.value] ?? card.value;
  ctx.fillStyle = card.color === 'wild' ? '#ffffff' : base;
  ctx.font = `bold ${fontSize(label)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (card.color === 'wild') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(label, x + CARD_W / 2, y + CARD_H / 2);
  }
  ctx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);

  // Corner labels (top-left, bottom-right)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${label.length > 4 ? 16 : 26}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 12, y + 10);
  ctx.save();
  ctx.translate(x + CARD_W - 12, y + CARD_H - 10);
  ctx.rotate(Math.PI);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  ctx.restore();
}

// Draw the back of an UNO card (used for the draw pile).
function drawCardBack(ctx, x, y) {
  ctx.save();
  // black body
  ctx.fillStyle = '#111111';
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  roundRect(ctx, x + 3, y + 3, CARD_W - 6, CARD_H - 6, RADIUS - 3);
  ctx.stroke();
  // red diagonal oval
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#d72600';
  ctx.beginPath();
  ctx.ellipse(0, 0, CARD_W * 0.62, CARD_H * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // UNO wordmark
  ctx.fillStyle = '#ffdd00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 46px Arial';
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
  ctx.rotate(-Math.PI / 9);
  ctx.strokeText('UNO', 0, 0);
  ctx.fillText('UNO', 0, 0);
  ctx.restore();
  ctx.restore();
}

// Render just a card back to a PNG buffer.
export function renderCardBack() {
  const pad = 12;
  const canvas = createCanvas(CARD_W + pad * 2, CARD_H + pad * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCardBack(ctx, pad, pad);
  return canvas.toBuffer('image/png');
}

const TABLE_COLOR_HEX = {
  red: '#d72600', green: '#379711', blue: '#0956bf', yellow: '#ecd407',
  pink: '#e84393', teal: '#00b894', orange: '#e17055', purple: '#6c5ce7', wild: '#888888',
};

// Render the WHOLE table as one big scene PNG: felt, draw pile, discard pile,
// current color, direction, draw stack, and every player with their card count.
export function renderTable(state) {
  const { topFace, currentColor, drawCount = 0, direction = 1, pendingDraw = 0, side = 'light', players = [], currentIndex = 0, mode = 'classic' } = state;
  const W = 920;
  const H = 540;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const dark = side === 'dark';
  const bg = ctx.createRadialGradient(W / 2, 230, 80, W / 2, 230, 640);
  bg.addColorStop(0, dark ? '#27412a' : '#2aa05a');
  bg.addColorStop(1, dark ? '#0a140a' : '#0b3d20');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // felt ring
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(W / 2, 215, 380, 175, 0, 0, Math.PI * 2);
  ctx.stroke();

  // title
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 34px Arial';
  ctx.fillText(`🎴 UNO — ${String(mode).toUpperCase()}`, W / 2, 18);

  // draw pile (back) on the left
  const pileY = 130;
  drawCardBack(ctx, 230, pileY + 6);
  drawCardBack(ctx, 226, pileY);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`Draw pile: ${drawCount}`, 226 + CARD_W / 2, pileY + CARD_H + 12);

  // discard top card on the right
  const displayed = { ...topFace, color: topFace.color === 'wild' ? currentColor : topFace.color };
  drawCard(ctx, displayed, 560, pileY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Discard', 560 + CARD_W / 2, pileY + CARD_H + 12);

  // current color chip in the middle
  ctx.save();
  ctx.fillStyle = TABLE_COLOR_HEX[currentColor] || '#888';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(W / 2, pileY + 70, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(currentColor).toUpperCase(), W / 2, pileY + 70);
  ctx.restore();

  // direction arrow
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 40px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(direction === 1 ? '↻' : '↺', W / 2, pileY + 150);

  // pending draw badge
  if (pendingDraw > 0) {
    ctx.save();
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(700, pileY - 6, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`+${pendingDraw}`, 700, pileY - 6);
    ctx.restore();
  }

  // players strip along the bottom
  const stripY = 430;
  const n = Math.max(players.length, 1);
  const slotW = Math.min(170, (W - 40) / n);
  const startX = (W - slotW * players.length) / 2;
  players.forEach((p, i) => {
    const x = startX + i * slotW;
    const active = i === currentIndex;
    ctx.fillStyle = active ? 'rgba(255,210,63,0.95)' : 'rgba(0,0,0,0.45)';
    roundRect(ctx, x + 6, stripY, slotW - 12, 84, 14);
    ctx.fill();
    ctx.fillStyle = active ? '#1a1a1a' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 18px Arial';
    const name = (p.username || 'Player').slice(0, 12);
    ctx.fillText(`${active ? '▶ ' : ''}${name}`, x + slotW / 2, stripY + 14);
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`🃏 ${p.handCount}`, x + slotW / 2, stripY + 44);
  });

  return canvas.toBuffer('image/png');
}

// Render a single card to a PNG buffer (used for the discard top card).
export function renderCard(card) {
  const pad = 12;
  const canvas = createCanvas(CARD_W + pad * 2, CARD_H + pad * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCard(ctx, card, pad, pad);
  return canvas.toBuffer('image/png');
}

// Render a whole hand to a PNG buffer, wrapping into rows.
export function renderHand(cards, { perRow = 7 } = {}) {
  const pad = 16;
  const n = Math.max(cards.length, 1);
  const cols = Math.min(n, perRow);
  const rows = Math.ceil(n / perRow);

  const width = pad * 2 + cols * CARD_W + (cols - 1) * GAP;
  const height = pad * 2 + rows * CARD_H + (rows - 1) * GAP;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, width, height);

  cards.forEach((card, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = pad + col * (CARD_W + GAP);
    const y = pad + row * (CARD_H + GAP);
    drawCard(ctx, card, x, y);
  });

  return canvas.toBuffer('image/png');
}
