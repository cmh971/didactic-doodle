// Reaction roles: react to a message → get a role; remove reaction → lose it.
import { getDb } from '../db/index.js';

const db = getDb();
const stmt = {
  add: db.prepare('INSERT OR REPLACE INTO reaction_roles(guild_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)'),
  del: db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?'),
  get: db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?'),
  listForMsg: db.prepare('SELECT emoji, role_id FROM reaction_roles WHERE message_id = ?'),
};

// Normalize an emoji to a stable key (custom -> id, unicode -> name).
export function emojiKey(emoji) {
  return emoji.id || emoji.name;
}

export function addReactionRole(guildId, messageId, emoji, roleId) {
  stmt.add.run(guildId, messageId, emoji, roleId);
}
export function removeReactionRole(messageId, emoji) {
  stmt.del.run(messageId, emoji);
}
export function listReactionRoles(messageId) {
  return stmt.listForMsg.all(messageId);
}

// ---- Dashboard helpers ----
const guildListStmt = db.prepare('SELECT message_id, emoji, role_id FROM reaction_roles WHERE guild_id = ? ORDER BY message_id');
export function listGuildReactionRoles(guildId) {
  return guildListStmt.all(guildId);
}
// Add a reaction role from the dashboard: store it AND make the bot react.
export async function addReactionRoleWeb(client, { guildId, channelId, messageId, emoji, roleId }) {
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel?.isTextBased?.()) throw new Error('Pick the channel the message is in.');
  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg) throw new Error('Message not found in that channel.');
  const key = emoji.match(/<a?:\w+:(\d+)>/)?.[1] || emoji.trim();
  addReactionRole(guildId, messageId, key, roleId);
  await msg.react(emoji).catch(() => { throw new Error('Could not react with that emoji.'); });
  return true;
}

export async function handleReactionRole(reaction, user, added) {
  if (user.bot) return;
  const row = stmt.get.get(reaction.message.id, emojiKey(reaction.emoji));
  if (!row) return;
  const guild = reaction.message.guild;
  if (!guild) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  if (added) await member.roles.add(row.role_id, 'Reaction role').catch(() => {});
  else await member.roles.remove(row.role_id, 'Reaction role removed').catch(() => {});
}
