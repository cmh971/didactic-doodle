// Staff manager — promotions, demotions, infractions, and raw role add/remove,
// all logged. Promotions/demotions walk a per-guild RANK LADDER (an ordered list
// of roles) so "promote" cleanly moves a member up one rung and "demote" moves
// them down. Everything is configurable on the dashboard or via /staff.
import { getDb } from '../db/index.js';
import { getCfg, setSetting } from '../setup/store.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS staff_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  moderator_id TEXT,
  reason TEXT,
  at INTEGER NOT NULL
)`);
const logIns = db.prepare('INSERT INTO staff_log(guild_id,target_id,action,detail,moderator_id,reason,at) VALUES(?,?,?,?,?,?,?)');
const logList = db.prepare('SELECT * FROM staff_log WHERE guild_id=? ORDER BY id DESC LIMIT ?');
const logUser = db.prepare('SELECT * FROM staff_log WHERE guild_id=? AND target_id=? ORDER BY id DESC LIMIT ?');

/** Ordered rank ladder for a guild: [{ id, name, roleId }] (index 0 = lowest). */
export const listRanks = (guildId) => getCfg(guildId).settings.ranks || [];
export const saveRanks = (guildId, ranks) => setSetting(guildId, 'ranks', ranks).settings.ranks;
export const staffLog = (guildId, limit = 25) => logList.all(guildId, limit);
export const userStaffLog = (guildId, userId, limit = 25) => logUser.all(guildId, userId, limit);

function currentRankIndex(member, ranks) {
  let idx = -1;
  ranks.forEach((r, i) => { if (r.roleId && member.roles.cache.has(r.roleId)) idx = Math.max(idx, i); });
  return idx;
}

/**
 * Apply a staff action to a member.
 * action: 'promote' | 'demote' | 'infract' | 'addrole' | 'removerole'
 */
export async function applyAction(client, { guildId, targetId, action, roleId, moderatorId, reason }) {
  const guild = client?.guilds?.cache.get(guildId);
  if (!guild) return { ok: false, error: 'Bot is not in that server.' };
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) return { ok: false, error: 'That member isn\'t in the server.' };
  const ranks = listRanks(guildId).filter((r) => r.roleId);
  let detail = '';

  if (action === 'promote' || action === 'demote') {
    if (ranks.length < 1) return { ok: false, error: 'No rank ladder set up yet — add ranks on the dashboard (Staff Manager).' };
    const cur = currentRankIndex(member, ranks);
    const next = action === 'promote' ? cur + 1 : cur - 1;
    if (next < 0) return { ok: false, error: `${member.user.username} is already at the lowest rank.` };
    if (next > ranks.length - 1) return { ok: false, error: `${member.user.username} is already at the top rank.` };
    for (const r of ranks) if (member.roles.cache.has(r.roleId)) await member.roles.remove(r.roleId, `Staff ${action}`).catch(() => {});
    await member.roles.add(ranks[next].roleId, `Staff ${action}`).catch(() => {});
    detail = `${cur < 0 ? '—' : ranks[cur].name} → ${ranks[next].name}`;
  } else if (action === 'addrole') {
    if (!roleId) return { ok: false, error: 'Pick a role to add.' };
    const okAdd = await member.roles.add(roleId, 'Staff action').then(() => true).catch(() => false);
    if (!okAdd) return { ok: false, error: 'Could not add that role (check the bot\'s role position/permissions).' };
    detail = `+${guild.roles.cache.get(roleId)?.name || roleId}`;
  } else if (action === 'removerole') {
    if (!roleId) return { ok: false, error: 'Pick a role to remove.' };
    const okRem = await member.roles.remove(roleId, 'Staff action').then(() => true).catch(() => false);
    if (!okRem) return { ok: false, error: 'Could not remove that role (check the bot\'s role position/permissions).' };
    detail = `-${guild.roles.cache.get(roleId)?.name || roleId}`;
  } else if (action === 'infract') {
    detail = 'infraction logged';
    if (roleId) await member.roles.add(roleId, `Infraction: ${reason || 'no reason'}`).catch(() => {});
  } else {
    return { ok: false, error: 'Unknown action.' };
  }

  logIns.run(guildId, targetId, action, detail, moderatorId || '', reason || '', Date.now());
  return { ok: true, action, detail, target: member.user.username };
}
