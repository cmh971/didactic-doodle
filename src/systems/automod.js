// Automated moderation engine:
//  • Regex invite-link blocking
//  • Spam heuristic: >5 messages within 3 seconds (atomic via cache rate-limiter)
//  • Structured punishment STATE MACHINE escalating with each infraction:
//      1) Warn  2) Timeout 10m  3) Timeout 24h  4) Kick  5+) Permanent Ban
import { PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';
import { cache } from '../db/index.js';
import { getGuild } from './guilds.js';

const db = getDb();
const stmt = {
  add: db.prepare('INSERT INTO infractions(user_id, guild_id, moderator_id, type, reason, expires_at) VALUES (?, ?, ?, ?, ?, ?)'),
  count: db.prepare('SELECT COUNT(*) AS n FROM infractions WHERE guild_id = ? AND user_id = ?'),
  recent: db.prepare('SELECT * FROM infractions WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?'),
};

const INVITE_RE = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-z0-9-]+/i;

// The punishment ladder. Index = (infractionCount - 1), clamped to last.
const LADDER = [
  { action: 'warn', label: '⚠️ Warning' },
  { action: 'timeout', ms: 10 * 60_000, label: '🔇 10-minute timeout' },
  { action: 'timeout', ms: 24 * 60 * 60_000, label: '🔇 24-hour timeout' },
  { action: 'kick', label: '👢 Kick' },
  { action: 'ban', label: '🔨 Permanent ban' },
];

export function recordInfraction(guildId, userId, moderatorId, type, reason, expiresAt = null) {
  stmt.add.run(userId, guildId, moderatorId, type, reason, expiresAt);
  return stmt.count.get(guildId, userId).n;
}

export function infractionCount(guildId, userId) {
  return stmt.count.get(guildId, userId).n;
}

const clearStmt = db.prepare('DELETE FROM infractions WHERE guild_id = ? AND user_id = ?');
export function clearInfractions(guildId, userId) {
  const before = stmt.count.get(guildId, userId).n;
  clearStmt.run(guildId, userId);
  return before;
}

export function recentInfractions(guildId, userId, limit = 5) {
  return stmt.recent.all(guildId, userId, limit);
}

// Apply the next ladder step to a member based on their total infractions.
export async function escalate(member, reason) {
  const count = recordInfraction(member.guild.id, member.id, member.client.user.id, 'auto', reason);
  const step = LADDER[Math.min(count - 1, LADDER.length - 1)];
  try {
    if (step.action === 'timeout') await member.timeout(step.ms, reason);
    else if (step.action === 'kick') await member.kick(reason);
    else if (step.action === 'ban') await member.ban({ reason });
  } catch {
    /* missing perms / hierarchy — infraction is still logged */
  }
  return { count, label: step.label };
}

// Scan a guild message. Returns a notice string if it acted, else null.
export async function scan(message) {
  if (!message.guild || message.author.bot) return null;
  const member = message.member;
  if (!member) return null;
  // Never moderate staff.
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return null;
  if (!getGuild(message.guild.id).modules.automod) return null;

  // ---- invite links ----
  if (INVITE_RE.test(message.content)) {
    await message.delete().catch(() => {});
    const { label } = await escalate(member, 'Posting an invite link');
    return `🚫 ${message.author}, invite links aren't allowed. **${label}** applied.`;
  }

  // ---- spam: >5 messages within 3 seconds ----
  const allowed = await cache.rateLimit(`spam:${message.guild.id}:${message.author.id}`, 5, 3);
  if (!allowed) {
    const { label } = await escalate(member, 'Spam (>5 messages / 3s)');
    return `🚫 ${message.author}, slow down — that's spam. **${label}** applied.`;
  }

  return null;
}
