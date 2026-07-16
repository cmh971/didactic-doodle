/* Landing page — live stats, theme, mobile nav, scroll-reveal. Standalone. */
'use strict';

const $ = (id) => document.getElementById(id);
const qsa = (s) => Array.from(document.querySelectorAll(s));

/* ---- theme (shared with dashboard via localStorage) ---- */
function resolveTheme(t) {
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', resolveTheme(t));
}
let theme = localStorage.getItem('theme') || 'dark';
applyTheme(theme);
$('lp-theme')?.addEventListener('click', () => {
  theme = resolveTheme(theme) === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
});

/* ---- mobile menu ---- */
const burger = $('lp-burger'), mobile = $('lp-mobile');
burger?.addEventListener('click', () => {
  const open = mobile.hidden;
  mobile.hidden = !open;
  burger.setAttribute('aria-expanded', String(open));
  burger.textContent = open ? '✕' : '☰';
});
qsa('#lp-mobile a').forEach((a) => a.addEventListener('click', () => { mobile.hidden = true; burger.textContent = '☰'; }));

/* ---- year ---- */
if ($('lp-year')) $('lp-year').textContent = new Date().getFullYear();

/* ---- scroll reveal ---- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
qsa('.reveal').forEach((el) => io.observe(el));

/* ---- count-up ---- */
function countUp(el, to) {
  if (!el) return;
  const dur = 1400, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---- bot-check gate (Cloudflare Turnstile) ---- */
function bcSetCookie() { document.cookie = 'human_verified=1; max-age=' + (60 * 60 * 24 * 30) + '; path=/; SameSite=Lax'; }
function bcVerified() { return /(?:^|; )human_verified=1/.test(document.cookie); }
function hideGate() { const g = $('botcheck'); if (g) { g.hidden = true; document.body.style.overflow = ''; } }
function showGate() { const g = $('botcheck'); if (g) { g.hidden = false; document.body.style.overflow = 'hidden'; } }
async function initBotCheck() {
  if (bcVerified()) return; // already passed on this device
  let hc = { enabled: false };
  try { hc = await (await fetch('/api/humancheck')).json(); } catch { /* offline → skip gate */ }
  if (!hc.enabled) return; // owner turned the bot check off
  showGate();
  renderChallenge(hc);
}
function renderChallenge(hc) {
  const status = $('botcheck-status');
  const t = $('hc-target'); if (t) t.textContent = hc.target;
  const opts = $('hc-options'); if (!opts) return;
  opts.innerHTML = '';
  for (const e of hc.options) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hc-emoji'; b.textContent = e; b.setAttribute('aria-label', 'emoji option');
    b.addEventListener('click', async () => {
      if (status) status.textContent = 'Checking…';
      try {
        const r = await (await fetch('/api/humancheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: e }) })).json();
        if (r.success) { bcSetCookie(); if (status) status.textContent = 'Verified ✓ Welcome!'; setTimeout(hideGate, 350); }
        else { if (status) status.textContent = 'Not quite — here\'s a new one.'; refreshChallenge(); }
      } catch { if (status) status.textContent = 'Network error — try again.'; }
    });
    opts.appendChild(b);
  }
}
async function refreshChallenge() {
  try { const hc = await (await fetch('/api/humancheck')).json(); if (hc.enabled) renderChallenge(hc); } catch { /* ignore */ }
}
initBotCheck();

/* ---- live stats + bot identity ---- */
async function loadStats() {
  try {
    const r = await fetch('/api/stats');
    const s = await r.json();
    countUp($('st-guilds'), s.guilds ?? 0);
    countUp($('st-users'), s.users ?? 0);
    if ($('pv-guilds')) $('pv-guilds').textContent = (s.guilds ?? 0).toLocaleString();
    if ($('pv-users')) $('pv-users').textContent = (s.users ?? 0).toLocaleString();
    if ($('pv-ping')) $('pv-ping').textContent = (s.ping ?? 0) + 'ms';
    // Personalize with the real bot identity.
    if (s.botName) {
      qsa('#lp-brand-name, .lp-brand-name').forEach((el) => (el.textContent = s.botName));
      document.title = s.botName + ' · The all-in-one Discord bot';
    }
    if (s.botAvatar) {
      qsa('#lp-logo, .lp-logo').forEach((el) => {
        el.textContent = '';
        const img = document.createElement('img');
        img.src = s.botAvatar; img.alt = ''; img.className = 'lp-logo-img';
        el.appendChild(img);
      });
      let fav = document.querySelector('link[rel="icon"]');
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = s.botAvatar;
    }
  } catch { /* stats optional on the landing page */ }
}
loadStats();
