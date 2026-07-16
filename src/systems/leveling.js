// Text-activity XP / leveling engine.
//   XP to advance from level L -> L+1 = 50·L² + 100·L
//   Strict 60s per-user cooldown (anti-spam farming)
//   Auto-role promotion on level-up (configured per guild in settings.autoroles)
import { getDb } from '../db/index.js';
import { getGuild } from './guilds.js';

const db = getDb();
const stmt = {
  get: db.prepare('SELECT xp, level, last_msg FROM levels WHERE user_id = ? AND guild_id = ?'),
  ins: db.prepare('INSERT OR IGNORE INTO levels(user_id, guild_id, level) VALUES (?, ?, 1)'),
  upd: db.prepare('UPDATE levels SET xp = ?, level = ?, last_msg = ? WHERE user_id = ? AND guild_id = ?'),
  top: db.prepare('SELECT user_id AS id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT ?'),
};

export const XP_COOLDOWN = 60_000; // 60s
export const xpPerMessage = () => 15 + Math.floor(Math.random() * 11); // 15–25
export const xpNeeded = (level) => 50 * level * level + 100 * level;

export function getLevel(userId, guildId) {
  stmt.ins.run(userId, guildId);
  return stmt.get.get(userId, guildId);
}

// Award XP for a message. Returns { leveled, level, awarded } or null if on cooldown.
export function awardMessageXp(userId, guildId) {
  const row = getLevel(userId, guildId);
  const now = Date.now();
  if (now - row.last_msg < XP_COOLDOWN) return null;

  let xp = row.xp + xpPerMessage();
  let level = row.level || 1;
  let leveled = false;
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
    leveled = true;
  }
  stmt.upd.run(xp, level, now, userId, guildId);
  return { leveled, level, xp };
}

export function leaderboard(guildId, limit = 10) {
  return stmt.top.all(guildId, limit);
}

// Apply auto-role on level-up. settings.autoroles = { "5": roleId, "10": roleId }.
export async function applyAutoRole(member, level) {
  const { settings } = getGuild(member.guild.id);
  const map = settings.autoroles || {};
  const roleId = map[String(level)];
  if (!roleId) return null;
  try {
    await member.roles.add(roleId, `Level ${level} auto-role`);
    return roleId;
  } catch {
    return null;
  }
}
