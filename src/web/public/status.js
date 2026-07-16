/* Live status page — polls /api/stats, shows health + a latency sparkline. */
'use strict';

const $ = (id) => document.getElementById(id);
const qsa = (s) => Array.from(document.querySelectorAll(s));

(function () {
  let t = localStorage.getItem('theme') || 'dark';
  if (t !== 'light' && t !== 'dark') t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const y = $('lp-year'); if (y) y.textContent = new Date().getFullYear();
})();

const pings = [];

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}
function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5865f2';
}

function drawChart() {
  const c = $('s-chart'); if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 600, h = Number(c.getAttribute('height')) || 160;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (pings.length < 2) return;
  const max = Math.max(60, ...pings) * 1.15, pad = 8;
  const x = (i) => pad + (i / (pings.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const accent = themeColor('--accent');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, accent + '55'); grad.addColorStop(1, accent + '00');
  ctx.beginPath(); ctx.moveTo(x(0), h - pad);
  pings.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(pings.length - 1), h - pad); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  pings.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
}

function setHealth(ping, uptime) {
  const dot = $('status-dot'), head = $('status-headline'), sub = $('status-sub'), cbot = $('c-bot');
  let cls = 'ok', head1 = 'All systems operational', bot = 'Operational';
  if (!uptime) { cls = 'bad'; head1 = 'Bot appears offline'; bot = 'Down'; }
  else if (ping > 300) { cls = 'warn'; head1 = 'Degraded performance'; bot = 'Degraded'; }
  if (dot) dot.className = 'status-big-dot ' + cls;
  if (head) head.textContent = head1;
  if (sub) sub.textContent = uptime ? `Latency ${ping}ms · up ${fmtUptime(uptime)}` : 'No uptime reported.';
  if (cbot) { cbot.textContent = bot; cbot.className = 'badge-status ' + cls; }
}

async function tick() {
  try {
    const s = await (await fetch('/api/stats')).json();
    $('s-ping').textContent = (s.ping ?? 0) + 'ms';
    $('s-uptime').textContent = fmtUptime(s.uptime ?? 0);
    $('s-guilds').textContent = (s.guilds ?? 0).toLocaleString();
    $('s-users').textContent = (s.users ?? 0).toLocaleString();
    $('s-now').textContent = (s.ping ?? 0) + ' ms';
    setHealth(s.ping ?? 0, s.uptime ?? 0);
    pings.push(s.ping ?? 0); if (pings.length > 40) pings.shift();
    drawChart();
    if (s.botName) qsa('#lp-brand-name').forEach((el) => (el.textContent = s.botName));
    if (s.botAvatar) { const l = $('lp-logo'); if (l && !l.querySelector('img')) { l.textContent = ''; const i = document.createElement('img'); i.src = s.botAvatar; i.className = 'lp-logo-img'; l.appendChild(i); } }
  } catch {
    setHealth(0, 0);
  }
}
window.addEventListener('resize', drawChart);
tick();
setInterval(tick, 5000);
