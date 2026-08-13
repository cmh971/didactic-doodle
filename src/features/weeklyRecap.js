// Weekly recap — every Sunday the bot DMs the owner a summary of the home server's
// week: messages (with a sparkline), member growth, and the top XP + richest members.
// Also exposed as ?recap for an on-demand snapshot in any server.
import { EmbedBuilder } from 'discord.js';
import { getDb } from '../db/index.js';
import { series } from '../systems/analytics.js';
import { leaderboard as ecoLeaderboard } from '../economy/store.js';
import { leaderboard as xpLeaderboard } from '../systems/leveling.js';
import { getCfg } from '../setup/store.js';

const ownerIds = () => (process.env.OWNER_IDS || '1183222250153984040').split(',').map((s) => s.trim()).filter(Boolean);
const HOME_GUILD = () => process.env.HOME_GUILD_ID || '1521295950654734538';

const SPARK = '▁▂▃▄▅▆▇█';
const sparkline = (vals) => { const max = Math.max(1, ...vals); return vals.map((v) => SPARK[Math.min(7, Math.floor((v / max) * 7))]).join(''); };
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

export function buildRecapEmbed(client, guildId) {
  const g = client?.guilds?.cache.get(guildId);
  const wk = series(guildId, 7);
  const sum = (k) => wk.reduce((a, d) => a + (d[k] || 0), 0);
  const joins = sum('joins'), leaves = sum('leaves'), messages = sum('messages');
  const net = joins - leaves;
  const uname = (id) => client?.users?.cache.get(id)?.username || `User ${String(id).slice(-4)}`;
  const topXp = xpLeaderboard(guildId, 5).map((r, i) => `${MEDALS[i]} ${uname(r.id)} — L${r.level}`).join('\n') || '—';
  const topEco = ecoLeaderboard(5).map((r, i) => `${MEDALS[i]} ${uname(r.id)} — ${Number(r.total).toLocaleString()} 🪙`).join('\n') || '—';
  const busiest = wk.reduce((b, d) => (d.messages > (b?.messages ?? -1) ? d : b), null);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 Weekly Recap — ${g?.name || 'Server'}`)
    .setThumbnail(g?.iconURL?.({ size: 128 }) || null)
    .setDescription('Here’s how your server did over the last 7 days:')
    .addFields(
      { name: '💬 Messages', value: `**${messages.toLocaleString()}**\n\`${sparkline(wk.map((d) => d.messages))}\`${busiest ? `\nBusiest day: ${busiest.day} (${busiest.messages})` : ''}`, inline: true },
      { name: '📈 Membership', value: `➕ ${joins} joined\n➖ ${leaves} left\n**${net >= 0 ? '+' : ''}${net}** net`, inline: true },
      { name: '​', value: '​', inline: false },
      { name: '⭐ Top members (XP)', value: topXp, inline: true },
      { name: '💰 Richest members', value: topEco, inline: true },
    )
    .setFooter({ text: 'Sentinel • weekly recap' })
    .setTimestamp();
}

export async function sendWeeklyRecap(client, guildId) {
  const embed = buildRecapEmbed(client, guildId);
  let sent = 0;
  for (const oid of ownerIds()) {
    const u = await client.users.fetch(oid).catch(() => null);
    if (u) { await u.send({ embeds: [embed] }).catch(() => {}); sent++; }
  }
  // Also post to the configured recap channel, if set (/setup → Weekly Recap).
  const chId = getCfg(guildId).settings.recap?.channel;
  if (chId) {
    const ch = client.guilds.cache.get(guildId)?.channels?.cache.get(chId);
    if (ch?.isTextBased?.()) await ch.send({ embeds: [embed] }).catch(() => {});
  }
  return sent;
}

// ---- scheduler (Sunday ~5pm UTC, deduped per ISO week) ----
const db = getDb();
db.exec('CREATE TABLE IF NOT EXISTS recap_state (guild_id TEXT PRIMARY KEY, last_week TEXT)');
const isoWeek = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
};

let timer = null;
export function startRecapScheduler(client) {
  if (timer) return;
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCDay() !== 0 || now.getUTCHours() !== 17) return; // Sunday 17:00 UTC
      const gid = HOME_GUILD();
      if (!client.guilds.cache.get(gid)) return;
      if (getCfg(gid).settings.recap?.enabled === false) return; // auto-DM turned off
      const wk = isoWeek(now);
      const row = db.prepare('SELECT last_week FROM recap_state WHERE guild_id=?').get(gid);
      if (row?.last_week === wk) return; // already sent this week
      const n = await sendWeeklyRecap(client, gid);
      db.prepare('INSERT INTO recap_state(guild_id,last_week) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET last_week=excluded.last_week').run(gid, wk);
      console.log(`📊 Weekly recap DM'd to ${n} owner(s) for guild ${gid} (${wk}).`);
    } catch (e) { console.error('recap tick:', e.message); }
  };
  timer = setInterval(tick, 60 * 60 * 1000); // hourly
  tick();
  console.log('📊 Weekly recap scheduler started (Sundays 17:00 UTC).');
}
