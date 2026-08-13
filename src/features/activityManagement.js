// Activity Management — staff LOAs (Leave of Absence) + modcall tracking.
//   .loa request <duration> <reason>   → posts an approve/deny card to the LOA log channel
//   .loa list                          → active LOAs
//   .loa end                           → end your own LOA early
//   .modstats view [@user]             → in-game modcall counts (needs Track Modcalls on)
// Config lives in settings.activity (set via /setup ▸ Activity Management).
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg, setNested } from '../setup/store.js';
import { erlc } from './erlc.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS loas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
  reason TEXT, start_at INTEGER, end_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | active | denied | ended
  approved_by TEXT, orig_nick TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS modcall_stats (
  guild_id TEXT NOT NULL, staff TEXT NOT NULL, calls INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, staff)
)`);
const q = {
  add: db.prepare('INSERT INTO loas(guild_id,user_id,reason,start_at,end_at,status) VALUES (?,?,?,?,?,?)'),
  get: db.prepare('SELECT * FROM loas WHERE id=?'),
  activeForUser: db.prepare("SELECT * FROM loas WHERE guild_id=? AND user_id=? AND status IN ('pending','active') ORDER BY id DESC LIMIT 1"),
  activeList: db.prepare("SELECT * FROM loas WHERE guild_id=? AND status='active' ORDER BY end_at"),
  expired: db.prepare("SELECT * FROM loas WHERE status='active' AND end_at<=?"),
  setStatus: db.prepare('UPDATE loas SET status=?, approved_by=? WHERE id=?'),
  setActive: db.prepare('UPDATE loas SET status=?, approved_by=?, orig_nick=? WHERE id=?'),
  end: db.prepare("UPDATE loas SET status='ended' WHERE id=?"),
  bumpCall: db.prepare('INSERT INTO modcall_stats(guild_id,staff,calls) VALUES (?,?,1) ON CONFLICT(guild_id,staff) DO UPDATE SET calls=calls+1'),
  statsTop: db.prepare('SELECT staff, calls FROM modcall_stats WHERE guild_id=? ORDER BY calls DESC LIMIT 15'),
};

const cfgOf = (gid) => getCfg(gid).settings.activity || {};
export function setActivityCfg(gid, key, val) { setNested(gid, 'activity', key, val); }

// ---- duration parsing: 3d, 1w, 48h, 90m ----
function parseDuration(str) {
  const m = /^(\d+)\s*(m|h|d|w)$/i.exec(String(str || '').trim());
  if (!m) return null;
  const n = Number(m[1]); const unit = m[2].toLowerCase();
  const ms = { m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit];
  return n * ms;
}
const fmtDur = (ms) => {
  const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000);
  return [d ? `${d}d` : '', h ? `${h}h` : ''].filter(Boolean).join(' ') || '<1h';
};
const applyNick = (tpl, member) => (tpl || '').replaceAll('{member.name}', member.displayName).replaceAll('{member.username}', member.user.username).slice(0, 32);

// ---- LOA lifecycle ----
async function activateLoa(guild, row, approverId) {
  const member = await guild.members.fetch(row.user_id).catch(() => null);
  const cfg = cfgOf(guild.id);
  const origNick = member?.nickname || null;
  q.setActive.run('active', approverId, origNick, row.id);
  if (member) {
    if (cfg.loaRole) await member.roles.add(cfg.loaRole, 'LOA started').catch(() => {});
    if (cfg.loaNickname) await member.setNickname(applyNick(cfg.loaNickname, member), 'LOA nickname').catch(() => {});
    await member.send(`✅ Your LOA was **approved** — active until <t:${Math.floor(row.end_at / 1000)}:F>.`).catch(() => {});
  }
}
async function deactivateLoa(guild, row, reason = 'LOA ended') {
  const member = await guild.members.fetch(row.user_id).catch(() => null);
  const cfg = cfgOf(guild.id);
  q.end.run(row.id);
  if (member) {
    if (cfg.loaRole) await member.roles.remove(cfg.loaRole, reason).catch(() => {});
    if (cfg.loaNickname) await member.setNickname(row.orig_nick || null, reason).catch(() => {});
    await member.send(`🔔 Your LOA has ended — welcome back!`).catch(() => {});
  }
}

// ---- text command: .loa / .modstats ----
export async function handleActivityText(message) {
  const m = /^\.(loa|modstats)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  const cfg = cfgOf(message.guild.id);
  const args = (m[2] || '').trim().split(/\s+/);
  const sub = (args.shift() || '').toLowerCase();

  if (m[1].toLowerCase() === 'modstats') {
    if (sub === 'view') {
      const rows = q.statsTop.all(message.guild.id);
      if (!rows.length) return message.reply('📊 No modcall stats yet.' + (cfg.trackModcalls ? '' : ' (Track Modcalls is **off** — enable it in `/setup`.)')).catch(() => {});
      const e = new EmbedBuilder().setColor(0x5865f2).setTitle('📊 Modcall stats').setDescription(rows.map((r, i) => `**${i + 1}.** ${r.staff} — ${r.calls}`).join('\n'));
      return message.reply({ embeds: [e] }).catch(() => {});
    }
    return message.reply('Usage: `.modstats view`').catch(() => {});
  }

  // ---- admin config (safe path until the /setup page lands) ----
  const isAdmin = message.member?.permissions?.has('ManageGuild');
  if (['setup', 'config', 'enable', 'disable', 'channel', 'role', 'nick', 'maxdays', 'modcalls'].includes(sub)) {
    if (!isAdmin) return message.reply('🔒 Needs **Manage Server**.').catch(() => {});
    const gid = message.guild.id;
    if (sub === 'enable') { setActivityCfg(gid, 'enabled', true); return message.reply('✅ LOAs **enabled**.').catch(() => {}); }
    if (sub === 'disable') { setActivityCfg(gid, 'enabled', false); return message.reply('✅ LOAs **disabled**.').catch(() => {}); }
    if (sub === 'channel') { const ch = message.mentions.channels.first() || message.channel; setActivityCfg(gid, 'logChannel', ch.id); return message.reply(`✅ LOA log channel → <#${ch.id}>`).catch(() => {}); }
    if (sub === 'role') { const r = message.mentions.roles.first(); if (!r) return message.reply('Mention a role: `.loa role @LOA`').catch(() => {}); setActivityCfg(gid, 'loaRole', r.id); return message.reply(`✅ LOA role → <@&${r.id}>`).catch(() => {}); }
    if (sub === 'nick') { const t = args.join(' '); setActivityCfg(gid, 'loaNickname', t || null); return message.reply(`✅ LOA nickname → \`${t || '(none)'}\` (vars: {member.name} {member.username})`).catch(() => {}); }
    if (sub === 'maxdays') { const n = parseInt(args[0], 10); if (!n) return message.reply('`.loa maxdays 30`').catch(() => {}); setActivityCfg(gid, 'maxDays', n); return message.reply(`✅ Max LOA length → **${n} days**`).catch(() => {}); }
    if (sub === 'modcalls') { const on = /^(on|true|yes)$/i.test(args[0] || ''); setActivityCfg(gid, 'trackModcalls', on); return message.reply(`✅ Track Modcalls → **${on ? 'ON' : 'OFF'}**`).catch(() => {}); }
    // setup/config → show current
    const c = cfgOf(gid);
    return message.reply(`⚙️ **Activity Management config**\n• Enabled: ${c.enabled ? '🟢' : '🔴'}\n• Log channel: ${c.logChannel ? `<#${c.logChannel}>` : '—'}\n• LOA role: ${c.loaRole ? `<@&${c.loaRole}>` : '—'}\n• LOA nickname: \`${c.loaNickname || '—'}\`\n• Max length: **${c.maxDays || 30}d**\n• Track modcalls: ${c.trackModcalls ? '🟢' : '🔴'}\n\nSet with: \`.loa enable\` · \`.loa channel #ch\` · \`.loa role @role\` · \`.loa nick <tpl>\` · \`.loa maxdays 30\` · \`.loa modcalls on\``).catch(() => {});
  }

  // ---- LOAs ----
  if (!cfg.enabled) return message.reply('❌ Activity Management (LOAs) is disabled. An admin can run `.loa enable`.').catch(() => {});

  if (sub === 'list') {
    const rows = q.activeList.all(message.guild.id);
    if (!rows.length) return message.reply('📋 No active LOAs.').catch(() => {});
    const e = new EmbedBuilder().setColor(0xf59e0b).setTitle('📋 Active LOAs')
      .setDescription(rows.map((r) => `• <@${r.user_id}> — until <t:${Math.floor(r.end_at / 1000)}:R> — ${r.reason || '_no reason_'}`).join('\n').slice(0, 4000));
    return message.reply({ embeds: [e] }).catch(() => {});
  }

  if (sub === 'end' || sub === 'cancel') {
    const row = q.activeForUser.get(message.guild.id, message.author.id);
    if (!row) return message.reply('You have no active or pending LOA.').catch(() => {});
    await deactivateLoa(message.guild, row, 'Ended by user');
    return message.reply('✅ Your LOA has been ended.').catch(() => {});
  }

  if (sub === 'request') {
    if (q.activeForUser.get(message.guild.id, message.author.id)) return message.reply('⚠️ You already have a pending/active LOA. Use `.loa end` first.').catch(() => {});
    const dur = parseDuration(args[0]);
    if (!dur) return message.reply('Usage: `.loa request <duration> <reason>` — e.g. `.loa request 3d family stuff` (units: m/h/d/w).').catch(() => {});
    const maxMs = (cfg.maxDays || 30) * 86400000;
    if (dur > maxMs) return message.reply(`⚠️ That exceeds the max LOA length of **${cfg.maxDays || 30} days**.`).catch(() => {});
    const reason = args.slice(1).join(' ') || 'No reason given';
    const start = Date.now(); const end = start + dur;
    const info = q.add.run(message.guild.id, message.author.id, reason.slice(0, 500), start, end, 'pending');
    const id = info.lastInsertRowid;

    const logCh = cfg.logChannel && message.guild.channels.cache.get(cfg.logChannel);
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('📝 LOA Request')
      .setDescription(`**Staff:** <@${message.author.id}>\n**Duration:** ${fmtDur(dur)} (ends <t:${Math.floor(end / 1000)}:F>)\n**Reason:** ${reason}`)
      .setFooter({ text: `LOA #${id} • anyone with access here can approve/deny` });
    const rowBtns = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`loa:approve:${id}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`loa:deny:${id}`).setLabel('Deny').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    );
    if (logCh?.isTextBased?.()) await logCh.send({ embeds: [embed], components: [rowBtns] }).catch(() => {});
    else return message.reply('⚠️ No LOA Logs Channel is set. Ask an admin to set one in `/setup`.').catch(() => {});
    return message.reply(`✅ LOA request #${id} submitted for approval.`).catch(() => {});
  }

  return message.reply('LOA commands: `.loa request <dur> <reason>` · `.loa list` · `.loa end`').catch(() => {});
}

// ---- approve/deny buttons (routed from index.js: customId `loa:...`) ----
export async function handleLoaButton(interaction) {
  if (!interaction.customId?.startsWith('loa:')) return false;
  const [, action, idStr] = interaction.customId.split(':');
  const row = q.get.get(Number(idStr));
  if (!row || row.status !== 'pending') { await interaction.reply({ content: '⚠️ This request was already handled or expired.', flags: 64 }).catch(() => {}); return true; }
  if (action === 'approve') {
    await activateLoa(interaction.guild, row, interaction.user.id);
    await interaction.update({ components: [], embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x22c55e).setTitle('✅ LOA Approved').setFooter({ text: `Approved by ${interaction.user.tag}` })] }).catch(() => {});
  } else if (action === 'deny') {
    q.setStatus.run('denied', interaction.user.id, row.id);
    const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
    await member?.send('⛔ Your LOA request was **denied**.').catch(() => {});
    await interaction.update({ components: [], embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xef4444).setTitle('⛔ LOA Denied').setFooter({ text: `Denied by ${interaction.user.tag}` })] }).catch(() => {});
  }
  return true;
}

// ---- background: expire LOAs + track modcalls ----
let started = false;
export function startActivityEngine(client) {
  if (started) return; started = true;
  // expire active LOAs
  setInterval(async () => {
    for (const row of q.expired.all(Date.now())) {
      const guild = client.guilds.cache.get(row.guild_id);
      if (guild) await deactivateLoa(guild, row, 'LOA expired').catch(() => {});
    }
  }, 60000);
  // track in-game modcalls (dedupe by seen id)
  const seen = new Set();
  setInterval(async () => {
    for (const gid of client.guilds.cache.keys()) {
      if (!cfgOf(gid).trackModcalls) continue;
      const res = await erlc(gid, '/server/modcalls').catch(() => null);
      if (!res?.ok || !Array.isArray(res.data)) continue;
      for (const call of res.data) {
        const key = `${gid}:${call.Timestamp}:${call.Caller}`;
        if (seen.has(key)) continue; seen.add(key);
        if (call.Operator) q.bumpCall.run(gid, String(call.Operator).split(':')[0], );
      }
      if (seen.size > 5000) seen.clear();
    }
  }, 30000);
  console.log('📋 Activity Management engine started (LOA expiry + modcall tracking).');
}
