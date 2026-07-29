// !nav — an interactive grid navigator on a photo.
//   1. attach a photo → it appears with a grid + a movable 🟨 selector
//   2. move the selector with ▲ ▼ ◀ ▶
//   3. 🎯 Go  → draws the A* route from the start to the selector
//      🔍 Zoom → crops/zooms into the selector spot ("pretend you're there")
//      🔭 Back → zoom out
//
// Real 2D navigation + a zoom effect. (Not true 3D — that's photogrammetry.)
import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { astar, nearestFree } from './pathfind.js';

const COLS = 16;
const sessions = new Map(); // messageId -> session

const isImage = (a) => /^image\//.test(a.contentType || '') || /\.(png|jpe?g|webp|bmp)$/i.test(a.name || '');

function buildObstacle(img, cols, rows, threshold = 0.42) {
  const gc = createCanvas(cols, rows); const g = gc.getContext('2d');
  g.drawImage(img, 0, 0, cols, rows);
  const px = g.getImageData(0, 0, cols, rows).data;
  const obstacle = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const lum = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    obstacle[i] = lum < threshold ? 1 : 0;
  }
  return obstacle;
}

function renderNav(s, DW = 640) {
  const { img, W, H, cols, rows } = s;
  const DH = Math.round((H / W) * DW);
  const cw = DW / cols; const ch = DH / rows;
  const canvas = createCanvas(DW, DH); const ctx = canvas.getContext('2d');

  if (s.zoom) {
    const win = 5; const winR = Math.max(3, Math.round((win * rows) / cols));
    let sc = s.selCol + 0.5 - win / 2; let sr = s.selRow + 0.5 - winR / 2;
    sc = Math.max(0, Math.min(cols - win, sc)); sr = Math.max(0, Math.min(rows - winR, sr));
    ctx.drawImage(img, sc * (W / cols), sr * (H / rows), win * (W / cols), winR * (H / rows), 0, 0, DW, DH);
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(DW / 2 - 22, DH / 2); ctx.lineTo(DW / 2 + 22, DH / 2); ctx.moveTo(DW / 2, DH / 2 - 22); ctx.lineTo(DW / 2, DH / 2 + 22); ctx.stroke();
    ctx.beginPath(); ctx.arc(DW / 2, DH / 2, 28, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.drawImage(img, 0, 0, DW, DH);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, DH); ctx.stroke(); }
    for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(DW, r * ch); ctx.stroke(); }
    if (s.showPath) {
      const goal = nearestFree(s.obstacle, cols, rows, s.selCol, s.selRow);
      const path = goal ? astar(s.obstacle, cols, rows, s.start, goal) : null;
      if (path) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(6, cw * 0.34); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); path.forEach(([c, r], i) => { const x = (c + 0.5) * cw; const y = (r + 0.5) * ch; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.strokeStyle = '#22ff55'; ctx.lineWidth = Math.max(3, cw * 0.2);
        ctx.beginPath(); path.forEach(([c, r], i) => { const x = (c + 0.5) * cw; const y = (r + 0.5) * ch; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      }
    }
    ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc((s.start[0] + 0.5) * cw, (s.start[1] + 0.5) * ch, Math.max(6, cw * 0.24), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(250,204,21,0.28)'; ctx.fillRect(s.selCol * cw, s.selRow * ch, cw, ch);
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4; ctx.strokeRect(s.selCol * cw + 2, s.selRow * ch + 2, cw - 4, ch - 4);
  }
  return canvas.toBuffer('image/png');
}

function payload(s) {
  const png = renderNav(s);
  const embed = new EmbedBuilder()
    .setColor(s.zoom ? 0xfacc15 : 0x5865f2)
    .setTitle('🧭 Navigator')
    .setDescription(s.zoom
      ? '🔍 **Zoomed to your selected spot.** 🔭 Back to zoom out.'
      : `Move the 🟨 selector with the arrows, then **🎯 Go** to route there or **🔍 Zoom** to look.\n**Selector:** col ${s.selCol + 1}, row ${s.selRow + 1}`)
    .setImage('attachment://nav.png');
  const B = (id, emoji, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId('nav:' + id).setEmoji(emoji).setStyle(style).setLabel(label || '​');
  const rows = [
    new ActionRowBuilder().addComponents(B('up', '⬆️', 'Up')),
    new ActionRowBuilder().addComponents(B('left', '⬅️', 'Left'), B('go', '🎯', 'Go', ButtonStyle.Success), B('right', '➡️', 'Right')),
    new ActionRowBuilder().addComponents(B('down', '⬇️', 'Down'), B('zoom', '🔍', 'Zoom', ButtonStyle.Primary), B('back', '🔭', 'Back')),
  ];
  return { embeds: [embed], files: [new AttachmentBuilder(png, { name: 'nav.png' })], attachments: [], components: rows };
}

export async function handleNavText(message) {
  if (!/^!nav(igate)?\b/i.test((message.content || '').trim())) return false;
  const att = [...message.attachments.values()].find(isImage);
  if (!att) { await message.reply('🧭 **!nav** — attach a **photo** and I’ll drop a grid + a movable selector so you can pick where to go.').catch(() => {}); return true; }

  try {
    const res = await fetch(att.url);
    const img = await loadImage(Buffer.from(await res.arrayBuffer()));
    const cols = COLS; const rows = Math.max(6, Math.round((img.height / img.width) * cols));
    const obstacle = buildObstacle(img, cols, rows);
    const start = nearestFree(obstacle, cols, rows, Math.floor(cols / 2), rows - 1) || [Math.floor(cols / 2), rows - 1];
    const s = { img, W: img.width, H: img.height, cols, rows, obstacle, start, selCol: Math.floor(cols / 2), selRow: Math.floor(rows / 2), zoom: false, showPath: false, hostId: message.author.id, at: Date.now() };
    const sent = await message.reply(payload(s));
    sessions.set(sent.id, s);
    // prune old sessions
    if (sessions.size > 40) { const oldest = [...sessions.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (oldest) sessions.delete(oldest[0]); }
  } catch (e) { await message.reply('⚠️ Could not open the navigator: ' + e.message).catch(() => {}); }
  return true;
}

export async function handleNavButton(interaction) {
  if (!interaction.customId?.startsWith('nav:')) return false;
  const s = sessions.get(interaction.message.id);
  if (!s) { await interaction.reply({ content: '⏳ This navigator expired (bot restarted). Run `!nav` again.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  if (interaction.user.id !== s.hostId) { await interaction.reply({ content: '🔒 Only the person who opened this navigator can drive it.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }

  const act = interaction.customId.split(':')[1];
  if (act === 'up') { s.selRow = Math.max(0, s.selRow - 1); s.zoom = false; s.showPath = false; }
  else if (act === 'down') { s.selRow = Math.min(s.rows - 1, s.selRow + 1); s.zoom = false; s.showPath = false; }
  else if (act === 'left') { s.selCol = Math.max(0, s.selCol - 1); s.zoom = false; s.showPath = false; }
  else if (act === 'right') { s.selCol = Math.min(s.cols - 1, s.selCol + 1); s.zoom = false; s.showPath = false; }
  else if (act === 'go') { s.showPath = true; s.zoom = false; }
  else if (act === 'zoom') { s.zoom = true; }
  else if (act === 'back') { s.zoom = false; }
  s.at = Date.now();

  await interaction.update(payload(s)).catch(() => {});
  return true;
}
