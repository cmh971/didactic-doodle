// Web dashboard — Express + Discord OAuth2.
//
// Features:
//   • OAuth2 login (scopes: identify, guilds)
//   • Lists guilds you can Manage that the bot is also in
//   • Toggle bot modules per guild + set language
//   • Live economy leaderboard + per-guild XP leaderboard
//   • Owner-only economy editor (wallet/bank)
//   • Live log + transaction stream (incremental polling)
//
// Runs in the same process as the bot, so it shares the SQLite store directly.
import express from 'express';
import session from 'express-session';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  balance, setWallet, getUser, leaderboard, getShopItems, getItem, addShopItem,
} from '../economy/store.js';
import { getDb } from '../db/index.js';
import { getGuild, saveGuild, setModule } from '../systems/guilds.js';
import { getCfg, setNested } from '../setup/store.js';
import { leaderboard as xpLeaderboard } from '../systems/leveling.js';
import { series as analyticsSeries, totals as analyticsTotals } from '../systems/analytics.js';
import { listGiveaways, createGiveawayWeb, endGiveaway, reroll as rerollGiveaway } from '../features/giveaways.js';
import { listGuildReactionRoles, addReactionRoleWeb, removeReactionRole } from '../features/reactionRoles.js';
import { renderMemberCard } from '../render/cards.js';
import { getWeather } from '../features/weather.js';
import { setGuildAvatar, setGuildBanner } from '../features/botProfile.js';
import { encryptSecret, decryptSecret } from '../systems/secureStore.js';
import { topCommands, recentCommands, totalCommands, commandsSince, bySource } from '../systems/usage.js';
import { getLogsAfter } from './logbus.js';
import { registerCommunity } from './community.js';
import { LOCALES, DEFAULT_LOCALE, LANG_LIST } from '../i18n/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANAGE_GUILD = 1n << 5n; // 0x20
const db = getDb();
const txStmt = db.prepare('SELECT user_id, type, amount, balance_after, created_at FROM transactions ORDER BY id DESC LIMIT ?');
const infStmt = db.prepare('SELECT * FROM infractions WHERE guild_id = ? ORDER BY id DESC LIMIT ?');
const infUserStmt = db.prepare('SELECT * FROM infractions WHERE guild_id = ? AND user_id LIKE ? ORDER BY id DESC LIMIT ?');

function ownerIds() {
  return (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function ownerEmails() {
  return (process.env.OWNER_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// ---- Global app config (DB key/value, for the site bot-check toggle etc.) ----
db.exec('CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT)');
const cfgGetStmt = db.prepare('SELECT value FROM app_config WHERE key = ?');
const cfgSetStmt = db.prepare('INSERT INTO app_config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
function appGet(key, def) { try { const r = cfgGetStmt.get(key); return r ? JSON.parse(r.value) : def; } catch { return def; } }
function appSet(key, value) { try { cfgSetStmt.run(key, JSON.stringify(value)); } catch { /* ignore */ } }

// Owner "prank & kill-switch" control center — all site-wide states live here.
const DEFAULT_SITE_CONTROL = {
  maintenance: false,   // kill switch: non-owners get the maintenance page
  bannedEmails: [],     // these Google emails get the ban page
  banner: '',           // site-wide banner text (empty = off)
  upsideDown: false,    // flip the whole site 180°
  comicSans: false,     // force Comic Sans everywhere
  snow: false,          // falling snow
  disco: false,         // rave hue-rotate
  crt: false,           // retro CRT scanlines
  grayscale: false,     // desaturate the page
  blur: false,          // mild blur prank
  spooky: false,        // dark overlay + shake
  fakeCounter: false,   // fake "you are visitor #1,000,000" popup
  emojiRain: '',        // rain this emoji (empty = off)
  creditSteal: false,   // dramatic "stealing your credits" overlay
};
function siteControl() { return { ...DEFAULT_SITE_CONTROL, ...appGet('siteControl', {}) }; }

export function startWeb(client) {
  const PORT = Number(process.env.WEB_PORT || 3000);
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
  const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${PORT}/callback`;
  const oauthEnabled = Boolean(CLIENT_ID && CLIENT_SECRET);

  // ---- Google Sign-In (optional first step before Discord) ----
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'change-me-please',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' },
    }),
  );

  // ---------- auth helpers ----------
  const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    next();
  };
  const isOwner = (req) =>
    ownerIds().includes(req.session.user?.id) ||
    Boolean(req.session.google?.email && ownerEmails().includes(req.session.google.email.toLowerCase()));
  const requireOwner = (req, res, next) => (isOwner(req) ? next() : res.status(403).json({ error: 'Owner only' }));
  const viewerEmail = (req) => (req?.session?.google?.email || '').toLowerCase();

  // ---------- live presence + moderator messaging + control history ----------
  const presence = new Map();     // sessionID -> viewer snapshot
  const modMessages = new Map();  // sessionID -> queue of undelivered staff messages
  const chats = new Map();        // sessionID -> [{ from:'staff'|'user', text, at }]
  const controlHistory = [];      // stack of previous site-control states (for undo)

  // ---------- KILL SWITCH + BAN middleware (owner always passes) ----------
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const p = req.path;
    // Never gate APIs, auth flows, or static assets (so the block pages can load CSS).
    if (p.startsWith('/api/') || p.startsWith('/auth/') || p === '/login' || p === '/callback' || p === '/logout') return next();
    if (/\.[a-z0-9]+$/i.test(p)) return next();
    if (p === '/maintenance' || p === '/banned') return next(); // owner preview pages
    if (isOwner(req)) return next(); // the owner is never locked out
    const c = siteControl();
    if (c.bannedEmails.map((e) => String(e).toLowerCase()).includes(viewerEmail(req))) {
      return res.status(403).sendFile(join(__dirname, 'public', 'banned.html'));
    }
    if (c.maintenance) {
      return res.status(503).sendFile(join(__dirname, 'public', 'maintenance.html'));
    }
    next();
  });

  // ---------- site control API ----------
  // Public read: returns only what the viewer needs (their own status + the visual effects).
  app.get('/api/site-control', (req, res) => {
    const c = siteControl();
    const owner = isOwner(req);
    res.json({
      owner,
      maintenance: c.maintenance,
      banned: !owner && c.bannedEmails.map((e) => String(e).toLowerCase()).includes(viewerEmail(req)),
      effects: {
        banner: c.banner, upsideDown: c.upsideDown, comicSans: c.comicSans, snow: c.snow,
        disco: c.disco, crt: c.crt, grayscale: c.grayscale, blur: c.blur, spooky: c.spooky,
        fakeCounter: c.fakeCounter, emojiRain: c.emojiRain, creditSteal: c.creditSteal,
      },
    });
  });
  // Owner-only full read (includes the ban list).
  app.get('/api/site-control/full', requireOwner, (req, res) => res.json(siteControl()));
  // Owner-only write (partial update).
  app.post('/api/site-control', requireOwner, (req, res) => {
    const c = siteControl();
    const b = req.body || {};
    for (const k of Object.keys(DEFAULT_SITE_CONTROL)) {
      if (k in b) {
        if (k === 'bannedEmails') c.bannedEmails = Array.isArray(b.bannedEmails) ? b.bannedEmails.map((e) => String(e).trim()).filter(Boolean) : c.bannedEmails;
        else if (k === 'banner' || k === 'emojiRain') c[k] = String(b[k] || '').slice(0, 200);
        else c[k] = Boolean(b[k]);
      }
    }
    controlHistory.push(siteControl()); // snapshot BEFORE change (for undo)
    if (controlHistory.length > 25) controlHistory.shift();
    appSet('siteControl', c);
    console.log(`[owner] site-control updated (maintenance=${c.maintenance})`);
    res.json({ ok: true, control: c });
  });

  // Undo the last owner control change.
  app.post('/api/site-control/undo', requireOwner, (req, res) => {
    const prev = controlHistory.pop();
    if (!prev) return res.json({ ok: false, error: 'Nothing to undo.' });
    appSet('siteControl', prev);
    console.log('[owner] site-control change UNDONE');
    res.json({ ok: true, control: prev });
  });

  // ---------- live presence heartbeat (any visitor) ----------
  app.post('/api/presence', (req, res) => {
    const sid = req.sessionID;
    const u = req.session.user, g = req.session.google;
    presence.set(sid, {
      sid,
      name: u?.global_name || u?.username || g?.name || 'Anonymous',
      email: g?.email || null,
      userId: u?.id || null,
      avatar: u?.avatar || g?.picture || null,
      owner: isOwner(req),
      path: String(req.body?.path || '/').slice(0, 200),
      ua: (req.get('user-agent') || '').slice(0, 120),
      ip: req.ip,
      lastSeen: Date.now(),
    });
    const msgs = modMessages.get(sid) || [];
    if (msgs.length) modMessages.delete(sid);
    res.json({ ok: true, messages: msgs });
  });

  // Owner: who's currently on the site (seen in the last 20s).
  app.get('/api/presence', requireOwner, (req, res) => {
    const now = Date.now();
    for (const [sid, p] of presence) if (now - p.lastSeen > 60000) presence.delete(sid);
    const active = [...presence.values()].filter((p) => now - p.lastSeen < 20000).sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(active);
  });

  // Owner: push a moderator message to one viewer (by sid) or 'all'. Recorded in
  // the chat thread so replies land in the same conversation.
  app.post('/api/moderator-message', requireOwner, (req, res) => {
    const { target, text } = req.body || {};
    const t = String(text || '').slice(0, 500);
    if (!t) return res.status(400).json({ error: 'Message text required.' });
    const push = (sid) => {
      const q = modMessages.get(sid) || []; q.push(t); modMessages.set(sid, q);
      const c = chats.get(sid) || []; c.push({ from: 'staff', text: t, at: Date.now() }); chats.set(sid, c);
    };
    if (target === 'all') { for (const sid of presence.keys()) push(sid); }
    else if (target) push(String(target));
    else return res.status(400).json({ error: 'Pick a target.' });
    console.log(`[owner] 💬 → ${target === 'all' ? 'EVERYONE' : target}: "${t}"`);
    res.json({ ok: true });
  });

  // Visitor: reply to staff (their reply joins their chat thread).
  app.post('/api/chat/reply', (req, res) => {
    const sid = req.sessionID;
    const t = String(req.body?.text || '').slice(0, 500);
    if (!t) return res.status(400).json({ error: 'Empty message.' });
    const c = chats.get(sid) || []; c.push({ from: 'user', text: t, at: Date.now() }); chats.set(sid, c);
    const who = presence.get(sid);
    console.log(`[chat] 💬 reply from ${who?.name || 'visitor'}${who?.email ? ' <' + who.email + '>' : ''}: "${t}"`);
    res.json({ ok: true });
  });

  // Owner: read a viewer's full chat thread.
  app.get('/api/chat/:sid', requireOwner, (req, res) => res.json(chats.get(req.params.sid) || []));
  const canManage = (req, guildId) => {
    const g = (req.session.guilds || []).find((x) => x.id === guildId);
    if (!g) return false;
    try {
      return (BigInt(g.permissions) & MANAGE_GUILD) === MANAGE_GUILD || g.owner;
    } catch {
      return false;
    }
  };

  // ---------- OAuth2 ----------
  app.get('/login', (req, res) => {
    if (!oauthEnabled) return res.redirect('/dashboard?error=oauth_not_configured');
    const url =
      `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code || !oauthEnabled) return res.redirect('/dashboard?error=login_failed');
    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: REDIRECT_URI,
        }),
      });
      const token = await tokenRes.json();
      if (!token.access_token) return res.redirect('/dashboard?error=login_failed');

      const headers = { Authorization: `Bearer ${token.access_token}` };
      const [user, guilds] = await Promise.all([
        fetch('https://discord.com/api/users/@me', { headers }).then((r) => r.json()),
        fetch('https://discord.com/api/users/@me/guilds', { headers }).then((r) => r.json()),
      ]);
      req.session.user = {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      };
      req.session.guilds = Array.isArray(guilds) ? guilds : [];
      console.log(`[login] 🎮 Discord: ${user.global_name || user.username} (@${user.username}, id ${user.id}) · ${Array.isArray(guilds) ? guilds.length : 0} guilds · ip ${req.ip}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error('OAuth callback error:', err.message);
      res.redirect('/dashboard?error=login_failed');
    }
  });

  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  // ---------- Google OAuth2 (real sign-in) ----------
  app.get('/auth/google', (req, res) => {
    if (!googleEnabled) return res.redirect('/dashboard?error=google_not_configured');
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    res.redirect(url);
  });

  app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code || !googleEnabled) return res.redirect('/dashboard?error=google_failed');
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const token = await tokenRes.json();
      if (!token.access_token) return res.redirect('/dashboard?error=google_failed');
      const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }).then((r) => r.json());
      req.session.google = { id: info.id, email: info.email, name: info.name, picture: info.picture, verified: info.verified_email };
      console.log(`[login] 🔵 Google: ${info.name} <${info.email}> · verified ${info.verified_email} · ip ${req.ip}`);
      res.redirect('/dashboard?google=ok');
    } catch (err) {
      console.error('Google OAuth error:', err.message);
      res.redirect('/dashboard?error=google_failed');
    }
  });

  // ---------- i18n ----------
  app.get('/api/i18n', (req, res) => {
    const lang = LOCALES[req.query.lang] ? req.query.lang : DEFAULT_LOCALE;
    res.json({ lang, languages: LANG_LIST, strings: LOCALES[lang] });
  });

  // ---------- public info ----------
  app.get('/api/me', (req, res) => res.json({
    user: req.session.user || null,
    google: req.session.google || null,
    owner: isOwner(req),
    oauthEnabled, googleEnabled, clientId: CLIENT_ID || null,
  }));

  app.get('/api/stats', (req, res) => {
    res.json({
      guilds: client?.guilds?.cache.size ?? 0,
      users: client?.users?.cache.size ?? 0,
      ping: Math.round(client?.ws?.ping ?? 0),
      uptime: client?.uptime ?? 0,
      botName: client?.user?.username ?? 'Bot',
      botTag: client?.user?.tag ?? '',
      botId: client?.user?.id ?? null,
      botAvatar: client?.user?.displayAvatarURL?.({ size: 128 }) ?? null,
    });
  });

  app.get('/api/leaderboard', (req, res) => {
    const rows = leaderboard(15).map((r) => ({
      id: r.id,
      total: r.total,
      name: client?.users?.cache.get(r.id)?.username || `User ${r.id.slice(-4)}`,
    }));
    res.json(rows);
  });

  app.get('/api/shop', (req, res) => res.json(getShopItems()));

  // Public weather proxy (uses the server's OpenWeather key).
  app.get('/api/weather', async (req, res) => {
    const q = req.query.q;
    const units = req.query.units === 'imperial' ? 'imperial' : 'metric';
    if (!q) return res.status(400).json({ error: 'Provide a location (?q=).' });
    const r = await getWeather(String(q), units);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json(r.data);
  });

  // ---------- Cloudflare Turnstile (bot check) ----------
  const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY;
  const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
  const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);

  // Public: the frontend asks whether the bot check is on and gets the public site key.
  app.get('/api/turnstile', (req, res) => res.json({ enabled: turnstileEnabled, siteKey: TURNSTILE_SITE_KEY || null }));

  // ---------- our own human check (emoji tap) — the default landing gate ----------
  const HC_EMOJIS = ['🎮', '🎯', '🚀', '🍕', '🐶', '🌟', '🎸', '⚽', '🎨', '🔥', '🍎', '🦊', '🌈', '🎧', '🏀', '🍩', '🐱', '🌵', '🍔', '🎲'];
  app.get('/api/humancheck', (req, res) => {
    if (!appGet('humanCheck', true)) return res.json({ enabled: false });
    const pool = [...HC_EMOJIS].sort(() => Math.random() - 0.5).slice(0, 6);
    const target = pool[Math.floor(Math.random() * pool.length)];
    req.session.hcTarget = target;
    res.json({ enabled: true, target, options: pool });
  });
  app.post('/api/humancheck', (req, res) => {
    if (!appGet('humanCheck', true)) { req.session.human = true; return res.json({ success: true }); }
    if (req.body?.answer && req.body.answer === req.session.hcTarget) {
      req.session.human = true; delete req.session.hcTarget;
      return res.json({ success: true });
    }
    res.json({ success: false });
  });

  // ---------- owner-only site settings (toggle the bot check) ----------
  app.get('/api/site-config', requireOwner, (req, res) => res.json({ humanCheck: appGet('humanCheck', true) }));
  app.post('/api/site-config', requireOwner, (req, res) => {
    if (typeof req.body?.humanCheck === 'boolean') appSet('humanCheck', req.body.humanCheck);
    console.log(`[dashboard] site bot-check set to ${appGet('humanCheck', true)}`);
    res.json({ ok: true, humanCheck: appGet('humanCheck', true) });
  });

  // Verify a Turnstile token server-side with Cloudflare's siteverify API.
  app.post('/api/verify-turnstile', async (req, res) => {
    if (!turnstileEnabled) return res.json({ success: true, skipped: true });
    const token = req.body?.token;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: String(token), remoteip: req.ip || '' }),
      });
      const data = await r.json();
      if (data.success) { req.session.human = true; return res.json({ success: true }); }
      res.json({ success: false, errors: data['error-codes'] || [] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public command reference — grouped by category from the live command registry.
  app.get('/api/commands', (req, res) => {
    const byCat = {};
    const cmds = client?.commands;
    if (cmds) {
      for (const [name, mod] of cmds) {
        const cat = mod.category || 'other';
        (byCat[cat] ??= []).push({ name, description: mod.data?.description || '' });
      }
    }
    const out = Object.entries(byCat)
      .map(([category, commands]) => ({ category, commands: commands.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.category.localeCompare(b.category));
    res.json({ total: cmds?.size ?? 0, categories: out });
  });

  // ---------- guild management ----------
  app.get('/api/guilds', requireAuth, (req, res) => {
    const botGuilds = new Set(client?.guilds?.cache.map((g) => g.id) || []);
    const manageable = (req.session.guilds || [])
      .filter((g) => canManage(req, g.id))
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon, botIn: botGuilds.has(g.id) }));
    res.json(manageable);
  });

  app.get('/api/guild/:id', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const g = getGuild(req.params.id);
    res.json({ ...g, xp: xpLeaderboard(req.params.id, 10).map((r) => ({ ...r, name: client?.users?.cache.get(r.id)?.username || r.id })) });
  });

  app.post('/api/guild/:id/module', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { name, enabled } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing module name' });
    const g = setModule(req.params.id, name, Boolean(enabled));
    console.log(`[dashboard] ${req.session.user.username} set ${name}=${enabled} in guild ${req.params.id}`);
    res.json(g);
  });

  app.post('/api/guild/:id/language', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const g = getGuild(req.params.id);
    g.language = LOCALES[req.body?.language] ? req.body.language : DEFAULT_LOCALE;
    saveGuild(g);
    res.json(g);
  });

  app.post('/api/guild/:id/autorole', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const g = getGuild(req.params.id);
    const { level, roleId } = req.body || {};
    g.settings.autoroles = g.settings.autoroles || {};
    if (roleId) g.settings.autoroles[String(level)] = roleId;
    else delete g.settings.autoroles[String(level)];
    saveGuild(g);
    res.json(g);
  });

  // ---------- owner-only economy editor ----------
  app.get('/api/economy/:userId', requireAuth, (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    const u = getUser(req.params.userId);
    res.json({ ...balance(req.params.userId), inventory: u.inventory, wins: u.wins, losses: u.losses });
  });

  app.post('/api/economy/:userId', requireAuth, (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    const { wallet } = req.body || {};
    if (typeof wallet === 'number') setWallet(req.params.userId, wallet);
    console.log(`[dashboard] ${req.session.user.username} set ${req.params.userId} wallet=${wallet}`);
    res.json(balance(req.params.userId));
  });

  app.post('/api/shop', requireAuth, (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    const { id, name, price, description, category, rarity } = req.body || {};
    if (!id || !name || !price) return res.status(400).json({ error: 'id, name, price required' });
    const r = addShopItem({ id, name, price: Number(price), description, category, rarity, custom: true, addedBy: req.session.user.id });
    res.status(r.ok ? 200 : 400).json(r);
  });

  // ---------- live logs / transactions ----------
  app.get('/api/logs', requireAuth, (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    res.json(getLogsAfter(Number(req.query.after) || 0));
  });

  app.get('/api/transactions', requireAuth, (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Owner only' });
    const rows = txStmt.all(Number(req.query.limit) || 25);
    res.json(rows);
  });

  // ---------- ticket studio (dashboard mirror of /setup ▸ Tickets) ----------
  app.get('/api/guild/:id/tickets', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(getCfg(req.params.id).settings.tickets);
  });

  app.post('/api/guild/:id/tickets', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const current = getCfg(req.params.id).settings.tickets;
    let changed = 0;
    for (const [k, v] of Object.entries(req.body || {})) {
      if (k in current) { setNested(req.params.id, 'tickets', k, v); changed++; }
    }
    res.json({ ok: true, changed, tickets: getCfg(req.params.id).settings.tickets });
  });

  // ---------- guild channels / roles (for pickers + composer) ----------
  app.get('/api/guild/:id/channels', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.json([]);
    const chans = [...guild.channels.cache.values()]
      .filter((c) => c.isTextBased?.() && !c.isThread?.())
      .map((c) => ({ id: c.id, name: c.name, type: c.type }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(chans);
  });

  app.get('/api/guild/:id/roles', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.json([]);
    const roles = [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(roles);
  });

  // ---------- announcement composer (bot posts an embed to a channel) ----------
  app.post('/api/guild/:id/announce', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that guild' });
    const { channelId, title, description, color, image, footer, content, useEmbed = true } = req.body || {};
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased?.()) return res.status(400).json({ error: 'Pick a valid text channel' });
    if (!channel.permissionsFor?.(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
      return res.status(403).json({ error: `I can't send messages in #${channel.name}. Grant me Send Messages there.` });
    }
    try {
      const payload = {};
      if (content) payload.content = String(content).slice(0, 2000);
      if (useEmbed !== false && (title || description || image)) {
        const embed = new EmbedBuilder();
        if (title) embed.setTitle(String(title).slice(0, 256));
        if (description) embed.setDescription(String(description).slice(0, 4096));
        if (footer) embed.setFooter({ text: String(footer).slice(0, 2048) });
        const hex = /^#?[0-9a-fA-F]{6}$/.test(String(color || '')) ? parseInt(String(color).replace('#', ''), 16) : 0x5865f2;
        embed.setColor(hex);
        if (/^https?:\/\/\S+$/i.test(String(image || ''))) embed.setImage(image);
        payload.embeds = [embed];
      }
      if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'Nothing to send — add text or an embed.' });
      const msg = await channel.send(payload);
      console.log(`[dashboard] ${req.session.user.username} announced in ${guild.name} #${channel.name}`);
      res.json({ ok: true, url: msg.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- warnings / infractions browser ----------
  app.get('/api/guild/:id/warnings', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const q = (req.query.q || '').toString().trim();
    const rows = q ? infUserStmt.all(req.params.id, `%${q}%`, 100) : infStmt.all(req.params.id, 100);
    res.json(rows.map((r) => ({
      id: r.id, user_id: r.user_id, type: r.type, reason: r.reason,
      created_at: r.created_at * 1000,
      userName: client?.users?.cache.get(r.user_id)?.username || null,
      modName: client?.users?.cache.get(r.moderator_id)?.username || null,
    })));
  });

  // ---------- analytics (daily joins / leaves / messages) ----------
  app.get('/api/guild/:id/analytics', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 60);
    res.json({ days, series: analyticsSeries(req.params.id, days), totals: analyticsTotals(req.params.id) });
  });

  // ---------- giveaways ----------
  app.get('/api/guild/:id/giveaways', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(listGiveaways(req.params.id));
  });
  app.post('/api/guild/:id/giveaways', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { channelId, prize, minutes, winners } = req.body || {};
    if (!channelId || !prize) return res.status(400).json({ error: 'Channel and prize are required.' });
    try {
      const r = await createGiveawayWeb(client, {
        guildId: req.params.id, channelId, prize: String(prize).slice(0, 200),
        durationMs: Math.max(1, Number(minutes) || 60) * 60_000,
        winners: Math.max(1, Number(winners) || 1), hostId: req.session.user.id,
      });
      res.json({ ok: true, ...r });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/guild/:id/giveaways/:gid/end', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    try { await endGiveaway(client, Number(req.params.gid)); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/guild/:id/giveaways/:gid/reroll', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    try { const w = await rerollGiveaway(client, Number(req.params.gid)); res.json({ ok: true, winners: w || [] }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // ---------- reaction roles ----------
  app.get('/api/guild/:id/reactionroles', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    const rows = listGuildReactionRoles(req.params.id).map((r) => ({
      ...r,
      roleName: guild?.roles?.cache.get(r.role_id)?.name || r.role_id,
    }));
    res.json(rows);
  });
  app.post('/api/guild/:id/reactionroles', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { channelId, messageId, emoji, roleId } = req.body || {};
    if (!channelId || !messageId || !emoji || !roleId) return res.status(400).json({ error: 'All fields are required.' });
    try { await addReactionRoleWeb(client, { guildId: req.params.id, channelId, messageId, emoji, roleId }); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/guild/:id/reactionroles/remove', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { messageId, emoji } = req.body || {};
    if (!messageId || !emoji) return res.status(400).json({ error: 'messageId and emoji required.' });
    removeReactionRole(messageId, emoji);
    res.json({ ok: true });
  });

  // ---------- automod rules editor ----------
  app.get('/api/guild/:id/automod', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(getCfg(req.params.id).settings.automod);
  });
  app.post('/api/guild/:id/automod', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const current = getCfg(req.params.id).settings.automod;
    let changed = 0;
    for (const [k, v] of Object.entries(req.body || {})) {
      if (k in current) {
        const val = k === 'maxMentions' ? Math.max(0, parseInt(v, 10) || 0) : v;
        setNested(req.params.id, 'automod', k, val);
        changed++;
      }
    }
    res.json({ ok: true, changed, automod: getCfg(req.params.id).settings.automod });
  });

  // ---------- ER:LC key (dual-guarded, never returned to the client) ----------
  app.get('/api/guild/:id/erlckey', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const s = getCfg(req.params.id).settings;
    // Only ever report whether a key is set + that it's encrypted — never the value.
    res.json({ set: Boolean(s.erlcKeyEnc || s.erlcKey), encrypted: Boolean(s.erlcKeyEnc) });
  });
  app.post('/api/guild/:id/erlckey', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const key = String(req.body?.key || '').trim();
    if (!key) {
      setSetting(req.params.id, 'erlcKeyEnc', null);
      setSetting(req.params.id, 'erlcKey', null);
      return res.json({ ok: true, set: false });
    }
    const blob = encryptSecret(key);
    // Sanity: confirm it round-trips before saving (a third safety check).
    if (decryptSecret(blob) !== key) return res.status(500).json({ error: 'Encryption self-check failed.' });
    setSetting(req.params.id, 'erlcKeyEnc', blob);
    setSetting(req.params.id, 'erlcKey', null); // wipe any legacy plaintext
    console.log(`[dashboard] ${req.session.user.username} set an encrypted ER:LC key for ${req.params.id}`);
    res.json({ ok: true, set: true, encrypted: true });
  });

  // ---------- command usage (flight recorder) ----------
  app.get('/api/usage', requireOwner, (req, res) => {
    const recent = recentCommands(20).map((r) => ({ ...r, userName: client?.users?.cache.get(r.user_id)?.username || null }));
    res.json({
      total: totalCommands(),
      last24h: commandsSince(86400),
      bySource: bySource(),
      top: topCommands(15),
      recent,
    });
  });

  // ---------- per-server bot profile (avatar + banner, this guild only) ----------
  app.post('/api/guild/:id/bot-avatar', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that guild' });
    try { await setGuildAvatar(guild, req.body?.url || null); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/guild/:id/bot-banner', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that guild' });
    try { await setGuildBanner(guild, req.body?.url || null); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // ---------- settings export / import ----------
  app.get('/api/guild/:id/export', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const g = getGuild(req.params.id);
    res.json({ exportedAt: Date.now(), guildId: req.params.id, language: g.language, modules: g.modules, settings: g.settings });
  });
  app.post('/api/guild/:id/import', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const data = req.body || {};
    const g = getGuild(req.params.id);
    if (data.language && LOCALES[data.language]) g.language = data.language;
    if (data.modules && typeof data.modules === 'object') g.modules = data.modules;
    if (data.settings && typeof data.settings === 'object') g.settings = data.settings;
    saveGuild(g);
    console.log(`[dashboard] ${req.session.user.username} imported settings for ${req.params.id}`);
    res.json({ ok: true });
  });

  // ---------- welcome-card preview (renders a sample card as PNG) ----------
  app.get('/api/guild/:id/welcome-preview', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    const u = req.session.user;
    try {
      const card = await renderMemberCard({
        username: u?.username || 'NewMember',
        avatarURL: u?.avatar || null,
        guildName: guild?.name || 'Your Server',
        memberCount: guild?.memberCount || 1,
        type: 'welcome',
      });
      res.set('Content-Type', 'image/png').send(card.attachment);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------- multi-tenant community pages + verification + super-admin ----------
  registerCommunity(app, client);

  // ---------- pretty page routes ----------
  const page = (file) => (req, res) => res.sendFile(join(__dirname, 'public', file));
  app.get('/dashboard', page('dashboard.html'));
  app.get('/privacy', page('privacy.html'));
  app.get('/terms', page('terms.html'));
  app.get('/commands', page('commands.html'));
  app.get('/status', page('status.html'));
  app.get('/docs', page('docs.html'));
  app.get('/changelog', page('changelog.html'));
  app.get('/maintenance', page('maintenance.html')); // owner preview
  app.get('/banned', page('banned.html'));            // owner preview

  // ---------- static frontend (index.html = landing page) ----------
  app.use(express.static(join(__dirname, 'public')));

  // ---------- 404 for anything unmatched ----------
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.status(404).sendFile(join(__dirname, 'public', '404.html'));
  });

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`🌐 Dashboard on http://localhost:${PORT}  (OAuth2 ${oauthEnabled ? 'enabled' : 'NOT configured — set OAUTH_CLIENT_SECRET'})`);
      resolve(server);
    });
  });
}
