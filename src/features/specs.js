// "?specs" / "!specs" — a user runs the command in the server, the bot hands
// them a one-time link, the website reads what their BROWSER can see about their
// PC (GPU via WebGL, CPU threads, RAM, OS, display), relays it back, and the bot
// renders a "PC Spec Card" image into the channel.
//
// Browsers can't read exact CPU/RAM model (privacy), so values are "as your
// browser reports them" — deviceMemory caps at 8GB, GPU comes from the WebGL
// unmasked renderer. Close enough to be fun and useful.
import { randomBytes } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';

const PUBLIC_URL = () => (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');

// token -> { userId, tag, avatar, guildId, channelId, createdAt }
const pending = new Map();
const cooldown = new Map(); // userId -> timestamp
const TTL = 10 * 60 * 1000;
const COOLDOWN = 20 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [t, v] of pending) if (now - v.createdAt > TTL) pending.delete(t);
}

// ---- the Discord command -------------------------------------------------
export async function handleSpecsText(message) {
  const raw = (message.content || '').trim();
  if (!/^[!?]specs\b/i.test(raw)) return false;
  if (!message.guild) { await message.reply('🖥️ Run `?specs` inside a server.').catch(() => {}); return true; }

  const last = cooldown.get(message.author.id) || 0;
  if (Date.now() - last < COOLDOWN) {
    await message.reply(`⏳ Hang on — try again in ${Math.ceil((COOLDOWN - (Date.now() - last)) / 1000)}s.`).catch(() => {});
    return true;
  }
  cooldown.set(message.author.id, Date.now());
  cleanup();

  const token = randomBytes(16).toString('hex');
  pending.set(token, {
    userId: message.author.id,
    tag: message.author.tag || message.author.username,
    avatar: message.author.displayAvatarURL?.({ extension: 'png', size: 128 }) || null,
    guildId: message.guild.id,
    channelId: message.channel.id,
    createdAt: Date.now(),
  });

  const link = `${PUBLIC_URL()}/specs?t=${token}`;
  await message.reply(
    `🖥️ **PC Spec Card** — open this link and I'll read what your browser can see, then drop your card here:\n${link}\n` +
    `_Link is just for you and expires in 10 minutes. Works best on the machine you're actually on._`,
  ).catch(() => {});
  return true;
}

// ---- the web endpoints (registered from server.js) -----------------------
export function registerSpecsRoutes(app, client) {
  // Note: the GET /specs page route is registered in server.js via sendPage().
  app.post('/api/specs/submit', async (req, res) => {
    try {
      const { token, specs } = req.body || {};
      const rec = token && pending.get(token);
      if (!rec) return res.status(400).json({ ok: false, error: 'This link expired or was already used. Run ?specs again.' });
      pending.delete(token);

      const card = renderSpecCard(specs || {}, rec);
      const channel = await client.channels.fetch(rec.channelId).catch(() => null);
      if (!channel) return res.status(500).json({ ok: false, error: 'Could not find the channel to post in.' });

      await channel.send({
        content: `🖥️ **${rec.tag}**'s PC Spec Card:`,
        files: [new AttachmentBuilder(card, { name: 'spec-card.png' })],
        allowedMentions: { parse: [] },
      });
      return res.json({ ok: true, message: 'Your spec card was posted in the channel! 🎉' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });
}

// ---- the card renderer ----------------------------------------------------
function renderSpecCard(s, meta) {
  const W = 960, H = 620;
  const c = createCanvas(W, H); const g = c.getContext('2d');

  // Deep gradient background + indigo glow + faint tech grid.
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a0e1a'); bg.addColorStop(1, '#141024');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W - 160, 90, 20, W - 160, 90, 420);
  glow.addColorStop(0, 'rgba(99,102,241,0.28)'); glow.addColorStop(1, 'rgba(99,102,241,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const ab = g.createLinearGradient(0, 0, W, 0); ab.addColorStop(0, '#6366f1'); ab.addColorStop(1, '#22d3ee');
  g.fillStyle = ab; g.fillRect(0, 0, W, 6);

  // Header
  g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.textAlign = 'left'; g.fillText('PC SPEC CARD', 44, 74);
  g.fillStyle = '#8b94b3'; g.font = '22px Arial'; g.fillText(`@${meta.tag || 'user'}  ·  Sentinel`, 46, 106);

  // Colour-coded rows (GPU highlighted — it's the star).
  const CAT = { os: '#4aa3ff', cpu: '#3fb950', ram: '#a371f7', gpu: '#f778ba', display: '#39d0d8', browser: '#e3883e', net: '#2dd4bf' };
  const rows = [
    ['os', 'OS / Platform', s.os || '—'],
    ['cpu', 'CPU Threads', s.cores ? `${s.cores} logical` : '—'],
    ['ram', 'Memory (reported)', s.ram ? `${s.ram} GB${s.ram >= 8 ? '+' : ''}` : '—'],
    ['gpu', 'GPU', trim(s.gpu, 44) || '—'],
    ['display', 'Display', s.screen ? `${s.screen}${s.dpr ? ` @ ${s.dpr}x` : ''}` : '—'],
    ['browser', 'Browser', trim(s.browser, 40) || '—'],
    ['net', 'Connection', s.net || '—'],
  ];
  let y = 150; const rh = 52;
  for (const [cat, label, val] of rows) {
    g.fillStyle = 'rgba(255,255,255,0.045)'; g.beginPath(); g.roundRect(36, y, W - 72, rh - 8, 10); g.fill();
    g.fillStyle = CAT[cat]; g.beginPath(); g.roundRect(36, y, 5, rh - 8, 3); g.fill();
    g.fillStyle = '#9aa4bf'; g.font = '19px Arial'; g.textAlign = 'left'; g.fillText(label, 60, y + 29);
    g.fillStyle = cat === 'gpu' ? '#ffd1ec' : '#fff'; g.font = 'bold 23px Arial'; g.textAlign = 'right';
    g.fillText(String(val), W - 52, y + 29);
    y += rh;
  }

  // Score bar with tier + colour by tier.
  const score = specScore(s);
  const tier = score >= 90 ? 'BEAST' : score >= 75 ? 'STRONG' : score >= 50 ? 'SOLID' : 'BUDGET';
  const bx = 44, by = H - 64, bw = W - 88, bh = 20;
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(bx, by, bw, bh, 10); g.fill();
  const sc = g.createLinearGradient(bx, 0, bx + bw, 0);
  if (score >= 75) { sc.addColorStop(0, '#3fb950'); sc.addColorStop(1, '#22d3ee'); }
  else if (score >= 50) { sc.addColorStop(0, '#d29922'); sc.addColorStop(1, '#f0b429'); }
  else { sc.addColorStop(0, '#f85149'); sc.addColorStop(1, '#ff8f8f'); }
  g.fillStyle = sc; g.beginPath(); g.roundRect(bx, by, Math.max(bh, bw * (score / 100)), bh, 10); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 26px Arial'; g.textAlign = 'left'; g.fillText(`Rig Score: ${score}/100  ·  ${tier}`, bx, by - 14);
  g.fillStyle = '#5b6478'; g.font = '15px Arial'; g.textAlign = 'right';
  g.fillText('Reported by your browser · sentinelbothq.com', W - 30, H - 20); g.textAlign = 'left';

  return c.toBuffer('image/png');
}

function trim(str, n) { if (!str) return ''; return str.length > n ? str.slice(0, n - 1) + '…' : str; }

// A light-hearted heuristic — browsers hide the good stuff, so this is "for fun".
function specScore(s) {
  let n = 30;
  if (s.cores >= 16) n += 25; else if (s.cores >= 8) n += 18; else if (s.cores >= 4) n += 10;
  if (s.ram >= 8) n += 20; else if (s.ram >= 4) n += 10;
  const gpu = (s.gpu || '').toLowerCase();
  if (/rtx|radeon rx|arc a/.test(gpu)) n += 20; else if (/gtx|radeon|iris xe/.test(gpu)) n += 12; else if (gpu) n += 5;
  if (/apple m\d/.test(gpu)) n += 18;
  return Math.min(100, n);
}
