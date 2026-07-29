// Encrypted server backup + restore — disaster recovery.
//   !backup           → snapshot THIS server (roles, channels, categories,
//                       permission overwrites, settings) → AES-256-GCM+HMAC file.
//   !backups          → list saved backups.
//   !restore confirm  → rebuild the LATEST backup onto the CURRENT server.
//                       (Invite the bot to a fresh server, run this, and your
//                        whole structure is recreated.)
// Owner-only. Backups are encrypted at rest with the bot's secure store.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ChannelType } from 'discord.js';
import { encryptSecret, decryptSecret } from '../systems/secureStore.js';

const DIR = join(process.cwd(), 'data', 'backups');
const FALLBACK_OWNER = '1183222250153984040';
const isOwner = (id) => { const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean); return ids.length ? ids.includes(id) : id === FALLBACK_OWNER; };
const CATEGORY = ChannelType.GuildCategory; // 4

function snapshot(guild) {
  const roles = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id).sort((a, b) => a.position - b.position)
    .map((r) => ({ name: r.name, color: r.color, hoist: r.hoist, permissions: r.permissions.bitfield.toString(), mentionable: r.mentionable }));
  const channels = [...guild.channels.cache.values()].sort((a, b) => (a.rawPosition ?? a.position) - (b.rawPosition ?? b.position))
    .map((c) => ({
      name: c.name, type: c.type, parentName: c.parent?.name || null,
      topic: c.topic || null, nsfw: !!c.nsfw, rateLimit: c.rateLimitPerUser || 0,
      bitrate: c.bitrate || null, userLimit: c.userLimit || null,
      overwrites: [...(c.permissionOverwrites?.cache?.values() || [])]
        .filter((o) => o.type === 0) // role overwrites only (member IDs don't transfer)
        .map((o) => ({ roleName: guild.roles.cache.get(o.id)?.name, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
        .filter((o) => o.roleName),
    }));
  return { version: 1, takenAt: new Date().toISOString(), sourceGuild: { id: guild.id, name: guild.name },
    settings: { name: guild.name, verificationLevel: guild.verificationLevel }, roles, channels };
}

function saveBackup(guild) {
  mkdirSync(DIR, { recursive: true });
  const data = snapshot(guild);
  const path = join(DIR, `backup-${guild.id}-${Date.now()}.enc`);
  writeFileSync(path, encryptSecret(JSON.stringify(data)));
  return { path, data };
}

function listBackups() {
  try {
    return readdirSync(DIR).filter((f) => f.endsWith('.enc'))
      .map((f) => ({ f, mtime: statSync(join(DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}

function loadLatest() {
  const list = listBackups();
  if (!list.length) return null;
  return JSON.parse(decryptSecret(readFileSync(join(DIR, list[0].f), 'utf8')));
}

function mapOverwrites(chan, guild, roleMap) {
  const out = [];
  for (const o of chan.overwrites || []) {
    const id = o.roleName === '@everyone' ? guild.id : roleMap.get(o.roleName);
    if (!id) continue;
    out.push({ id, allow: BigInt(o.allow), deny: BigInt(o.deny) });
  }
  return out;
}

async function restore(guild, backup, log) {
  // 1) roles (low→high so hierarchy comes out right)
  const roleMap = new Map();
  let rc = 0;
  for (const r of backup.roles) {
    const role = await guild.roles.create({ name: r.name, color: r.color, hoist: r.hoist, permissions: BigInt(r.permissions), mentionable: r.mentionable, reason: 'Server restore' }).catch(() => null);
    if (role) { roleMap.set(r.name, role.id); rc++; }
  }
  // 2) categories first
  const catMap = new Map();
  let cc = 0;
  for (const c of backup.channels.filter((c) => c.type === CATEGORY)) {
    const ch = await guild.channels.create({ name: c.name, type: CATEGORY, permissionOverwrites: mapOverwrites(c, guild, roleMap), reason: 'Server restore' }).catch(() => null);
    if (ch) { catMap.set(c.name, ch.id); cc++; }
  }
  // 3) the rest, parented to their category
  let chc = 0;
  for (const c of backup.channels.filter((c) => c.type !== CATEGORY)) {
    const opts = { name: c.name, type: c.type, reason: 'Server restore', permissionOverwrites: mapOverwrites(c, guild, roleMap) };
    if (c.parentName && catMap.has(c.parentName)) opts.parent = catMap.get(c.parentName);
    if (c.type === ChannelType.GuildText) { if (c.topic) opts.topic = c.topic; opts.nsfw = c.nsfw; if (c.rateLimit) opts.rateLimitPerUser = c.rateLimit; }
    if (c.type === ChannelType.GuildVoice) { if (c.bitrate) opts.bitrate = c.bitrate; if (c.userLimit) opts.userLimit = c.userLimit; }
    const ch = await guild.channels.create(opts).catch(() => null);
    if (ch) chc++;
  }
  return { roles: rc, categories: cc, channels: chc };
}

export async function handleBackupText(message) {
  const m = /^!(backup|restore|backups)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  if (!message.guild) { await message.reply('Run this in a server.').catch(() => {}); return true; }
  if (!isOwner(message.author.id)) { await message.reply('🔒 Owner only.').catch(() => {}); return true; }
  const cmd = m[1].toLowerCase();
  const arg = (m[2] || '').trim().toLowerCase();

  if (cmd === 'backups') {
    const list = listBackups();
    if (!list.length) return message.reply('No backups yet. Run `!backup`.').catch(() => {});
    const lines = list.slice(0, 10).map((b) => `• \`${b.f}\` — ${new Date(b.mtime).toLocaleString()}`).join('\n');
    return message.reply(`🗄️ **Backups (newest first):**\n${lines}`).catch(() => {});
  }

  if (cmd === 'backup') {
    const status = await message.reply('🗄️ Backing up the server (encrypted)…').catch(() => null);
    try {
      const { path, data } = saveBackup(message.guild);
      await status?.edit(`✅ **Backup saved & encrypted.**\n• ${data.roles.length} roles · ${data.channels.length} channels\n• 🔒 AES-256-GCM at \`${path.split(/[\\/]/).pop()}\`\n\nTo rebuild on another server: invite me there and run \`!restore confirm\`.`).catch(() => {});
    } catch (e) { await status?.edit('⚠️ Backup failed: ' + e.message).catch(() => {}); }
    return true;
  }

  if (cmd === 'restore') {
    const backup = loadLatest();
    if (!backup) return message.reply('No backup found to restore. Run `!backup` first (on the good server).').catch(() => {});
    if (arg !== 'confirm') {
      return message.reply(`⚠️ **This will CREATE ${backup.roles.length} roles and ${backup.channels.length} channels** on **this** server (from backup taken ${new Date(backup.takenAt).toLocaleString()}).\nIt adds to what's here (doesn't delete). Run **\`!restore confirm\`** to proceed.`).catch(() => {});
    }
    const status = await message.reply('🛠️ Restoring… creating roles & channels (this takes a bit)…').catch(() => null);
    try {
      const r = await restore(message.guild, backup, status);
      await status?.edit(`✅ **Restore complete.** Recreated **${r.roles} roles**, **${r.categories} categories**, **${r.channels} channels** from the backup.`).catch(() => {});
    } catch (e) { await status?.edit('⚠️ Restore failed: ' + e.message).catch(() => {}); }
    return true;
  }
  return false;
}
