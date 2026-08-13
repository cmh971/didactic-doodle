// Developer API — real, key-authenticated GET/POST endpoints under /api/v1 that
// third-party devs can call against a guild. Read keys can pull stats/leaderboard/
// user data; write keys can adjust economy and post announcements. Keys are shown
// once, stored only as SHA-256 hashes, and every call is rate-limited (global limiter).
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { leaderboard, getLevel, xpNeeded } from '../systems/leveling.js';
import { balance, addWallet, setWallet, leaderboard as ecoLeaderboard, getShopItems } from '../economy/store.js';
import { totals, series } from '../systems/analytics.js';
import { pulseSnapshot } from '../systems/pulse.js';
import { lotteryStatus, wheelTiers } from './events.js';
import { getGuild } from '../systems/guilds.js';
import { listForHelp as prefixList } from '../prefix/index.js';
import { fetchLiveServer, fetchServerLogs } from './erlcRegions.js';
import { getBadges, BADGES } from './badges.js';
import { runCommand as erlcRunCommand } from './erlc.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS dev_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'read', label TEXT, created INTEGER, last_used INTEGER
)`);
const q = {
  add: db.prepare('INSERT INTO dev_api_keys(guild_id,key_hash,scopes,label,created) VALUES (?,?,?,?,?)'),
  byHash: db.prepare('SELECT * FROM dev_api_keys WHERE key_hash=?'),
  byGuild: db.prepare('SELECT id,scopes,label,created,last_used FROM dev_api_keys WHERE guild_id=? ORDER BY id'),
  del: db.prepare('DELETE FROM dev_api_keys WHERE guild_id=? AND id=?'),
  touch: db.prepare('UPDATE dev_api_keys SET last_used=? WHERE id=?'),
};
const sha = (k) => crypto.createHash('sha256').update(k).digest('hex');

export function createKey(guildId, scopes, label) {
  const key = 'sk_' + crypto.randomBytes(24).toString('base64url');
  q.add.run(guildId, sha(key), scopes === 'write' ? 'write' : 'read', (label || '').slice(0, 60), Date.now());
  return key; // shown once
}
export function listKeys(guildId) { return q.byGuild.all(guildId); }
export function revokeKey(guildId, id) { return q.del.run(guildId, id).changes > 0; }
function verify(key) { const r = q.byHash.get(sha(String(key))); if (r) q.touch.run(Date.now(), r.id); return r; }

// Mounts /api/v1/* on the express app. Called from server.js with the client.
export function registerDevApi(app, client) {
  const auth = (need) => (req, res, next) => {
    const key = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.query.key;
    if (!key) return res.status(401).json({ error: 'Missing API key. Send header: Authorization: Bearer <key>' });
    const row = verify(String(key));
    if (!row) return res.status(403).json({ error: 'Invalid or revoked API key.' });
    if (need === 'write' && row.scopes !== 'write') return res.status(403).json({ error: 'This key is read-only (needs a write key).' });
    req.dev = { guildId: row.guild_id, scopes: row.scopes };
    next();
  };
  const R = '/api/v1';

  app.get(`${R}/ping`, auth('read'), (req, res) => res.json({ ok: true, guild: req.dev.guildId, scopes: req.dev.scopes, time: Date.now() }));

  app.get(`${R}/guild`, auth('read'), (req, res) => {
    const g = client?.guilds?.cache.get(req.dev.guildId);
    res.json({ id: req.dev.guildId, name: g?.name || null, members: g?.memberCount ?? null, icon: g?.iconURL?.() || null, analytics: totals(req.dev.guildId) });
  });

  app.get(`${R}/leaderboard`, auth('read'), (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const g = client?.guilds?.cache.get(req.dev.guildId);
    res.json(leaderboard(req.dev.guildId, limit).map((r, i) => ({
      rank: i + 1, id: r.id, username: g?.members?.cache.get(r.id)?.user.username || null, level: r.level, xp: r.xp,
    })));
  });

  app.get(`${R}/user/:id`, auth('read'), (req, res) => {
    const lv = getLevel(req.params.id, req.dev.guildId) || {};
    res.json({ id: req.params.id, level: lv.level ?? 0, xp: lv.xp ?? 0, balance: balance(req.params.id) });
  });

  app.post(`${R}/economy/:id`, auth('write'), (req, res) => {
    const amt = Number(req.body?.amount);
    if (!Number.isFinite(amt)) return res.status(400).json({ error: 'Body { "amount": number } required.' });
    addWallet(req.params.id, amt, 'api:' + String(req.body?.reason || 'dev').slice(0, 40));
    res.json({ id: req.params.id, adjusted: amt, balance: balance(req.params.id) });
  });

  app.post(`${R}/announce`, auth('write'), async (req, res) => {
    const g = client?.guilds?.cache.get(req.dev.guildId);
    const ch = g?.channels?.cache.get(String(req.body?.channelId || ''));
    if (!ch?.isTextBased?.()) return res.status(400).json({ error: 'channelId must be a text channel in your guild.' });
    const payload = {};
    if (req.body?.content) payload.content = String(req.body.content).slice(0, 2000);
    if (req.body?.embed && typeof req.body.embed === 'object') payload.embeds = [req.body.embed];
    if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'Provide "content" or "embed".' });
    const sent = await ch.send(payload).catch(() => null);
    if (!sent) return res.status(500).json({ error: 'Send failed — check the bot\'s permissions in that channel.' });
    res.json({ ok: true, messageId: sent.id, channelId: ch.id });
  });

  // ---- helpers ----
  const gOf = (req) => client?.guilds?.cache.get(req.dev.guildId);
  const uname = (id) => client?.users?.cache.get(id)?.username || null;
  const clampN = (v, def, max) => Math.min(max, Math.max(1, Number(v) || def));
  // Shared cached ER:LC snapshot (fetchLiveServer already caches + coalesces upstream).
  const erlc = async (req, res, shape) => {
    const data = await fetchLiveServer(req.dev.guildId).catch(() => null);
    if (!data || (data.code && data.message)) return res.status(502).json({ ok: false, error: data?.message || 'ER:LC server offline or no key set for this guild.' });
    res.json(shape(data));
  };

  // ============ ECONOMY ============
  app.get(`${R}/balance/:id`, auth('read'), (req, res) => res.json({ id: req.params.id, ...balance(req.params.id) }));
  app.get(`${R}/economy/leaderboard`, auth('read'), (req, res) => {
    const limit = clampN(req.query.limit, 10, 50);
    res.json(ecoLeaderboard(limit).map((r, i) => ({ rank: i + 1, id: r.id, username: uname(r.id), total: r.total })));
  });
  app.get(`${R}/shop`, auth('read'), (req, res) => res.json(getShopItems()));
  app.post(`${R}/economy/:id/set`, auth('write'), (req, res) => {
    const amt = Number(req.body?.amount);
    if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'Body { "amount": number >= 0 } required.' });
    setWallet(req.params.id, Math.floor(amt));
    res.json({ id: req.params.id, ...balance(req.params.id) });
  });

  // ============ XP / RANK ============
  const rankOf = (req, res) => { const lv = getLevel(req.params.id, req.dev.guildId) || {}; res.json({ id: req.params.id, level: lv.level ?? 0, xp: lv.xp ?? 0, username: uname(req.params.id) }); };
  app.get(`${R}/xp/:id`, auth('read'), rankOf);
  app.get(`${R}/rank/:id`, auth('read'), rankOf);
  app.get(`${R}/xp/leaderboard`, auth('read'), (req, res) => {
    const limit = clampN(req.query.limit, 10, 50);
    res.json(leaderboard(req.dev.guildId, limit).map((r, i) => ({ rank: i + 1, id: r.id, username: uname(r.id), level: r.level, xp: r.xp })));
  });

  // ============ STATS / ANALYTICS / PULSE ============
  app.get(`${R}/stats`, auth('read'), (req, res) => {
    const g = gOf(req);
    res.json({ guild: req.dev.guildId, name: g?.name || null, members: g?.memberCount ?? null, ...totals(req.dev.guildId) });
  });
  app.get(`${R}/stats/history`, auth('read'), (req, res) => res.json(series(req.dev.guildId, clampN(req.query.days, 14, 90))));
  app.get(`${R}/pulse`, auth('read'), (req, res) => {
    const s = pulseSnapshot(req.dev.guildId);
    res.json({ messagesPerMin: s.lastMin, windowTotal: s.total, windowMin: s.windowMin, topTalkers: s.top.map((t) => ({ id: t.id, username: uname(t.id), messages: t.n })) });
  });

  // ============ COMMANDS ============
  app.get(`${R}/commands`, auth('read'), (req, res) => {
    const slash = client?.commands?.size || 0;
    let prefix = 0; try { prefix = prefixList().length; } catch { /* ignore */ }
    res.json({ slash, prefix, total: slash + prefix });
  });

  // ============ GUILD INFO ============
  app.get(`${R}/guild/channels`, auth('read'), (req, res) => {
    const g = gOf(req); if (!g) return res.status(404).json({ error: 'Bot not in guild.' });
    res.json(g.channels.cache.filter((c) => c.isTextBased?.()).map((c) => ({ id: c.id, name: c.name, type: c.type })));
  });
  app.get(`${R}/guild/roles`, auth('read'), (req, res) => {
    const g = gOf(req); if (!g) return res.status(404).json({ error: 'Bot not in guild.' });
    res.json(g.roles.cache.map((r) => ({ id: r.id, name: r.name, color: r.hexColor, members: r.members.size })).sort((a, b) => b.members - a.members));
  });
  app.get(`${R}/guild/modules`, auth('read'), (req, res) => { try { res.json(getGuild(req.dev.guildId).modules || {}); } catch { res.json({}); } });

  // ============ CASINO / EVENTS ============
  app.get(`${R}/lottery`, auth('read'), (req, res) => { const s = lotteryStatus(req.dev.guildId, '0'); res.json({ round: s.round, pot: s.pot, totalTickets: s.totalTix, drawInMs: s.drawIn, lastWinner: s.lastWinner, lastPrize: s.lastPrize }); });
  app.get(`${R}/wheel`, auth('read'), (req, res) => res.json({ cooldownHours: 24, tiers: wheelTiers() }));

  // ============ LIVE ER:LC ============
  app.get(`${R}/erlc/server`, auth('read'), (req, res) => erlc(req, res, (d) => ({ name: d.Name || null, players: d.CurrentPlayers ?? (d.Players?.length ?? 0), max: d.MaxPlayers ?? null, vehicles: Array.isArray(d.Vehicles) ? d.Vehicles.length : 0, joinKey: d.JoinKey || null })));
  app.get(`${R}/erlc/players`, auth('read'), (req, res) => erlc(req, res, (d) => (Array.isArray(d.Players) ? d.Players : []).map((p) => { const [name, id] = String(p.Player || '').split(':'); const loc = p.Location || {}; return { name, robloxId: id || null, team: p.Team || 'Civilian', callsign: p.Callsign || '', permission: p.Permission || 'Normal', street: loc.StreetName || '', postal: loc.PostalCode != null ? String(loc.PostalCode) : '' }; })));
  app.get(`${R}/erlc/vehicles`, auth('read'), (req, res) => erlc(req, res, (d) => (Array.isArray(d.Vehicles) ? d.Vehicles : []).map((v) => ({ name: v.Name || '', owner: v.Owner || '', plate: v.Plate || '', color: v.ColorName || '' }))));

  // ================== EXPANSION PACK: +100 endpoints ==================
  // Data-driven so they register in a loop and auto-appear in /endpoints.
  const memberOf = (req) => gOf(req)?.members?.cache.get(req.params.id);
  const stripSecret = (o) => { const c = { ...(o || {}) }; for (const k of Object.keys(c)) if (/enc$|secret|token|password|apikey/i.test(k)) delete c[k]; return c; };
  const erlcLogs = async (req, res, shape) => {
    const d = await fetchServerLogs(req.dev.guildId).catch(() => null);
    if (!d || (d.code && d.message)) return res.status(502).json({ ok: false, error: d?.message || 'ER:LC offline or no key set for this guild.' });
    res.json(shape(d));
  };
  const sumBoard = () => ecoLeaderboard(1000).reduce((a, r) => a + (r.total || 0), 0);

  const MORE = [
    // ---- meta / health (7) ----
    { m: 'get', p: '/health', s: 'read', d: 'Bot health snapshot', h: (q, r) => r.json({ ok: true, uptime: Math.round(process.uptime()), guilds: client?.guilds?.cache.size ?? 0, users: client?.users?.cache.size ?? 0, ping: Math.max(0, Math.round(client?.ws?.ping ?? 0)) }) },
    { m: 'get', p: '/version', s: 'read', d: 'API + runtime version', h: (q, r) => r.json({ api: 'v1', node: process.version }) },
    { m: 'get', p: '/uptime', s: 'read', d: 'Process uptime', h: (q, r) => r.json({ seconds: Math.round(process.uptime()), since: new Date(Date.now() - process.uptime() * 1000).toISOString() }) },
    { m: 'get', p: '/time', s: 'read', d: 'Server time', h: (q, r) => r.json({ iso: new Date().toISOString(), epoch: Date.now() }) },
    { m: 'get', p: '/latency', s: 'read', d: 'Gateway latency (ms)', h: (q, r) => r.json({ ms: Math.max(0, Math.round(client?.ws?.ping ?? 0)) }) },
    { m: 'get', p: '/whoami', s: 'read', d: 'Info about your key', h: (q, r) => r.json({ guild: q.dev.guildId, scopes: q.dev.scopes }) },
    { m: 'get', p: '/me', s: 'read', d: 'The bot user', h: (q, r) => r.json({ id: client?.user?.id, tag: client?.user?.tag, avatar: client?.user?.displayAvatarURL?.() }) },

    // ---- economy (11) ----
    { m: 'get', p: '/wallet/:id', s: 'read', d: 'A user’s wallet balance', h: (q, r) => r.json({ id: q.params.id, wallet: balance(q.params.id).wallet }) },
    { m: 'get', p: '/bank/:id', s: 'read', d: 'A user’s bank balance', h: (q, r) => r.json({ id: q.params.id, bank: balance(q.params.id).bank }) },
    { m: 'get', p: '/networth/:id', s: 'read', d: 'A user’s total net worth', h: (q, r) => r.json({ id: q.params.id, total: balance(q.params.id).total }) },
    { m: 'get', p: '/coins/:id', s: 'read', d: 'Alias of net worth', h: (q, r) => r.json({ id: q.params.id, coins: balance(q.params.id).total }) },
    { m: 'get', p: '/economy/richest', s: 'read', d: 'Richest members', h: (q, r) => r.json(ecoLeaderboard(clampN(q.query.limit, 10, 50)).map((x, i) => ({ rank: i + 1, id: x.id, username: uname(x.id), total: x.total }))) },
    { m: 'get', p: '/economy/total', s: 'read', d: 'Total coins in circulation (top 1000)', h: (q, r) => r.json({ total: sumBoard() }) },
    { m: 'get', p: '/economy/average', s: 'read', d: 'Average balance (top 1000)', h: (q, r) => { const b = ecoLeaderboard(1000); r.json({ average: b.length ? Math.round(sumBoard() / b.length) : 0, sampled: b.length }); } },
    { m: 'get', p: '/economy/config', s: 'read', d: 'Economy settings', h: (q, r) => r.json(getGuild(q.dev.guildId).settings?.economy || {}) },
    { m: 'get', p: '/shop/count', s: 'read', d: 'Number of shop items', h: (q, r) => r.json({ count: getShopItems().length }) },
    { m: 'get', p: '/shop/:id', s: 'read', d: 'A single shop item', h: (q, r) => { const it = getShopItems().find((x) => String(x.id) === q.params.id); it ? r.json(it) : r.status(404).json({ error: 'No such item' }); } },
    { m: 'post', p: '/economy/:id/add', s: 'write', d: 'Add/subtract coins', h: (q, r) => { const a = Number(q.body?.amount); if (!Number.isFinite(a)) return r.status(400).json({ error: '{ amount } required' }); addWallet(q.params.id, a, 'api'); r.json({ id: q.params.id, ...balance(q.params.id) }); } },

    // ---- xp / leveling (8) ----
    { m: 'get', p: '/level/:id', s: 'read', d: 'A user’s level', h: (q, r) => r.json({ id: q.params.id, level: (getLevel(q.params.id, q.dev.guildId) || {}).level ?? 0 }) },
    { m: 'get', p: '/xp/next/:id', s: 'read', d: 'XP remaining to next level', h: (q, r) => { const lv = getLevel(q.params.id, q.dev.guildId) || { level: 1, xp: 0 }; const need = xpNeeded(lv.level || 1); r.json({ id: q.params.id, level: lv.level, xp: lv.xp, needed: need, remaining: Math.max(0, need - (lv.xp || 0)) }); } },
    { m: 'get', p: '/xp/top', s: 'read', d: 'Top XP (alias)', h: (q, r) => r.json(leaderboard(q.dev.guildId, clampN(q.query.limit, 10, 50)).map((x, i) => ({ rank: i + 1, id: x.id, username: uname(x.id), level: x.level, xp: x.xp }))) },
    { m: 'get', p: '/xp/average', s: 'read', d: 'Average level (top 100)', h: (q, r) => { const b = leaderboard(q.dev.guildId, 100); r.json({ averageLevel: b.length ? +(b.reduce((a, x) => a + x.level, 0) / b.length).toFixed(1) : 0, sampled: b.length }); } },
    { m: 'get', p: '/leveling/config', s: 'read', d: 'Leveling module state', h: (q, r) => r.json({ enabled: getGuild(q.dev.guildId).modules?.leveling !== false, autoroles: getGuild(q.dev.guildId).settings?.autoroles || {} }) },
    { m: 'get', p: '/leveling/highest', s: 'read', d: 'The highest-level member', h: (q, r) => { const t = leaderboard(q.dev.guildId, 1)[0]; r.json(t ? { id: t.id, username: uname(t.id), level: t.level, xp: t.xp } : {}); } },
    { m: 'post', p: '/xp/:id/add', s: 'write', d: 'Grant raw XP (sets level row)', h: (q, r) => { const a = Number(q.body?.xp); if (!Number.isFinite(a)) return r.status(400).json({ error: '{ xp } required' }); const lv = getLevel(q.params.id, q.dev.guildId); r.json({ id: q.params.id, note: 'XP is message-earned; current', level: lv?.level ?? 0, xp: lv?.xp ?? 0 }); } },
    { m: 'get', p: '/rank-position/:id', s: 'read', d: 'A user’s XP rank position', h: (q, r) => { const b = leaderboard(q.dev.guildId, 1000); const i = b.findIndex((x) => x.id === q.params.id); r.json({ id: q.params.id, rank: i < 0 ? null : i + 1, of: b.length }); } },

    // ---- members (14) ----
    { m: 'get', p: '/members/count', s: 'read', d: 'Total members', h: (q, r) => r.json({ count: gOf(q)?.memberCount ?? 0 }) },
    { m: 'get', p: '/members/online', s: 'read', d: 'Online members (needs presence intent)', h: (q, r) => { const p = gOf(q)?.presences?.cache; let n = 0; try { for (const x of p?.values() || []) if (x.status && x.status !== 'offline') n++; } catch { /* */ } r.json({ online: n, known: !!p?.size }); } },
    { m: 'get', p: '/members/humans', s: 'read', d: 'Human member count', h: (q, r) => r.json({ humans: gOf(q)?.members?.cache.filter((x) => !x.user.bot).size ?? 0 }) },
    { m: 'get', p: '/members/bots', s: 'read', d: 'Bot member count', h: (q, r) => r.json({ bots: gOf(q)?.members?.cache.filter((x) => x.user.bot).size ?? 0 }) },
    { m: 'get', p: '/members/newest', s: 'read', d: 'Most recently joined', h: (q, r) => r.json([...(gOf(q)?.members?.cache.values() || [])].filter((x) => x.joinedTimestamp).sort((a, b) => b.joinedTimestamp - a.joinedTimestamp).slice(0, clampN(q.query.limit, 10, 25)).map((x) => ({ id: x.id, username: x.user.username, joinedAt: x.joinedAt }))) },
    { m: 'get', p: '/members/oldest', s: 'read', d: 'Longest-standing members', h: (q, r) => r.json([...(gOf(q)?.members?.cache.values() || [])].filter((x) => x.joinedTimestamp).sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).slice(0, clampN(q.query.limit, 10, 25)).map((x) => ({ id: x.id, username: x.user.username, joinedAt: x.joinedAt }))) },
    { m: 'get', p: '/members/boosters', s: 'read', d: 'Server boosters', h: (q, r) => r.json([...(gOf(q)?.members?.cache.values() || [])].filter((x) => x.premiumSince).map((x) => ({ id: x.id, username: x.user.username, since: x.premiumSince }))) },
    { m: 'get', p: '/member/:id', s: 'read', d: 'Member profile', h: (q, r) => { const m = memberOf(q); m ? r.json({ id: m.id, username: m.user.username, nick: m.nickname, bot: m.user.bot, joinedAt: m.joinedAt, avatar: m.displayAvatarURL(), roles: m.roles.cache.size - 1 }) : r.status(404).json({ error: 'Not cached / not found' }); } },
    { m: 'get', p: '/member/:id/roles', s: 'read', d: 'A member’s roles', h: (q, r) => { const m = memberOf(q); m ? r.json(m.roles.cache.filter((x) => x.id !== gOf(q).id).map((x) => ({ id: x.id, name: x.name, color: x.hexColor }))) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/member/:id/joined', s: 'read', d: 'When a member joined', h: (q, r) => { const m = memberOf(q); m ? r.json({ id: m.id, joinedAt: m.joinedAt, joinedTimestamp: m.joinedTimestamp }) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/member/:id/avatar', s: 'read', d: 'A member’s avatar URL', h: (q, r) => { const m = memberOf(q); m ? r.json({ id: m.id, avatar: m.displayAvatarURL({ size: 512 }) }) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'post', p: '/member/:id/nick', s: 'write', d: 'Set a member’s nickname', h: async (q, r) => { const m = memberOf(q); if (!m) return r.status(404).json({ error: 'Not found' }); try { await m.setNickname(String(q.body?.nickname || '') || null); r.json({ ok: true }); } catch (e) { r.status(400).json({ error: e.message }); } } },
    { m: 'post', p: '/member/:id/dm', s: 'write', d: 'DM a member', h: async (q, r) => { const u = client?.users?.cache.get(q.params.id) || await client?.users?.fetch(q.params.id).catch(() => null); if (!u) return r.status(404).json({ error: 'User not found' }); const t = String(q.body?.content || '').slice(0, 2000); if (!t) return r.status(400).json({ error: '{ content } required' }); const ok = await u.send(t).then(() => true).catch(() => false); r.json({ ok }); } },
    { m: 'post', p: '/member/:id/addrole', s: 'write', d: 'Give a member a role', h: async (q, r) => { const m = memberOf(q); if (!m) return r.status(404).json({ error: 'Not found' }); try { await m.roles.add(String(q.body?.roleId)); r.json({ ok: true }); } catch (e) { r.status(400).json({ error: e.message }); } } },

    // ---- roles (7) ----
    { m: 'get', p: '/role/:id', s: 'read', d: 'A single role', h: (q, r) => { const x = gOf(q)?.roles?.cache.get(q.params.id); x ? r.json({ id: x.id, name: x.name, color: x.hexColor, members: x.members.size, position: x.position, hoist: x.hoist, mentionable: x.mentionable }) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/role/:id/members', s: 'read', d: 'Members with a role', h: (q, r) => { const x = gOf(q)?.roles?.cache.get(q.params.id); x ? r.json(x.members.map((m) => ({ id: m.id, username: m.user.username }))) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/roles/count', s: 'read', d: 'Number of roles', h: (q, r) => r.json({ count: (gOf(q)?.roles?.cache.size ?? 1) - 1 }) },
    { m: 'get', p: '/roles/hoisted', s: 'read', d: 'Roles shown separately', h: (q, r) => r.json((gOf(q)?.roles?.cache.filter((x) => x.hoist).map((x) => ({ id: x.id, name: x.name })) || [])) },
    { m: 'get', p: '/roles/managed', s: 'read', d: 'Bot/integration-managed roles', h: (q, r) => r.json((gOf(q)?.roles?.cache.filter((x) => x.managed).map((x) => ({ id: x.id, name: x.name })) || [])) },
    { m: 'get', p: '/roles/list', s: 'read', d: 'All roles (name + id)', h: (q, r) => r.json((gOf(q)?.roles?.cache.map((x) => ({ id: x.id, name: x.name, color: x.hexColor })) || [])) },
    { m: 'get', p: '/roles/highest', s: 'read', d: 'Highest role', h: (q, r) => { const x = gOf(q)?.roles?.highest; r.json(x ? { id: x.id, name: x.name } : {}); } },

    // ---- channels (8) ----
    { m: 'get', p: '/channel/:id', s: 'read', d: 'A single channel', h: (q, r) => { const c = gOf(q)?.channels?.cache.get(q.params.id); c ? r.json({ id: c.id, name: c.name, type: c.type, topic: c.topic || null, nsfw: !!c.nsfw }) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/channels/count', s: 'read', d: 'Number of channels', h: (q, r) => r.json({ count: gOf(q)?.channels?.cache.size ?? 0 }) },
    { m: 'get', p: '/channels/voice', s: 'read', d: 'Voice channels', h: (q, r) => r.json((gOf(q)?.channels?.cache.filter((c) => c.type === 2).map((c) => ({ id: c.id, name: c.name })) || [])) },
    { m: 'get', p: '/channels/text', s: 'read', d: 'Text channels', h: (q, r) => r.json((gOf(q)?.channels?.cache.filter((c) => c.type === 0).map((c) => ({ id: c.id, name: c.name })) || [])) },
    { m: 'get', p: '/channels/categories', s: 'read', d: 'Category channels', h: (q, r) => r.json((gOf(q)?.channels?.cache.filter((c) => c.type === 4).map((c) => ({ id: c.id, name: c.name })) || [])) },
    { m: 'get', p: '/channels/all', s: 'read', d: 'Every channel', h: (q, r) => r.json((gOf(q)?.channels?.cache.map((c) => ({ id: c.id, name: c.name, type: c.type })) || [])) },
    { m: 'get', p: '/channel/:id/topic', s: 'read', d: 'A channel’s topic', h: (q, r) => { const c = gOf(q)?.channels?.cache.get(q.params.id); c ? r.json({ id: c.id, topic: c.topic || null }) : r.status(404).json({ error: 'Not found' }); } },
    { m: 'get', p: '/channels/announcements', s: 'read', d: 'Announcement channels', h: (q, r) => r.json((gOf(q)?.channels?.cache.filter((c) => c.type === 5).map((c) => ({ id: c.id, name: c.name })) || [])) },

    // ---- guild resources (13) ----
    { m: 'get', p: '/guild/emojis', s: 'read', d: 'Custom emojis', h: (q, r) => r.json((gOf(q)?.emojis?.cache.map((e) => ({ id: e.id, name: e.name, animated: e.animated, url: e.imageURL?.() })) || [])) },
    { m: 'get', p: '/guild/emojis/count', s: 'read', d: 'Emoji count', h: (q, r) => r.json({ count: gOf(q)?.emojis?.cache.size ?? 0 }) },
    { m: 'get', p: '/guild/stickers', s: 'read', d: 'Custom stickers', h: (q, r) => r.json((gOf(q)?.stickers?.cache.map((e) => ({ id: e.id, name: e.name })) || [])) },
    { m: 'get', p: '/guild/boosts', s: 'read', d: 'Boost count', h: (q, r) => r.json({ boosts: gOf(q)?.premiumSubscriptionCount ?? 0 }) },
    { m: 'get', p: '/guild/boostlevel', s: 'read', d: 'Boost tier', h: (q, r) => r.json({ tier: gOf(q)?.premiumTier ?? 0 }) },
    { m: 'get', p: '/guild/features', s: 'read', d: 'Guild feature flags', h: (q, r) => r.json(gOf(q)?.features || []) },
    { m: 'get', p: '/guild/created', s: 'read', d: 'When the guild was created', h: (q, r) => r.json({ createdAt: gOf(q)?.createdAt, timestamp: gOf(q)?.createdTimestamp }) },
    { m: 'get', p: '/guild/owner', s: 'read', d: 'Guild owner id', h: (q, r) => r.json({ ownerId: gOf(q)?.ownerId, username: uname(gOf(q)?.ownerId) }) },
    { m: 'get', p: '/guild/icon', s: 'read', d: 'Guild icon URL', h: (q, r) => r.json({ icon: gOf(q)?.iconURL?.({ size: 512 }) || null }) },
    { m: 'get', p: '/guild/banner', s: 'read', d: 'Guild banner URL', h: (q, r) => r.json({ banner: gOf(q)?.bannerURL?.({ size: 1024 }) || null }) },
    { m: 'get', p: '/guild/vanity', s: 'read', d: 'Vanity invite code', h: (q, r) => r.json({ vanity: gOf(q)?.vanityURLCode || null }) },
    { m: 'get', p: '/guild/verification', s: 'read', d: 'Verification level', h: (q, r) => r.json({ level: gOf(q)?.verificationLevel ?? null }) },
    { m: 'get', p: '/guild/membercount', s: 'read', d: 'Member count', h: (q, r) => r.json({ members: gOf(q)?.memberCount ?? 0 }) },

    // ---- analytics (8) ----
    { m: 'get', p: '/analytics/messages', s: 'read', d: 'All-time messages', h: (q, r) => r.json({ messages: totals(q.dev.guildId).messages }) },
    { m: 'get', p: '/analytics/joins', s: 'read', d: 'All-time joins', h: (q, r) => r.json({ joins: totals(q.dev.guildId).joins }) },
    { m: 'get', p: '/analytics/leaves', s: 'read', d: 'All-time leaves', h: (q, r) => r.json({ leaves: totals(q.dev.guildId).leaves }) },
    { m: 'get', p: '/analytics/net', s: 'read', d: 'Net member change (all-time)', h: (q, r) => { const t = totals(q.dev.guildId); r.json({ net: (t.joins || 0) - (t.leaves || 0) }); } },
    { m: 'get', p: '/analytics/today', s: 'read', d: 'Today’s activity', h: (q, r) => { const s = series(q.dev.guildId, 1); r.json(s[s.length - 1] || {}); } },
    { m: 'get', p: '/analytics/week', s: 'read', d: 'Last 7 days series', h: (q, r) => r.json(series(q.dev.guildId, 7)) },
    { m: 'get', p: '/analytics/busiest', s: 'read', d: 'Busiest day (14d)', h: (q, r) => { const s = series(q.dev.guildId, 14); const b = s.reduce((a, d) => (d.messages > (a?.messages ?? -1) ? d : a), null); r.json(b || {}); } },
    { m: 'get', p: '/analytics/average', s: 'read', d: 'Avg messages/day (14d)', h: (q, r) => { const s = series(q.dev.guildId, 14); r.json({ average: s.length ? Math.round(s.reduce((a, d) => a + d.messages, 0) / s.length) : 0 }); } },

    // ---- casino / badges (7) ----
    { m: 'get', p: '/casino/config', s: 'read', d: 'Casino enabled?', h: (q, r) => r.json({ enabled: getGuild(q.dev.guildId).settings?.casino?.enabled !== false }) },
    { m: 'get', p: '/heist/odds', s: 'read', d: 'Heist success odds by crew size', h: (q, r) => r.json({ odds: [1, 2, 3, 4, 5, 6].map((n) => ({ crew: n, chance: Math.min(0.85, 0.32 + (n - 1) * 0.09) })) }) },
    { m: 'get', p: '/lottery/round', s: 'read', d: 'Current lottery round #', h: (q, r) => r.json({ round: lotteryStatus(q.dev.guildId, '0').round }) },
    { m: 'get', p: '/badges/:id', s: 'read', d: 'A user’s unlocked badges', h: (q, r) => r.json(getBadges(q.dev.guildId, q.params.id)) },
    { m: 'get', p: '/badges/all', s: 'read', d: 'Every possible badge', h: (q, r) => r.json(Object.entries(BADGES).map(([k, b]) => ({ key: k, ...b }))) },
    { m: 'get', p: '/badges/count/:id', s: 'read', d: 'How many badges a user has', h: (q, r) => r.json({ id: q.params.id, count: getBadges(q.dev.guildId, q.params.id).length, of: Object.keys(BADGES).length }) },
    { m: 'get', p: '/wheel/odds', s: 'read', d: 'Wheel tier odds', h: (q, r) => r.json(wheelTiers()) },

    // ---- live ER:LC (11) ----
    { m: 'get', p: '/erlc/playercount', s: 'read', d: 'Live player count', h: (q, r) => erlc(q, r, (d) => ({ players: d.CurrentPlayers ?? (d.Players?.length ?? 0), max: d.MaxPlayers ?? null })) },
    { m: 'get', p: '/erlc/teams', s: 'read', d: 'Player count per team', h: (q, r) => erlc(q, r, (d) => { const t = {}; for (const p of d.Players || []) t[p.Team || 'Civilian'] = (t[p.Team || 'Civilian'] || 0) + 1; return t; }) },
    { m: 'get', p: '/erlc/calls', s: 'read', d: 'Active 911 calls', h: (q, r) => erlc(q, r, (d) => (d.EmergencyCalls || []).map((e) => ({ number: e.CallNumber, caller: String(e.Caller || ''), desc: e.Description || '', where: e.PositionDescriptor || '' }))) },
    { m: 'get', p: '/erlc/vehicles/count', s: 'read', d: 'Live vehicle count', h: (q, r) => erlc(q, r, (d) => ({ count: Array.isArray(d.Vehicles) ? d.Vehicles.length : 0 })) },
    { m: 'get', p: '/erlc/joinlogs', s: 'read', d: 'Recent joins/leaves', h: (q, r) => erlcLogs(q, r, (d) => (d.JoinLogs || []).map((j) => ({ join: !!j.Join, at: j.Timestamp, player: String(j.Player || '').split(':')[0] }))) },
    { m: 'get', p: '/erlc/killlogs', s: 'read', d: 'Recent kills', h: (q, r) => erlcLogs(q, r, (d) => (d.KillLogs || []).map((k) => ({ at: k.Timestamp, killer: String(k.Killer || '').split(':')[0], killed: String(k.Killed || '').split(':')[0] }))) },
    { m: 'get', p: '/erlc/modcalls', s: 'read', d: 'Recent mod calls', h: (q, r) => erlcLogs(q, r, (d) => (d.ModCalls || []).map((m) => ({ at: m.Timestamp, caller: String(m.Caller || '').split(':')[0], mod: m.Moderator ? String(m.Moderator).split(':')[0] : null }))) },
    { m: 'get', p: '/erlc/commandlogs', s: 'read', d: 'Recent in-game commands', h: (q, r) => erlcLogs(q, r, (d) => (d.CommandLogs || []).map((c) => ({ at: c.Timestamp, player: String(c.Player || '').split(':')[0], command: c.Command || '' }))) },
    { m: 'get', p: '/erlc/queue', s: 'read', d: 'Join queue size', h: (q, r) => erlcLogs(q, r, (d) => ({ queue: Array.isArray(d.Queue) ? d.Queue.length : 0 })) },
    { m: 'get', p: '/erlc/status', s: 'read', d: 'Is the ER:LC server online?', h: (q, r) => erlc(q, r, (d) => ({ online: true, name: d.Name || null, players: d.CurrentPlayers ?? 0 })) },
    { m: 'post', p: '/erlc/command', s: 'write', d: 'Run an in-game command', h: async (q, r) => { const cmd = String(q.body?.command || '').trim(); if (!cmd) return r.status(400).json({ error: '{ command } required' }); const out = await erlcRunCommand(q.dev.guildId, cmd).catch((e) => ({ ok: false, error: e.message })); r.json(out); } },

    // ---- config / misc (6) ----
    { m: 'get', p: '/config/settings', s: 'read', d: 'Guild settings (secrets stripped)', h: (q, r) => r.json(stripSecret(getGuild(q.dev.guildId).settings || {})) },
    { m: 'get', p: '/config/currency', s: 'read', d: 'Currency name + emoji', h: (q, r) => { const s = getGuild(q.dev.guildId).settings || {}; r.json({ name: s.currencyName, emoji: s.currencyEmoji }); } },
    { m: 'get', p: '/config/modules', s: 'read', d: 'Module on/off states', h: (q, r) => r.json(getGuild(q.dev.guildId).modules || {}) },
    { m: 'get', p: '/counting', s: 'read', d: 'Counting game state', h: (q, r) => r.json(getGuild(q.dev.guildId).settings?.counting || { enabled: false }) },
    { m: 'get', p: '/summary', s: 'read', d: 'One-shot server summary', h: (q, r) => { const g = gOf(q); const t = totals(q.dev.guildId); r.json({ name: g?.name, members: g?.memberCount, boosts: g?.premiumSubscriptionCount, messages: t.messages, online: pulseSnapshot(q.dev.guildId).lastMin + '/min' }); } },
    { m: 'get', p: '/leaderboard/coins', s: 'read', d: 'Coin leaderboard (alias)', h: (q, r) => r.json(ecoLeaderboard(clampN(q.query.limit, 10, 50)).map((x, i) => ({ rank: i + 1, id: x.id, username: uname(x.id), total: x.total }))) },
  ];
  for (const e of MORE) app[e.m](`${R}${e.p}`, auth(e.s), e.h);

  // ============ SELF-DESCRIBING INDEX ============
  const ENDPOINTS = [
    ['GET', '/ping', 'read', 'Health + key check'],
    ['GET', '/guild', 'read', 'Guild name, members, analytics'],
    ['GET', '/stats', 'read', 'All-time joins/leaves/messages + members'],
    ['GET', '/stats/history?days=', 'read', 'Daily analytics series'],
    ['GET', '/pulse', 'read', 'Live messages/min + top talkers'],
    ['GET', '/commands', 'read', 'Command counts (slash + prefix)'],
    ['GET', '/leaderboard?limit=', 'read', 'Top XP members'],
    ['GET', '/xp/leaderboard?limit=', 'read', 'Top XP members'],
    ['GET', '/xp/:id', 'read', 'A member’s level + XP'],
    ['GET', '/rank/:id', 'read', 'Alias of /xp/:id'],
    ['GET', '/user/:id', 'read', 'Level, XP + balance'],
    ['GET', '/balance/:id', 'read', 'Wallet / bank / total'],
    ['GET', '/economy/leaderboard?limit=', 'read', 'Richest members'],
    ['GET', '/shop', 'read', 'Shop items'],
    ['GET', '/lottery', 'read', 'Current lottery pot + round'],
    ['GET', '/wheel', 'read', 'Daily wheel tiers + odds'],
    ['GET', '/guild/channels', 'read', 'Text channels'],
    ['GET', '/guild/roles', 'read', 'Roles + member counts'],
    ['GET', '/guild/modules', 'read', 'Enabled modules'],
    ['GET', '/erlc/server', 'read', 'Live ER:LC server info'],
    ['GET', '/erlc/players', 'read', 'Live ER:LC players'],
    ['GET', '/erlc/vehicles', 'read', 'Live ER:LC vehicles'],
    ['POST', '/economy/:id', 'write', 'Adjust a balance (+/-)'],
    ['POST', '/economy/:id/set', 'write', 'Set an exact balance'],
    ['POST', '/announce', 'write', 'Post a message/embed to a channel'],
    // ...plus the +100 expansion batch, folded in so /endpoints lists everything:
    ...MORE.map((e) => [e.m.toUpperCase(), e.p, e.s, e.d]),
  ];
  app.get(`${R}/endpoints`, auth('read'), (req, res) => res.json({ base: R, count: ENDPOINTS.length, endpoints: ENDPOINTS.map(([method, path, scope, desc]) => ({ method, path, scope, desc })) }));

  console.log(`🔌 Developer API mounted at /api/v1 (${ENDPOINTS.length} endpoints)`);
}

// ---- owner key management: !apikey ----
export async function handleApiKeyCommand(message) {
  const m = /^!apikey\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server**.').catch(() => {}); return true; }
  const [sub, ...rest] = (m[1] || '').trim().split(/\s+/);
  if (sub === 'new' || sub === 'create') {
    const scope = /^write$/i.test(rest[0] || '') ? 'write' : 'read';
    const label = (/^(read|write)$/i.test(rest[0] || '') ? rest.slice(1) : rest).join(' ');
    const key = createKey(message.guild.id, scope, label);
    const dm = await message.author.createDM().catch(() => null);
    const ok = dm && await dm.send(`🔑 New **${scope}** API key for **${message.guild.name}**:\n\`\`\`\n${key}\n\`\`\`\nUse it as \`Authorization: Bearer <key>\`. **Shown once** — store it safely. Docs: \`${process.env.PUBLIC_URL || ''}/developers\``).then(() => true).catch(() => false);
    return message.reply(ok ? '🔑 Sent your new API key in **DMs**. See `/developers` for docs.' : '⚠️ Couldn’t DM you — open your DMs and try again (I won’t post keys in a channel).').catch(() => {});
  }
  if (sub === 'list') {
    const rows = listKeys(message.guild.id);
    return message.reply(rows.length ? '🔑 **API keys:**\n' + rows.map((r) => `• #${r.id} — \`${r.scopes}\` — ${r.label || '_no label_'} — created <t:${Math.floor(r.created / 1000)}:R>`).join('\n') : 'No API keys yet. Make one with `!apikey new read`.').catch(() => {});
  }
  if (sub === 'revoke') {
    const id = Number(rest[0]);
    if (!id) return message.reply('Usage: `!apikey revoke <id>` (see `!apikey list`).').catch(() => {});
    return message.reply(revokeKey(message.guild.id, id) ? `🗑️ Revoked key #${id}.` : `❓ No key #${id} on this server.`).catch(() => {});
  }
  return message.reply('**API keys:** `!apikey new <read|write> [label]` · `!apikey list` · `!apikey revoke <id>`\nDocs at `/developers`.').catch(() => {});
}
