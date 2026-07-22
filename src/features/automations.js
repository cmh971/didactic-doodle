// Automations engine — the "When → Do" rule system (the runtime behind the
// visual block builder). Rules are stored per guild and executed live when their
// trigger fires. Designed to be cheap on hot paths: enabled rules are cached per
// guild and only re-read from SQLite when they change.
//
// Trigger types (v1):
//   • message_contains { text, matchType: contains|exact|startsWith, channelId? }
//   • member_join {}
// Action types (v1):
//   • reply { text }            – reply to the triggering message
//   • send  { channelId, text } – post to a channel
//   • dm    { text }            – DM the user who triggered it
//   • react { emoji }           – react to the triggering message
//   • add_role / remove_role { roleId }
//   • wait  { seconds }         – pause (≤30s) between actions
//
// Text supports placeholders: {user} {username} {server} {content} {count}
import { EmbedBuilder } from 'discord.js';
import { getDb } from '../db/index.js';
import { chatWithAI } from '../ai/gemini.js';
import { getWeather, weatherEmoji } from './weather.js';

const db = getDb();
// NOTE: table is `flow_automations` — the plain `automations` table is already
// owned by the /automations (management) command with a different schema.
db.exec(`CREATE TABLE IF NOT EXISTS flow_automations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  name       TEXT,
  enabled    INTEGER NOT NULL DEFAULT 1,
  trigger    TEXT NOT NULL,
  actions    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`);
// Migrations: scope ('server'|'global') + status ('active'|'pending'|'denied') +
// who submitted it. Global automations run in every server, so they must be
// approved by the bot owner first (status starts 'pending'). Idempotent.
for (const sql of [
  "ALTER TABLE flow_automations ADD COLUMN scope TEXT NOT NULL DEFAULT 'server'",
  "ALTER TABLE flow_automations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
  'ALTER TABLE flow_automations ADD COLUMN submitted_by TEXT',
]) { try { db.exec(sql); } catch { /* column exists */ } }

const MAX_PER_GUILD = 25;
const MAX_ACTIONS = 10;
const TRIGGERS = new Set(['message_contains', 'member_join', 'member_leave']);
const ACTIONS = new Set(['reply', 'send', 'dm', 'react', 'add_role', 'remove_role', 'wait', 'send_embed', 'timeout', 'set_nickname', 'delete_message', 'pin_message', 'random_reply', 'dice', 'ai_reply', 'weather', 'translate']);

const stmt = {
  all: db.prepare('SELECT * FROM flow_automations WHERE guild_id = ? ORDER BY id DESC'),
  // Rules that run for a guild: its own active server rules + all approved globals.
  enabled: db.prepare("SELECT * FROM flow_automations WHERE enabled = 1 AND status = 'active' AND ((scope = 'server' AND guild_id = ?) OR scope = 'global')"),
  count: db.prepare('SELECT COUNT(*) AS n FROM flow_automations WHERE guild_id = ?'),
  get: db.prepare('SELECT * FROM flow_automations WHERE guild_id = ? AND id = ?'),
  insert: db.prepare('INSERT INTO flow_automations(guild_id, name, trigger, actions, scope, status, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  del: db.prepare('DELETE FROM flow_automations WHERE guild_id = ? AND id = ?'),
  toggle: db.prepare('UPDATE flow_automations SET enabled = ? WHERE guild_id = ? AND id = ?'),
  pending: db.prepare("SELECT * FROM flow_automations WHERE status = 'pending' ORDER BY id DESC"),
  getById: db.prepare('SELECT * FROM flow_automations WHERE id = ?'),
  setStatus: db.prepare('UPDATE flow_automations SET status = ?, enabled = ? WHERE id = ?'),
};

// ---- per-guild cache of parsed, enabled rules (hot path) ----
const cache = new Map();
function invalidate(guildId) { cache.delete(guildId); }
function enabledFor(guildId) {
  if (cache.has(guildId)) return cache.get(guildId);
  const parsed = stmt.enabled.all(guildId).map((r) => {
    try { return { id: r.id, trigger: JSON.parse(r.trigger), actions: JSON.parse(r.actions) }; } catch { return null; }
  }).filter(Boolean);
  cache.set(guildId, parsed);
  return parsed;
}

// ---- validation (the "check it before deploy" gate) ----
export function validateAutomation(trigger, actions) {
  if (!trigger || !TRIGGERS.has(trigger.type)) return { ok: false, error: 'Pick a valid trigger.' };
  if (trigger.type === 'message_contains' && !String(trigger.text || '').trim()) return { ok: false, error: 'The message trigger needs some text to match.' };
  if (!Array.isArray(actions) || !actions.length) return { ok: false, error: 'Add at least one action.' };
  if (actions.length > MAX_ACTIONS) return { ok: false, error: `Too many actions (max ${MAX_ACTIONS}).` };
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]; const n = i + 1;
    if (!a || !ACTIONS.has(a.type)) return { ok: false, error: `Action ${n} is not a valid block.` };
    if (['reply', 'send', 'dm'].includes(a.type) && !String(a.text || '').trim()) return { ok: false, error: `Action ${n} (${a.type}) needs message text.` };
    if (a.type === 'send' && !a.channelId) return { ok: false, error: `Action ${n} (send) needs a channel.` };
    if (a.type === 'send_embed' && !String(a.title || '').trim() && !String(a.description || '').trim()) return { ok: false, error: `Action ${n} (embed) needs a title or description.` };
    if (['add_role', 'remove_role'].includes(a.type) && !a.roleId) return { ok: false, error: `Action ${n} needs a role.` };
    if (a.type === 'react' && !String(a.emoji || '').trim()) return { ok: false, error: `Action ${n} (react) needs an emoji.` };
    if (a.type === 'set_nickname' && !String(a.text || '').trim()) return { ok: false, error: `Action ${n} (nickname) needs text.` };
    if (a.type === 'random_reply' && !String(a.text || '').trim()) return { ok: false, error: `Action ${n} (random reply) needs options (separate with |).` };
    if (a.type === 'translate' && !String(a.to || '').trim()) return { ok: false, error: `Action ${n} (translate) needs a target language.` };
  }
  return { ok: true };
}

// ---- CRUD (used by the dashboard) ----
export function listAutomations(guildId) {
  return stmt.all.all(guildId).map((r) => ({
    id: r.id, name: r.name, enabled: !!r.enabled, scope: r.scope || 'server', status: r.status || 'active',
    trigger: safeParse(r.trigger, {}), actions: safeParse(r.actions, []), created_at: r.created_at * 1000,
  }));
}
export function createAutomation(guildId, { name, trigger, actions, scope, submittedBy }) {
  if (stmt.count.get(guildId).n >= MAX_PER_GUILD) return { ok: false, error: `Limit reached (${MAX_PER_GUILD} automations per server).` };
  const v = validateAutomation(trigger, actions);
  if (!v.ok) return v;
  const acts = actions.slice(0, MAX_ACTIONS);
  const sc = scope === 'global' ? 'global' : 'server';
  const status = sc === 'global' ? 'pending' : 'active'; // globals wait for owner approval
  const info = stmt.insert.run(guildId, String(name || 'Untitled').slice(0, 80), JSON.stringify(trigger), JSON.stringify(acts), sc, status, submittedBy || null);
  invalidate(guildId);
  if (sc === 'global') cache.clear();
  return { ok: true, id: Number(info.lastInsertRowid), pending: status === 'pending' };
}
export function deleteAutomation(guildId, id) {
  const n = stmt.del.run(guildId, Number(id)).changes;
  invalidate(guildId); cache.clear();
  return n > 0;
}
export function setAutomationEnabled(guildId, id, enabled) {
  stmt.toggle.run(enabled ? 1 : 0, guildId, Number(id));
  invalidate(guildId); cache.clear();
  return true;
}

// ---- owner approval queue (global automations) ----
export function listPending() {
  return stmt.pending.all().map((r) => ({
    id: r.id, guild_id: r.guild_id, name: r.name, submitted_by: r.submitted_by,
    trigger: safeParse(r.trigger, {}), actions: safeParse(r.actions, []), created_at: r.created_at * 1000,
  }));
}
export function approveAutomation(id) {
  const n = stmt.setStatus.run('active', 1, Number(id)).changes;
  cache.clear();
  return n > 0;
}
export function denyAutomation(id) {
  const n = stmt.setStatus.run('denied', 0, Number(id)).changes;
  cache.clear();
  return n > 0;
}

function safeParse(s, d) { try { return JSON.parse(s); } catch { return d; } }

// ---- placeholders ----
function fill(text, ctx) {
  return String(text ?? '')
    .split('{user}').join(ctx.user ? `<@${ctx.user.id}>` : '')
    .split('{username}').join(ctx.user?.username || 'there')
    .split('{server}').join(ctx.guild?.name || '')
    .split('{content}').join(ctx.content || '')
    .split('{args}').join(ctx.args ?? ctx.content ?? '')
    .split('{count}').join(String(ctx.guild?.memberCount ?? ''))
    .slice(0, 2000);
}

// ---- trigger matching ----
function matchMessage(trigger, message) {
  if (trigger.type !== 'message_contains') return false;
  if (trigger.channelId && message.channel.id !== trigger.channelId) return false;
  const kw = String(trigger.text || '').toLowerCase().trim();
  if (!kw) return false;
  const content = (message.content || '').toLowerCase();
  const mt = trigger.matchType || 'contains';
  if (mt === 'exact') return content.trim() === kw;
  if (mt === 'startsWith') return content.startsWith(kw);
  return content.includes(kw);
}

// ---- action runner (each action is isolated; one failure never aborts the rest) ----
async function runActions(actions, ctx) {
  for (const a of actions.slice(0, MAX_ACTIONS)) {
    try {
      if (a.type === 'reply' && ctx.message) await ctx.message.reply({ content: fill(a.text, ctx) || '​', allowedMentions: { repliedUser: true, parse: ['users'] } });
      else if (a.type === 'send' && a.channelId) { const ch = ctx.guild.channels.cache.get(a.channelId); if (ch?.isTextBased?.()) await ch.send(fill(a.text, ctx) || '​'); }
      else if (a.type === 'dm' && ctx.user) await ctx.user.send(fill(a.text, ctx) || '​').catch(() => {});
      else if (a.type === 'react' && ctx.message && a.emoji) await ctx.message.react(a.emoji).catch(() => {});
      else if (a.type === 'add_role' && ctx.member && a.roleId) await ctx.member.roles.add(a.roleId).catch(() => {});
      else if (a.type === 'remove_role' && ctx.member && a.roleId) await ctx.member.roles.remove(a.roleId).catch(() => {});
      else if (a.type === 'wait') await new Promise((r) => setTimeout(r, Math.min(30, Math.max(0, Number(a.seconds) || 0)) * 1000));
      else if (a.type === 'send_embed') {
        const e = new EmbedBuilder();
        if (a.title) e.setTitle(fill(a.title, ctx).slice(0, 256));
        if (a.description) e.setDescription(fill(a.description, ctx).slice(0, 4096));
        e.setColor(/^#?[0-9a-fA-F]{6}$/.test(String(a.color || '')) ? parseInt(String(a.color).replace('#', ''), 16) : 0x5865f2);
        const ch = a.channelId ? ctx.guild.channels.cache.get(a.channelId) : ctx.message?.channel;
        if (ch?.isTextBased?.()) await ch.send({ embeds: [e] }).catch(() => {});
      }
      else if (a.type === 'timeout' && ctx.member) await ctx.member.timeout(Math.min(2419200, Math.max(1, Number(a.seconds) || 60)) * 1000).catch(() => {});
      else if (a.type === 'set_nickname' && ctx.member) await ctx.member.setNickname(fill(a.text, ctx).slice(0, 32) || null).catch(() => {});
      else if (a.type === 'delete_message' && ctx.message) await ctx.message.delete().catch(() => {});
      else if (a.type === 'pin_message' && ctx.message) await ctx.message.pin().catch(() => {});
      else if (a.type === 'random_reply' && ctx.message) {
        const opts = String(a.text || '').split('|').map((s) => s.trim()).filter(Boolean);
        if (opts.length) await ctx.message.reply({ content: fill(opts[Math.floor(Math.random() * opts.length)], ctx) || '​', allowedMentions: { repliedUser: true, parse: ['users'] } });
      }
      else if (a.type === 'dice' && ctx.message) {
        const sides = Math.min(1000, Math.max(2, Number(a.sides) || 6));
        await ctx.message.reply(`🎲 You rolled **${1 + Math.floor(Math.random() * sides)}** (1–${sides})`);
      }
      else if (a.type === 'ai_reply' && ctx.message) {
        const prompt = fill(a.prompt || '{content}', ctx) || ctx.content || 'Say hello!';
        let ans = null;
        try { ans = await chatWithAI(ctx.user.id, prompt); } catch { /* AI down */ }
        if (ans) await ctx.message.reply({ content: String(ans).slice(0, 2000), allowedMentions: { repliedUser: true, parse: ['users'] } });
      }
      else if (a.type === 'weather' && ctx.message) {
        const loc = (fill(a.location || '{args}', ctx) || ctx.content || '').trim();
        const r = await getWeather(loc);
        if (r.ok) { const d = r.data; await ctx.message.reply(`${weatherEmoji(d.icon)} **${d.name}${d.country ? ', ' + d.country : ''}** — ${d.temp}°${d.units === 'imperial' ? 'F' : 'C'}, ${d.desc} (feels ${d.feels}°, humidity ${d.humidity}%)`); }
        else await ctx.message.reply(`🌧️ ${r.error}`);
      }
      else if (a.type === 'translate' && ctx.message) {
        const to = String(a.to || 'English').trim();
        const text = fill('{args}', ctx) || ctx.content || '';
        let ans = null;
        try { ans = await chatWithAI(ctx.user.id, `Translate the following into ${to}. Output ONLY the translation, nothing else:\n\n${text}`); } catch { /* AI down */ }
        if (ans) await ctx.message.reply({ content: `🌍 ${String(ans).slice(0, 1990)}`, allowedMentions: { repliedUser: true, parse: ['users'] } });
      }
    } catch { /* per-action safety */ }
  }
}

// ---- runtime hooks (called from the event pipeline) ----
export async function runMessageAutomations(message) {
  if (!message.guild || message.author?.bot) return;
  const rules = enabledFor(message.guild.id);
  if (!rules.length) return;
  const ctx = { guild: message.guild, client: message.client, message, member: message.member, user: message.author, content: message.content };
  for (const rule of rules) {
    if (!matchMessage(rule.trigger, message)) continue;
    // {args} = the message with the trigger keyword removed (e.g. "weather london" → "london").
    const kw = String(rule.trigger.text || '');
    const idx = kw ? message.content.toLowerCase().indexOf(kw.toLowerCase()) : -1;
    ctx.args = idx !== -1 ? (message.content.slice(0, idx) + message.content.slice(idx + kw.length)).trim() : message.content;
    await runActions(rule.actions, ctx);
  }
}

export async function runMemberJoinAutomations(member) {
  if (member.user?.bot) return;
  const rules = enabledFor(member.guild.id);
  if (!rules.length) return;
  const ctx = { guild: member.guild, client: member.client, member, user: member.user, content: '' };
  for (const rule of rules) {
    if (rule.trigger.type === 'member_join') await runActions(rule.actions, ctx);
  }
}

export async function runMemberLeaveAutomations(member) {
  if (member.user?.bot) return;
  const rules = enabledFor(member.guild.id);
  if (!rules.length) return;
  const ctx = { guild: member.guild, client: member.client, user: member.user, content: '' };
  for (const rule of rules) {
    if (rule.trigger.type === 'member_leave') await runActions(rule.actions, ctx);
  }
}
