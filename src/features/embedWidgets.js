// Embed-by-URL widgets — safe, public, embeddable views (leaderboard, stats) a
// server can drop into Google Sites/any site via an <iframe> or copied HTML.
//   • Server-RENDERED (no client JS needed → works anywhere, no CORS)
//   • READ-ONLY, only non-sensitive data — no dangerous requests possible
//   • OPT-IN per guild (`!embed on`) so nobody's data is exposed without consent
import { leaderboard } from '../systems/leveling.js';
import { totals } from '../systems/analytics.js';
import { getCfg, setSetting } from '../setup/store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enabled = (gid) => getCfg(gid).settings.embedWidgets === true;
const baseUrl = () => process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

const STYLE = `<style>
  :root{color-scheme:dark} *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:transparent}
  .card{background:#0e1c2c;border:1px solid #1e3a55;border-radius:14px;padding:14px 16px;color:#e8f0ff;max-width:420px;margin:6px auto}
  .head{font-weight:800;font-size:16px;margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .row{display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid #14283d}
  .row:last-child{border-bottom:none}
  .pos{width:26px;text-align:center;font-weight:800} .rk{color:#6d90b3}
  .nm{flex:1;font-weight:600} .lv{color:#37d0a0;font-weight:700;font-size:13px}
  .stat{display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #14283d}
  .stat b{color:#37d0a0}
  .empty{color:#6d90b3;padding:8px 4px;text-align:center}
  .foot{margin-top:10px;text-align:center;font-size:11px;color:#4f6f93}
</style>`;
const page = (inner, refresh = 60) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}${STYLE}</head><body>${inner}</body></html>`;

function leaderboardWidget(client, gid) {
  const g = client?.guilds?.cache.get(gid);
  const rows = leaderboard(gid, 10);
  const items = rows.map((r, i) => {
    const u = g?.members?.cache.get(r.id)?.user;
    const medal = ['🥇', '🥈', '🥉'][i] || `<span class="rk">${i + 1}</span>`;
    return `<div class="row"><span class="pos">${medal}</span><span class="nm">${esc(u?.username || 'user ' + String(r.id).slice(-4))}</span><span class="lv">Lv ${r.level} · ${r.xp} XP</span></div>`;
  }).join('') || '<div class="empty">No leaderboard data yet.</div>';
  return page(`<div class="card"><div class="head">🏆 ${esc(g?.name || 'Leaderboard')}</div>${items}<div class="foot">Powered by Sentinel</div></div>`);
}

function statsWidget(client, gid) {
  const g = client?.guilds?.cache.get(gid);
  const t = totals(gid) || {};
  const stat = (label, val) => `<div class="stat"><span>${label}</span><b>${esc(val ?? '—')}</b></div>`;
  return page(`<div class="card"><div class="head">📊 ${esc(g?.name || 'Server')}</div>${stat('Members', g?.memberCount ?? '—')}${stat('Messages', t.messages ?? 0)}${stat('Joins', t.joins ?? 0)}<div class="foot">Powered by Sentinel</div></div>`);
}

// GET /embed/:type/:guildId — the embeddable widget itself.
export function registerEmbedRoutes(app, client) {
  app.get('/embed/:type/:guildId', (req, res) => {
    // Allow framing anywhere; these are safe public views.
    res.removeHeader('X-Frame-Options');
    res.set('Content-Security-Policy', 'frame-ancestors *');
    res.set('Content-Type', 'text/html; charset=utf-8');
    const { type, guildId } = req.params;
    if (!/^\d{5,25}$/.test(guildId)) return res.status(400).send(page('<div class="card"><div class="empty">Bad server id.</div></div>', 0));
    if (!enabled(guildId)) return res.send(page('<div class="card"><div class="head">🔒 Embeds off</div><div class="empty">This server hasn’t enabled public embeds.</div></div>', 0));
    if (type === 'leaderboard') return res.send(leaderboardWidget(client, guildId));
    if (type === 'stats') return res.send(statsWidget(client, guildId));
    return res.status(404).send(page('<div class="card"><div class="empty">Unknown widget type.</div></div>', 0));
  });
  console.log('🖼️  Embed widgets mounted at /embed/:type/:guildId');
}

// ---- owner command: !embed on|off|url ----
export async function handleEmbedCommand(message) {
  const m = /^!embed\b\s*(\w*)/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server**.').catch(() => {}); return true; }
  const sub = (m[1] || '').toLowerCase();
  const gid = message.guild.id;
  const base = baseUrl();
  if (sub === 'off') { setSetting(gid, 'embedWidgets', false); return message.reply('🔒 Public embeds **disabled**.').catch(() => {}); }
  if (sub === 'on') setSetting(gid, 'embedWidgets', true);
  if (!enabled(gid)) return message.reply('🖼️ Public embeds are **off**. Turn them on with `!embed on` (then anyone can embed your leaderboard/stats).').catch(() => {});
  const url = `${base}/embed/leaderboard/${gid}`;
  return message.reply(
    `🖼️ **Embeds enabled!** Two ways to use them (your choice):\n` +
    `**① iframe URL** (auto-updates): ${url}\n` +
    `**② HTML snippet** (paste into Google Sites → Embed → Embed code):\n\`\`\`html\n<iframe src="${url}" width="380" height="440" style="border:0"></iframe>\n\`\`\`\n` +
    `Also available: \`/embed/stats/${gid}\`\n🛠️ Visual builder: ${base}/embed-builder.html?guild=${gid}`,
  ).catch(() => {});
}
