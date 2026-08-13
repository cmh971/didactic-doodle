// Departments (a Ducky staff feature, rebuilt for Sentinel): organise members into
// units (PD / Fire / EMS / Dispatch …), each mapped to a Discord role with an
// auto-assigned callsign and a live roster. Configured on the website (/departments).
// Commands:
//   !dept list | info <name> | join <name> | leave <name> | roster <name>
//   !dept mine | add @user <name> | remove @user <name> | callsign @user <sign>
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg, setSetting } from '../setup/store.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS dept_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  dept_id  TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  callsign TEXT,
  joined_at INTEGER NOT NULL,
  UNIQUE(guild_id, dept_id, user_id)
)`);
const q = {
  join: db.prepare('INSERT OR IGNORE INTO dept_member(guild_id,dept_id,user_id,callsign,joined_at) VALUES(?,?,?,?,?)'),
  leave: db.prepare('DELETE FROM dept_member WHERE guild_id=? AND dept_id=? AND user_id=?'),
  wipeDept: db.prepare('DELETE FROM dept_member WHERE guild_id=? AND dept_id=?'),
  one: db.prepare('SELECT * FROM dept_member WHERE guild_id=? AND dept_id=? AND user_id=?'),
  roster: db.prepare('SELECT * FROM dept_member WHERE guild_id=? AND dept_id=? ORDER BY joined_at ASC'),
  mine: db.prepare('SELECT * FROM dept_member WHERE guild_id=? AND user_id=? ORDER BY joined_at ASC'),
  count: db.prepare('SELECT dept_id, COUNT(*) n FROM dept_member WHERE guild_id=? GROUP BY dept_id'),
  setSign: db.prepare('UPDATE dept_member SET callsign=? WHERE guild_id=? AND dept_id=? AND user_id=?'),
};

// A department role must never carry powers — otherwise "!dept join" would be a
// privilege-escalation hole (see the privilege-guard rule). These perms are banned.
const DANGEROUS = [
  PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ManageMessages,
];
function roleIsDangerous(role) {
  return !!role && DANGEROUS.some((p) => role.permissions.has(p));
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
const clampHex = (v, d) => { const n = parseInt(String(v).replace('#', ''), 16); return Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : d; };
const cleanEmoji = (e) => String(e || '').trim().slice(0, 32);

// ---- config (stored under settings.departments) --------------------------
export function getDeptCfg(guildId) {
  const d = getCfg(guildId)?.settings?.departments || {};
  return {
    enabled: !!d.enabled,
    logChannel: d.logChannel || '',
    list: Array.isArray(d.list) ? d.list : [],
  };
}
export function saveDeptCfg(guildId, cfg) {
  const seen = new Set();
  const list = (Array.isArray(cfg.list) ? cfg.list : []).map((dp) => {
    let id = slug(dp.id || dp.name);
    while (!id || seen.has(id)) id = (id || 'dept') + '-' + Math.random().toString(36).slice(2, 5);
    seen.add(id);
    return {
      id,
      name: String(dp.name || 'Department').slice(0, 60),
      emoji: cleanEmoji(dp.emoji) || '🏢',
      color: clampHex(dp.color, 0x5865f2),
      roleId: /^\d{15,25}$/.test(dp.roleId || '') ? dp.roleId : '',
      prefix: String(dp.prefix || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8),
      description: String(dp.description || '').slice(0, 300),
      open: dp.open !== false, // members may self-join unless explicitly locked
    };
  }).slice(0, 25);
  const clean = {
    enabled: !!cfg.enabled,
    logChannel: /^\d{15,25}$/.test(cfg.logChannel || '') ? cfg.logChannel : '',
    list,
  };
  setSetting(guildId, 'departments', clean);
  return clean;
}
// Rosters + counts for the dashboard.
export function deptData(guildId) {
  const counts = Object.fromEntries(q.count.all(guildId).map((r) => [r.dept_id, r.n]));
  return { counts };
}

function findDept(cfg, needle) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return null;
  return cfg.list.find((d) => d.id === n)
    || cfg.list.find((d) => d.name.toLowerCase() === n)
    || cfg.list.find((d) => d.prefix && d.prefix.toLowerCase() === n)
    || cfg.list.find((d) => d.name.toLowerCase().includes(n));
}

// Next free callsign for a department: prefix + lowest unused number.
function nextCallsign(guildId, dept) {
  if (!dept.prefix) return null;
  const used = new Set(q.roster.all(guildId, dept.id)
    .map((r) => Number(String(r.callsign || '').replace(dept.prefix + '-', '')))
    .filter((n) => Number.isFinite(n)));
  let n = 1; while (used.has(n)) n += 1;
  return `${dept.prefix}-${n}`;
}

async function log(message, cfg, text) {
  if (!cfg.logChannel) return;
  const ch = message.guild.channels.cache.get(cfg.logChannel);
  if (ch?.isTextBased?.()) ch.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(text).setTimestamp()], allowedMentions: { parse: [] } }).catch(() => {});
}

// Assign/remove the dept's Discord role, guarding against powered roles + hierarchy.
async function grantRole(message, dept, member) {
  if (!dept.roleId) return { ok: true };
  const role = message.guild.roles.cache.get(dept.roleId);
  if (!role) return { ok: false, why: 'the department role no longer exists' };
  if (roleIsDangerous(role)) return { ok: false, why: 'that department role carries staff permissions — a mod must fix it on the dashboard' };
  const me = message.guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
    return { ok: false, why: 'I can’t assign that role (it sits above my highest role)' };
  }
  await member.roles.add(role, `Joined ${dept.name}`).catch(() => {});
  return { ok: true };
}
async function revokeRole(message, dept, member) {
  if (!dept.roleId) return;
  const role = message.guild.roles.cache.get(dept.roleId);
  if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, `Left ${dept.name}`).catch(() => {});
}

const isStaff = (member) => !!member?.permissions?.has(PermissionFlagsBits.ManageGuild);

export async function handleDeptText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(dept|department)\b/i.test(raw)) return false;
  if (!message.guild) return false;
  const cfg = getDeptCfg(message.guild.id);
  if (!cfg.enabled) { await message.reply('🏢 Departments are off — set them up at **sentinelbothq.com/departments**.').catch(() => {}); return true; }

  const parts = raw.split(/\s+/);
  const sub = (parts[1] || 'list').toLowerCase();
  const rest = raw.replace(/^!(dept|department)\b/i, '').replace(new RegExp(`^\\s*${sub}\\s*`, 'i'), '').trim();

  // ----- list -----
  if (sub === 'list' || sub === 'all' || sub === 'depts') {
    if (!cfg.list.length) { await message.reply('📭 No departments yet. A mod can add them at **sentinelbothq.com/departments**.').catch(() => {}); return true; }
    const counts = Object.fromEntries(q.count.all(message.guild.id).map((r) => [r.dept_id, r.n]));
    const lines = cfg.list.map((d) => `${d.emoji} **${d.name}**${d.prefix ? ` \`${d.prefix}\`` : ''} — ${counts[d.id] || 0} member${(counts[d.id] || 0) === 1 ? '' : 's'}${d.open ? '' : ' 🔒'}`);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`🏢 Departments (${cfg.list.length})`).setDescription(lines.join('\n')).setFooter({ text: 'Join with  !dept join <name>' })] }).catch(() => {});
    return true;
  }

  // ----- mine -----
  if (sub === 'mine' || sub === 'me') {
    const rows = q.mine.all(message.guild.id, message.author.id);
    if (!rows.length) { await message.reply('📭 You’re not in any department. Try `!dept list`.').catch(() => {}); return true; }
    const lines = rows.map((r) => { const d = cfg.list.find((x) => x.id === r.dept_id); return d ? `${d.emoji} **${d.name}**${r.callsign ? ` — \`${r.callsign}\`` : ''}` : null; }).filter(Boolean);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x3fb950).setAuthor({ name: `${message.author.username}'s departments`, iconURL: message.author.displayAvatarURL() }).setDescription(lines.join('\n'))] }).catch(() => {});
    return true;
  }

  // Everything below needs a department name.
  const needsName = ['info', 'join', 'leave', 'roster', 'members', 'add', 'remove', 'callsign', 'sign'];
  if (!needsName.includes(sub)) {
    await message.reply('🏢 **Departments** — `!dept list` · `join <name>` · `leave <name>` · `roster <name>` · `mine` · `info <name>`').catch(() => {});
    return true;
  }

  // ----- staff: add / remove / callsign (name comes after the @mention) -----
  if (sub === 'add' || sub === 'remove' || sub === 'callsign' || sub === 'sign') {
    if (!isStaff(message.member)) { await message.reply('🔒 That needs the **Manage Server** permission.').catch(() => {}); return true; }
    const target = message.mentions.members?.first();
    if (!target) { await message.reply('🙋 Mention someone: `!dept add @user <department>`.').catch(() => {}); return true; }
    const afterMention = rest.replace(/<@!?\d+>/, '').trim();

    if (sub === 'callsign' || sub === 'sign') {
      const m = afterMention.match(/^(.+?)\s+(\S+)$/);
      if (!m) { await message.reply('📻 Usage: `!dept callsign @user <department> <callsign>`.').catch(() => {}); return true; }
      const dept = findDept(cfg, m[1]); if (!dept) { await message.reply(`❓ No department matching **${m[1]}**.`).catch(() => {}); return true; }
      if (!q.one.get(message.guild.id, dept.id, target.id)) { await message.reply(`❌ ${target} isn’t in **${dept.name}**.`).catch(() => {}); return true; }
      q.setSign.run(m[2].slice(0, 16), message.guild.id, dept.id, target.id);
      await message.reply(`📻 Set ${target}’s **${dept.name}** callsign to \`${m[2].slice(0, 16)}\`.`, { allowedMentions: { parse: [] } }).catch(() => {});
      return true;
    }

    const dept = findDept(cfg, afterMention);
    if (!dept) { await message.reply(`❓ No department matching **${afterMention || '(none given)'}**.`).catch(() => {}); return true; }
    if (sub === 'add') {
      const g = await grantRole(message, dept, target); if (!g.ok) { await message.reply(`⚠️ ${g.why}.`).catch(() => {}); return true; }
      const cs = nextCallsign(message.guild.id, dept);
      q.join.run(message.guild.id, dept.id, target.id, cs, Date.now());
      await message.reply(`✅ Added ${target} to ${dept.emoji} **${dept.name}**${cs ? ` — callsign \`${cs}\`` : ''}.`, { allowedMentions: { parse: [] } }).catch(() => {});
      log(message, cfg, `➕ <@${target.id}> added to **${dept.name}** by <@${message.author.id}>${cs ? ` (\`${cs}\`)` : ''}.`);
    } else {
      q.leave.run(message.guild.id, dept.id, target.id);
      await revokeRole(message, dept, target);
      await message.reply(`✅ Removed ${target} from ${dept.emoji} **${dept.name}**.`, { allowedMentions: { parse: [] } }).catch(() => {});
      log(message, cfg, `➖ <@${target.id}> removed from **${dept.name}** by <@${message.author.id}>.`);
    }
    return true;
  }

  // ----- name-only subcommands (info / join / leave / roster) -----
  const dept = findDept(cfg, rest);
  if (!dept) { await message.reply(`❓ No department matching **${rest || '(none given)'}**. Try \`!dept list\`.`).catch(() => {}); return true; }

  if (sub === 'info') {
    const n = q.roster.all(message.guild.id, dept.id).length;
    const e = new EmbedBuilder().setColor(dept.color).setTitle(`${dept.emoji} ${dept.name}`)
      .setDescription(dept.description || '_No description set._')
      .addFields(
        { name: 'Members', value: String(n), inline: true },
        { name: 'Callsign', value: dept.prefix ? `\`${dept.prefix}-#\`` : '—', inline: true },
        { name: 'Join', value: dept.open ? '`!dept join`' : '🔒 staff only', inline: true },
      );
    if (dept.roleId) e.addFields({ name: 'Role', value: `<@&${dept.roleId}>`, inline: true });
    await message.reply({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  if (sub === 'roster' || sub === 'members') {
    const rows = q.roster.all(message.guild.id, dept.id);
    if (!rows.length) { await message.reply(`📭 **${dept.name}** has no members yet.`).catch(() => {}); return true; }
    const lines = rows.map((r) => `• <@${r.user_id}>${r.callsign ? ` — \`${r.callsign}\`` : ''}`);
    await message.reply({ embeds: [new EmbedBuilder().setColor(dept.color).setTitle(`${dept.emoji} ${dept.name} — Roster (${rows.length})`).setDescription(lines.join('\n').slice(0, 4096))], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }

  if (sub === 'join') {
    if (!dept.open && !isStaff(message.member)) { await message.reply(`🔒 **${dept.name}** is staff-assign only. Ask a mod to add you.`).catch(() => {}); return true; }
    if (q.one.get(message.guild.id, dept.id, message.author.id)) { await message.reply(`✅ You’re already in **${dept.name}**.`).catch(() => {}); return true; }
    const g = await grantRole(message, dept, message.member); if (!g.ok) { await message.reply(`⚠️ Couldn’t join — ${g.why}.`).catch(() => {}); return true; }
    const cs = nextCallsign(message.guild.id, dept);
    q.join.run(message.guild.id, dept.id, message.author.id, cs, Date.now());
    await message.reply(`✅ Welcome to ${dept.emoji} **${dept.name}**!${cs ? ` Your callsign is \`${cs}\`.` : ''}`).catch(() => {});
    log(message, cfg, `➕ <@${message.author.id}> joined **${dept.name}**${cs ? ` (\`${cs}\`)` : ''}.`);
    return true;
  }

  if (sub === 'leave') {
    if (!q.one.get(message.guild.id, dept.id, message.author.id)) { await message.reply(`🤔 You’re not in **${dept.name}**.`).catch(() => {}); return true; }
    q.leave.run(message.guild.id, dept.id, message.author.id);
    await revokeRole(message, dept, message.member);
    await message.reply(`👋 You’ve left **${dept.name}**.`).catch(() => {});
    log(message, cfg, `➖ <@${message.author.id}> left **${dept.name}**.`);
    return true;
  }

  return true;
}
