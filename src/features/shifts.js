// Shift Management (a Ducky staff feature): staff clock in/out, tracked in a DB
// table with weekly leaderboards + a live "who's on shift" view. Configured on
// the website (/shifts). Commands:
//   !shift start | end | status | active | leaderboard
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg, setSetting } from '../setup/store.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS shift_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  duration INTEGER
)`);
const q = {
  start: db.prepare('INSERT INTO shift_log(guild_id,user_id,start_at) VALUES(?,?,?)'),
  active: db.prepare('SELECT * FROM shift_log WHERE guild_id=? AND user_id=? AND end_at IS NULL ORDER BY id DESC LIMIT 1'),
  end: db.prepare('UPDATE shift_log SET end_at=?, duration=? WHERE id=?'),
  weekTotal: db.prepare('SELECT COALESCE(SUM(duration),0) t FROM shift_log WHERE guild_id=? AND user_id=? AND end_at IS NOT NULL AND end_at>=?'),
  activeAll: db.prepare('SELECT user_id, start_at FROM shift_log WHERE guild_id=? AND end_at IS NULL ORDER BY start_at ASC'),
  board: db.prepare('SELECT user_id, SUM(duration) t FROM shift_log WHERE guild_id=? AND end_at IS NOT NULL AND end_at>=? GROUP BY user_id ORDER BY t DESC LIMIT 10'),
};
const IDS = (a) => (Array.isArray(a) ? a : []).filter((x) => /^\d{15,25}$/.test(String(x))).slice(0, 25);
const humanDur = (ms) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };

export function getShiftCfg(guildId) {
  const d = getCfg(guildId)?.settings?.shifts || {};
  return { enabled: !!d.enabled, staffRoles: d.staffRoles || [], logChannel: d.logChannel || '' };
}
export function saveShiftCfg(guildId, cfg) {
  const clean = { enabled: !!cfg.enabled, staffRoles: IDS(cfg.staffRoles), logChannel: /^\d{15,25}$/.test(cfg.logChannel || '') ? cfg.logChannel : '' };
  setSetting(guildId, 'shifts', clean);
  return clean;
}
export function shiftData(guildId) {
  const weekAgo = Date.now() - 7 * 864e5;
  return { active: q.activeAll.all(guildId), leaderboard: q.board.all(guildId, weekAgo) };
}

async function log(message, cfg, text) {
  if (!cfg.logChannel) return;
  const ch = message.guild.channels.cache.get(cfg.logChannel);
  if (ch?.isTextBased?.()) ch.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(text).setTimestamp()] }).catch(() => {});
}

export async function handleShiftText(message) {
  const raw = (message.content || '').trim();
  if (!/^!shift\b/i.test(raw)) return false;
  if (!message.guild) return false;
  const cfg = getShiftCfg(message.guild.id);
  if (!cfg.enabled) { await message.reply('🕒 Shift management is off — enable it at **sentinelbothq.com/shifts**.').catch(() => {}); return true; }

  const sub = (raw.split(/\s+/)[1] || '').toLowerCase();
  const isStaff = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
    || cfg.staffRoles.length === 0 || cfg.staffRoles.some((r) => message.member?.roles?.cache?.has(r));
  const weekAgo = Date.now() - 7 * 864e5;

  if (sub === 'start' || sub === 'on' || sub === 'in') {
    if (!isStaff) { await message.reply('🔒 You’re not on the shift staff list.').catch(() => {}); return true; }
    if (q.active.get(message.guild.id, message.author.id)) { await message.reply('⏱️ You’re **already on shift**. `!shift end` to clock out.').catch(() => {}); return true; }
    q.start.run(message.guild.id, message.author.id, Date.now());
    await message.reply('🟢 **Clocked in.** Have a good shift! Use `!shift end` when you’re done.').catch(() => {});
    log(message, cfg, `🟢 <@${message.author.id}> **clocked in**.`);
    return true;
  }
  if (sub === 'end' || sub === 'off' || sub === 'out') {
    const cur = q.active.get(message.guild.id, message.author.id);
    if (!cur) { await message.reply('🤔 You’re **not on shift**. `!shift start` to clock in.').catch(() => {}); return true; }
    const dur = Date.now() - cur.start_at;
    q.end.run(Date.now(), dur, cur.id);
    await message.reply(`🔴 **Clocked out.** You worked **${humanDur(dur)}** this shift.`).catch(() => {});
    log(message, cfg, `🔴 <@${message.author.id}> **clocked out** — worked ${humanDur(dur)}.`);
    return true;
  }
  if (sub === 'status') {
    const cur = q.active.get(message.guild.id, message.author.id);
    const week = q.weekTotal.get(message.guild.id, message.author.id, weekAgo).t || 0;
    const now = cur ? `🟢 On shift — **${humanDur(Date.now() - cur.start_at)}** so far.` : '⚪ Not on shift.';
    await message.reply(`${now}\n📊 This week: **${humanDur(week)}** total.`).catch(() => {});
    return true;
  }
  if (sub === 'active' || sub === 'who') {
    const rows = q.activeAll.all(message.guild.id);
    if (!rows.length) { await message.reply('💤 Nobody is on shift right now.').catch(() => {}); return true; }
    const list = rows.map((r) => `🟢 <@${r.user_id}> — ${humanDur(Date.now() - r.start_at)}`).join('\n');
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x3fb950).setTitle(`🕒 On Shift (${rows.length})`).setDescription(list.slice(0, 4096))], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }
  if (sub === 'leaderboard' || sub === 'top' || sub === 'lb') {
    const rows = q.board.all(message.guild.id, weekAgo);
    if (!rows.length) { await message.reply('📊 No shift time logged this week yet.').catch(() => {}); return true; }
    const medals = ['🥇', '🥈', '🥉'];
    const list = rows.map((r, i) => `${medals[i] || `**${i + 1}.**`} <@${r.user_id}> — ${humanDur(r.t)}`).join('\n');
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🏆 Shift Leaderboard — this week').setDescription(list)], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }
  await message.reply('🕒 **Shifts** — `!shift start` · `!shift end` · `!shift status` · `!shift active` · `!shift leaderboard`').catch(() => {});
  return true;
}
