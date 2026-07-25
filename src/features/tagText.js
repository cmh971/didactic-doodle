// #tags — custom saved snippets per server. A classic, genuinely useful bot
// feature: staff save canned responses, anyone recalls them instantly.
//   #save rules Be kind, no spam, follow Discord ToS.   (Manage Messages)
//   #rules            → posts the saved "rules" snippet
//   #taglist          → list all tags
//   #delete rules     → remove it (Manage Messages)
//
// Only "#word" (no space after #) is handled, so Discord's "# Heading" markdown
// is untouched, and an unknown #word falls through to normal processing.
import { PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS tags (
  guild_id TEXT, name TEXT, content TEXT, created_by TEXT,
  PRIMARY KEY (guild_id, name)
)`);
const stmt = {
  get: db.prepare('SELECT content FROM tags WHERE guild_id = ? AND name = ?'),
  set: db.prepare('INSERT INTO tags(guild_id, name, content, created_by) VALUES (?,?,?,?) ON CONFLICT(guild_id, name) DO UPDATE SET content = excluded.content'),
  del: db.prepare('DELETE FROM tags WHERE guild_id = ? AND name = ?'),
  list: db.prepare('SELECT name FROM tags WHERE guild_id = ? ORDER BY name'),
};

const canManage = (member) => member?.permissions?.has(PermissionFlagsBits.ManageMessages);
const SUBS = new Set(['save', 'add', 'set', 'delete', 'remove', 'del', 'taglist', 'tags', 'taghelp']);

export async function handleTagText(message) {
  if (!message.guild) return false;
  const m = /^#(\S+)(?:\s+([\s\S]*))?$/.exec((message.content || '').trim());
  if (!m) return false; // no "#word" → not ours (headers like "# text" have a space)
  const key = m[1].toLowerCase();
  const rest = (m[2] || '').trim();
  const gid = message.guild.id;

  if (key === 'taghelp') {
    await message.reply('🏷️ **Tags:** `#save <name> <text>` · `#<name>` to post · `#taglist` · `#delete <name>`').catch(() => {});
    return true;
  }
  if (key === 'taglist' || key === 'tags') {
    const rows = stmt.list.all(gid);
    await message.reply(rows.length ? '🏷️ **Tags:** ' + rows.map((r) => `\`#${r.name}\``).join(' ') : 'No tags yet — make one with `#save <name> <text>`.').catch(() => {});
    return true;
  }
  if (['save', 'add', 'set'].includes(key)) {
    if (!canManage(message.member)) { await message.reply('❌ You need **Manage Messages** to save tags.').catch(() => {}); return true; }
    const sm = /^(\S+)\s+([\s\S]+)$/.exec(rest);
    if (!sm) { await message.reply('❌ Usage: `#save <name> <content>`').catch(() => {}); return true; }
    const name = sm[1].toLowerCase().slice(0, 40);
    if (SUBS.has(name)) { await message.reply('❌ That name is reserved.').catch(() => {}); return true; }
    stmt.set.run(gid, name, sm[2].slice(0, 1800), message.author.id);
    await message.reply(`✅ Saved tag \`#${name}\`.`).catch(() => {});
    return true;
  }
  if (['delete', 'remove', 'del'].includes(key)) {
    if (!canManage(message.member)) { await message.reply('❌ You need **Manage Messages** to delete tags.').catch(() => {}); return true; }
    const name = rest.toLowerCase().split(/\s+/)[0];
    if (!name) { await message.reply('❌ Usage: `#delete <name>`').catch(() => {}); return true; }
    const info = stmt.del.run(gid, name);
    await message.reply(info.changes ? `🗑️ Deleted \`#${name}\`.` : `❓ No tag called \`#${name}\`.`).catch(() => {});
    return true;
  }

  // Plain #name → post it if it exists; otherwise let the message pass through.
  const row = stmt.get.get(gid, key);
  if (!row) return false;
  await message.reply({ content: row.content.slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}
