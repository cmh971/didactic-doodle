#!/usr/bin/env node
// ============================================================================
// Sentinel Dev CLI — my lead-dev Swiss-army knife. One entry point, 30+ tools
// for inspecting and operating the bot, its servers, members, roles, bans,
// config and processes. REST-only against Discord (no gateway session, so it
// never disturbs the running bot). Ops commands (ban/kick/roles/say) act for
// real — read commands are always safe.
//
//   node tools/sentinel.mjs <tool> [args...]
//   node tools/sentinel.mjs help            → list every tool
//   node tools/sentinel.mjs help <tool>     → usage for one tool
// ============================================================================
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { REST } from '@discordjs/rest';
import { Routes, PermissionFlagsBits } from 'discord-api-types/v10';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('❌ DISCORD_TOKEN missing in .env'); process.exit(1); }
const rest = new REST({ version: '10' }).setToken(TOKEN);

// ---- tiny helpers ---------------------------------------------------------
const g = (id) => id;                                   // guild id passthrough (clarity)
const j = (o) => JSON.stringify(o, null, 2);
const ts = (sf) => `<${sf}>`;                            // placeholder
const die = (m) => { console.error('❌ ' + m); process.exit(1); };
const need = (v, what) => { if (!v) die(`missing ${what}`); return v; };
const qs = (o) => new URLSearchParams(o).toString();
const table = (rows) => rows.map((r) => r.join('  ')).join('\n');
const fmtUser = (u) => `${u.username}${u.discriminator && u.discriminator !== '0' ? '#' + u.discriminator : ''} (${u.id})${u.bot ? ' [bot]' : ''}`;
const perms = (bitfield) => Object.entries(PermissionFlagsBits).filter(([, bit]) => (BigInt(bitfield) & bit) === bit).map(([n]) => n);

// Resolve a member's total permission bitfield from their roles (owner = all).
async function memberPerms(guildId, userId) {
  const [guild, roles, member] = await Promise.all([
    rest.get(Routes.guild(guildId)),
    rest.get(Routes.guildRoles(guildId)),
    rest.get(Routes.guildMember(guildId, userId)),
  ]);
  if (guild.owner_id === userId) return { owner: true, bitfield: ~0n, member };
  const byId = new Map(roles.map((r) => [r.id, r]));
  let bits = BigInt(byId.get(guildId)?.permissions || 0); // @everyone
  for (const rid of member.roles) bits |= BigInt(byId.get(rid)?.permissions || 0);
  if ((bits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) return { admin: true, bitfield: ~0n, member };
  return { bitfield: bits, member };
}

// ---- TOOL REGISTRY --------------------------------------------------------
const TOOLS = {
  // ===================== DISCORD · READ =====================
  guilds: { grp: 'read', desc: 'List every server the bot is in', async run() {
    const gs = await rest.get(Routes.userGuilds() + '?with_counts=true&limit=200');
    console.log(`Bot is in ${gs.length} servers:`);
    for (const x of gs.sort((a, b) => (b.approximate_member_count || 0) - (a.approximate_member_count || 0)))
      console.log(`  ${String(x.approximate_member_count ?? '?').padStart(6)}  ${x.name}  (${x.id})`);
  } },
  guild: { grp: 'read', usage: '<guildId>', desc: 'Server overview (owner, counts, features)', async run(a) {
    const guild = await rest.get(Routes.guild(need(a[0], 'guildId')) + '?with_counts=true');
    console.log(`🏠 ${guild.name}  (${guild.id})`);
    console.log(`   owner: ${guild.owner_id}`);
    console.log(`   members ~${guild.approximate_member_count}  ·  online ~${guild.approximate_presence_count}`);
    console.log(`   boosts: ${guild.premium_subscription_count || 0} (tier ${guild.premium_tier})`);
    console.log(`   features: ${(guild.features || []).join(', ') || '—'}`);
  } },
  members: { grp: 'read', usage: '<guildId> [limit]', desc: 'List members (needs GUILD_MEMBERS intent)', async run(a) {
    const m = await rest.get(Routes.guildMembers(need(a[0], 'guildId')) + '?' + qs({ limit: a[1] || 1000 }));
    console.log(`${m.length} members:`);
    for (const x of m) console.log(`  ${fmtUser(x.user)}${x.nick ? ` "${x.nick}"` : ''}`);
  } },
  member: { grp: 'read', usage: '<guildId> <userId>', desc: 'Member detail: roles, joined, boosting', async run(a) {
    const m = await rest.get(Routes.guildMember(need(a[0], 'guildId'), need(a[1], 'userId')));
    console.log(fmtUser(m.user));
    console.log(`  nick: ${m.nick || '—'}`);
    console.log(`  joined: ${m.joined_at}`);
    console.log(`  roles: ${m.roles.join(', ') || '—'}`);
    if (m.premium_since) console.log(`  boosting since: ${m.premium_since}`);
    if (m.communication_disabled_until) console.log(`  ⏳ timed out until: ${m.communication_disabled_until}`);
  } },
  whois: { grp: 'read', usage: '<userId>', desc: 'Global user info (username, avatar, created)', async run(a) {
    const u = await rest.get(Routes.user(need(a[0], 'userId')));
    console.log(fmtUser(u));
    const created = new Date(Number((BigInt(u.id) >> 22n) + 1420070400000n));
    console.log(`  created: ${created.toISOString()}`);
    if (u.avatar) console.log(`  avatar: https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=512`);
    if (u.banner) console.log(`  banner: https://cdn.discordapp.com/banners/${u.id}/${u.banner}.png?size=1024`);
  } },
  roles: { grp: 'read', usage: '<guildId>', desc: 'List roles high→low with positions', async run(a) {
    const r = await rest.get(Routes.guildRoles(need(a[0], 'guildId')));
    for (const x of r.sort((p, q) => q.position - p.position))
      console.log(`  pos ${String(x.position).padStart(3)} ${x.managed ? '[managed] ' : '          '}${x.name} (${x.id})`);
  } },
  channels: { grp: 'read', usage: '<guildId>', desc: 'List channels by type', async run(a) {
    const c = await rest.get(Routes.guildChannels(need(a[0], 'guildId')));
    const T = { 0: '#', 2: '🔊', 4: '📁', 5: '📣', 13: '🎤', 15: '🧵' };
    for (const x of c.sort((p, q) => (p.position || 0) - (q.position || 0)))
      console.log(`  ${T[x.type] || '?'} ${x.name} (${x.id})`);
  } },
  emojis: { grp: 'read', usage: '<guildId>', desc: 'List custom emojis', async run(a) {
    const e = await rest.get(Routes.guildEmojis(need(a[0], 'guildId')));
    console.log(`${e.length} emojis:`);
    for (const x of e) console.log(`  ${x.animated ? '<a:' : '<:'}${x.name}:${x.id}>  :${x.name}:`);
  } },
  bans: { grp: 'read', usage: '<guildId>', desc: 'List banned users + reasons', async run(a) {
    const b = await rest.get(Routes.guildBans(need(a[0], 'guildId')) + '?limit=1000');
    console.log(`${b.length} bans:`);
    for (const x of b) console.log(`  ${fmtUser(x.user)} — ${x.reason || 'no reason'}`);
  } },
  invites: { grp: 'read', usage: '<guildId>', desc: 'List active invites w/ uses', async run(a) {
    const inv = await rest.get(Routes.guildInvites(need(a[0], 'guildId')));
    for (const x of inv) console.log(`  discord.gg/${x.code} · uses ${x.uses}/${x.max_uses || '∞'} · by ${x.inviter?.username || '?'} · #${x.channel?.name}`);
  } },
  webhooks: { grp: 'read', usage: '<guildId>', desc: 'List guild webhooks', async run(a) {
    const w = await rest.get(Routes.guildWebhooks(need(a[0], 'guildId')));
    for (const x of w) console.log(`  ${x.name} (${x.id}) · channel ${x.channel_id} · by ${x.user?.username || '?'}`);
  } },
  perms: { grp: 'read', usage: '<guildId> <userId>', desc: "Compute a member's effective permissions", async run(a) {
    const p = await memberPerms(need(a[0], 'guildId'), need(a[1], 'userId'));
    if (p.owner) return console.log('👑 Server OWNER — all permissions.');
    if (p.admin) return console.log('🛡️ Has ADMINISTRATOR — all permissions.');
    console.log('Permissions:', perms(p.bitfield).join(', ') || '(none)');
  } },
  cangate: { grp: 'read', usage: '<guildId> <userId> <perm>', desc: 'Check ONE permission (e.g. BanMembers)', async run(a) {
    const p = await memberPerms(need(a[0], 'guildId'), need(a[1], 'userId'));
    const flag = PermissionFlagsBits[need(a[2], 'perm')]; if (!flag) return die(`unknown perm "${a[2]}"`);
    const has = p.owner || p.admin || (p.bitfield & flag) === flag;
    console.log(`${has ? '✅ HAS' : '❌ lacks'} ${a[2]}`);
  } },
  audit: { grp: 'read', usage: '<guildId> [limit]', desc: 'Recent audit-log entries', async run(a) {
    const al = await rest.get(Routes.guildAuditLog(need(a[0], 'guildId')) + '?' + qs({ limit: a[1] || 15 }));
    const A = { 20: 'kick', 22: 'ban', 23: 'unban', 25: 'member_role_update', 1: 'guild_update', 10: 'channel_create', 12: 'channel_delete', 72: 'msg_delete' };
    const users = new Map((al.users || []).map((u) => [u.id, u.username]));
    for (const e of al.audit_log_entries) console.log(`  ${A[e.action_type] || 'action#' + e.action_type} · by ${users.get(e.user_id) || e.user_id} · target ${e.target_id || '—'}${e.reason ? ` · "${e.reason}"` : ''}`);
  } },
  search: { grp: 'read', usage: '<guildId> <query>', desc: 'Search members by name/nick prefix', async run(a) {
    const r = await rest.get(Routes.guildMembersSearch(need(a[0], 'guildId')) + '?' + qs({ query: need(a[1], 'query'), limit: 25 }));
    console.log(`${r.length} matches:`);
    for (const x of r) console.log(`  ${fmtUser(x.user)}${x.nick ? ` "${x.nick}"` : ''}`);
  } },
  invitecheck: { grp: 'read', usage: '<code>', desc: 'Resolve an invite code → server + counts', async run(a) {
    const inv = await rest.get(Routes.invite(need(a[0], 'code')) + '?with_counts=true');
    console.log(`discord.gg/${inv.code} → ${inv.guild?.name} (${inv.guild?.id}) · ~${inv.approximate_member_count} members · #${inv.channel?.name}`);
  } },
  botinfo: { grp: 'read', desc: "The bot's own application + user info", async run() {
    const [me, app] = await Promise.all([rest.get(Routes.user('@me')), rest.get(Routes.currentApplication())]);
    console.log(`🤖 ${fmtUser(me)}`);
    console.log(`   app: ${app.name} (${app.id})`);
    console.log(`   flags: ${app.flags}  ·  public: ${app.bot_public}`);
    if (app.approximate_guild_count) console.log(`   guilds: ${app.approximate_guild_count}`);
  } },
  ping: { grp: 'read', desc: 'Measure REST round-trip latency', async run() {
    const t = Date.now(); await rest.get(Routes.user('@me')); console.log(`🏓 REST latency: ${Date.now() - t}ms`);
  } },

  // ===================== DISCORD · OPS (write) =====================
  unban: { grp: 'ops', usage: '<guildId> <userId> [reason]', desc: 'Lift a ban', async run(a) {
    await rest.delete(Routes.guildBan(need(a[0], 'guildId'), need(a[1], 'userId')), { reason: a.slice(2).join(' ') || 'via CLI' });
    console.log('✅ unbanned', a[1]);
  } },
  kick: { grp: 'ops', usage: '<guildId> <userId> [reason]', desc: 'Kick a member', async run(a) {
    await rest.delete(Routes.guildMember(need(a[0], 'guildId'), need(a[1], 'userId')), { reason: a.slice(2).join(' ') || 'via CLI' });
    console.log('👢 kicked', a[1]);
  } },
  ban: { grp: 'ops', usage: '<guildId> <userId> [reason]', desc: 'Ban a user', async run(a) {
    await rest.put(Routes.guildBan(need(a[0], 'guildId'), need(a[1], 'userId')), { reason: a.slice(2).join(' ') || 'via CLI' });
    console.log('🔨 banned', a[1]);
  } },
  invite: { grp: 'ops', usage: '<guildId> [channelId] [maxUses]', desc: 'Create an invite (defaults: first text ch, 1 use)', async run(a) {
    let ch = a[1];
    if (!ch) { const chans = await rest.get(Routes.guildChannels(need(a[0], 'guildId'))); ch = chans.find((c) => c.type === 0)?.id; }
    if (!ch) return die('no channel to invite to');
    const inv = await rest.post(Routes.channelInvites(ch), { body: { max_age: 0, max_uses: Number(a[2]) || 1, unique: true }, reason: 'via CLI' });
    console.log('🔗 https://discord.gg/' + inv.code);
  } },
  roleadd: { grp: 'ops', usage: '<guildId> <userId> <roleId>', desc: 'Add a role to a member', async run(a) {
    await rest.put(Routes.guildMemberRole(need(a[0], 'guildId'), need(a[1], 'userId'), need(a[2], 'roleId')), { reason: 'via CLI' });
    console.log('✅ role added');
  } },
  roledel: { grp: 'ops', usage: '<guildId> <userId> <roleId>', desc: 'Remove a role from a member', async run(a) {
    await rest.delete(Routes.guildMemberRole(need(a[0], 'guildId'), need(a[1], 'userId'), need(a[2], 'roleId')), { reason: 'via CLI' });
    console.log('✅ role removed');
  } },
  nick: { grp: 'ops', usage: '<guildId> <userId> <nick...>', desc: "Set a member's nickname", async run(a) {
    await rest.patch(Routes.guildMember(need(a[0], 'guildId'), need(a[1], 'userId')), { body: { nick: a.slice(2).join(' ') }, reason: 'via CLI' });
    console.log('✅ nick set');
  } },
  timeout: { grp: 'ops', usage: '<guildId> <userId> <minutes>', desc: 'Timeout a member (0 to clear)', async run(a) {
    const min = Number(need(a[2], 'minutes'));
    const until = min > 0 ? new Date(Date.now() + min * 60000).toISOString() : null;
    await rest.patch(Routes.guildMember(need(a[0], 'guildId'), need(a[1], 'userId')), { body: { communication_disabled_until: until }, reason: 'via CLI' });
    console.log(min > 0 ? `⏳ timed out ${min}m` : '✅ timeout cleared');
  } },
  say: { grp: 'ops', usage: '<channelId> <message...>', desc: 'Send a message to a channel', async run(a) {
    const m = await rest.post(Routes.channelMessages(need(a[0], 'channelId')), { body: { content: a.slice(1).join(' ') } });
    console.log('✅ sent', m.id);
  } },
  dm: { grp: 'ops', usage: '<userId> <message...>', desc: 'DM a user (needs mutual server)', async run(a) {
    const dm = await rest.post(Routes.userChannels(), { body: { recipient_id: need(a[0], 'userId') } });
    const m = await rest.post(Routes.channelMessages(dm.id), { body: { content: a.slice(1).join(' ') } });
    console.log('✅ DM sent', m.id);
  } },

  // ===================== LOCAL · OPS/DIAG =====================
  status: { grp: 'local', desc: 'PM2 process status (sentinel + tunnel)', run() {
    try { console.log(execSync('pm2 jlist', { encoding: 'utf8' }) && JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' })).map((p) => `  ${p.name}: ${p.pm2_env.status} · restarts ${p.pm2_env.restart_time} · ${Math.round(p.monit.memory / 1048576)}mb`).join('\n')); }
    catch (e) { die('pm2 not available: ' + e.message); }
  } },
  logs: { grp: 'local', usage: '[app] [lines]', desc: 'Tail PM2 logs (default sentinel 40)', run(a) {
    try { console.log(execSync(`pm2 logs ${a[0] || 'sentinel'} --lines ${a[1] || 40} --nostream`, { encoding: 'utf8' })); }
    catch (e) { die('pm2 logs failed: ' + e.message); }
  } },
  health: { grp: 'local', usage: '[url]', desc: 'HTTP health check (default localhost:3000)', async run(a) {
    const url = a[0] || 'http://127.0.0.1:3000/';
    const t = Date.now();
    try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); console.log(`${url} → HTTP ${r.status} (${Date.now() - t}ms)`); }
    catch (e) { die(`unreachable: ${e.message}`); }
  } },
  domain: { grp: 'local', desc: 'Check the public domain + detect Cloudflare challenge', async run() {
    try {
      const r = await fetch('https://sentinelbothq.com/', { redirect: 'manual', signal: AbortSignal.timeout(12000) });
      console.log(`sentinelbothq.com → HTTP ${r.status}`);
      if (r.headers.get('cf-mitigated')) console.log(`  ⚠️ Cloudflare mitigation: ${r.headers.get('cf-mitigated')} (Ray ${r.headers.get('cf-ray')}) — Bot Fight Mode likely ON`);
    } catch (e) { die('domain unreachable: ' + e.message); }
  } },
  env: { grp: 'local', desc: 'List env var NAMES present (no values)', run() {
    const keys = Object.keys(process.env).filter((k) => /TOKEN|SECRET|KEY|URI|URL|ID|MONGO|REDIS|NASA|OAUTH|CLIENT/.test(k)).sort();
    console.log('Config-ish env vars set:'); for (const k of keys) console.log('  ' + k + ' = ' + (process.env[k] ? '✓ set (' + process.env[k].length + ' chars)' : '(empty)'));
  } },
  config: { grp: 'local', usage: '<guildId>', desc: "Dump a guild's saved setup config (best-effort)", async run(a) {
    need(a[0], 'guildId');
    try { const { getCfg } = await import('../src/setup/store.js'); console.log(j(getCfg(a[0]))); }
    catch (e) { die('could not load config store: ' + e.message); }
    process.exit(0);
  } },
  inbox: { grp: 'local', desc: 'Show images/files Chris sent me via !claude', async run() {
    const { promises: fs } = await import('node:fs');
    const dir = new URL('../data/claude-inbox/', import.meta.url);
    const latest = await fs.readFile(new URL('_latest.json', dir), 'utf8').then(JSON.parse).catch(() => null);
    if (!latest?.files?.length) return console.log('📭 Claude inbox is empty.');
    console.log(`📥 ${latest.files.length} file(s) · ${latest.at}${latest.note ? `\n📝 ${latest.note}` : ''}`);
    for (const f of latest.files) console.log(`  ${f.isImage ? '🖼️' : '📄'} ${f.path}`);
  } },
  modaudit: { grp: 'local', desc: 'Scan mod commands for a target-protection guard', async run() {
    const { promises: fs } = await import('node:fs');
    const dir = 'src/commands/moderation';
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const src = await fs.readFile(`${dir}/${f}`, 'utf8');
      const destructive = /\.ban\(|bans\.create|\.kick\(|guildMember.*delete/i.test(src);
      if (!destructive) continue;
      const guarded = /guardTarget|ownerId|roles\.highest/.test(src);
      console.log(`  ${guarded ? '✅' : '⚠️  UNGUARDED'} ${f}`);
    }
  } },
};

// ---- help / dispatch ------------------------------------------------------
function printHelp(one) {
  if (one && TOOLS[one]) { const t = TOOLS[one]; return console.log(`${one} ${t.usage || ''}\n  ${t.desc}`); }
  const groups = { read: '🔎 DISCORD · READ', ops: '⚙️  DISCORD · OPS (writes for real)', local: '🖥️  LOCAL · DIAG/OPS' };
  console.log(`Sentinel Dev CLI — ${Object.keys(TOOLS).length} tools\n  usage: node tools/sentinel.mjs <tool> [args]\n`);
  for (const [gid, label] of Object.entries(groups)) {
    console.log(label);
    for (const [name, t] of Object.entries(TOOLS).filter(([, t]) => t.grp === gid))
      console.log(`  ${name.padEnd(12)} ${(t.usage || '').padEnd(26)} ${t.desc}`);
    console.log('');
  }
}

const [, , tool, ...args] = process.argv;
if (!tool || tool === 'help') { printHelp(args[0]); process.exit(0); }
const chosen = TOOLS[tool];
if (!chosen) { console.error(`❌ unknown tool "${tool}". Run: node tools/sentinel.mjs help`); process.exit(1); }
try {
  await chosen.run(args);
} catch (e) {
  console.error(`❌ ${tool} failed:`, e.status ? `HTTP ${e.status} — ${e.rawError?.message || e.message}` : e.message);
  process.exit(1);
}
