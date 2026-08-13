// ⛏️ Minecraft Mine — a canvas-rendered push-your-luck mining minigame.
//
//   !mine            → start digging
//   ⛏️ Dig deeper for better ores (coal → iron → gold → diamond → emerald), but the
//   deeper you go the more likely you strike 🌋 LAVA or a 💥 CREEPER — which blows up
//   your whole haul. 💰 Cash Out any time to bank your loot as coins. Classic greed game.
import { createCanvas } from '@napi-rs/canvas';
import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { addWallet, balance } from '../economy/store.js';

const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fmt = (n) => Number(n || 0).toLocaleString();

// name, value, color, emoji, bust?
const B = {
  dirt:    { name: 'Dirt',    value: 0,   color: '#8b5a2b', emoji: '🟫' },
  stone:   { name: 'Stone',   value: 1,   color: '#7f7f7f', emoji: '⬜' },
  coal:    { name: 'Coal',    value: 6,   color: '#2b2b2b', emoji: '⚫' },
  iron:    { name: 'Iron',    value: 18,  color: '#d8cab0', emoji: '🔩' },
  redstone:{ name: 'Redstone',value: 25,  color: '#c62828', emoji: '🔴' },
  gold:    { name: 'Gold',    value: 45,  color: '#d4af37', emoji: '🟡' },
  diamond: { name: 'Diamond', value: 120, color: '#4dd0e1', emoji: '💎' },
  emerald: { name: 'Emerald', value: 180, color: '#2ecc71', emoji: '🟢' },
  lava:    { name: 'LAVA',    value: 0,   color: '#ff3d00', emoji: '🌋', bust: true },
  creeper: { name: 'CREEPER', value: 0,   color: '#4caf50', emoji: '💥', bust: true },
};

function pickBlock(depth) {
  const d = depth;
  const table = [
    ['dirt', Math.max(1, 26 - d * 2)],
    ['stone', 24],
    ['coal', 16],
    ['iron', 5 + Math.min(18, d)],
    ['redstone', 3 + Math.min(12, d * 0.6)],
    ['gold', 2 + Math.min(12, d * 0.5)],
    ['diamond', Math.min(9, d * 0.45)],
    ['emerald', Math.min(4, d * 0.2)],
    ['lava', 3 + Math.min(34, d * 1.3)],   // danger climbs fast with depth
    ['creeper', 2 + Math.min(16, d * 0.5)],
  ];
  const total = table.reduce((a, x) => a + x[1], 0);
  let r = Math.random() * total;
  for (const [k, w] of table) { if ((r -= w) <= 0) return { key: k, ...B[k] }; }
  return { key: 'stone', ...B.stone };
}

const games = new Map();
// Anti-spam: canvas rendering is CPU-heavy, so cap it per user.
const lastStart = new Map(); // userId -> timestamp
const active = new Set();     // userIds mining right now
const COOLDOWN = 12000;
const CW = 460, CH = 420;

function render(s) {
  const c = createCanvas(CW, CH), g = c.getContext('2d');
  g.fillStyle = '#0d1117'; g.fillRect(0, 0, CW, CH);
  // HUD
  g.fillStyle = '#1b2431'; g.fillRect(0, 0, CW, 46);
  g.fillStyle = '#4dd0e1'; g.font = 'bold 20px sans-serif'; g.textBaseline = 'middle';
  g.fillText('⛏️ Mineshaft', 14, 23);
  g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.font = 'bold 16px sans-serif';
  g.fillText(`Loot: ${fmt(s.loot)} 🪙`, CW - 14, 15);
  g.fillStyle = '#9aa7b4'; g.font = '13px sans-serif';
  g.fillText(`Depth: ${s.depth}m`, CW - 14, 33);
  g.textAlign = 'left';

  // dig column — most recent block nearest the miner (bottom)
  const show = s.history.slice(-8);
  const bw = 300, bh = 40, ox = 80, oy = 56;
  for (let i = 0; i < show.length; i++) {
    const blk = show[i], py = oy + i * (bh + 2);
    g.fillStyle = blk.color; g.fillRect(ox, py, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(ox, py, bw, bh);
    // speckle for ore texture
    g.fillStyle = 'rgba(255,255,255,.12)';
    for (let k = 0; k < 6; k++) g.fillRect(ox + rint(6, bw - 10), py + rint(6, bh - 8), 3, 3);
    g.fillStyle = /lava|creeper/.test(blk.key) ? '#fff' : '#0d1117';
    g.font = 'bold 15px sans-serif'; g.textBaseline = 'middle';
    g.fillText(`${blk.emoji} ${blk.name}`, ox + 12, py + bh / 2);
    if (blk.value) { g.textAlign = 'right'; g.fillText(`+${blk.value}`, ox + bw - 10, py + bh / 2); g.textAlign = 'left'; }
  }
  // miner marker
  const my = oy + show.length * (bh + 2) + 6;
  g.font = '26px sans-serif'; g.fillText('🧑‍🔧', ox + bw / 2 - 16, Math.min(CH - 20, my + 10));
  if (!show.length) { g.fillStyle = '#9aa7b4'; g.font = '15px sans-serif'; g.fillText('Press ⛏️ to start digging…', ox, oy + 20); }
  return c.toBuffer('image/png');
}

const row = (disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('mc:dig').setLabel('Dig deeper').setEmoji('⛏️').setStyle(ButtonStyle.Success).setDisabled(disabled),
  new ButtonBuilder().setCustomId('mc:cash').setLabel('Cash out').setEmoji('💰').setStyle(ButtonStyle.Primary).setDisabled(disabled),
);

const embed = (s, color, title, extra) => new EmbedBuilder().setColor(color).setTitle(title)
  .setDescription(extra || `Depth **${s.depth}m** · Loot **${fmt(s.loot)}** 🪙\n⛏️ dig for more (better ores below) · 💰 bank it before you hit lava!`)
  .setImage('attachment://mine.png');

export async function handleMinecraftCommand(message) {
  if (!/^!(mine|minecraft|mc)\b/i.test((message.content || '').trim())) return false;
  if (!message.guild) { await message.reply('Play `!mine` in a server.').catch(() => {}); return true; }

  // Spam guard: one mine at a time + a cooldown between runs.
  if (active.has(message.author.id)) { await message.reply('⛏️ Finish your current mine first!').catch(() => {}); return true; }
  const wait = COOLDOWN - (Date.now() - (lastStart.get(message.author.id) || 0));
  if (wait > 0) { await message.reply(`⏳ Slow down! You can mine again in **${Math.ceil(wait / 1000)}s**.`).catch(() => {}); return true; }
  lastStart.set(message.author.id, Date.now());
  active.add(message.author.id);

  const state = { userId: message.author.id, depth: 0, loot: 0, history: [] };
  const sent = await message.reply({
    embeds: [embed(state, 0x2ecc71, '⛏️ Minecraft Mine')],
    files: [new AttachmentBuilder(render(state), { name: 'mine.png' })],
    components: [row()],
  }).catch(() => null);
  if (!sent) { active.delete(message.author.id); return true; }
  games.set(sent.id, state);

  const col = sent.createMessageComponentCollector({ time: 150000 });
  col.on('collect', async (i) => {
    const s = games.get(sent.id);
    if (!s) return i.deferUpdate().catch(() => {});
    if (i.user.id !== s.userId) return i.reply({ content: '⛏️ This is someone else’s mine — start your own with `!mine`.', ephemeral: true }).catch(() => {});

    if (i.customId === 'mc:cash') {
      col.stop('cash');
      if (s.loot > 0) addWallet(s.userId, s.loot, 'minecraft');
      return i.update({
        embeds: [embed(s, 0x5865f2, '💰 Cashed Out!', `You climbed out with **${fmt(s.loot)}** 🪙 of ore!\n💼 Wallet: **${fmt(balance(s.userId).total)}**`)],
        files: [new AttachmentBuilder(render(s), { name: 'mine.png' })], components: [row(true)],
      }).catch(() => {});
    }

    // dig
    const blk = pickBlock(s.depth);
    s.depth++;
    s.history.push(blk);
    if (blk.bust) {
      col.stop('bust');
      const msg = blk.key === 'lava' ? '🌋 You struck **LAVA** and lost your whole haul!' : '💥 A **CREEPER** blew up your loot! Ssssss…';
      return i.update({
        embeds: [embed(s, 0xe74c3c, blk.key === 'lava' ? '🌋 Burned!' : '💥 Boom!', `${msg}\nYou walked away with **0** 🪙. Should’ve cashed out! 😬`)],
        files: [new AttachmentBuilder(render(s), { name: 'mine.png' })], components: [row(true)],
      }).catch(() => {});
    }
    s.loot += blk.value;
    await i.update({
      embeds: [embed(s, 0x2ecc71, '⛏️ Minecraft Mine')],
      files: [new AttachmentBuilder(render(s), { name: 'mine.png' })], components: [row()],
    }).catch(() => {});
  });

  col.on('end', (_, reason) => { games.delete(sent.id); active.delete(state.userId); if (reason === 'time') sent.edit({ components: [row(true)] }).catch(() => {}); });
  return true;
}
