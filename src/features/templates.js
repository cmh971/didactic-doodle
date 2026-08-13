// Saveable message templates with a big {variable} library. Design them on the
// website (/templates), pick a type (warning / startup / announcement / welcome
// / custom), drop in variables, and they auto-fill with live data when used.
//
// 60 variables across users, staff, server, infractions, ER:LC sessions, dates
// and utility — comfortably past the "at least 56" bar.
import { setSetting, getCfg } from '../setup/store.js';
import { randomBytes } from 'node:crypto';

export const TEMPLATE_TYPES = ['warning', 'startup', 'announcement', 'welcome', 'shift', 'custom'];

// ---- THE VARIABLE CATALOG (what shows in the website palette) --------------
// Each: { key, desc, category }. The resolver for each key lives in buildVars().
export const VARIABLES = [
  // — User / offender —
  { key: 'user', desc: 'Mention the user', cat: 'User' },
  { key: 'user.name', desc: 'Username', cat: 'User' },
  { key: 'user.tag', desc: 'Username#0000', cat: 'User' },
  { key: 'user.id', desc: 'User ID', cat: 'User' },
  { key: 'user.avatar', desc: 'Avatar image URL', cat: 'User' },
  { key: 'user.nickname', desc: 'Server nickname', cat: 'User' },
  { key: 'user.created', desc: 'Account created (relative)', cat: 'User' },
  { key: 'user.joined', desc: 'Joined server (relative)', cat: 'User' },
  { key: 'user.roles', desc: 'Number of roles', cat: 'User' },
  { key: 'user.toprole', desc: 'Highest role name', cat: 'User' },
  // — Staff / moderator / author —
  { key: 'mod', desc: 'Mention the staff member', cat: 'Staff' },
  { key: 'mod.name', desc: 'Staff username', cat: 'Staff' },
  { key: 'mod.tag', desc: 'Staff username#0000', cat: 'Staff' },
  { key: 'mod.id', desc: 'Staff ID', cat: 'Staff' },
  { key: 'mod.avatar', desc: 'Staff avatar URL', cat: 'Staff' },
  { key: 'mod.toprole', desc: 'Staff highest role', cat: 'Staff' },
  // — Server —
  { key: 'server', desc: 'Server name', cat: 'Server' },
  { key: 'server.id', desc: 'Server ID', cat: 'Server' },
  { key: 'server.icon', desc: 'Server icon URL', cat: 'Server' },
  { key: 'server.members', desc: 'Total member count', cat: 'Server' },
  { key: 'server.humans', desc: 'Human (non-bot) count', cat: 'Server' },
  { key: 'server.bots', desc: 'Bot count', cat: 'Server' },
  { key: 'server.online', desc: 'Online member count', cat: 'Server' },
  { key: 'server.boosts', desc: 'Boost count', cat: 'Server' },
  { key: 'server.boosttier', desc: 'Boost tier', cat: 'Server' },
  { key: 'server.owner', desc: 'Owner mention', cat: 'Server' },
  { key: 'server.created', desc: 'Server created (relative)', cat: 'Server' },
  { key: 'server.channels', desc: 'Channel count', cat: 'Server' },
  { key: 'server.roles', desc: 'Role count', cat: 'Server' },
  { key: 'server.vanity', desc: 'Vanity invite URL', cat: 'Server' },
  // — Infraction (warning templates) —
  { key: 'reason', desc: 'Infraction reason', cat: 'Infraction' },
  { key: 'action', desc: 'warn / mute / kick / ban', cat: 'Infraction' },
  { key: 'case', desc: 'Case ID', cat: 'Infraction' },
  { key: 'duration', desc: 'Punishment duration', cat: 'Infraction' },
  { key: 'expires', desc: 'When it expires (relative)', cat: 'Infraction' },
  { key: 'strikes', desc: 'Total strike count', cat: 'Infraction' },
  { key: 'notes', desc: 'Staff notes', cat: 'Infraction' },
  { key: 'rule', desc: 'Rule broken', cat: 'Infraction' },
  // — ER:LC session / startup —
  { key: 'session.host', desc: 'Session host mention', cat: 'Session' },
  { key: 'session.code', desc: 'Private server code', cat: 'Session' },
  { key: 'session.link', desc: 'Join link', cat: 'Session' },
  { key: 'session.players', desc: 'Current players', cat: 'Session' },
  { key: 'session.max', desc: 'Max players', cat: 'Session' },
  { key: 'session.votes', desc: 'Votes to start', cat: 'Session' },
  { key: 'session.needed', desc: 'Votes needed', cat: 'Session' },
  { key: 'session.peak', desc: 'Peak players', cat: 'Session' },
  { key: 'session.region', desc: 'Server region', cat: 'Session' },
  { key: 'session.status', desc: 'SSU / SSD status', cat: 'Session' },
  // — Date / time —
  { key: 'date', desc: 'Current date', cat: 'Date' },
  { key: 'time', desc: 'Current time', cat: 'Date' },
  { key: 'datetime', desc: 'Full timestamp (Discord)', cat: 'Date' },
  { key: 'relative', desc: 'Relative time (Discord)', cat: 'Date' },
  { key: 'day', desc: 'Day of month', cat: 'Date' },
  { key: 'weekday', desc: 'Day name (Monday…)', cat: 'Date' },
  { key: 'month', desc: 'Month name', cat: 'Date' },
  { key: 'year', desc: 'Year', cat: 'Date' },
  // — Utility —
  { key: 'channel', desc: 'Current channel mention', cat: 'Utility' },
  { key: 'invite', desc: 'Server invite URL', cat: 'Utility' },
  { key: 'random', desc: 'Random number 1–100', cat: 'Utility' },
  { key: 'everyone', desc: '@everyone ping', cat: 'Utility' },
  { key: 'here', desc: '@here ping', cat: 'Utility' },
];

// Build the substitution map from a live context. Everything is best-effort —
// unknown/unavailable variables resolve to a readable placeholder, never crash.
export function buildVars(ctx = {}) {
  const { guild, target, targetMember, mod, modMember, channel, session = {}, infraction = {}, invite } = ctx;
  const now = new Date();
  const rel = (ts) => (ts ? `<t:${Math.floor(ts / 1000)}:R>` : '—');
  const v = {};

  v['user'] = target ? `<@${target.id}>` : '{user}';
  v['user.name'] = target?.username || '—';
  v['user.tag'] = target?.tag || target?.username || '—';
  v['user.id'] = target?.id || '—';
  v['user.avatar'] = target?.displayAvatarURL?.() || '';
  v['user.nickname'] = targetMember?.nickname || target?.username || '—';
  v['user.created'] = rel(target?.createdTimestamp);
  v['user.joined'] = rel(targetMember?.joinedTimestamp);
  v['user.roles'] = String((targetMember?.roles?.cache?.size ?? 1) - 1);
  v['user.toprole'] = targetMember?.roles?.highest?.name || '—';

  v['mod'] = mod ? `<@${mod.id}>` : '{mod}';
  v['mod.name'] = mod?.username || '—';
  v['mod.tag'] = mod?.tag || mod?.username || '—';
  v['mod.id'] = mod?.id || '—';
  v['mod.avatar'] = mod?.displayAvatarURL?.() || '';
  v['mod.toprole'] = modMember?.roles?.highest?.name || '—';

  v['server'] = guild?.name || '—';
  v['server.id'] = guild?.id || '—';
  v['server.icon'] = guild?.iconURL?.() || '';
  v['server.members'] = String(guild?.memberCount ?? '—');
  v['server.humans'] = String(guild?.members?.cache?.filter?.((m) => !m.user.bot).size ?? '—');
  v['server.bots'] = String(guild?.members?.cache?.filter?.((m) => m.user.bot).size ?? '—');
  v['server.online'] = String(guild?.approximatePresenceCount ?? guild?.members?.cache?.filter?.((m) => m.presence && m.presence.status !== 'offline').size ?? '—');
  v['server.boosts'] = String(guild?.premiumSubscriptionCount ?? 0);
  v['server.boosttier'] = String(guild?.premiumTier ?? 0);
  v['server.owner'] = guild?.ownerId ? `<@${guild.ownerId}>` : '—';
  v['server.created'] = rel(guild?.createdTimestamp);
  v['server.channels'] = String(guild?.channels?.cache?.size ?? '—');
  v['server.roles'] = String(guild?.roles?.cache?.size ?? '—');
  v['server.vanity'] = guild?.vanityURLCode ? `https://discord.gg/${guild.vanityURLCode}` : '—';

  v['reason'] = infraction.reason || '—';
  v['action'] = infraction.action || '—';
  v['case'] = infraction.caseId != null ? `#${infraction.caseId}` : '—';
  v['duration'] = infraction.duration || '—';
  v['expires'] = infraction.expiresAt ? `<t:${infraction.expiresAt}:R>` : 'Permanent';
  v['strikes'] = String(infraction.count ?? '—');
  v['notes'] = infraction.notes || '—';
  v['rule'] = infraction.rule || '—';

  v['session.host'] = session.hostId ? `<@${session.hostId}>` : '—';
  v['session.code'] = session.code || '—';
  v['session.link'] = session.link || '—';
  v['session.players'] = String(session.players ?? '—');
  v['session.max'] = String(session.max ?? '—');
  v['session.votes'] = String(session.votes ?? '—');
  v['session.needed'] = String(session.needed ?? '—');
  v['session.peak'] = String(session.peak ?? '—');
  v['session.region'] = session.region || '—';
  v['session.status'] = session.status || '—';

  v['date'] = now.toLocaleDateString('en-US');
  v['time'] = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  v['datetime'] = `<t:${Math.floor(now / 1000)}:F>`;
  v['relative'] = `<t:${Math.floor(now / 1000)}:R>`;
  v['day'] = String(now.getDate());
  v['weekday'] = now.toLocaleDateString('en-US', { weekday: 'long' });
  v['month'] = now.toLocaleDateString('en-US', { month: 'long' });
  v['year'] = String(now.getFullYear());

  v['channel'] = channel ? `<#${channel.id}>` : '{channel}';
  v['invite'] = invite || v['server.vanity'] || '—';
  v['random'] = String(Math.floor(Math.random() * 100) + 1);
  v['everyone'] = '@everyone';
  v['here'] = '@here';

  return v;
}

// Substitute {var} tokens. Unknown tokens are left as-is so authors can see typos.
export function renderTemplate(content, ctx) {
  const vars = buildVars(ctx);
  return String(content || '').replace(/\{([\w.]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// ---- storage (per guild) --------------------------------------------------
export function getTemplates(guildId) {
  return getCfg(guildId)?.settings?.templates || [];
}
export function saveTemplate(guildId, tpl) {
  const list = getTemplates(guildId);
  const clean = {
    id: tpl.id && /^[a-z0-9]{6,}$/i.test(tpl.id) ? tpl.id : randomBytes(6).toString('hex'),
    name: String(tpl.name || 'Untitled').slice(0, 80),
    type: TEMPLATE_TYPES.includes(tpl.type) ? tpl.type : 'custom',
    title: String(tpl.title || '').slice(0, 256),
    content: String(tpl.content || '').slice(0, 3800),
    color: /^#?[0-9a-f]{6}$/i.test(tpl.color || '') ? tpl.color : '',
    image: /^https?:\/\//.test(tpl.image || '') ? tpl.image : '',
    updatedAt: Date.now(),
  };
  const i = list.findIndex((t) => t.id === clean.id);
  if (i >= 0) list[i] = clean; else list.push(clean);
  setSetting(guildId, 'templates', list.slice(0, 100));
  return clean;
}
export function deleteTemplate(guildId, id) {
  const list = getTemplates(guildId).filter((t) => t.id !== id);
  setSetting(guildId, 'templates', list);
  return true;
}
