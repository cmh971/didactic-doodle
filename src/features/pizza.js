// 🍕 Pizza Simulator — an advanced, image-driven delivery mini-game.
//
//   !pizza            → start a delivery run
//   Move your scooter around a canvas-rendered town with the ⬆️⬇️⬅️➡️ buttons.
//   Reach the customer's house before you run out of gas to DELIVER a freshly
//   generated pizza image and earn coins (base + distance + a random tip).
//
// Everything is drawn live with @napi-rs/canvas — the town map + your character
// are re-rendered every move, and the delivered pizza is procedurally drawn with
// random toppings. Economy payouts go through the real wallet.
import { createCanvas } from '@napi-rs/canvas';
import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { addWallet, balance } from '../economy/store.js';

const COLS = 8, ROWS = 6, CELL = 78, PAD = 26;
const W = COLS * CELL + PAD * 2, H = ROWS * CELL + PAD * 2 + 40;
const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const games = new Map(); // messageId -> state
// Anti-spam: canvas rendering is CPU-heavy, so cap it hard per user.
const lastStart = new Map(); // userId -> timestamp
const active = new Set();     // userIds with a game open right now
const COOLDOWN = 12000;

const TOPPINGS = [
  { name: 'Pepperoni', color: '#b91c1c' }, { name: 'Mushroom', color: '#d6c3a1' },
  { name: 'Olives', color: '#1f2937' }, { name: 'Peppers', color: '#16a34a' },
  { name: 'Onion', color: '#c084fc' }, { name: 'Bacon', color: '#f472b6' },
  { name: 'Pineapple', color: '#facc15' }, { name: 'Sausage', color: '#7c2d12' },
];

// ---- town map render ----
function renderMap(s) {
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  // grass
  g.fillStyle = '#2f7d32'; g.fillRect(0, 0, W, H);
  // HUD bar
  g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, 34);
  g.fillStyle = '#ffd23f'; g.font = 'bold 18px sans-serif'; g.textBaseline = 'middle';
  g.fillText('🍕 Pizza Delivery', 12, 17);
  g.fillStyle = '#e6edf3'; g.font = 'bold 15px sans-serif'; g.textAlign = 'right';
  g.fillText(`⛽ ${s.steps} moves left`, W - 12, 17); g.textAlign = 'left';

  const ox = PAD, oy = 34 + PAD;
  // blocks + roads
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
    const px = ox + x * CELL, py = oy + y * CELL;
    g.fillStyle = (x + y) % 2 ? '#3a8a3d' : '#347a37'; g.fillRect(px, py, CELL, CELL);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.strokeRect(px, py, CELL, CELL);
  }
  // roads (grid lines the scooter drives on)
  g.strokeStyle = '#6b7280'; g.lineWidth = 10;
  for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(ox + x * CELL, oy); g.lineTo(ox + x * CELL, oy + ROWS * CELL); g.stroke(); }
  for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(ox, oy + y * CELL); g.lineTo(ox + COLS * CELL, oy + y * CELL); g.stroke(); }
  g.strokeStyle = '#facc15'; g.lineWidth = 2; g.setLineDash([8, 8]);
  for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(ox + x * CELL, oy); g.lineTo(ox + x * CELL, oy + ROWS * CELL); g.stroke(); }
  g.setLineDash([]);

  const cx = (p) => ox + p.x * CELL + CELL / 2, cy = (p) => oy + p.y * CELL + CELL / 2;
  // customer house
  const hx = cx(s.dest), hy = cy(s.dest);
  g.fillStyle = '#8b5a2b'; g.fillRect(hx - 20, hy - 8, 40, 26);
  g.fillStyle = '#b91c1c'; g.beginPath(); g.moveTo(hx - 26, hy - 8); g.lineTo(hx, hy - 30); g.lineTo(hx + 26, hy - 8); g.closePath(); g.fill();
  g.fillStyle = '#fde68a'; g.fillRect(hx - 6, hy - 2, 12, 14);
  g.font = '16px sans-serif'; g.fillText('🏠', hx - 30, hy - 34);

  // scooter (character) — a red delivery marker with a pizza box
  const sx = cx(s.pos), sy = cy(s.pos);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(sx, sy + 16, 16, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ef4444'; g.beginPath(); g.arc(sx, sy, 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🛵', sx, sy); g.textAlign = 'left';
  return c.toBuffer('image/png');
}

// ---- procedural pizza render ----
function renderPizza(toppings) {
  const S = 420, c = createCanvas(S, S), g = c.getContext('2d');
  const cx = S / 2, cy = S / 2;
  g.fillStyle = '#1a120b'; g.fillRect(0, 0, S, S);
  // crust
  g.fillStyle = '#d9a25f'; g.beginPath(); g.arc(cx, cy, 190, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c8873f'; g.beginPath(); g.arc(cx, cy, 178, 0, Math.PI * 2); g.fill();
  // sauce
  g.fillStyle = '#c0392b'; g.beginPath(); g.arc(cx, cy, 162, 0, Math.PI * 2); g.fill();
  // cheese
  g.fillStyle = '#f4d35e'; g.beginPath(); g.arc(cx, cy, 156, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(230,180,60,.5)';
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = Math.random() * 150; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rint(3, 7), 0, 6.28); g.fill(); }
  // toppings
  for (const t of toppings) {
    g.fillStyle = t.color;
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r = Math.random() * 140; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9, 0, 6.28); g.fill(); }
  }
  // slice lines
  g.strokeStyle = 'rgba(120,60,20,.4)'; g.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; g.beginPath(); g.moveTo(cx - Math.cos(a) * 156, cy - Math.sin(a) * 156); g.lineTo(cx + Math.cos(a) * 156, cy + Math.sin(a) * 156); g.stroke(); }
  return c.toBuffer('image/png');
}

const moveRow = (disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('pz:up').setEmoji('⬆️').setStyle(ButtonStyle.Primary).setDisabled(disabled),
  new ButtonBuilder().setCustomId('pz:down').setEmoji('⬇️').setStyle(ButtonStyle.Primary).setDisabled(disabled),
  new ButtonBuilder().setCustomId('pz:left').setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(disabled),
  new ButtonBuilder().setCustomId('pz:right').setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(disabled),
  new ButtonBuilder().setCustomId('pz:quit').setEmoji('🛑').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
);

export async function handlePizzaCommand(message) {
  if (!/^!pizza\b/i.test((message.content || '').trim())) return false;
  if (!message.guild) { await message.reply('Play `!pizza` in a server.').catch(() => {}); return true; }

  // Spam guard: one game at a time + a cooldown between runs.
  if (active.has(message.author.id)) { await message.reply('🍕 Finish your current delivery first!').catch(() => {}); return true; }
  const wait = COOLDOWN - (Date.now() - (lastStart.get(message.author.id) || 0));
  if (wait > 0) { await message.reply(`⏳ Slow down! Another delivery in **${Math.ceil(wait / 1000)}s**.`).catch(() => {}); return true; }
  lastStart.set(message.author.id, Date.now());
  active.add(message.author.id);

  const pos = { x: 0, y: rint(0, ROWS - 1) };
  const dest = { x: COLS - 1, y: rint(0, ROWS - 1) };
  const need = dist(pos, dest);
  const state = { userId: message.author.id, pos, dest, steps: need + 5, base: need };

  const sent = await message.reply({
    embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🍕 Pizza Delivery!').setDescription(`Drive your 🛵 to the 🏠 in **${state.steps}** moves or less. Go!`).setImage('attachment://map.png')],
    files: [new AttachmentBuilder(renderMap(state), { name: 'map.png' })],
    components: [moveRow()],
  }).catch(() => null);
  if (!sent) { active.delete(message.author.id); return true; }
  games.set(sent.id, state);

  const collector = sent.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', async (i) => {
    const s = games.get(sent.id);
    if (!s) return i.deferUpdate().catch(() => {});
    if (i.user.id !== s.userId) return i.reply({ content: '🍕 This isn’t your delivery run! Start your own with `!pizza`.', ephemeral: true }).catch(() => {});

    if (i.customId === 'pz:quit') { collector.stop('quit'); return i.deferUpdate().catch(() => {}); }
    const d = { 'pz:up': [0, -1], 'pz:down': [0, 1], 'pz:left': [-1, 0], 'pz:right': [1, 0] }[i.customId];
    if (d) {
      s.pos.x = Math.max(0, Math.min(COLS - 1, s.pos.x + d[0]));
      s.pos.y = Math.max(0, Math.min(ROWS - 1, s.pos.y + d[1]));
      s.steps--;
    }

    // delivered?
    if (s.pos.x === s.dest.x && s.pos.y === s.dest.y) {
      collector.stop('delivered');
      const tip = rint(0, 60), pay = 40 + s.base * 8 + tip;
      addWallet(s.userId, pay, 'pizza');
      const picks = [...TOPPINGS].sort(() => Math.random() - 0.5).slice(0, rint(2, 4));
      await i.update({
        embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('🍕 Delivered! 🎉')
          .setDescription(`Hot and fresh with **${picks.map((t) => t.name).join(', ')}**!\n\n💵 Payout: **${(40 + s.base * 8)}** + 🪙 tip **${tip}** = **${pay}** coins\n💼 Wallet: **${balance(s.userId).total.toLocaleString()}**`)
          .setImage('attachment://pizza.png')],
        files: [new AttachmentBuilder(renderPizza(picks), { name: 'pizza.png' })],
        components: [moveRow(true)],
      }).catch(() => {});
      return;
    }

    // out of gas?
    if (s.steps <= 0) {
      collector.stop('empty');
      await i.update({
        embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('⛽ Out of gas!').setDescription('The pizza went cold before you arrived. No pay this run — try again with `!pizza`.').setImage('attachment://map.png')],
        files: [new AttachmentBuilder(renderMap(s), { name: 'map.png' })],
        components: [moveRow(true)],
      }).catch(() => {});
      return;
    }

    await i.update({
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🍕 Pizza Delivery!').setDescription(`Keep going to the 🏠! **${s.steps}** moves left.`).setImage('attachment://map.png')],
      files: [new AttachmentBuilder(renderMap(s), { name: 'map.png' })],
      components: [moveRow()],
    }).catch(() => {});
  });

  collector.on('end', (_, reason) => {
    games.delete(sent.id);
    active.delete(state.userId);
    if (reason === 'time') sent.edit({ components: [moveRow(true)] }).catch(() => {});
  });
  return true;
}
