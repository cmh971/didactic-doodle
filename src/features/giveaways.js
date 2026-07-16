// Giveaways: button-entry, scheduled end, winner pick, reroll. Survives restarts
// (active giveaways are rescheduled from the DB on startup).
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDb } from '../db/index.js';

const db = getDb();
const stmt = {
  create: db.prepare('INSERT INTO giveaways(guild_id, channel_id, prize, winners, ends_at, host_id) VALUES (?, ?, ?, ?, ?, ?)'),
  setMsg: db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?'),
  get: db.prepare('SELECT * FROM giveaways WHERE id = ?'),
  active: db.prepare('SELECT * FROM giveaways WHERE ended = 0'),
  end: db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?'),
  enter: db.prepare('INSERT OR IGNORE INTO giveaway_entries(giveaway_id, user_id) VALUES (?, ?)'),
  entries: db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM giveaway_entries WHERE giveaway_id = ?'),
};

const timers = new Map();

function embedFor(prize, winners, endsAt, entrants, ended, winnerMentions) {
  const e = new EmbedBuilder()
    .setColor(ended ? 0x95a5a6 : 0xe91e63)
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(
      `**Prize:** ${prize}\n**Winners:** ${winners}\n` +
        (ended ? `**Ended** — ${winnerMentions || 'no valid entries'}` : `**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`) +
        `\n**Entries:** ${entrants}`,
    )
    .setFooter({ text: ended ? 'Giveaway ended' : 'Click 🎉 to enter!' });
  return e;
}

export async function createGiveaway(interaction, prize, durationMs, winners) {
  const endsAt = Date.now() + durationMs;
  const info = stmt.create.run(interaction.guildId, interaction.channelId, prize, winners, endsAt, interaction.user.id);
  const id = info.lastInsertRowid;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gw:enter:${id}`).setLabel('Enter').setEmoji('🎉').setStyle(ButtonStyle.Success),
  );
  const msg = await interaction.channel.send({ embeds: [embedFor(prize, winners, endsAt, 0, false)], components: [row] });
  stmt.setMsg.run(msg.id, id);
  schedule(interaction.client, id, durationMs);
  return id;
}

export function enter(giveawayId, userId) {
  stmt.enter.run(giveawayId, userId);
  return stmt.count.get(giveawayId).n;
}

// ---- Dashboard helpers ----
const listStmt = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY id DESC LIMIT 25');
export function listGiveaways(guildId) {
  return listStmt.all(guildId).map((g) => ({
    id: g.id, prize: g.prize, winners: g.winners, ends_at: g.ends_at,
    ended: g.ended, channel_id: g.channel_id, entries: stmt.count.get(g.id).n,
  }));
}
// Create a giveaway from the dashboard (posts via the client, no interaction).
export async function createGiveawayWeb(client, { guildId, channelId, prize, durationMs, winners, hostId }) {
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel?.isTextBased?.()) throw new Error('Pick a valid text channel.');
  const endsAt = Date.now() + durationMs;
  const info = stmt.create.run(guildId, channelId, prize, winners, endsAt, hostId);
  const id = info.lastInsertRowid;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gw:enter:${id}`).setLabel('Enter').setEmoji('🎉').setStyle(ButtonStyle.Success),
  );
  const msg = await channel.send({ embeds: [embedFor(prize, winners, endsAt, 0, false)], components: [row] });
  stmt.setMsg.run(msg.id, id);
  schedule(client, id, durationMs);
  return { id, url: msg.url };
}

function pickWinners(userIds, n) {
  const a = [...userIds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export async function endGiveaway(client, id) {
  const g = stmt.get.get(id);
  if (!g || g.ended) return;
  stmt.end.run(id);
  clearTimeout(timers.get(id));
  timers.delete(id);

  const entrants = stmt.entries.all(id).map((r) => r.user_id);
  const winners = pickWinners(entrants, g.winners);
  const mentions = winners.length ? winners.map((w) => `<@${w}>`).join(', ') : null;

  const channel = await client.channels.fetch(g.channel_id).catch(() => null);
  if (channel?.isTextBased?.()) {
    const msg = await channel.messages.fetch(g.message_id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embedFor(g.prize, g.winners, g.ends_at, entrants.length, true, mentions)], components: [] }).catch(() => {});
    }
    await channel.send(mentions ? `🎉 Congratulations ${mentions}! You won **${g.prize}**!` : `😢 No one entered the giveaway for **${g.prize}**.`).catch(() => {});
  }
  return winners;
}

export async function reroll(client, id) {
  const g = stmt.get.get(id);
  if (!g) return null;
  const entrants = stmt.entries.all(id).map((r) => r.user_id);
  const w = pickWinners(entrants, g.winners);
  const channel = await client.channels.fetch(g.channel_id).catch(() => null);
  if (channel?.isTextBased?.()) {
    await channel.send(w.length ? `🔁 New winner for **${g.prize}**: ${w.map((x) => `<@${x}>`).join(', ')}!` : 'No entries to reroll.').catch(() => {});
  }
  return w;
}

function schedule(client, id, ms) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => endGiveaway(client, id).catch(() => {}), Math.max(0, ms)));
}

// Reschedule everything that's still active (called on startup).
export function restoreGiveaways(client) {
  for (const g of stmt.active.all()) {
    const ms = g.ends_at - Date.now();
    if (ms <= 0) endGiveaway(client, g.id).catch(() => {});
    else schedule(client, g.id, ms);
  }
}
