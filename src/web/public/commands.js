/* Commands reference page — fetches the live command registry and renders a
   searchable, filterable list. Standalone (no dependencies). */
'use strict';

const $ = (id) => document.getElementById(id);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* theme + year (shared convention) */
(function () {
  let t = localStorage.getItem('theme') || 'dark';
  if (t !== 'light' && t !== 'dark') t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const y = $('lp-year'); if (y) y.textContent = new Date().getFullYear();
})();

const CAT_META = {
  core: { ic: '⚙️', label: 'Core' },
  economy: { ic: '🪙', label: 'Economy' },
  moderation: { ic: '🛡️', label: 'Moderation' },
  gamification: { ic: '🎮', label: 'Games & Fun' },
  utility: { ic: '🔧', label: 'Utility' },
  roblox: { ic: '🟥', label: 'Roblox' },
  extra: { ic: '✨', label: 'Extras' },
  other: { ic: '📦', label: 'Other' },
};

let DATA = [];
let activeCat = 'all';

async function load() {
  try {
    const r = await fetch('/api/commands');
    const json = await r.json();
    DATA = json.categories || [];
    if ($('cmd-total')) $('cmd-total').textContent = json.total ?? DATA.reduce((n, c) => n + c.commands.length, 0);
    renderCats();
    render();
    // personalize brand from live stats
    fetch('/api/stats').then((x) => x.json()).then((s) => {
      if (s.botName) qsa('#lp-brand-name').forEach((el) => (el.textContent = s.botName));
      if (s.botAvatar) { const l = $('lp-logo'); if (l) { l.textContent = ''; const i = document.createElement('img'); i.src = s.botAvatar; i.className = 'lp-logo-img'; l.appendChild(i); } }
    }).catch(() => {});
  } catch {
    $('cmd-list').innerHTML = '<p class="muted">Could not load commands. Is the bot online?</p>';
  }
}

function renderCats() {
  const box = $('cmd-cats'); if (!box) return;
  box.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'cmd-cat on'; all.dataset.cat = 'all'; all.textContent = 'All';
  box.appendChild(all);
  for (const c of DATA) {
    const m = CAT_META[c.category] || { ic: '📦', label: c.category };
    const b = document.createElement('button');
    b.className = 'cmd-cat'; b.dataset.cat = c.category;
    b.innerHTML = `${m.ic} ${esc(m.label)} <span class="cmd-cat-n">${c.commands.length}</span>`;
    box.appendChild(b);
  }
  qsa('.cmd-cat').forEach((b) => b.addEventListener('click', () => {
    activeCat = b.dataset.cat;
    qsa('.cmd-cat').forEach((x) => x.classList.toggle('on', x === b));
    render();
  }));
}

function render() {
  const list = $('cmd-list'); if (!list) return;
  const q = ($('cmd-search')?.value || '').toLowerCase();
  list.innerHTML = '';
  let shown = 0;
  for (const cat of DATA) {
    if (activeCat !== 'all' && cat.category !== activeCat) continue;
    const matches = cat.commands.filter((cmd) => !q || cmd.name.toLowerCase().includes(q) || (cmd.description || '').toLowerCase().includes(q));
    if (!matches.length) continue;
    const m = CAT_META[cat.category] || { ic: '📦', label: cat.category };
    const sec = document.createElement('section');
    sec.className = 'cmd-group';
    sec.innerHTML = `<h3 class="cmd-group-h">${m.ic} ${esc(m.label)} <span class="muted">(${matches.length})</span></h3>`;
    const grid = document.createElement('div');
    grid.className = 'cmd-grid';
    for (const cmd of matches) {
      shown++;
      const el = document.createElement('div');
      el.className = 'cmd-card';
      el.innerHTML = `<code class="cmd-name">/${esc(cmd.name)}</code><p class="cmd-desc">${esc(cmd.description || 'No description.')}</p>`;
      grid.appendChild(el);
    }
    sec.appendChild(grid);
    list.appendChild(sec);
  }
  if (!shown) list.innerHTML = '<p class="muted">No commands match your search.</p>';
}

$('cmd-search')?.addEventListener('input', render);
load();
