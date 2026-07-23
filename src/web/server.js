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
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import {
  balance, setWallet, getUser, leaderboard, getShopItems, getItem, addShopItem,
} from '../economy/store.js';
import { getDb } from '../db/index.js';
import { getGuild, saveGuild, setModule } from '../systems/guilds.js';
import { getCfg, setNested } from '../setup/store.js';
import { renderPanel } from '../setup/ui.js';
import { leaderboard as xpLeaderboard } from '../systems/leveling.js';
import { series as analyticsSeries, totals as analyticsTotals } from '../systems/analytics.js';
import { listGiveaways, createGiveawayWeb, endGiveaway, reroll as rerollGiveaway } from '../features/giveaways.js';
import { listGuildReactionRoles, addReactionRoleWeb, removeReactionRole } from '../features/reactionRoles.js';
import { renderMemberCard } from '../render/cards.js';
import { getWeather } from '../features/weather.js';
import { setGuildAvatar, setGuildBanner } from '../features/botProfile.js';
import { listBundledEmojis, bundledEmojiPath, addEmojiToGuild, EMOJI_DIR } from '../features/emojis.js';
import { AUDIO_DIR, listAudio } from '../features/audio.js';
import { startVerification, pendingCode, previewRoblox, completeVerification } from '../features/verification.js';
import { applyAction, listRanks, saveRanks, staffLog } from '../features/staff.js';
import { applyInfraction, parseDuration } from '../systems/infractions.js';
import { deleteInfraction, getInfraction } from '../systems/automod.js';
import { buildMessageComponents, buildPagesMessage } from '../features/components.js';
import { listAutomations, createAutomation, deleteAutomation, setAutomationEnabled, listPending, approveAutomation, denyAutomation, validateAutomation } from '../features/automations.js';
import { planAutomationAI } from '../ai/gemini.js';
import { getCommunity, updateCommunity, getCommunityByCustomId } from '../community/store.js';
import { encryptSecret, decryptSecret } from '../systems/secureStore.js';
import { topCommands, recentCommands, totalCommands, commandsSince, bySource } from '../systems/usage.js';
import { getLogsAfter } from './logbus.js';
import { aiIsBadword } from '../ai/gemini.js';
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
    const { channelId, title, description, color, image, footer, content, useEmbed = true, components, pages } = req.body || {};
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased?.()) return res.status(400).json({ error: 'Pick a valid text channel' });
    if (!channel.permissionsFor?.(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
      return res.status(403).json({ error: `I can't send messages in #${channel.name}. Grant me Send Messages there.` });
    }
    try {
      const payload = {};
      if (content) payload.content = String(content).slice(0, 2000);
      // Paginated panel (≥2 pages) takes over the embed + adds ◀▶ nav.
      const paged = Array.isArray(pages) && pages.length >= 2 ? buildPagesMessage(req.params.id, pages) : null;
      if (paged) { payload.embeds = paged.embeds; payload.components = paged.components; }
      if (!paged && useEmbed !== false && (title || description || image)) {
        const embed = new EmbedBuilder();
        if (title) embed.setTitle(String(title).slice(0, 256));
        if (description) embed.setDescription(String(description).slice(0, 4096));
        if (footer) embed.setFooter({ text: String(footer).slice(0, 2048) });
        const hex = /^#?[0-9a-fA-F]{6}$/.test(String(color || '')) ? parseInt(String(color).replace('#', ''), 16) : 0x5865f2;
        embed.setColor(hex);
        if (/^https?:\/\/\S+$/i.test(String(image || ''))) embed.setImage(image);
        payload.embeds = [embed];
      }
      if (Array.isArray(components) && components.length) {
        try {
          const rows = buildMessageComponents(req.params.id, components);
          if (rows.length) payload.components = [...(payload.components || []), ...rows].slice(0, 5);
        } catch (e) { return res.status(400).json({ error: 'Bad components: ' + e.message }); }
      }
      if (!payload.content && !payload.embeds && !payload.components) return res.status(400).json({ error: 'Nothing to send — add text, an embed, or components.' });
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
      expires_at: r.expires_at ? r.expires_at * 1000 : null,
      userName: client?.users?.cache.get(r.user_id)?.username || null,
      modName: client?.users?.cache.get(r.moderator_id)?.username || null,
    })));
  });

  // Add an infraction from the dashboard — mirrors the /infraction add command.
  app.post('/api/guild/:id/infractions', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { userId, action, reason, duration, notes } = req.body || {};
    if (!userId || !action) return res.status(400).json({ error: 'A member and an action are required.' });
    if (!['warn', 'mute', 'kick', 'ban'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });
    const durationMs = (action === 'mute' || action === 'ban') ? parseDuration(duration) : null;
    const result = await applyInfraction(client, {
      guildId: req.params.id,
      targetId: String(userId).replace(/[^0-9]/g, ''),
      moderatorId: req.session.user.id,
      action,
      reason,
      durationMs,
      notes,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    console.log(`[dashboard] ${req.session.user.username} added ${action} (case #${result.caseId}) in guild ${req.params.id}`);
    res.json({ ok: true, ...result });
  });

  // Delete a single case by ID — mirrors /infraction remove.
  app.post('/api/guild/:id/infractions/:caseId/delete', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const caseId = Number(req.params.caseId);
    if (!getInfraction(req.params.id, caseId)) return res.status(404).json({ error: `No case #${caseId} in this server.` });
    deleteInfraction(req.params.id, caseId);
    console.log(`[dashboard] ${req.session.user.username} deleted case #${caseId} in guild ${req.params.id}`);
    res.json({ ok: true, deleted: caseId });
  });

  // ---------- automations (When → Do rules) ----------
  app.get('/api/guild/:id/automations', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(listAutomations(req.params.id));
  });
  app.post('/api/guild/:id/automations', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { name, trigger, actions, scope } = req.body || {};
    const r = createAutomation(req.params.id, { name, trigger, actions, scope, submittedBy: req.session.user.id });
    if (!r.ok) return res.status(400).json({ error: r.error });
    console.log(`[dashboard] ${req.session.user.username} created ${scope === 'global' ? 'GLOBAL (pending)' : 'automation'} #${r.id} in guild ${req.params.id}`);
    res.json(r);
  });

  // Owner approval queue for global automations.
  app.get('/api/automations/pending', requireOwner, (req, res) => {
    res.json(listPending().map((a) => ({ ...a, guildName: client?.guilds?.cache.get(a.guild_id)?.name || a.guild_id, byName: client?.users?.cache.get(a.submitted_by)?.username || a.submitted_by })));
  });
  app.post('/api/automations/:aid/approve', requireOwner, (req, res) => {
    const ok = approveAutomation(req.params.aid);
    console.log(`[owner] approved global automation #${req.params.aid}`);
    res.json({ ok });
  });
  app.post('/api/automations/:aid/deny', requireOwner, (req, res) => {
    res.json({ ok: denyAutomation(req.params.aid) });
  });
  app.post('/api/guild/:id/automations/:aid/delete', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json({ ok: deleteAutomation(req.params.id, req.params.aid) });
  });
  app.post('/api/guild/:id/automations/:aid/toggle', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    setAutomationEnabled(req.params.id, req.params.aid, Boolean(req.body?.enabled));
    res.json({ ok: true });
  });

  // AI Builder — describe it, the AI drafts a SAFE automation (whitelisted blocks
  // only), we validate it (the "checker"), then return it to build on the canvas.
  app.post('/api/guild/:id/ai-build', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Describe what you want the automation to do.' });
    const r = await planAutomationAI(prompt);
    if (!r.ok) return res.status(400).json({ error: r.error });
    const v = validateAutomation(r.spec?.trigger, r.spec?.actions);
    if (!v.ok) return res.status(400).json({ error: 'The AI draft failed the safety check: ' + v.error });
    res.json({ ok: true, spec: r.spec });
  });

  // ---------- community page editor (user-built page at /c/<slug>, owner-approved) ----------
  app.get('/api/guild/:id/community', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(getCommunity(req.params.id));
  });
  app.post('/api/guild/:id/community', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const b = req.body || {};
    const slug = String(b.customSubdomainOrId || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
    if (slug && slug.length < 3) return res.status(400).json({ error: 'The page URL must be at least 3 characters (letters, numbers, dashes).' });
    // Slug uniqueness — can't steal another server's page URL.
    if (slug) {
      const owner = getCommunityByCustomId(slug);
      if (owner && owner.guildId !== req.params.id) return res.status(400).json({ error: `The URL /c/${slug} is already taken.` });
    }
    const hex = /^#?[0-9a-fA-F]{6}$/.test(String(b.themeColor || '')) ? (b.themeColor.startsWith('#') ? b.themeColor : '#' + b.themeColor) : '#5865f2';
    // Drag-in page widgets (login buttons, links, text). Sanitized — only known
    // types + string config, never raw HTML.
    const ALLOWED_WIDGETS = new Set(['google_login', 'discord_login', 'invite', 'button', 'text', 'stats']);
    const widgets = Array.isArray(b.widgets) ? b.widgets.slice(0, 20)
      .map((w) => ({ type: String(w?.type || ''), title: String(w?.title || '').slice(0, 60), config: { label: String(w?.config?.label || '').slice(0, 80), url: String(w?.config?.url || '').slice(0, 300), text: String(w?.config?.text || '').slice(0, 1000) } }))
      .filter((w) => ALLOWED_WIDGETS.has(w.type)) : [];
    // Any edit re-enters the approval queue — you approve everything on your domain.
    const saved = updateCommunity(req.params.id, {
      customSubdomainOrId: slug || req.params.id,
      communityName: String(b.communityName || 'My Community').slice(0, 60),
      themeColor: hex,
      homePageMarkdown: String(b.homePageMarkdown || '').slice(0, 5000),
      verificationRequired: Boolean(b.verificationRequired),
      widgets,
      isApproved: false,
    });
    console.log(`[dashboard] ${req.session.user.username} submitted community page /c/${saved.customSubdomainOrId} (guild ${req.params.id}) for approval`);
    res.json({ ok: true, community: saved, publicUrl: `/c/${saved.customSubdomainOrId}` });
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

  // ---------- custom emojis ----------
  app.use('/emojis', express.static(EMOJI_DIR)); // serve the bundled PNGs for previews
  app.get('/api/emojis', (req, res) => res.json(listBundledEmojis()));
  app.post('/api/guild/:id/emoji', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const guild = client?.guilds?.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot is not in that guild' });
    const { preset, url, name } = req.body || {};
    const source = preset ? bundledEmojiPath(preset) : url;
    if (!source) return res.status(400).json({ error: 'Pick a preset or provide an image URL.' });
    try {
      const e = await addEmojiToGuild(guild, name || preset || 'emoji', source);
      res.json({ ok: true, name: e.name, id: e.id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------- Roblox verification: admin config (Manage Guild) ----------
  app.get('/api/guild/:id/verify', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(getCfg(req.params.id).settings.verify);
  });
  app.post('/api/guild/:id/verify', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { verifiedRoleId, unverifiedRoleId, nickname } = req.body || {};
    setNested(req.params.id, 'verify', 'verifiedRoleId', verifiedRoleId || '');
    setNested(req.params.id, 'verify', 'unverifiedRoleId', unverifiedRoleId || '');
    setNested(req.params.id, 'verify', 'nickname', Boolean(nickname));
    res.json(getCfg(req.params.id).settings.verify);
  });

  // ---------- Roblox verification: member self-serve flow (login required) ----------
  // Guilds the logged-in user shares with the bot that have verification set up.
  app.get('/api/verify/options', requireAuth, (req, res) => {
    const botGuilds = new Set(client?.guilds?.cache.map((g) => g.id) || []);
    const mine = (req.session.guilds || []).filter((g) => botGuilds.has(g.id));
    const out = mine
      .map((g) => ({ g, v: getCfg(g.id).settings.verify }))
      .filter(({ v }) => v && (v.verifiedRoleId || v.unverifiedRoleId))
      .map(({ g }) => ({ id: g.id, name: g.name }));
    res.json(out);
  });
  app.post('/api/verify/start', requireAuth, (req, res) => {
    const guildId = req.body?.guildId;
    if (!guildId) return res.status(400).json({ error: 'Missing guild' });
    const code = startVerification(guildId, req.session.user.id);
    res.json({ code });
  });
  app.get('/api/verify/code', requireAuth, (req, res) => {
    res.json({ code: pendingCode(req.query.g, req.session.user.id) });
  });
  app.post('/api/verify/preview', requireAuth, async (req, res) => {
    const p = await previewRoblox(String(req.body?.username || '').trim());
    if (!p) return res.status(404).json({ error: 'Roblox user not found.' });
    res.json(p);
  });
  app.post('/api/verify/complete', requireAuth, async (req, res) => {
    const { guildId, username } = req.body || {};
    if (!guildId || !username) return res.status(400).json({ error: 'Missing guild or username' });
    const r = await completeVerification(client, guildId, req.session.user.id, String(username).trim());
    res.status(r.ok ? 200 : 400).json(r);
  });

  // ---------- staff manager: promotion / infraction / role actions ----------
  app.get('/api/guild/:id/ranks', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    res.json(listRanks(req.params.id));
  });
  app.post('/api/guild/:id/ranks', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const ranks = Array.isArray(req.body?.ranks)
      ? req.body.ranks.filter((r) => r && r.roleId).map((r, i) => ({ id: r.id || `r${i}`, name: String(r.name || `Rank ${i + 1}`).slice(0, 40), roleId: r.roleId }))
      : [];
    res.json(saveRanks(req.params.id, ranks));
  });
  app.post('/api/guild/:id/staff-action', requireAuth, async (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const { targetId, action, roleId } = req.body || {};
    if (!targetId || !action) return res.status(400).json({ error: 'Missing target or action' });
    const r = await applyAction(client, { guildId: req.params.id, targetId, action, roleId, moderatorId: req.session.user.id, reason: req.body?.reason });
    res.status(r.ok ? 200 : 400).json(r);
  });
  app.get('/api/guild/:id/staff-log', requireAuth, (req, res) => {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'No permission' });
    const rows = staffLog(req.params.id, 30).map((r) => ({ ...r, targetName: client?.users?.cache.get(r.target_id)?.username || r.target_id, modName: client?.users?.cache.get(r.moderator_id)?.username || null }));
    res.json(rows);
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

  // ================= OWNER DIAGNOSTICS CENTER =================
  // Access = owner (ID/email) OR anyone on the owner-managed allowlist. All data
  // here is sensitive, so every endpoint is gated. The command runner is a strict
  // WHITELIST — there is deliberately no arbitrary shell/eval.
  const bootTime = Date.now();
  const fmtDur = (s) => {
    s = Math.max(0, s | 0);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return [d && d + 'd', h && h + 'h', m && m + 'm', sec + 's'].filter(Boolean).join(' ') || '0s';
  };
  const diagAccess = () => {
    const a = appGet('diagnosticsAccess', {}) || {};
    return {
      ids: Array.isArray(a.ids) ? a.ids : [],
      emails: (Array.isArray(a.emails) ? a.emails : []).map((e) => String(e).toLowerCase()),
    };
  };
  const isDiag = (req) =>
    isOwner(req) ||
    diagAccess().ids.includes(req.session.user?.id) ||
    (viewerEmail(req) && diagAccess().emails.includes(viewerEmail(req)));
  const requireDiag = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    if (!isDiag(req)) return res.status(403).json({ error: 'Diagnostics access denied' });
    next();
  };

  // Scan every guild's saved config for common "you forgot to set this up" mistakes.
  function guildConfigIssues() {
    const issues = [];
    for (const guild of client?.guilds?.cache?.values?.() || []) {
      let cfg;
      try { cfg = getCfg(guild.id); } catch { continue; }
      const s = cfg.settings || {};
      const has = (id) => id && guild.channels.cache.has(id);
      const t = s.tickets || {};
      if (t.enabled) {
        if (!t.categoryId) issues.push({ g: guild.name, level: 'fail', msg: 'Tickets are ON but no ticket category is set — new tickets will fail to open.', hint: 'Dashboard ▸ Tickets ▸ Ticket category.' });
        else if (!has(t.categoryId)) issues.push({ g: guild.name, level: 'fail', msg: 'Ticket category points to a channel that was deleted.', hint: 'Re-pick the category on Dashboard ▸ Tickets.' });
        if (!t.panelChannelId) issues.push({ g: guild.name, level: 'warn', msg: 'Ticket panel has never been deployed to a channel.', hint: 'Set a Panel channel on Dashboard ▸ Tickets and deploy it.' });
      }
      const am = s.automod || {};
      if (am.badwords && !am.logChannel) issues.push({ g: guild.name, level: 'warn', msg: 'Bad-word filter is ON but has no log channel — ban approvals post in the triggering channel.', hint: 'Run /badwords logchannel #mod-log.' });
      if (s.welcomeChannel && !has(s.welcomeChannel)) issues.push({ g: guild.name, level: 'warn', msg: 'Welcome channel was deleted.', hint: 'Pick a new welcome channel.' });
      if (s.logChannel && !has(s.logChannel)) issues.push({ g: guild.name, level: 'warn', msg: 'Log channel was deleted.', hint: 'Pick a new log channel.' });
    }
    return issues;
  }

  function healthReport() {
    const checks = [];
    const push = (status, label, detail, hint) => checks.push({ status, label, detail: detail || '', hint: hint || '' });
    const envHas = (k) => Boolean(process.env[k]);
    const ready = Boolean(client?.isReady?.());

    push(ready ? 'ok' : 'fail', 'Discord bot connection',
      ready ? `Online — ${client.guilds.cache.size} server(s), WS ping ${Math.round(client.ws.ping)}ms` : 'Bot is NOT connected to Discord.',
      ready ? '' : 'Check DISCORD_TOKEN and that the bot process is running.');
    push(envHas('DISCORD_TOKEN') ? 'ok' : 'fail', 'DISCORD_TOKEN', envHas('DISCORD_TOKEN') ? 'Present' : 'Missing', 'Set it in .env.');
    push(envHas('CLIENT_ID') ? 'ok' : 'fail', 'CLIENT_ID', envHas('CLIENT_ID') ? 'Present' : 'Missing', 'Set it in .env.');
    push(envHas('OAUTH_CLIENT_SECRET') ? 'ok' : 'warn', 'Discord OAuth (login)', envHas('OAUTH_CLIENT_SECRET') ? 'Configured' : 'Not configured — dashboard login is disabled', 'Set OAUTH_CLIENT_SECRET.');
    push(envHas('GEMINI_API_KEY') ? 'ok' : 'warn', 'Gemini AI', envHas('GEMINI_API_KEY') ? 'API key present' : 'No key — /ask and AI bad-word checks are off', 'Set GEMINI_API_KEY.');
    const sessOk = process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'change-me-please';
    push(sessOk ? 'ok' : 'warn', 'Session secret', sessOk ? 'Custom secret set' : 'Using the default insecure secret', 'Set SESSION_SECRET to a long random string.');
    push(envHas('PUBLIC_URL') ? 'ok' : 'warn', 'Public URL / tunnel', envHas('PUBLIC_URL') ? process.env.PUBLIC_URL : 'PUBLIC_URL not set — verify links may break', 'Set PUBLIC_URL to your tunnel/domain.');
    try { db.prepare('SELECT 1 AS ok').get(); push('ok', 'Database (SQLite)', 'Reachable — query succeeded.'); }
    catch (e) { push('fail', 'Database (SQLite)', 'Query failed: ' + e.message, 'Check the DB file and disk space.'); }

    const issues = guildConfigIssues();
    if (!issues.length) push('ok', 'Server configuration', `No configuration problems across ${client?.guilds?.cache?.size || 0} server(s).`);
    else for (const i of issues) push(i.level, `Config · ${i.g}`, i.msg, i.hint);

    const counts = checks.reduce((a, c) => (a[c.status]++, a), { ok: 0, warn: 0, fail: 0 });
    const mem = process.memoryUsage();
    return {
      summary: {
        botReady: ready,
        wsPing: ready ? Math.round(client.ws.ping) : null,
        guilds: client?.guilds?.cache?.size || 0,
        users: client?.users?.cache?.size || 0,
        memMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        uptimeS: Math.round(process.uptime()),
        webUptimeS: Math.round((Date.now() - bootTime) / 1000),
        node: process.version,
        now: Date.now(),
      },
      counts,
      checks,
    };
  }

  app.get('/api/diagnostics/health', requireDiag, (req, res) => res.json(healthReport()));
  app.get('/api/diagnostics/me', requireDiag, (req, res) => res.json({ id: req.session.user?.id, name: req.session.user?.username, email: viewerEmail(req) || null, owner: isOwner(req) }));

  // ---- deep live metrics (CPU %, memory, event-loop lag, gateway, handles) ----
  const eld = monitorEventLoopDelay({ resolution: 20 });
  eld.enable();
  let _cpuPrev = process.cpuUsage();
  let _cpuPrevT = Date.now();
  function metricsSnapshot() {
    const now = Date.now();
    const cu = process.cpuUsage(_cpuPrev);
    const elapsed = (now - _cpuPrevT) * 1000 || 1; // µs
    const cpuPct = Math.min(100, ((cu.user + cu.system) / elapsed) * 100);
    _cpuPrev = process.cpuUsage(); _cpuPrevT = now;
    const mem = process.memoryUsage();
    const lagMean = eld.mean / 1e6, lagMax = eld.max / 1e6; eld.reset();
    const ready = Boolean(client?.isReady?.());
    return {
      t: now,
      cpuPct: Math.round(cpuPct * 10) / 10,
      rssMB: Math.round(mem.rss / 1048576),
      heapMB: Math.round(mem.heapUsed / 1048576),
      heapTotalMB: Math.round(mem.heapTotal / 1048576),
      extMB: Math.round(mem.external / 1048576),
      loopLagMs: Math.round(lagMean * 100) / 100,
      loopMaxMs: Math.round(lagMax * 100) / 100,
      wsPing: ready ? Math.round(client.ws.ping) : null,
      guilds: client?.guilds?.cache?.size || 0,
      users: client?.users?.cache?.size || 0,
      channels: client?.channels?.cache?.size || 0,
      handles: (process._getActiveHandles?.() || []).length,
      requests: (process._getActiveRequests?.() || []).length,
      sysFreeMB: Math.round(os.freemem() / 1048576),
      sysTotalMB: Math.round(os.totalmem() / 1048576),
      load1: Math.round((os.loadavg?.()?.[0] || 0) * 100) / 100,
      uptimeS: Math.round(process.uptime()),
    };
  }
  app.get('/api/diagnostics/metrics', requireDiag, (req, res) => res.json(metricsSnapshot()));

  function dbTables() {
    try {
      return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => {
        let rows = 0; try { rows = db.prepare(`SELECT COUNT(*) c FROM "${r.name}"`).get().c; } catch { /* view or locked */ }
        return { name: r.name, rows };
      });
    } catch { return []; }
  }
  let _deps = {};
  try { _deps = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')).dependencies || {}; } catch { /* ignore */ }
  app.get('/api/diagnostics/system', requireDiag, (req, res) => {
    const ready = Boolean(client?.isReady?.());
    res.json({
      runtime: { node: process.version, v8: process.versions.v8, uv: process.versions.uv, pid: process.pid, cwd: process.cwd(), uptimeS: Math.round(process.uptime()) },
      os: { type: os.type(), release: os.release(), platform: process.platform, arch: process.arch, host: os.hostname(), cores: os.cpus().length, cpuModel: os.cpus()[0]?.model || '—', totalMemMB: Math.round(os.totalmem() / 1048576), freeMemMB: Math.round(os.freemem() / 1048576) },
      discord: { ready, tag: client?.user?.tag || null, ping: ready ? Math.round(client.ws.ping) : null, guilds: client?.guilds?.cache?.size || 0, channels: client?.channels?.cache?.size || 0, users: client?.users?.cache?.size || 0, readyAt: client?.readyTimestamp || null },
      db: dbTables(),
      deps: _deps,
    });
  });

  // ---- config inspector: mirror the dashboard's per-guild panels with health ----
  app.get('/api/diagnostics/guilds', requireDiag, (req, res) =>
    res.json([...(client?.guilds?.cache?.values?.() || [])].map((g) => ({ id: g.id, name: g.name, members: g.memberCount }))));
  app.get('/api/diagnostics/guild/:id/config', requireDiag, (req, res) => {
    const g = client?.guilds?.cache?.get(req.params.id);
    if (!g) return res.status(404).json({ error: 'Bot is not in that server' });
    let cfg; try { cfg = getCfg(req.params.id); } catch (e) { return res.status(500).json({ error: e.message }); }
    const s = cfg.settings || {};
    const has = (id) => Boolean(id && g.channels.cache.has(id));
    const t = s.tickets || {}, am = s.automod || {}, ec = s.economy || {};
    const panels = [
      { label: 'Modules', items: Object.entries(cfg.modules || {}).map(([k, v]) => ({ k, ok: v !== false, val: v !== false ? 'ON' : 'OFF' })) },
      { label: 'Welcome & Goodbye', items: [
        { k: 'Welcome channel', ok: !s.welcomeChannel || has(s.welcomeChannel), val: s.welcomeChannel ? (has(s.welcomeChannel) ? 'set' : 'DELETED') : 'none' },
        { k: 'Goodbye channel', ok: !s.goodbyeChannel || has(s.goodbyeChannel), val: s.goodbyeChannel ? (has(s.goodbyeChannel) ? 'set' : 'DELETED') : 'none' },
      ] },
      { label: 'Tickets', items: [
        { k: 'Enabled', ok: !!t.enabled, val: t.enabled ? 'ON' : 'OFF' },
        { k: 'Ticket category', ok: !t.enabled || has(t.categoryId), val: t.categoryId ? (has(t.categoryId) ? 'set' : 'DELETED') : 'MISSING' },
        { k: 'Panel deployed', ok: !t.enabled || !!t.panelChannelId, val: t.panelChannelId ? 'yes' : 'no' },
        { k: 'Category pings', ok: true, val: Object.keys(t.categoryRoles || {}).length + ' mapped' },
      ] },
      { label: 'Automod & Bad-words', items: [
        { k: 'Invite block', ok: true, val: am.invites ? 'ON' : 'off' },
        { k: 'Anti-spam', ok: true, val: am.spam ? 'ON' : 'off' },
        { k: 'Bad-word filter', ok: true, val: am.badwords ? 'ON' : 'off' },
        { k: 'Ban-approval log ch', ok: !am.badwords || has(am.logChannel), val: am.logChannel ? (has(am.logChannel) ? 'set' : 'DELETED') : 'none' },
      ] },
      { label: 'Logging', items: [
        { k: 'Log channel', ok: !s.logChannel || has(s.logChannel), val: s.logChannel ? (has(s.logChannel) ? 'set' : 'DELETED') : 'none' },
        { k: 'Level-up channel', ok: !s.levelUpChannel || has(s.levelUpChannel), val: s.levelUpChannel ? (has(s.levelUpChannel) ? 'set' : 'DELETED') : 'none' },
      ] },
      { label: 'Economy', items: [
        { k: 'Currency', ok: true, val: `${s.currencyEmoji || ''} ${s.currencyName || ''}`.trim() || '—' },
        { k: 'Start balance', ok: true, val: String(ec.startingBalance ?? '—') },
        { k: 'Daily', ok: true, val: String(ec.dailyAmount ?? '—') },
      ] },
    ];
    res.json({ id: g.id, name: g.name, language: cfg.language, panels, raw: { modules: cfg.modules, settings: s } });
  });

  app.get('/api/diagnostics/logs.txt', requireDiag, (req, res) => {
    const text = getLogsAfter(0).map((l) => `[${new Date(l.t).toISOString()}] ${String(l.level).toUpperCase().padEnd(5)} ${l.message}`).join('\n');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="sentinel-logs-${stamp}.txt"`);
    res.send(text || 'No logs buffered yet.');
  });

  // owner-only: manage who else can open the diagnostics console
  app.get('/api/diagnostics/access', requireOwner, (req, res) => res.json(diagAccess()));
  app.post('/api/diagnostics/access', requireOwner, (req, res) => {
    const b = req.body || {};
    const cur = diagAccess();
    const next = {
      ids: Array.isArray(b.ids) ? b.ids.map((x) => String(x).trim()).filter(Boolean) : cur.ids,
      emails: Array.isArray(b.emails) ? b.emails.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : cur.emails,
    };
    appSet('diagnosticsAccess', next);
    res.json(next);
  });

  // safe command runner — WHITELIST only, no shell/eval
  app.post('/api/diagnostics/run', requireDiag, async (req, res) => {
    const raw = String(req.body?.command || '').trim();
    const cmd = raw.toLowerCase();
    const arg = cmd.split(/\s+/)[1];
    const out = [];
    const line = (s = '') => out.push(s);
    try {
      if (cmd === '' ) line('Type a command. Try: help');
      else if (cmd === 'help') {
        line('COMMANDS');
        line('  help         this list');
        line('  status       bot + system snapshot');
        line('  health       run every health check');
        line('  guilds       servers the bot is in');
        line('  ping-db      test the database + timing');
        line('  test-gemini  call the Gemini AI and time it');
        line('  env          which env vars are set (names only)');
        line('  memory       memory usage');
        line('  uptime       process + web uptime');
        line('  tunnel       public URL / tunnel info');
        line('  logs [n]     last n log lines (default 20)');
        line('  cpu          process CPU % + load');
        line('  os           host operating system info');
        line('  loop-lag     event-loop latency (mean/max)');
        line('  handles      active libuv handles / requests');
        line('  db-tables    every DB table + row count');
        line('  versions     node/v8/libuv + dependency versions');
        line('  config <id>  inspect a server’s saved config');
        line('  diagnose     full health check (friendly name)');
        line('  online <id>  who is online in a server');
        line('  setupview <id> [chId]  post a READ-ONLY setup panel (DM or channel)');
        line('  whoami       your session identity');
        line('  clear        clear the console (local)');
      }
      else if (cmd === 'status') {
        const h = healthReport().summary;
        line(`bot: ${h.botReady ? 'ONLINE' : 'OFFLINE'}   ping: ${h.wsPing ?? '—'}ms   guilds: ${h.guilds}   users: ${h.users}`);
        line(`mem: ${h.memMB}MB rss / ${h.heapMB}MB heap   uptime: ${fmtDur(h.uptimeS)}   node: ${h.node}`);
      }
      else if (cmd === 'health') {
        const h = healthReport();
        line(`checks: ${h.counts.ok} ok · ${h.counts.warn} warn · ${h.counts.fail} fail`);
        for (const c of h.checks) line(`  [${c.status.toUpperCase().padEnd(4)}] ${c.label} — ${c.detail}`);
      }
      else if (cmd === 'guilds') {
        const gs = [...(client?.guilds?.cache?.values?.() || [])];
        if (!gs.length) line('  (none)');
        for (const g of gs) line(`  ${g.id}  ${g.name}  (${g.memberCount} members)`);
      }
      else if (cmd === 'ping-db') { const t0 = Date.now(); db.prepare('SELECT 1').get(); line(`database OK — ${Date.now() - t0}ms`); }
      else if (cmd === 'test-gemini') {
        if (!process.env.GEMINI_API_KEY) line('Gemini: no API key set (GEMINI_API_KEY).');
        else {
          const t0 = Date.now(); let ok = true;
          try { await aiIsBadword('hello world'); } catch (e) { ok = false; line('error: ' + e.message); }
          line(`Gemini pipeline responded in ${Date.now() - t0}ms ${ok ? 'OK' : 'FAILED'} (model ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`);
        }
      }
      else if (cmd === 'env') {
        const keys = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'GEMINI_API_KEY', 'SESSION_SECRET', 'PUBLIC_URL', 'WEB_PORT', 'DATABASE_URL', 'REDIS_URL', 'TURNSTILE_SECRET_KEY', 'ERLC_API_KEY'];
        for (const k of keys) line(`  ${process.env[k] ? '✓' : '·'} ${k}`);
      }
      else if (cmd === 'memory') {
        const m = process.memoryUsage();
        line(`rss ${Math.round(m.rss / 1048576)}MB   heapUsed ${Math.round(m.heapUsed / 1048576)}MB   heapTotal ${Math.round(m.heapTotal / 1048576)}MB   external ${Math.round(m.external / 1048576)}MB`);
      }
      else if (cmd === 'uptime') { line(`process uptime: ${fmtDur(Math.round(process.uptime()))}`); line(`web uptime:     ${fmtDur(Math.round((Date.now() - bootTime) / 1000))}`); }
      else if (cmd === 'tunnel') {
        line(`PUBLIC_URL:      ${process.env.PUBLIC_URL || '(not set)'}`);
        line(`OAUTH redirect:  ${process.env.OAUTH_REDIRECT_URI || '(default localhost)'}`);
        line('Note: quick tunnels change URL on every restart — remember to update the URL spots.');
      }
      else if (cmd === 'whoami') {
        line(`id:    ${req.session.user?.id}`);
        line(`name:  ${req.session.user?.username || '—'}`);
        line(`email: ${viewerEmail(req) || '—'}`);
        line(`owner: ${isOwner(req) ? 'yes' : 'no'}`);
      }
      else if (cmd.startsWith('logs')) {
        const n = Math.min(200, Math.max(1, Number(arg) || 20));
        const ls = getLogsAfter(0).slice(-n);
        if (!ls.length) line('(no logs buffered)');
        for (const l of ls) line(`[${new Date(l.t).toLocaleTimeString()}] ${String(l.level).toUpperCase()} ${l.message}`);
      }
      else if (cmd === 'cpu') { const m = metricsSnapshot(); line(`process CPU: ${m.cpuPct}%   load(1m): ${m.load1}   cores: ${os.cpus().length}`); line(`model: ${os.cpus()[0]?.model || '—'}`); }
      else if (cmd === 'os') { line(`${os.type()} ${os.release()}  (${process.platform}/${process.arch})`); line(`host: ${os.hostname()}   RAM used: ${Math.round((os.totalmem() - os.freemem()) / 1048576)} / ${Math.round(os.totalmem() / 1048576)} MB`); }
      else if (cmd === 'loop-lag') { const m = metricsSnapshot(); line(`event-loop lag — mean ${m.loopLagMs}ms   max ${m.loopMaxMs}ms  (lower is better)`); }
      else if (cmd === 'handles') { const m = metricsSnapshot(); line(`active handles: ${m.handles}   active requests: ${m.requests}`); }
      else if (cmd === 'db-tables') { const ts = dbTables(); if (!ts.length) line('(no tables)'); for (const t of ts) line(`  ${String(t.rows).padStart(9)}  ${t.name}`); }
      else if (cmd === 'versions') { line(`node ${process.version}   v8 ${process.versions.v8}   uv ${process.versions.uv}`); for (const [k, v] of Object.entries(_deps)) line(`  ${k} ${v}`); }
      else if (cmd.startsWith('config')) {
        if (!arg) { line('usage: config <guildId>   (run "guilds" for IDs)'); }
        else {
          const g = client?.guilds?.cache?.get(arg);
          if (!g) line('bot is not in that server.');
          else { const c = getCfg(arg); line(`${g.name}  ·  lang ${c.language}`); line(`modules on: ${Object.entries(c.modules || {}).filter(([, v]) => v !== false).map(([k]) => k).join(', ') || '(none)'}`); line(`tickets: ${c.settings.tickets?.enabled ? 'ON' : 'off'}   badwords: ${c.settings.automod?.badwords ? 'ON' : 'off'}`); }
        }
      }
      else if (cmd === 'diagnose') {
        // Full health report (alias of `health`, friendlier name).
        const h = healthReport();
        line(`🩺 Diagnosis — ${h.counts.ok} ok · ${h.counts.warn} warn · ${h.counts.fail} fail`);
        for (const c of h.checks) line(`  [${c.status.toUpperCase().padEnd(4)}] ${c.label} — ${c.detail}${c.hint ? '  ▸ ' + c.hint : ''}`);
      }
      else if (cmd.startsWith('online')) {
        const g = client?.guilds?.cache?.get(arg);
        if (!g) { line('usage: online <guildId>   (run "guilds" for IDs)'); }
        else {
          const on = [...g.members.cache.values()].filter((m) => m.presence && m.presence.status && m.presence.status !== 'offline' && !m.user.bot);
          if (!on.length) { line(`No online members detected in ${g.name}.`); line('(If this is always empty, enable the "Presence Intent" for the bot in the Discord Developer Portal.)'); }
          else {
            const dot = (s) => (s === 'dnd' ? '⛔' : s === 'idle' ? '🌙' : '🟢');
            line(`🟢 ${on.length} online in ${g.name}:`);
            for (const m of on.slice(0, 60)) line(`  ${dot(m.presence.status)} ${m.user.username}`);
          }
        }
      }
      else if (cmd.startsWith('setupview')) {
        const gid = arg;
        const chId = raw.split(/\s+/)[2];
        if (!gid) { line('usage: setupview <guildId> [channelId]   — posts a READ-ONLY config panel (no Manage Server needed).'); }
        else {
          try {
            const panel = renderPanel(client, gid, 0);
            if (chId) {
              const ch = client.channels.cache.get(chId);
              if (ch?.isTextBased?.()) { await ch.send({ embeds: panel.embeds }); line(`✅ Read-only setup panel posted to #${ch.name}.`); }
              else line('That channel id isn’t a text channel the bot can see.');
            } else {
              const owner = await client.users.fetch(req.session.user.id).catch(() => null);
              if (owner) { await owner.send({ embeds: panel.embeds }); line('✅ Read-only setup panel sent to your DMs.'); }
              else line('Couldn’t DM you — open your DMs and retry, or pass a channelId.');
            }
          } catch (e) { line('error: ' + e.message); }
        }
      }
      else line(`Unknown command: "${raw}". Type "help".`);
    } catch (e) {
      line('error: ' + e.message);
    }
    res.json({ command: raw, output: out.join('\n') });
  });

  // ---------- extracted-audio library (dashboard player) ----------
  app.get('/api/audio', (req, res) => res.json({ tracks: listAudio() }));
  app.use('/audio', express.static(AUDIO_DIR)); // serve the mp3s for offline playback

  // ---------- pretty page routes ----------
  const page = (file) => (req, res) => res.sendFile(join(__dirname, 'public', file));
  app.get('/audio-app', page('audio.html'));
  app.get('/diagnostics', page('diagnostics.html'));
  app.get('/dashboard', page('dashboard.html'));
  app.get('/verify', page('verify.html'));
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
