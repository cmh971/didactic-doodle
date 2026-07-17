/* =====================================================================
   Dashboard SPA — vanilla JS, no build step.
   View routing · theme engine · command palette · canvas charts ·
   animated counters · modals · shop · transactions · live logs.
   Every DOM lookup is guarded so a missing element never crashes the app.
   ===================================================================== */
'use strict';

const state = {
  me: null,
  lang: 'en',
  languages: [],
  strings: {},
  guild: null,
  logCursor: 0,
  view: 'overview',
  theme: localStorage.getItem('theme') || 'auto',
  pings: [],            // rolling ping history for the chart
  lastLeaderboard: [],  // cached for the bar chart + search
  logLines: [],         // cached raw log lines for filtering
  txTimer: null,
};

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) throw new Error((body && body.error) || res.statusText || 'Request failed');
  return body;
}

/* ---------------------------------------------------------------- toasts */
function toast(msg, type = 'info') {
  const root = $('toast-root') || document.body;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------------------------------------------------------------- confetti 🎉 */
function confetti(count = 90) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#5865f2', '#2ecc71', '#ffd23f', '#e74c3c', '#f97316', '#a855f7', '#00d3ff'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    p.style.animationDelay = (Math.random() * 0.25) + 's';
    if (Math.random() > 0.5) p.style.borderRadius = '50%';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4200);
  }
}

/* ------------------------------------------------------------ bot identity */
let botIdentityApplied = false;
function applyBotIdentity(s) {
  if (botIdentityApplied || !s || !s.botName) return;
  botIdentityApplied = true;
  const name = s.botName;
  if ($('title')) $('title').textContent = name + ' Dashboard';
  document.title = name + ' · Dashboard';
  if (s.botAvatar) {
    const logo = qs('.logo');
    if (logo) {
      logo.textContent = '';
      const img = document.createElement('img');
      img.src = s.botAvatar; img.alt = name;
      img.style.cssText = 'width:42px;height:42px;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.5);object-fit:cover';
      logo.appendChild(img);
    }
    let fav = document.querySelector('link[rel="icon"]');
    if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
    fav.href = s.botAvatar;
  }
}

/* ------------------------------------------------------------ activity feed */
function pushFeed(icon, text) {
  const feed = $('activity-feed');
  if (!feed) return;
  const empty = feed.querySelector('.feed-empty');
  if (empty) empty.remove();
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<span class="feed-ic" aria-hidden="true">${esc(icon)}</span><span>${esc(text)}</span><span class="feed-time">${esc(time)}</span>`;
  feed.prepend(li);
  while (feed.children.length > 25) feed.lastChild.remove();
}

/* ---------------------------------------------------------------- i18n */
function applyStrings() {
  document.documentElement.lang = state.lang;
  const rtl = state.languages.find((l) => l.code === state.lang)?.rtl;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  qsa('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = state.strings[key];
    if (!value) return;
    const badge = el.querySelector('.badge');
    el.textContent = value;
    if (badge) { el.appendChild(document.createTextNode(' ')); el.appendChild(badge); }
  });
}

async function loadI18n(lang) {
  const data = await api('/api/i18n?lang=' + encodeURIComponent(lang || state.lang));
  state.lang = data.lang;
  state.languages = data.languages || [];
  state.strings = data.strings || {};
  const sel = $('lang');
  if (sel && !sel.options.length) {
    for (const l of state.languages) {
      const o = document.createElement('option');
      o.value = l.code; o.textContent = l.name;
      sel.appendChild(o);
    }
  }
  if (sel) sel.value = state.lang;
  applyStrings();
}

/* ---------------------------------------------------------------- theme */
function resolveTheme(t) {
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme() {
  const resolved = resolveTheme(state.theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-pref', state.theme);
  qsa('[data-theme-value]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-value') === state.theme)));
  // redraw charts (colors are theme-dependent)
  drawPingChart(); drawLeaderboardChart();
}
function setTheme(t) {
  state.theme = t;
  localStorage.setItem('theme', t);
  applyTheme();
}
function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  setTheme(order[(order.indexOf(state.theme) + 1) % order.length]);
  toast('Theme: ' + state.theme, 'info');
}

/* ---------------------------------------------------------------- router */
const VIEWS = ['overview', 'servers', 'leaderboards', 'shop', 'notes', 'tickets', 'announce', 'analytics', 'members', 'giveaways', 'reactionroles', 'automod', 'owner', 'transactions', 'logs'];
function showView(name) {
  if (!VIEWS.includes(name)) name = 'overview';
  state.view = name;
  qsa('.view').forEach((v) => { v.hidden = v.getAttribute('data-view-id') !== name; });
  qsa('.nav-link').forEach((b) => {
    const active = b.getAttribute('data-view') === name;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  // lazy-load per-view data
  if (name === 'shop') loadShop();
  if (name === 'transactions') { loadTransactions(); startTxPolling(); } else stopTxPolling();
  if (name === 'leaderboards') drawLeaderboardChart();
  if (name === 'tickets') loadTickets();
  if (name === 'announce') loadAnnounce();
  if (name === 'analytics') loadAnalytics();
  if (name === 'members') loadWarnings();
  if (name === 'giveaways') loadGiveaways();
  if (name === 'reactionroles') loadReactionRoles();
  if (name === 'automod') loadAutomod();
  if (name === 'notes') loadNotes();
  const main = $('main'); if (main) main.focus({ preventScroll: true });
}
function initRouter() {
  qsa('.nav-link').forEach((b) => on(b, 'click', () => showView(b.getAttribute('data-view'))));
  on(window, 'hashchange', () => showView(location.hash.slice(1) || 'overview'));
  showView(location.hash.slice(1) || 'overview');
}

/* ---------------------------------------------------------------- auth */
function renderAuth() {
  const area = $('auth-area');
  if (!area) return;
  area.innerHTML = '';
  if (state.me?.user) {
    const u = state.me.user;
    if (u.avatar) {
      const img = document.createElement('img');
      img.className = 'avatar'; img.src = u.avatar; img.alt = `${u.username} avatar`;
      area.appendChild(img);
    }
    const name = document.createElement('span');
    name.textContent = u.global_name || u.username;
    area.appendChild(name);
    const out = document.createElement('a');
    out.className = 'btn'; out.href = '/logout';
    out.textContent = state.strings.logout || 'Logout';
    area.appendChild(out);
  } else {
    const a = document.createElement('a');
    a.className = 'btn discord'; a.href = '/login';
    a.innerHTML = '<span aria-hidden="true">🔑</span>' + (state.strings.login || 'Login');
    area.appendChild(a);
    if (!state.me?.oauthEnabled) {
      a.removeAttribute('href');
      a.title = 'Set OAUTH_CLIENT_SECRET to enable login';
      a.style.opacity = '0.6';
    } else {
      // Open the multi-step gate (email/Google → Discord) instead of jumping straight in.
      a.addEventListener('click', (e) => { e.preventDefault(); openLoginGate(); });
    }
  }
}

/* ---------------------------------------------------------------- counters */
function animateCount(el, to) {
  if (!el) return;
  const from = Number(String(el.dataset.value ?? '0').replace(/[^\d.-]/g, '')) || 0;
  el.dataset.value = String(to);
  const dur = 600, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------------------------------------------------------- stats */
function fmtUptime(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
function setStatus(ping, uptime) {
  const pill = $('status-pill'), txt = $('status-text');
  if (!pill || !txt) return;
  pill.classList.remove('status-warn', 'status-bad');
  let label = 'Status: Online';
  if (!uptime) { pill.classList.add('status-bad'); label = 'Status: Offline'; }
  else if (ping > 300) { pill.classList.add('status-warn'); label = 'Status: Degraded'; }
  txt.textContent = label;
}
async function refreshStats() {
  try {
    const s = await api('/api/stats');
    applyBotIdentity(s);
    animateCount($('st-guilds'), s.guilds ?? 0);
    animateCount($('st-users'), s.users ?? 0);
    if ($('st-ping')) $('st-ping').textContent = (s.ping ?? 0) + 'ms';
    if ($('st-uptime')) $('st-uptime').textContent = fmtUptime(s.uptime ?? 0);
    if ($('ping-now')) $('ping-now').textContent = (s.ping ?? 0) + ' ms';
    setStatus(s.ping ?? 0, s.uptime ?? 0);
    state.pings.push(s.ping ?? 0);
    if (state.pings.length > 40) state.pings.shift();
    drawPingChart();
  } catch { /* silent */ }
}

/* ---------------------------------------------------------------- charts */
function prepCanvas(canvas) {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
  const h = Number(canvas.getAttribute('height')) || 150;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}
function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5865f2';
}
function drawPingChart() {
  const c = $('ping-chart'); if (!c || c.offsetParent === null) return;
  const p = prepCanvas(c); if (!p) return;
  const { ctx, w, h } = p, data = state.pings;
  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const max = Math.max(60, ...data) * 1.15, pad = 8;
  const x = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const accent = themeColor('--accent') || '#5865f2';
  // area fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, accent + '66'); grad.addColorStop(1, accent + '00');
  ctx.beginPath(); ctx.moveTo(x(0), h - pad);
  data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(data.length - 1), h - pad); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // line
  ctx.beginPath();
  data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // last point
  const lx = x(data.length - 1), ly = y(data[data.length - 1]);
  ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
}
function drawLeaderboardChart() {
  const c = $('lb-chart'); if (!c || c.offsetParent === null) return;
  const p = prepCanvas(c); if (!p) return;
  const { ctx, w, h } = p, rows = state.lastLeaderboard.slice(0, 6);
  ctx.clearRect(0, 0, w, h);
  if (!rows.length) return;
  const max = Math.max(...rows.map((r) => Number(r.total) || 0), 1);
  const gap = 10, bw = (w - gap * (rows.length + 1)) / rows.length;
  const gold = themeColor('--gold') || '#ffd23f', accent = themeColor('--accent') || '#5865f2';
  rows.forEach((r, i) => {
    const bh = Math.max(4, ((Number(r.total) || 0) / max) * (h - 26));
    const bx = gap + i * (bw + gap), by = h - bh - 16;
    const g = ctx.createLinearGradient(0, by, 0, h);
    g.addColorStop(0, i === 0 ? gold : accent); g.addColorStop(1, (i === 0 ? gold : accent) + '55');
    ctx.fillStyle = g;
    const rr = 6;
    ctx.beginPath();
    ctx.moveTo(bx, by + rr); ctx.arcTo(bx, by, bx + rr, by, rr);
    ctx.arcTo(bx + bw, by, bx + bw, by + rr, rr); ctx.lineTo(bx + bw, h - 16);
    ctx.lineTo(bx, h - 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = themeColor('--muted') || '#888';
    ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('#' + (i + 1), bx + bw / 2, h - 4);
  });
}

/* ---------------------------------------------------------------- leaderboard */
async function refreshLeaderboard() {
  try {
    const rows = await api('/api/leaderboard');
    state.lastLeaderboard = rows || [];
    renderLeaderboard();
    drawLeaderboardChart();
  } catch { /* ignore */ }
}
function renderLeaderboard() {
  const ol = $('leaderboard'); if (!ol) return;
  const q = ($('lb-search')?.value || '').toLowerCase();
  ol.innerHTML = '';
  (state.lastLeaderboard || []).forEach((r, i) => {
    const li = document.createElement('li');
    if (i < 3) li.classList.add('top' + (i + 1));
    if (q && !String(r.name).toLowerCase().includes(q)) li.classList.add('hidden-search');
    const who = document.createElement('span');
    who.className = 'who';
    who.innerHTML = `<span>${esc(r.name)}</span>`;
    const a = document.createElement('span');
    a.className = 'amt';
    a.textContent = '🪙 ' + Number(r.total || 0).toLocaleString();
    li.append(who, a);
    ol.appendChild(li);
  });
}

/* ---------------------------------------------------------------- guilds */
const MODULE_META = {
  economy: { ic: '🪙', desc: 'Coins, shop, gambling & rewards.' },
  gamification: { ic: '🎮', desc: 'Games, fun commands & minigames.' },
  moderation: { ic: '🛡️', desc: 'Bans, kicks, timeouts & tools.' },
  automod: { ic: '🤖', desc: 'Auto-filters for spam & bad words.' },
  leveling: { ic: '📈', desc: 'XP, levels & auto-roles.' },
};
async function loadGuilds() {
  if (!state.me?.user) {
    if ($('login-hint')) $('login-hint').hidden = false;
    if ($('guild-field')) $('guild-field').hidden = true;
    return;
  }
  if ($('login-hint')) $('login-hint').hidden = true;
  let guilds = [];
  try { guilds = await api('/api/guilds'); } catch { return; }
  const sel = $('guild-select'); if (!sel) return;
  sel.innerHTML = '';
  const usable = (guilds || []).filter((g) => g.botIn);
  if (!usable.length) {
    if ($('guild-field')) $('guild-field').hidden = true;
    if ($('modules')) $('modules').innerHTML = '<p class="muted">No manageable servers where the bot is present.</p>';
    return;
  }
  if ($('guild-field')) $('guild-field').hidden = false;
  for (const g of usable) {
    const o = document.createElement('option');
    o.value = g.id; o.textContent = g.name;
    sel.appendChild(o);
  }
  // Cache + share the active guild across every guild-scoped view.
  state.guildsUsable = usable;
  if (!state.guild) state.guild = usable[0].id;
  qsa('.auth-nav').forEach((li) => (li.hidden = false));
  populateGuildPickers();
  sel.onchange = () => { setActiveGuild(sel.value); loadGuild(sel.value, usable); };
  loadGuild(state.guild, usable);
}

/* ------------------------------------------------------- shared guild context */
function setActiveGuild(id) {
  state.guild = id;
  qsa('.guild-picker').forEach((s) => { if (s.value !== id) s.value = id; });
  const main = $('guild-select'); if (main && main.value !== id) main.value = id;
}
function populateGuildPickers() {
  qsa('.guild-picker').forEach((sel) => {
    sel.innerHTML = '';
    for (const g of state.guildsUsable || []) {
      const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; sel.appendChild(o);
    }
    if (state.guild) sel.value = state.guild;
    if (!sel.dataset.wired) {
      sel.dataset.wired = '1';
      sel.addEventListener('change', () => { setActiveGuild(sel.value); reloadGuildView(); });
    }
  });
}
function reloadGuildView() {
  const v = state.view;
  if (v === 'tickets') loadTickets();
  else if (v === 'announce') loadAnnounce();
  else if (v === 'analytics') loadAnalytics();
  else if (v === 'members') loadWarnings();
  else if (v === 'giveaways') loadGiveaways();
  else if (v === 'reactionroles') loadReactionRoles();
  else if (v === 'automod') loadAutomod();
  else if (v === 'servers') loadGuild(state.guild, state.guildsUsable);
}
function guildViewReady(name) {
  const ok = Boolean(state.me?.user && state.guild);
  const empty = qs(`[data-empty="${name}"]`); const body = qs(`[data-body="${name}"]`);
  if (empty) empty.hidden = ok;
  if (body) body.hidden = !ok;
  return ok;
}
async function guildChannels() {
  if (!state.guild) return [];
  try { return await api('/api/guild/' + state.guild + '/channels'); } catch { return []; }
}
async function guildRoles() {
  if (!state.guild) return [];
  try { return await api('/api/guild/' + state.guild + '/roles'); } catch { return []; }
}
async function loadGuild(id, list) {
  setActiveGuild(id);
  const g = await api('/api/guild/' + id);
  const meta = $('guild-meta');
  if (meta) {
    const info = (list || []).find((x) => x.id === id);
    const icon = info?.icon ? `https://cdn.discordapp.com/icons/${id}/${info.icon}.png` : null;
    meta.innerHTML = (icon ? `<img src="${icon}" alt="" />` : '') +
      `<span><b>${esc(info?.name || id)}</b> · ${Object.keys(g.modules || {}).length} modules</span>`;
  }
  const box = $('modules');
  if (box) {
    box.innerHTML = '';
    for (const [name, enabled] of Object.entries(g.modules || {})) {
      const m = MODULE_META[name] || { ic: '⚙️', desc: '' };
      const row = document.createElement('div');
      row.className = 'toggle';
      row.dataset.name = name;
      row.innerHTML = `<div class="mod-info"><span class="mod-ic">${m.ic}</span><div><div class="name">${esc(name)}</div><div class="mod-desc">${esc(m.desc)}</div></div></div>`;
      const sw = document.createElement('label');
      sw.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = enabled !== false;
      input.setAttribute('aria-label', name + ' module');
      input.onchange = async () => {
        try {
          await api('/api/guild/' + id + '/module', { method: 'POST', body: JSON.stringify({ name, enabled: input.checked }) });
          toast((state.strings.saved || 'Saved') + ' · ' + name, 'success');
          pushFeed(input.checked ? '🟢' : '🔴', `${name} ${input.checked ? 'enabled' : 'disabled'}`);
        } catch (e) { input.checked = !input.checked; toast('Error: ' + e.message, 'error'); }
      };
      const slider = document.createElement('span'); slider.className = 'slider';
      sw.append(input, slider); row.appendChild(sw); box.appendChild(row);
    }
    filterModules();
  }
  if ($('xp-h')) $('xp-h').hidden = false;
  const ol = $('xp-leaderboard');
  if (ol) {
    ol.innerHTML = '';
    for (const r of g.xp || []) {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'who'; n.innerHTML = `<span>${esc(r.name)}</span>`;
      const a = document.createElement('span'); a.className = 'amt'; a.textContent = `Lv ${r.level} · ${Number(r.xp).toLocaleString()} xp`;
      li.append(n, a); ol.appendChild(li);
    }
  }
  if ($('autorole-box')) $('autorole-box').hidden = false;
  renderAutoroles(g.settings?.autoroles || {});
  loadErlcStatus();
}

/* ---- per-server bot profile (avatar + banner) ---- */
function setupBotProfile() {
  const post = async (kind, url) => {
    if (!state.guild) return;
    const msg = $('bp-msg');
    if (msg) msg.textContent = 'Applying…';
    try {
      await api(`/api/guild/${state.guild}/bot-${kind}`, { method: 'POST', body: JSON.stringify({ url: url || null }) });
      if (msg) msg.textContent = `Server ${kind} ${url ? 'updated' : 'reset'} ✓`;
      toast(`Server ${kind} ${url ? 'set 🏠' : 'reset'}`, 'success');
    } catch (e) { if (msg) msg.textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
  };
  on($('bp-avatar-set'), 'click', () => { const u = $('bp-avatar')?.value.trim(); if (!u) return toast('Enter an image URL', 'error'); post('avatar', u); });
  on($('bp-avatar-reset'), 'click', () => post('avatar', null));
  on($('bp-banner-set'), 'click', () => { const u = $('bp-banner')?.value.trim(); if (!u) return toast('Enter an image URL', 'error'); post('banner', u); });
  on($('bp-banner-reset'), 'click', () => post('banner', null));
}

/* ---- ER:LC encrypted key ---- */
async function loadErlcStatus() {
  const el = $('erlc-status'); if (!el || !state.guild) return;
  try {
    const r = await api('/api/guild/' + state.guild + '/erlckey');
    el.textContent = r.set ? (r.encrypted ? '🔒 A key is set (encrypted at rest).' : '⚠️ Legacy plaintext key — click Save to encrypt it.') : 'No key set yet.';
  } catch { el.textContent = ''; }
}
function setupErlc() {
  on($('erlc-save'), 'click', async () => {
    const key = $('erlc-key')?.value.trim();
    if (!key || !state.guild) return toast('Enter a key first', 'error');
    try {
      await api('/api/guild/' + state.guild + '/erlckey', { method: 'POST', body: JSON.stringify({ key }) });
      $('erlc-key').value = ''; toast('ER:LC key saved & encrypted 🔒', 'success'); loadErlcStatus();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
  on($('erlc-clear'), 'click', async () => {
    if (!state.guild) return;
    try { await api('/api/guild/' + state.guild + '/erlckey', { method: 'POST', body: JSON.stringify({ key: '' }) }); toast('Key cleared', 'success'); loadErlcStatus(); }
    catch (e) { toast('Error: ' + e.message, 'error'); }
  });
}

/* ---- command usage (flight recorder) ---- */
async function loadUsage() {
  let d;
  try { d = await api('/api/usage'); } catch { return; }
  if ($('usage-card')) $('usage-card').hidden = false;
  if ($('usage-total')) $('usage-total').textContent = Number(d.total || 0).toLocaleString();
  if ($('usage-24h')) $('usage-24h').textContent = Number(d.last24h || 0).toLocaleString();
  const top = $('usage-top');
  if (top) top.innerHTML = (d.top || []).map((c) => `<li><span class="who"><span>/${esc(c.name)}</span></span><span class="amt">${c.n}</span></li>`).join('') || '<li class="muted">No data yet.</li>';
  const rec = $('usage-recent');
  if (rec) rec.innerHTML = (d.recent || []).map((r) => `<li><span>/${esc(r.name)}${r.userName ? ' · ' + esc(r.userName) : ''}</span><span class="muted">${new Date(r.at).toLocaleTimeString()}</span></li>`).join('') || '<li class="muted">No data yet.</li>';
}
function filterModules() {
  const q = ($('module-search')?.value || '').toLowerCase();
  qsa('#modules .toggle').forEach((r) => r.classList.toggle('hidden-search', q && !r.dataset.name.includes(q)));
}
function renderAutoroles(map) {
  const ul = $('ar-list'); if (!ul) return;
  ul.innerHTML = '';
  for (const [level, roleId] of Object.entries(map)) {
    const li = document.createElement('li');
    li.innerHTML = `<span>Level <b>${esc(level)}</b> → <code>${esc(roleId)}</code></span>`;
    const rm = document.createElement('button');
    rm.className = 'btn'; rm.textContent = '✕'; rm.setAttribute('aria-label', 'Remove');
    rm.onclick = async () => {
      const g = await api('/api/guild/' + state.guild + '/autorole', { method: 'POST', body: JSON.stringify({ level, roleId: '' }) });
      renderAutoroles(g.settings?.autoroles || {});
      toast('Removed', 'success');
    };
    li.appendChild(rm); ul.appendChild(li);
  }
}
function setupAutorole() {
  on($('ar-save'), 'click', async () => {
    const level = Number($('ar-level')?.value);
    const roleId = $('ar-role')?.value.trim();
    if (!level || !roleId || !state.guild) return toast('Enter a level and role ID', 'error');
    const g = await api('/api/guild/' + state.guild + '/autorole', { method: 'POST', body: JSON.stringify({ level, roleId }) });
    renderAutoroles(g.settings?.autoroles || {});
    $('ar-level').value = ''; $('ar-role').value = '';
    toast('Auto-role added', 'success');
  });
}

/* ---------------------------------------------------------------- shop */
async function loadShop() {
  const grid = $('shop-grid'); if (!grid) return;
  grid.innerHTML = '<p class="muted">Loading…</p>';
  let items = [];
  try { items = await api('/api/shop'); } catch { grid.innerHTML = '<p class="muted">Could not load shop.</p>'; return; }
  renderShop(items);
  if (state.me?.owner && $('shop-add-card')) $('shop-add-card').hidden = false;
}
function renderShop(items) {
  const grid = $('shop-grid'); if (!grid) return;
  const q = ($('shop-search')?.value || '').toLowerCase();
  const list = (items || state._shop || []);
  state._shop = list;
  const filtered = list.filter((it) => !q || String(it.name).toLowerCase().includes(q) || String(it.id).toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML = '<p class="muted">No items found.</p>'; return; }
  grid.innerHTML = '';
  for (const it of filtered) {
    const rarity = (it.rarity || 'common').toLowerCase();
    const el = document.createElement('article');
    el.className = 'shop-item ' + rarity; el.setAttribute('role', 'listitem');
    el.innerHTML =
      `<span class="rarity ${rarity}">${esc(rarity)}</span>` +
      `<h4>${esc(it.name || it.id)}</h4>` +
      `<p class="desc">${esc(it.description || 'No description.')}</p>` +
      `<div class="price">🪙 ${Number(it.price || 0).toLocaleString()}</div>`;
    grid.appendChild(el);
  }
}
function setupShop() {
  on($('shop-search'), 'input', () => renderShop());
  on($('si-save'), 'click', async () => {
    const payload = {
      id: $('si-id')?.value.trim(), name: $('si-name')?.value.trim(),
      price: Number($('si-price')?.value), category: $('si-category')?.value.trim(),
      rarity: $('si-rarity')?.value, description: $('si-desc')?.value.trim(),
    };
    if (!payload.id || !payload.name || !payload.price) return toast('ID, name and price are required', 'error');
    try {
      await api('/api/shop', { method: 'POST', body: JSON.stringify(payload) });
      if ($('si-msg')) $('si-msg').textContent = `Added “${payload.name}”.`;
      toast('Item created', 'success');
      pushFeed('🛒', `Shop item added: ${payload.name}`);
      loadShop();
    } catch (e) { if ($('si-msg')) $('si-msg').textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------- owner: economy */
function setupOwner() {
  if (!state.me?.owner) return;
  qsa('.owner-nav').forEach((li) => (li.hidden = false));
  if ($('eco-card')) $('eco-card').hidden = false;

  on($('eco-load'), 'click', async () => {
    const id = $('eco-user')?.value.trim(); if (!id) return;
    try {
      const e = await api('/api/economy/' + id);
      if ($('eco-wallet')) $('eco-wallet').value = e.wallet;
      const ro = $('eco-readout'); if (ro) ro.hidden = false;
      if ($('eco-r-wallet')) $('eco-r-wallet').textContent = Number(e.wallet).toLocaleString();
      if ($('eco-r-bank')) $('eco-r-bank').textContent = Number(e.bank).toLocaleString();
      if ($('eco-r-wins')) $('eco-r-wins').textContent = e.wins ?? 0;
      if ($('eco-r-losses')) $('eco-r-losses').textContent = e.losses ?? 0;
      if ($('eco-msg')) $('eco-msg').textContent = '';
    } catch (err) { if ($('eco-msg')) $('eco-msg').textContent = 'Error: ' + err.message; }
  });

  on($('eco-save'), 'click', () => {
    const id = $('eco-user')?.value.trim();
    const wallet = Number($('eco-wallet')?.value);
    if (!id || Number.isNaN(wallet)) return;
    confirmModal(`Set wallet of ${id} to ${wallet.toLocaleString()}?`, async () => {
      try {
        await api('/api/economy/' + id, { method: 'POST', body: JSON.stringify({ wallet }) });
        toast('Saved', 'success');
        pushFeed('💰', `Set ${id} wallet → ${wallet.toLocaleString()}`);
      } catch (err) { if ($('eco-msg')) $('eco-msg').textContent = 'Error: ' + err.message; }
    });
  });

  // Site bot-check toggle (owner only).
  (async () => {
    try {
      const cfg = await api('/api/site-config');
      if ($('site-config-card')) $('site-config-card').hidden = false;
      const t = $('hc-toggle');
      if (t) { t.checked = cfg.humanCheck; t.closest('.flag-chip')?.classList.toggle('on', cfg.humanCheck); }
    } catch { /* not owner via this session */ }
  })();
  on($('hc-toggle'), 'change', async (e) => {
    try {
      const r = await api('/api/site-config', { method: 'POST', body: JSON.stringify({ humanCheck: e.target.checked }) });
      e.target.closest('.flag-chip')?.classList.toggle('on', r.humanCheck);
      if ($('hc-toggle-msg')) $('hc-toggle-msg').textContent = 'Bot-check ' + (r.humanCheck ? 'enabled' : 'disabled') + '.';
      toast('Bot-check ' + (r.humanCheck ? 'ON' : 'OFF'), 'success');
    } catch (err) { e.target.checked = !e.target.checked; toast('Error: ' + err.message, 'error'); }
  });

  // Owner Control Center (prank tools + kill switch + live surveillance).
  setupOwnerControl();
  setupOwnerChat();
  loadOwnerControl();
  loadUsage();
  startPresence();

  pollLogs();
  setInterval(pollLogs, 3000);
}

/* ================================================================ OWNER CONTROL 😈 */
let ownerControl = null;
async function loadOwnerControl() {
  try { ownerControl = await api('/api/site-control/full'); } catch { return; }
  if ($('owner-ctrl-card')) $('owner-ctrl-card').hidden = false;
  const setChip = (el, onState) => { if (el) { el.checked = onState; el.closest('.flag-chip')?.classList.toggle('on', onState); } };
  setChip($('ctrl-maintenance'), ownerControl.maintenance);
  qsa('#ctrl-effects [data-fx]').forEach((el) => setChip(el, ownerControl[el.dataset.fx]));
  if ($('ctrl-banner')) $('ctrl-banner').value = ownerControl.banner || '';
  if ($('ctrl-emoji')) $('ctrl-emoji').value = ownerControl.emojiRain || '';
  renderBanList();
}
function renderBanList() {
  const ul = $('ctrl-ban-list'); if (!ul || !ownerControl) return;
  ul.innerHTML = '';
  for (const email of ownerControl.bannedEmails || []) {
    const li = document.createElement('li');
    li.innerHTML = `<span>⛔ <code>${esc(email)}</code></span>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Unban';
    b.onclick = () => saveControl({ bannedEmails: (ownerControl.bannedEmails || []).filter((e) => e !== email) });
    li.appendChild(b); ul.appendChild(li);
  }
}
async function saveControl(patch) {
  try {
    const r = await api('/api/site-control', { method: 'POST', body: JSON.stringify(patch) });
    ownerControl = r.control;
    renderBanList();
    if ($('ctrl-msg')) $('ctrl-msg').textContent = 'Saved ✓';
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}
function setupOwnerControl() {
  on($('ctrl-maintenance'), 'change', (e) => {
    e.target.closest('.flag-chip')?.classList.toggle('on', e.target.checked);
    saveControl({ maintenance: e.target.checked });
    toast(e.target.checked ? '🛠️ Kill switch ON — site is down for everyone else' : '✅ Site back up', e.target.checked ? 'error' : 'success');
  });
  qsa('#ctrl-effects [data-fx]').forEach((el) => on(el, 'change', () => {
    el.closest('.flag-chip')?.classList.toggle('on', el.checked);
    saveControl({ [el.dataset.fx]: el.checked });
  }));
  on($('ctrl-banner'), 'change', (e) => saveControl({ banner: e.target.value }));
  on($('ctrl-emoji'), 'change', (e) => saveControl({ emojiRain: e.target.value }));
  on($('ctrl-ban-add'), 'click', () => {
    const email = $('ctrl-ban-input')?.value.trim(); if (!email) return;
    saveControl({ bannedEmails: [...(ownerControl?.bannedEmails || []), email] });
    if ($('ctrl-ban-input')) $('ctrl-ban-input').value = '';
    toast('Banned ' + email + ' 😏', 'success');
  });
  on($('ctrl-preview-503'), 'click', () => window.open('/maintenance', '_blank'));
  on($('ctrl-undo'), 'click', async () => {
    try {
      const r = await api('/api/site-control/undo', { method: 'POST', body: '{}' });
      if (r.ok) { toast('Undone ↩️', 'success'); loadOwnerControl(); }
      else toast(r.error || 'Nothing to undo', 'info');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
  on($('msg-all'), 'click', () => sendModMessage('all'));
  on($('ctrl-clear-all'), 'click', () => {
    saveControl({ maintenance: false, banner: '', emojiRain: '', upsideDown: false, comicSans: false, snow: false, disco: false, crt: false, grayscale: false, blur: false, spooky: false, fakeCounter: false });
    qsa('#owner-ctrl-card input[type=checkbox]').forEach((c) => { c.checked = false; c.closest('.flag-chip')?.classList.remove('on'); });
    if ($('ctrl-banner')) $('ctrl-banner').value = '';
    if ($('ctrl-emoji')) $('ctrl-emoji').value = '';
    toast('All effects cleared ✨', 'success');
  });
}

/* ---------------------------------------------------------------- transactions */
async function loadTransactions() {
  if (!state.me?.owner) return;
  const body = $('tx-body'); if (!body) return;
  try {
    const rows = await api('/api/transactions?limit=30');
    if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="muted">No transactions yet.</td></tr>'; return; }
    body.innerHTML = '';
    for (const t of rows) {
      const tr = document.createElement('tr');
      const amt = Number(t.amount) || 0;
      tr.innerHTML =
        `<td><code>${esc(String(t.user_id).slice(-6))}</code></td>` +
        `<td>${esc(t.type)}</td>` +
        `<td class="num ${amt >= 0 ? 't-in' : 't-out'}">${amt >= 0 ? '+' : ''}${amt.toLocaleString()}</td>` +
        `<td class="num">${Number(t.balance_after || 0).toLocaleString()}</td>` +
        `<td>${esc(new Date(t.created_at).toLocaleString())}</td>`;
      body.appendChild(tr);
    }
  } catch { body.innerHTML = '<tr><td colspan="5" class="muted">Could not load transactions.</td></tr>'; }
}
function startTxPolling() { stopTxPolling(); state.txTimer = setInterval(loadTransactions, 6000); }
function stopTxPolling() { if (state.txTimer) { clearInterval(state.txTimer); state.txTimer = null; } }

/* ---------------------------------------------------------------- logs */
async function pollLogs() {
  try {
    const logs = await api('/api/logs?after=' + state.logCursor);
    if (!logs.length) return;
    const pre = $('logs'); if (!pre) return;
    const auto = $('log-autoscroll')?.checked !== false;
    const filter = ($('log-filter')?.value || '').toLowerCase();
    for (const l of logs) {
      state.logCursor = Math.max(state.logCursor, l.id);
      const span = document.createElement('span');
      span.className = 'lg-' + l.level;
      const ts = new Date(l.t).toLocaleTimeString();
      span.textContent = `[${ts}] ${l.message}\n`;
      if (filter && !span.textContent.toLowerCase().includes(filter)) span.classList.add('lg-hidden');
      pre.appendChild(span);
      if (l.level === 'error') pushFeed('⛔', l.message.slice(0, 60));
    }
    if (auto) pre.scrollTop = pre.scrollHeight;
  } catch { /* ignore */ }
}
function setupLogs() {
  on($('log-filter'), 'input', () => {
    const filter = ($('log-filter').value || '').toLowerCase();
    qsa('#logs span').forEach((s) => s.classList.toggle('lg-hidden', filter && !s.textContent.toLowerCase().includes(filter)));
  });
  on($('log-clear'), 'click', () => { if ($('logs')) $('logs').innerHTML = ''; });
}

/* ---------------------------------------------------------------- modals */
function openModal(id) { const m = $(id); if (m) { m.hidden = false; m.querySelector('input, button')?.focus(); } }
function closeModal(id) { const m = $(id); if (m) m.hidden = true; }
let confirmHandler = null;
function confirmModal(text, onOk) {
  if ($('confirm-body')) $('confirm-body').textContent = text;
  confirmHandler = onOk;
  openModal('confirm-modal');
}
function setupModals() {
  qsa('[data-close-modal]').forEach((b) => on(b, 'click', () => qsa('.modal-overlay').forEach((m) => (m.hidden = true))));
  qsa('.modal-overlay').forEach((m) => on(m, 'click', (e) => { if (e.target === m) m.hidden = true; }));
  on($('confirm-ok'), 'click', () => { closeModal('confirm-modal'); if (confirmHandler) confirmHandler(); confirmHandler = null; });
}

/* ---------------------------------------------------------------- command palette */
const COMMANDS = [
  { ic: '📊', label: 'Go to Overview', sub: 'view', run: () => showView('overview') },
  { ic: '🧩', label: 'Go to Servers & Modules', sub: 'view', run: () => showView('servers') },
  { ic: '🏆', label: 'Go to Leaderboards', sub: 'view', run: () => showView('leaderboards') },
  { ic: '🛒', label: 'Go to Shop', sub: 'view', run: () => showView('shop') },
  { ic: '📜', label: 'Go to Live Logs', sub: 'owner', run: () => showView('logs') },
  { ic: '💸', label: 'Go to Transactions', sub: 'owner', run: () => showView('transactions') },
  { ic: '🌓', label: 'Toggle theme', sub: 'action', run: cycleTheme },
  { ic: '🔄', label: 'Refresh all data', sub: 'action', run: () => { refreshStats(); refreshLeaderboard(); loadGuilds(); toast('Refreshed', 'success'); } },
  { ic: '⌨️', label: 'Keyboard shortcuts', sub: 'help', run: () => openModal('help-modal') },
  { ic: '🔗', label: 'Copy bot invite link', sub: 'action', run: copyInvite },
];
let cmdkIndex = 0, cmdkFiltered = COMMANDS;
function openCmdk() {
  openModal('cmdk');
  const input = $('cmdk-input');
  if (input) { input.value = ''; renderCmdk(''); input.focus(); }
}
function renderCmdk(q) {
  const list = $('cmdk-results'); if (!list) return;
  q = q.toLowerCase();
  cmdkFiltered = COMMANDS.filter((c) => (c.sub !== 'owner' || state.me?.owner) && c.label.toLowerCase().includes(q));
  cmdkIndex = 0;
  list.innerHTML = '';
  cmdkFiltered.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = i === 0 ? 'active' : '';
    li.setAttribute('role', 'option');
    li.innerHTML = `<span class="ic">${c.ic}</span><span>${esc(c.label)}</span><span class="sub">${esc(c.sub)}</span>`;
    on(li, 'click', () => { c.run(); closeModal('cmdk'); });
    list.appendChild(li);
  });
  if (!cmdkFiltered.length) list.innerHTML = '<li class="muted" style="padding:12px">No matches</li>';
}
function moveCmdk(d) {
  const items = qsa('#cmdk-results li'); if (!items.length) return;
  cmdkIndex = (cmdkIndex + d + cmdkFiltered.length) % cmdkFiltered.length;
  items.forEach((el, i) => el.classList.toggle('active', i === cmdkIndex));
  items[cmdkIndex]?.scrollIntoView({ block: 'nearest' });
}
function runCmdk() {
  const cmd = cmdkFiltered[cmdkIndex];
  if (cmd) { closeModal('cmdk'); cmd.run(); }
}
function setupCmdk() {
  on($('cmdk-open'), 'click', openCmdk);
  on($('cmdk-input'), 'input', (e) => renderCmdk(e.target.value));
  on($('cmdk-input'), 'keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdk(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdk(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmdk(); }
    else if (e.key === 'Escape') closeModal('cmdk');
  });
}

/* ---------------------------------------------------------------- misc actions */
function copyInvite() {
  const id = state.me?.clientId;
  const url = `https://discord.com/oauth2/authorize?client_id=${id || 'YOUR_CLIENT_ID'}&scope=bot%20applications.commands&permissions=8`;
  navigator.clipboard?.writeText(url).then(() => toast('Invite link copied!', 'success'), () => toast(url, 'info'));
}
function setupQuickActions() {
  qsa('[data-cmd]').forEach((b) => on(b, 'click', () => {
    const cmd = b.getAttribute('data-cmd');
    if (cmd === 'refresh') { refreshStats(); refreshLeaderboard(); loadGuilds(); toast('Refreshed', 'success'); }
    else if (cmd === 'copy-invite') copyInvite();
    else if (cmd === 'scroll-logs') showView('logs');
    else if (cmd === 'shortcuts') openModal('help-modal');
  }));
}

/* ---------------------------------------------------------------- 3D tilt */
function setupTilt() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return; // skip on touch
  const SEL = '.stat, .shop-item';
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest(SEL);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateY(-4px)`;
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest?.(SEL);
    if (el) el.style.transform = '';
  });
}

/* ---------------------------------------------------------------- ripple + keys */
function setupRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const r = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.className = 'ripple';
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size / 2) + 'px';
    r.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
}
let gPending = false;
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
    if (typing) return;
    if (e.key === 'Escape') { qsa('.modal-overlay, .cmdk-overlay').forEach((m) => (m.hidden = true)); return; }
    if (e.key === '?') { openModal('help-modal'); return; }
    if (e.key.toLowerCase() === 't') { cycleTheme(); return; }
    if (e.key.toLowerCase() === 'g') { gPending = true; setTimeout(() => (gPending = false), 900); return; }
    if (gPending) {
      gPending = false;
      const map = { o: 'overview', s: 'servers', l: 'leaderboards', p: 'shop', t: 'transactions', g: 'logs' };
      const v = map[e.key.toLowerCase()];
      if (v) showView(v);
    }
  });
}

/* ================================================================ TICKETS */
const TK_GROUPS = [
  { title: '⚙️ General', fields: [
    { k: 'mode', label: 'Mode', type: 'select', opts: ['channel', 'dm', 'both'] },
    { k: 'component', label: 'Opener component', type: 'select', opts: ['button', 'menu'] },
    { k: 'panelChannelId', label: 'Panel channel', type: 'channel' },
    { k: 'categoryId', label: 'Ticket category', type: 'channel' },
    { k: 'staffRoleId', label: 'Staff role', type: 'role' },
  ] },
  { title: '🎨 Appearance', fields: [
    { k: 'title', label: 'Title', type: 'text' },
    { k: 'subtitle', label: 'Subtitle', type: 'text' },
    { k: 'description', label: 'Description', type: 'textarea', wide: true },
    { k: 'color', label: 'Color (hex)', type: 'text' },
    { k: 'buttonLabel', label: 'Button label', type: 'text' },
    { k: 'buttonEmoji', label: 'Button emoji', type: 'text' },
    { k: 'buttonStyle', label: 'Button style', type: 'select', opts: ['Primary', 'Secondary', 'Success', 'Danger'] },
    { k: 'image', label: 'Image URL', type: 'text', wide: true },
    { k: 'menuOptions', label: 'Menu options (comma-separated)', type: 'text', wide: true },
  ] },
  { title: '💬 Behavior', fields: [
    { k: 'openMessage', label: 'Opening message ({user}, {staff})', type: 'textarea', wide: true },
    { k: 'naming', label: 'Channel naming ({num})', type: 'text' },
    { k: 'autoCloseMinutes', label: 'Auto-close (minutes)', type: 'number' },
    { k: 'cooldownSeconds', label: 'Cooldown (seconds)', type: 'number' },
    { k: 'maxOpen', label: 'Max open / user', type: 'number' },
  ] },
  { title: '📨 DM tickets', fields: [
    { k: 'dmStaffChannelId', label: 'DM staff channel', type: 'channel' },
    { k: 'dmCommand', label: 'Open command', type: 'text' },
    { k: 'dmCloseCommand', label: 'Close command', type: 'text' },
    { k: 'dmReply', label: 'Auto-reply to opener', type: 'textarea', wide: true },
  ] },
];
const TK_FLAGS = [
  ['enabled', 'Enabled'], ['pingStaff', 'Ping staff'], ['requireReason', 'Require reason'],
  ['feedback', 'Feedback ⭐'], ['welcomeDM', 'Welcome-DM'], ['priority', 'Priority buttons'],
  ['btnClose', 'Close btn'], ['btnClaim', 'Claim btn'], ['btnLock', 'Lock btn'], ['btnTranscript', 'Transcript btn'],
];
state.tkChannels = []; state.tkRoles = []; state.tkCfg = {};

async function loadTickets() {
  if (!guildViewReady('tickets')) return;
  const form = $('tk-form'); if (form) form.innerHTML = '<p class="muted">Loading configuration…</p>';
  let cfg;
  try { [cfg, state.tkChannels, state.tkRoles] = await Promise.all([api('/api/guild/' + state.guild + '/tickets'), guildChannels(), guildRoles()]); }
  catch (e) { if (form) form.innerHTML = `<p class="muted">Could not load tickets: ${esc(e.message)}</p>`; return; }
  state.tkCfg = cfg || {};
  renderTicketForm();
  updateTicketPreview();
}
function optionList(items, current, kind) {
  const none = `<option value="">— none —</option>`;
  const opts = items.map((it) => `<option value="${esc(it.id)}" ${it.id === current ? 'selected' : ''}>${kind === 'channel' ? '#' : '@'}${esc(it.name)}</option>`).join('');
  return none + opts;
}
function renderTicketForm() {
  const form = $('tk-form'); if (!form) return;
  const cfg = state.tkCfg;
  let html = '';
  for (const group of TK_GROUPS) {
    html += `<div class="tk-group"><h4>${esc(group.title)}</h4><div class="tk-grid">`;
    for (const f of group.fields) {
      const id = 'tkf-' + f.k;
      const val = cfg[f.k] ?? '';
      const wide = f.wide ? ' wide' : '';
      if (f.type === 'select') {
        html += `<label class="field${wide}"><span>${esc(f.label)}</span><select id="${id}" class="select">${f.opts.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      } else if (f.type === 'channel') {
        html += `<label class="field${wide}"><span>${esc(f.label)}</span><select id="${id}" class="select">${optionList(state.tkChannels, val, 'channel')}</select></label>`;
      } else if (f.type === 'role') {
        html += `<label class="field${wide}"><span>${esc(f.label)}</span><select id="${id}" class="select">${optionList(state.tkRoles, val, 'role')}</select></label>`;
      } else if (f.type === 'textarea') {
        html += `<label class="field${wide}"><span>${esc(f.label)}</span><textarea id="${id}" class="input" rows="3">${esc(val)}</textarea></label>`;
      } else {
        const t = f.type === 'number' ? 'number' : 'text';
        html += `<label class="field${wide}"><span>${esc(f.label)}</span><input id="${id}" type="${t}" class="input" value="${esc(val)}" /></label>`;
      }
    }
    html += `</div></div>`;
  }
  html += `<div class="tk-group"><h4>🔘 Feature toggles</h4><div class="tk-flags">`;
  for (const [k, label] of TK_FLAGS) {
    html += `<label class="flag-chip ${cfg[k] ? 'on' : ''}"><input type="checkbox" id="tkf-${k}" ${cfg[k] ? 'checked' : ''} /> ${esc(label)}</label>`;
  }
  html += `</div></div>`;
  form.innerHTML = html;
  // live preview + flag-chip styling
  form.querySelectorAll('input, select, textarea').forEach((el) => on(el, 'input', () => {
    if (el.type === 'checkbox') el.closest('.flag-chip')?.classList.toggle('on', el.checked);
    updateTicketPreview();
  }));
}
function gatherTicketForm() {
  const out = {};
  for (const group of TK_GROUPS) for (const f of group.fields) {
    const el = $('tkf-' + f.k); if (!el) continue;
    out[f.k] = f.type === 'number' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
  }
  for (const [k] of TK_FLAGS) { const el = $('tkf-' + k); if (el) out[k] = el.checked; }
  return out;
}
function updateTicketPreview() {
  const p = $('tk-preview'); if (!p) return;
  const v = gatherTicketForm();
  const color = /^#?[0-9a-fA-F]{6}$/.test(v.color || '') ? (v.color.startsWith('#') ? v.color : '#' + v.color) : '#5865f2';
  p.style.borderLeftColor = color;
  let html = '';
  if (v.title) html += `<div class="ep-title">${esc(v.title)}</div>`;
  let desc = v.description || '';
  if (v.subtitle) desc = `**${v.subtitle}**\n\n` + desc;
  if (v.mode === 'dm' || v.mode === 'both') desc += `\n\n📨 Prefer DMs? DM the bot with \`${v.dmCommand || '!ticket'} your message\`.`;
  if (desc) html += `<div class="ep-desc">${esc(desc)}</div>`;
  if (/^https?:\/\//.test(v.image || '')) html += `<img class="ep-img" src="${esc(v.image)}" alt="" onerror="this.style.display='none'" />`;
  if (v.footer) html += `<div class="ep-footer">${esc(v.footer)}</div>`;
  if (v.mode !== 'dm') {
    if (v.component === 'menu') html += `<div class="ep-btn">▾ ${esc(v.menuPlaceholder || 'Select a ticket type…')}</div>`;
    else html += `<div class="ep-btn">${esc(v.buttonEmoji || '')} ${esc(v.buttonLabel || 'Create Ticket')}</div>`;
  }
  p.innerHTML = html || '<span class="muted">Nothing to preview yet.</span>';
}
function setupTickets() {
  on($('tk-save'), 'click', async () => {
    if (!state.guild) return;
    const payload = gatherTicketForm();
    try {
      const r = await api('/api/guild/' + state.guild + '/tickets', { method: 'POST', body: JSON.stringify(payload) });
      if ($('tk-msg')) $('tk-msg').textContent = `Saved ${r.changed} field(s).`;
      toast('Ticket config saved', 'success');
      confetti();
      pushFeed('🎫', 'Ticket config updated via dashboard');
    } catch (e) { if ($('tk-msg')) $('tk-msg').textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
  });
}

/* ================================================================ ANNOUNCE */
async function loadAnnounce() {
  if (!guildViewReady('announce')) return;
  const sel = $('an-channel'); if (!sel) return;
  const channels = await guildChannels();
  sel.innerHTML = channels.map((c) => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('') || '<option value="">No channels</option>';
  updateAnnouncePreview();
}
function updateAnnouncePreview() {
  const cp = $('an-content-preview'), p = $('an-preview'); if (!p) return;
  if (cp) cp.textContent = $('an-content')?.value || '';
  const useEmbed = $('an-useembed')?.checked;
  if (!useEmbed) { p.style.display = 'none'; return; }
  p.style.display = 'block';
  const color = $('an-color')?.value || '#5865f2';
  p.style.borderLeftColor = color;
  const title = $('an-title')?.value, desc = $('an-desc')?.value, footer = $('an-footer')?.value, image = $('an-image')?.value;
  let html = '';
  if (title) html += `<div class="ep-title">${esc(title)}</div>`;
  if (desc) html += `<div class="ep-desc">${esc(desc)}</div>`;
  if (/^https?:\/\//.test(image || '')) html += `<img class="ep-img" src="${esc(image)}" alt="" onerror="this.style.display='none'" />`;
  if (footer) html += `<div class="ep-footer">${esc(footer)}</div>`;
  p.innerHTML = html || '<span class="muted">Empty embed…</span>';
}
function setupAnnounce() {
  ['an-content', 'an-title', 'an-desc', 'an-footer', 'an-image', 'an-color'].forEach((id) => on($(id), 'input', updateAnnouncePreview));
  on($('an-useembed'), 'change', updateAnnouncePreview);
  on($('an-send'), 'click', () => {
    if (!state.guild) return;
    const payload = {
      channelId: $('an-channel')?.value, content: $('an-content')?.value,
      useEmbed: $('an-useembed')?.checked, title: $('an-title')?.value,
      description: $('an-desc')?.value, color: $('an-color')?.value,
      footer: $('an-footer')?.value, image: $('an-image')?.value,
    };
    if (!payload.channelId) return toast('Pick a channel', 'error');
    confirmModal('Send this announcement now?', async () => {
      try {
        const r = await api('/api/guild/' + state.guild + '/announce', { method: 'POST', body: JSON.stringify(payload) });
        if ($('an-msg')) $('an-msg').textContent = 'Sent! ' + (r.url || '');
        toast('Announcement sent 🚀', 'success');
        confetti(120);
        pushFeed('📢', 'Announcement posted via dashboard');
      } catch (e) { if ($('an-msg')) $('an-msg').textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
    });
  });
}

/* ================================================================ ANALYTICS */
async function loadAnalytics() {
  if (!guildViewReady('analytics')) return;
  let data;
  try { data = await api('/api/guild/' + state.guild + '/analytics?days=14'); } catch { return; }
  const t = data.totals || {};
  if ($('ana-joins')) $('ana-joins').textContent = Number(t.joins || 0).toLocaleString();
  if ($('ana-leaves')) $('ana-leaves').textContent = Number(t.leaves || 0).toLocaleString();
  if ($('ana-messages')) $('ana-messages').textContent = Number(t.messages || 0).toLocaleString();
  const net = (t.joins || 0) - (t.leaves || 0);
  if ($('ana-net')) $('ana-net').textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
  state.analytics = data.series || [];
  drawAnalyticsChart();
}
function drawAnalyticsChart() {
  const c = $('analytics-chart'); if (!c || c.offsetParent === null) return;
  const p = prepCanvas(c); if (!p) return;
  const { ctx, w, h } = p, rows = state.analytics || [];
  ctx.clearRect(0, 0, w, h);
  if (rows.length < 2) return;
  const padL = 30, padR = 10, padT = 10, padB = 22;
  const maxMsg = Math.max(1, ...rows.map((r) => r.messages));
  const maxPeople = Math.max(1, ...rows.map((r) => Math.max(r.joins, r.leaves)));
  const x = (i) => padL + (i / (rows.length - 1)) * (w - padL - padR);
  const yMsg = (v) => h - padB - (v / maxMsg) * (h - padT - padB);
  const yPpl = (v) => h - padB - (v / maxPeople) * (h - padT - padB);
  // message bars
  const bw = Math.max(3, (w - padL - padR) / rows.length * 0.5);
  ctx.fillStyle = (themeColor('--accent') || '#5865f2') + '55';
  rows.forEach((r, i) => { const bh = (r.messages / maxMsg) * (h - padT - padB); ctx.fillRect(x(i) - bw / 2, h - padB - bh, bw, bh); });
  // line helper
  const line = (key, color) => {
    ctx.beginPath();
    rows.forEach((r, i) => { const yy = yPpl(r[key]); i ? ctx.lineTo(x(i), yy) : ctx.moveTo(x(i), yy); });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    rows.forEach((r, i) => { ctx.beginPath(); ctx.arc(x(i), yPpl(r[key]), 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
  };
  line('joins', '#2ecc71');
  line('leaves', '#e74c3c');
  // x labels (every few days)
  ctx.fillStyle = themeColor('--muted') || '#889'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
  rows.forEach((r, i) => { if (i % Math.ceil(rows.length / 7) === 0) ctx.fillText(r.day.slice(5), x(i), h - 6); });
}

/* ================================================================ WARNINGS */
let warnTimer = null;
async function loadWarnings() {
  if (!guildViewReady('members')) return;
  const q = $('warn-search')?.value.trim() || '';
  const body = $('warn-body'); if (!body) return;
  body.innerHTML = '<tr><td colspan="5" class="muted">Loading…</td></tr>';
  let rows;
  try { rows = await api('/api/guild/' + state.guild + '/warnings' + (q ? '?q=' + encodeURIComponent(q) : '')); } catch { body.innerHTML = '<tr><td colspan="5" class="muted">Could not load.</td></tr>'; return; }
  if ($('warn-count')) $('warn-count').textContent = rows.length + ' record' + (rows.length === 1 ? '' : 's');
  if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="muted">No infractions found.</td></tr>'; return; }
  const typeIc = { warn: '⚠️', timeout: '🔇', kick: '👢', ban: '🔨', badword: '🤬', auto: '🤖' };
  body.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${esc(r.userName || '')} <code>${esc(String(r.user_id).slice(-6))}</code></td>` +
      `<td>${typeIc[r.type] || '•'} ${esc(r.type)}</td>` +
      `<td>${esc(r.reason || '—')}</td>` +
      `<td>${esc(r.modName || '—')}</td>` +
      `<td>${esc(new Date(r.created_at).toLocaleString())}</td>`;
    body.appendChild(tr);
  }
}
function setupWarnings() {
  on($('warn-search'), 'input', () => { clearTimeout(warnTimer); warnTimer = setTimeout(loadWarnings, 300); });
}

/* ================================================================ GIVEAWAYS 🎉 */
async function loadGiveaways() {
  if (!guildViewReady('giveaways')) return;
  const sel = $('gw-channel');
  if (sel) { const chans = await guildChannels(); sel.innerHTML = chans.map((c) => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join(''); }
  const list = $('gw-list'); if (!list) return;
  list.innerHTML = '<li class="muted">Loading…</li>';
  let rows;
  try { rows = await api('/api/guild/' + state.guild + '/giveaways'); } catch { list.innerHTML = '<li class="muted">Could not load.</li>'; return; }
  if (!rows.length) { list.innerHTML = '<li class="muted">No giveaways yet.</li>'; return; }
  list.innerHTML = '';
  for (const g of rows) {
    const li = document.createElement('li');
    li.className = 'gw-item';
    const ended = g.ended || g.ends_at < Date.now();
    li.innerHTML = `<div><b>${esc(g.prize)}</b><div class="muted">${g.entries} entries · ${g.winners} winner(s) · ${ended ? 'ended' : 'ends ' + new Date(g.ends_at).toLocaleString()}</div></div>`;
    if (!ended) {
      const b = document.createElement('button'); b.className = 'btn danger'; b.textContent = 'End now';
      b.onclick = () => confirmModal(`End the giveaway for "${g.prize}" now?`, async () => {
        try { await api(`/api/guild/${state.guild}/giveaways/${g.id}/end`, { method: 'POST', body: '{}' }); toast('Giveaway ended', 'success'); loadGiveaways(); }
        catch (e) { toast('Error: ' + e.message, 'error'); }
      });
      li.appendChild(b);
    } else {
      const rr = document.createElement('button'); rr.className = 'btn'; rr.textContent = '🔁 Reroll';
      rr.onclick = async () => {
        try { const r = await api(`/api/guild/${state.guild}/giveaways/${g.id}/reroll`, { method: 'POST', body: '{}' }); toast(r.winners?.length ? 'New winner picked! 🎉' : 'No entries to reroll', r.winners?.length ? 'success' : 'info'); if (r.winners?.length) confetti(60); }
        catch (e) { toast('Error: ' + e.message, 'error'); }
      };
      li.appendChild(rr);
    }
    list.appendChild(li);
  }
}
function setupGiveaways() {
  on($('gw-create'), 'click', () => {
    if (!state.guild) return;
    const payload = { channelId: $('gw-channel')?.value, prize: $('gw-prize')?.value.trim(), minutes: Number($('gw-minutes')?.value), winners: Number($('gw-winners')?.value) };
    if (!payload.channelId || !payload.prize) return toast('Pick a channel and enter a prize', 'error');
    (async () => {
      try {
        const r = await api('/api/guild/' + state.guild + '/giveaways', { method: 'POST', body: JSON.stringify(payload) });
        if ($('gw-msg')) $('gw-msg').textContent = 'Launched! ' + (r.url || '');
        toast('Giveaway launched 🎉', 'success'); confetti(110);
        $('gw-prize').value = '';
        loadGiveaways();
      } catch (e) { if ($('gw-msg')) $('gw-msg').textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
    })();
  });
}

/* ================================================================ REACTION ROLES 🎭 */
async function loadReactionRoles() {
  if (!guildViewReady('reactionroles')) return;
  const [chans, roles] = await Promise.all([guildChannels(), guildRoles()]);
  if ($('rr-channel')) $('rr-channel').innerHTML = chans.map((c) => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('');
  if ($('rr-role')) $('rr-role').innerHTML = roles.map((r) => `<option value="${esc(r.id)}">@${esc(r.name)}</option>`).join('');
  const list = $('rr-list'); if (!list) return;
  list.innerHTML = '<li class="muted">Loading…</li>';
  let rows;
  try { rows = await api('/api/guild/' + state.guild + '/reactionroles'); } catch { list.innerHTML = '<li class="muted">Could not load.</li>'; return; }
  if (!rows.length) { list.innerHTML = '<li class="muted">No reaction roles yet.</li>'; return; }
  list.innerHTML = '';
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'rr-item';
    li.innerHTML = `<div><b>${esc(r.emoji)}</b> → <span class="chip">@${esc(r.roleName)}</span><div class="muted">message <code>${esc(r.message_id)}</code></div></div>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '✕';
    b.onclick = async () => {
      try { await api('/api/guild/' + state.guild + '/reactionroles/remove', { method: 'POST', body: JSON.stringify({ messageId: r.message_id, emoji: r.emoji }) }); toast('Removed', 'success'); loadReactionRoles(); }
      catch (e) { toast('Error: ' + e.message, 'error'); }
    };
    li.appendChild(b);
    list.appendChild(li);
  }
}
function setupReactionRoles() {
  on($('rr-add'), 'click', () => {
    if (!state.guild) return;
    const payload = { channelId: $('rr-channel')?.value, messageId: $('rr-message')?.value.trim(), emoji: $('rr-emoji')?.value.trim(), roleId: $('rr-role')?.value };
    if (!payload.channelId || !payload.messageId || !payload.emoji || !payload.roleId) return toast('Fill in all fields', 'error');
    (async () => {
      try {
        await api('/api/guild/' + state.guild + '/reactionroles', { method: 'POST', body: JSON.stringify(payload) });
        if ($('rr-msg')) $('rr-msg').textContent = 'Added! The bot reacted to the message.';
        toast('Reaction role added 🎭', 'success');
        $('rr-message').value = ''; $('rr-emoji').value = '';
        loadReactionRoles();
      } catch (e) { if ($('rr-msg')) $('rr-msg').textContent = 'Error: ' + e.message; toast('Error: ' + e.message, 'error'); }
    })();
  });
}

/* ================================================================ WEATHER 🌤️ */
function setupWeather() {
  const go = async () => {
    const q = $('weather-input')?.value.trim();
    const box = $('weather-result'); if (!box) return;
    if (!q) return;
    box.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const d = await api('/api/weather?q=' + encodeURIComponent(q));
      box.innerHTML =
        `<div class="weather-card">` +
        (d.icon ? `<img src="https://openweathermap.org/img/wn/${esc(d.icon)}@2x.png" alt="" />` : '') +
        `<div><div class="weather-temp">${d.temp}°C</div>` +
        `<div class="weather-place">${esc(d.name)}${d.country ? ', ' + esc(d.country) : ''}</div>` +
        `<div class="muted" style="text-transform:capitalize">${esc(d.desc)}</div>` +
        `<div class="weather-meta">🌡️ feels ${d.feels}° · 💧 ${d.humidity}% · 💨 ${d.wind} m/s</div></div></div>`;
    } catch (e) { box.innerHTML = `<p class="muted">❌ ${esc(e.message)}</p>`; }
  };
  on($('weather-btn'), 'click', go);
  on($('weather-input'), 'keydown', (e) => { if (e.key === 'Enter') go(); });
}

/* ================================================================ AUTOMOD 🤖 */
async function loadAutomod() {
  if (!guildViewReady('automod')) return;
  let cfg, chans;
  try { [cfg, chans] = await Promise.all([api('/api/guild/' + state.guild + '/automod'), guildChannels()]); }
  catch { return; }
  const setChip = (id, on) => { const el = $(id); if (el) { el.checked = on; el.closest('.flag-chip')?.classList.toggle('on', on); } };
  setChip('am-invites', cfg.invites !== false);
  setChip('am-spam', cfg.spam !== false);
  setChip('am-badwords', Boolean(cfg.badwords));
  if ($('am-maxmentions')) $('am-maxmentions').value = cfg.maxMentions ?? 5;
  if ($('am-logchannel')) {
    $('am-logchannel').innerHTML = '<option value="">— none —</option>' + chans.map((c) => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('');
    $('am-logchannel').value = cfg.logChannel || '';
  }
}
function setupAutomod() {
  ['am-invites', 'am-spam', 'am-badwords'].forEach((id) => on($(id), 'change', (e) => e.target.closest('.flag-chip')?.classList.toggle('on', e.target.checked)));
  on($('am-save'), 'click', async () => {
    if (!state.guild) return;
    const payload = {
      invites: $('am-invites')?.checked, spam: $('am-spam')?.checked, badwords: $('am-badwords')?.checked,
      maxMentions: Number($('am-maxmentions')?.value) || 0, logChannel: $('am-logchannel')?.value || null,
    };
    try {
      await api('/api/guild/' + state.guild + '/automod', { method: 'POST', body: JSON.stringify(payload) });
      if ($('am-msg')) $('am-msg').textContent = 'Automod rules saved.';
      toast('Automod saved 🤖', 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
}

/* ================================================================ LIVE PRESENCE 👁️ */
function sendModMessage(target) {
  const text = prompt(target === 'all' ? '📢 Message to EVERYONE on the site:' : '📢 Message to this viewer:');
  if (!text) return;
  api('/api/moderator-message', { method: 'POST', body: JSON.stringify({ target, text }) })
    .then(() => toast('Message sent 📢', 'success'))
    .catch((e) => toast('Error: ' + e.message, 'error'));
}
let presenceTimer = null;
async function loadPresence() {
  const body = $('presence-body'); if (!body) return;
  let list;
  try { list = await api('/api/presence'); } catch { return; }
  if ($('presence-count')) $('presence-count').textContent = list.length + ' online';
  if (!list.length) { body.innerHTML = '<tr><td colspan="4" class="muted">Nobody online right now.</td></tr>'; return; }
  body.innerHTML = '';
  for (const p of list) {
    const tr = document.createElement('tr');
    const who = esc(p.name) + (p.email ? ` <code>${esc(p.email)}</code>` : '') + (p.owner ? ' 👑' : '');
    const secs = Math.max(0, Math.round((Date.now() - p.lastSeen) / 1000));
    tr.innerHTML = `<td>${who}</td><td><code>${esc(p.path)}</code></td><td>${secs}s ago</td>`;
    const td = document.createElement('td');
    const chatBtn = document.createElement('button'); chatBtn.className = 'btn'; chatBtn.textContent = '💬'; chatBtn.title = 'Chat with this viewer';
    chatBtn.onclick = () => openOwnerChat(p.sid, p.name);
    td.appendChild(chatBtn);
    if (p.email && !p.owner) {
      const banBtn = document.createElement('button'); banBtn.className = 'btn danger'; banBtn.textContent = '⛔'; banBtn.title = 'Ban this viewer';
      banBtn.onclick = () => { saveControl({ bannedEmails: [...(ownerControl?.bannedEmails || []), p.email] }); toast('Banned ' + p.email, 'success'); };
      td.appendChild(banBtn);
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }
}
function startPresence() {
  if (presenceTimer || !$('presence-body')) return;
  loadPresence();
  presenceTimer = setInterval(loadPresence, 5000);
}

/* ---- owner ↔ viewer chat ---- */
let ocSid = null, ocTimer = null;
function openOwnerChat(sid, name) {
  ocSid = sid;
  if ($('oc-title')) $('oc-title').textContent = '💬 ' + name;
  openModal('owner-chat-modal');
  loadOwnerChat();
  clearInterval(ocTimer); ocTimer = setInterval(loadOwnerChat, 3000);
}
async function loadOwnerChat() {
  if (!ocSid) return;
  const body = $('oc-body'); if (!body) return;
  let thread;
  try { thread = await api('/api/chat/' + encodeURIComponent(ocSid)); } catch { return; }
  body.innerHTML = thread.length
    ? thread.map((m) => `<div class="chat-msg ${m.from === 'staff' ? 'right' : 'left'}">${esc(m.text)}</div>`).join('')
    : '<p class="muted">No messages yet — say hi 👋</p>';
  body.scrollTop = body.scrollHeight;
}
function setupOwnerChat() {
  on($('oc-form'), 'submit', async (e) => {
    e.preventDefault();
    const text = $('oc-input')?.value.trim(); if (!text || !ocSid) return;
    $('oc-input').value = '';
    try { await api('/api/moderator-message', { method: 'POST', body: JSON.stringify({ target: ocSid, text }) }); loadOwnerChat(); }
    catch (err) { toast('Error: ' + err.message, 'error'); }
  });
  qsa('#owner-chat-modal [data-close-modal]').forEach((b) => on(b, 'click', () => { clearInterval(ocTimer); ocSid = null; }));
}

/* ================================================================ EMBED TEMPLATES 📚 */
let tplCat = 'All';
function openTemplates() {
  if (!window.EMBED_TEMPLATES || !window.EMBED_TEMPLATES.length) return toast('Templates not loaded', 'error');
  renderTemplateCats();
  renderTemplates();
  openModal('tpl-modal');
}
function renderTemplateCats() {
  const box = $('tpl-cats'); if (!box) return;
  const cats = ['All', ...Array.from(new Set(window.EMBED_TEMPLATES.map((t) => t.category)))];
  box.innerHTML = '';
  for (const c of cats) {
    const b = document.createElement('button');
    b.className = 'cmd-cat' + (c === tplCat ? ' on' : '');
    b.textContent = c;
    on(b, 'click', () => { tplCat = c; renderTemplateCats(); renderTemplates(); });
    box.appendChild(b);
  }
}
function renderTemplates() {
  const grid = $('tpl-grid'); if (!grid) return;
  const q = ($('tpl-search')?.value || '').toLowerCase();
  const list = window.EMBED_TEMPLATES.filter((t) =>
    (tplCat === 'All' || t.category === tplCat) &&
    (!q || t.name.toLowerCase().includes(q) || (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)));
  grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = '<p class="muted" style="padding:12px">No templates match.</p>'; return; }
  for (const t of list) {
    const el = document.createElement('button');
    el.className = 'tpl-card';
    el.style.borderLeftColor = t.color;
    el.innerHTML = `<div class="tpl-name">${esc(t.emoji || '')} ${esc(t.name)}</div><div class="tpl-cat muted">${esc(t.category)}</div><div class="tpl-prev">${esc((t.title || '').slice(0, 64))}</div>`;
    on(el, 'click', () => applyTemplate(t));
    grid.appendChild(el);
  }
}
function applyTemplate(t) {
  if ($('an-title')) $('an-title').value = t.title || '';
  if ($('an-desc')) $('an-desc').value = t.description || '';
  if ($('an-footer')) $('an-footer').value = t.footer || '';
  if ($('an-color')) $('an-color').value = /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#5865f2';
  if ($('an-useembed')) $('an-useembed').checked = true;
  updateAnnouncePreview();
  closeModal('tpl-modal');
  toast(`Applied “${t.name}” ✨`, 'success');
}
function setupTemplates() {
  on($('an-templates'), 'click', openTemplates);
  on($('tpl-search'), 'input', renderTemplates);
}

/* ================================================================ BACKUP / RESTORE 💾 */
function setupBackup() {
  on($('cfg-export'), 'click', async () => {
    if (!state.guild) return;
    try {
      const data = await api('/api/guild/' + state.guild + '/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sentinel-settings-${state.guild}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      if ($('cfg-msg')) $('cfg-msg').textContent = 'Exported to a .json file.';
      toast('Settings exported ⬇️', 'success');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  });
  on($('cfg-import-file'), 'change', (e) => {
    const file = e.target.files?.[0]; if (!file || !state.guild) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data; try { data = JSON.parse(reader.result); } catch { return toast('Invalid JSON file', 'error'); }
      confirmModal('Import these settings? This overwrites the current configuration for this server.', async () => {
        try {
          await api('/api/guild/' + state.guild + '/import', { method: 'POST', body: JSON.stringify(data) });
          toast('Settings imported ✅', 'success'); confetti(50);
          loadGuild(state.guild, state.guildsUsable);
        } catch (err) { toast('Error: ' + err.message, 'error'); }
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

/* ================================================================ WELCOME PREVIEW 🖼️ */
function setupWelcomePreview() {
  on($('wc-preview-btn'), 'click', () => {
    if (!state.guild) return toast('Pick a server first', 'error');
    const box = $('wc-preview'); if (!box) return;
    box.innerHTML = '<p class="muted">Rendering…</p>';
    const img = new Image();
    img.alt = 'Welcome card preview';
    img.style.cssText = 'max-width:100%;border-radius:12px;border:1px solid var(--border)';
    img.onload = () => { box.innerHTML = ''; box.appendChild(img); };
    img.onerror = () => { box.innerHTML = '<p class="muted">Could not render the preview.</p>'; };
    img.src = '/api/guild/' + state.guild + '/welcome-preview?t=' + Date.now();
  });
}

/* ================================================================ COOKIES 🍪 */
function setCookie(name, value, days = 365) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setupCookieBanner() {
  const banner = $('cookie-banner');
  if (!banner) return;
  if (!getCookie('cookie_consent')) banner.hidden = false;
  on($('cookie-accept'), 'click', () => { setCookie('cookie_consent', 'accepted'); banner.hidden = true; toast('Thanks! 🍪', 'success'); });
  on($('cookie-decline'), 'click', () => { setCookie('cookie_consent', 'declined'); banner.hidden = true; });
}

/* ================================================================ NOTES 📝 */
const NOTES_KEY = 'dash_notes_v1';
let noteColor = '#5865f2';
function getNotes() { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; } }
function saveNotes(list) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(list)); } catch { /* quota */ } }
function loadNotes() { renderNotes(); }
function renderNotes() {
  const grid = $('notes-grid'); if (!grid) return;
  const notes = getNotes().sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));
  if ($('notes-count')) $('notes-count').textContent = notes.length + ' note' + (notes.length === 1 ? '' : 's');
  if (!notes.length) { grid.innerHTML = '<p class="muted">No notes yet — write your first one above. ✍️</p>'; return; }
  grid.innerHTML = '';
  for (const n of notes) {
    const el = document.createElement('div');
    el.className = 'note' + (n.pinned ? ' pinned' : '');
    el.style.borderLeftColor = n.color || '#5865f2';
    el.innerHTML =
      `<div class="note-text">${esc(n.text)}</div>` +
      `<div class="note-meta"><span>${esc(new Date(n.at).toLocaleString())}</span>` +
      `<span class="note-tools"><button data-pin="${n.id}" title="Pin">${n.pinned ? '📌' : '📍'}</button><button data-del="${n.id}" title="Delete">🗑️</button></span></div>`;
    grid.appendChild(el);
  }
  grid.querySelectorAll('[data-del]').forEach((b) => on(b, 'click', () => { saveNotes(getNotes().filter((x) => x.id !== b.dataset.del)); renderNotes(); toast('Note deleted', 'info'); }));
  grid.querySelectorAll('[data-pin]').forEach((b) => on(b, 'click', () => { const l = getNotes(); const n = l.find((x) => x.id === b.dataset.pin); if (n) n.pinned = !n.pinned; saveNotes(l); renderNotes(); }));
}
function addNote() {
  const input = $('note-input'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  const list = getNotes();
  list.push({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), text, color: noteColor, at: Date.now(), pinned: false });
  saveNotes(list); input.value = ''; renderNotes();
  toast('Note saved 📝', 'success'); confetti(30);
}
function setupNotes() {
  on($('note-add'), 'click', addNote);
  on($('note-input'), 'keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote(); });
  qsa('#note-colors .note-swatch').forEach((sw) => on(sw, 'click', () => {
    noteColor = sw.dataset.color;
    qsa('#note-colors .note-swatch').forEach((s) => s.classList.toggle('on', s === sw));
  }));
}

/* ================================================================ LOGIN GATE 🔐 */
function openLoginGate() {
  const gate = $('login-gate'); if (!gate) return;
  // Restore a remembered email from the cookie.
  const saved = getCookie('login_email');
  if (saved && $('gate-email')) $('gate-email').value = saved;
  // If they already signed in with Google, skip straight to the Discord step.
  if (state.me?.google) proceedToDiscord(state.me.google.name || state.me.google.email?.split('@')[0]);
  else { gateStep(1); }
  gate.hidden = false;
  if (!state.me?.google) $('gate-email')?.focus();
}
function gateStep(n) {
  qsa('#login-gate .gate-step').forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
}
function proceedToDiscord(whoLabel) {
  if ($('gate-who')) $('gate-who').textContent = whoLabel || 'friend';
  gateStep(2);
}
function setupLoginGate() {
  on($('gate-email-next'), 'click', () => {
    const email = ($('gate-email')?.value || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email', 'error');
    setCookie('login_email', email);            // 🍪 remembered
    proceedToDiscord(email.split('@')[0]);
  });
  on($('gate-google'), 'click', () => {
    if (state.me?.googleEnabled) { window.location = '/auth/google'; return; } // real OAuth redirect
    toast('Google sign-in not configured — add GOOGLE_CLIENT_ID/SECRET to .env.', 'info');
    proceedToDiscord('friend');
  });
  on($('gate-back'), 'click', () => gateStep(1));
  // Discord button is a real <a href="/login"> — nothing to wire.
}

/* ---------------------------------------------------------------- theme buttons */
function setupThemeButtons() {
  qsa('[data-theme-value]').forEach((b) => on(b, 'click', () => setTheme(b.getAttribute('data-theme-value'))));
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.theme === 'auto') applyTheme(); });
}

/* ---------------------------------------------------------------- boot */
async function boot() {
  applyTheme();
  setupThemeButtons();
  setupModals();
  setupCmdk();
  setupKeyboard();
  setupRipple();
  setupTilt();
  setupQuickActions();
  setupShop();
  setupLogs();
  setupTickets();
  setupAnnounce();
  setupWarnings();
  setupCookieBanner();
  setupNotes();
  setupLoginGate();
  setupGiveaways();
  setupReactionRoles();
  setupTemplates();
  setupBackup();
  setupWelcomePreview();
  setupAutomod();
  setupWeather();
  setupErlc();
  setupBotProfile();

  on($('lang'), 'change', (e) => loadI18n(e.target.value));
  on($('module-search'), 'input', filterModules);
  on($('lb-search'), 'input', renderLeaderboard);
  on(window, 'resize', () => { drawPingChart(); drawLeaderboardChart(); drawAnalyticsChart(); });

  await loadI18n('en');

  try { state.me = await api('/api/me'); }
  catch { state.me = { user: null, oauthEnabled: false, owner: false }; }

  if ($('oauth-note')) $('oauth-note').textContent = state.me.oauthEnabled ? '' : 'OAuth2 not configured.';

  renderAuth();
  initRouter();
  setupAutorole();

  await Promise.all([refreshStats(), refreshLeaderboard(), loadGuilds()]);
  setupOwner();

  setInterval(refreshStats, 5000);
  setInterval(refreshLeaderboard, 8000);

  const params = new URLSearchParams(location.search);
  const err = params.get('error');
  if (err) toast('Login error: ' + err.replace(/_/g, ' '), 'error');
  // Returned from a successful Google sign-in → celebrate + advance to the Discord step.
  if (params.get('google') === 'ok') {
    toast('Signed in with Google ✓', 'success');
    confetti(90);
    if (!state.me?.user) setTimeout(openLoginGate, 300);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  pushFeed('✨', 'Dashboard loaded');
  setTimeout(() => confetti(70), 400); // welcome celebration 🎉
}

boot();
