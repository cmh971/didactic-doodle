// Multi-tenant community pages + "Cloud Fair" proof-of-work verification +
// Super-Admin approval lifecycle + SSE live sync. Mounted onto the main Express
// app (which already provides sessions + Discord OAuth2).
import { randomBytes, createHash } from 'node:crypto';
import { getCommunity, getCommunityByCustomId, listPending, updateCommunity, setApproved, bus } from '../community/store.js';
import { getCfg } from '../setup/store.js';

const POW_DIFFICULTY = 4; // required leading zero hex chars (mCaptcha-style)
const superAdminId = () => (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || process.env.SUPER_ADMIN_ID || '';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Minimal, safe markdown → HTML (bold/italic/headers/links/breaks).
function md(src) {
  return esc(src)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

function page(cfg, body, extraHead = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.communityName)}</title>
<style>
:root{--accent:${esc(cfg.themeColor)};}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0e1117;color:#e6edf3}
.hero{background:linear-gradient(135deg,var(--accent),#0e1117);padding:80px 24px;text-align:center}
.hero h1{font-size:3rem;margin:0}.hero p{color:#cfd8e3;font-size:1.2rem}
.card{max-width:820px;margin:-40px auto 40px;background:#161b22;border:1px solid #2a3340;border-radius:16px;padding:32px}
a{color:var(--accent)}.btn{display:inline-block;background:var(--accent);color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;border:0;cursor:pointer;font-size:1rem}
.badge{display:inline-block;background:#2ecc71;color:#062;padding:3px 10px;border-radius:999px;font-size:.75rem;font-weight:800}
.muted{color:#9aa7b4}.center{text-align:center}
input{background:#0e1117;border:1px solid #2a3340;color:#e6edf3;padding:10px;border-radius:8px;font-size:1rem}
</style>${extraHead}</head><body>${body}</body></html>`;
}

export function registerCommunity(app, client) {
  // ---------- public community landing page ----------
  app.get('/c/:id', (req, res) => {
    const cfg = getCommunityByCustomId(req.params.id) || getCommunity(req.params.id);
    if (!cfg) return res.status(404).send('Community not found.');
    if (!cfg.isApproved) {
      return res.send(page(cfg, `<div class="hero"><h1>${esc(cfg.communityName)}</h1></div>
        <div class="card center"><h2>⏳ Pending approval</h2><p class="muted">This community is awaiting Super-Admin approval.</p></div>`));
    }
    const verifyBtn = cfg.verificationRequired
      ? `<p><a class="btn" href="/c/${esc(cfg.customSubdomainOrId)}/verify">✅ Verify to join</a></p>`
      : '';
    const widgets = (cfg.widgets || [])
      .map((w) => `<div class="card"><h3>${esc(w.title || w.type)}</h3><div class="muted">${esc(JSON.stringify(w.config || {}))}</div></div>`)
      .join('');
    res.send(page(cfg, `
      <div class="hero"><h1>${esc(cfg.communityName)}</h1><p>Powered community page</p></div>
      <div class="card"><span class="badge">✓ Approved</span><div style="margin-top:16px">${md(cfg.homePageMarkdown)}</div>${verifyBtn}</div>
      ${widgets}
      <p class="center muted">Live-synced • updates from Discord appear instantly</p>`));
  });

  // ---------- Cloud Fair (proof-of-work) verification ----------
  app.get('/c/:id/verify', (req, res) => {
    const cfg = getCommunityByCustomId(req.params.id) || getCommunity(req.params.id);
    if (!cfg || !cfg.isApproved) return res.status(404).send('Not available.');
    if (!req.session.user) {
      return res.send(page(cfg, `<div class="hero"><h1>Verify</h1></div>
        <div class="card center"><p>Log in with Discord first.</p><a class="btn" href="/login">Login with Discord</a></div>`));
    }
    const challenge = randomBytes(16).toString('hex');
    req.session.pow = { challenge, guildId: cfg.guildId };
    res.send(page(cfg, `
      <div class="hero"><h1>🛡️ Cloud Fair</h1><p>Prove you're human</p></div>
      <div class="card center">
        <p>Solving a quick proof-of-work… no clicking boxes, no tracking.</p>
        <p id="status" class="muted">Working…</p>
        <button id="go" class="btn" disabled>Verify</button>
      </div>
      <script>
      const challenge=${JSON.stringify(challenge)},diff=${POW_DIFFICULTY};
      async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
      (async()=>{const pre='0'.repeat(diff);let n=0,h;const t=Date.now();
        do{h=await sha(challenge+n);n++;}while(!h.startsWith(pre));
        document.getElementById('status').textContent='Solved in '+((Date.now()-t)/1000).toFixed(1)+'s';
        const b=document.getElementById('go');b.disabled=false;
        b.onclick=async()=>{b.disabled=true;const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:n-1})});const j=await r.json();document.getElementById('status').textContent=j.ok?('✅ '+j.message):('❌ '+j.error);};
      })();
      </script>`));
  });

  app.post('/c/:id/verify', async (req, res) => {
    const pow = req.session.pow;
    if (!req.session.user || !pow) return res.status(400).json({ ok: false, error: 'No challenge in session.' });
    const nonce = req.body?.nonce;
    const hash = createHash('sha256').update(pow.challenge + nonce).digest('hex');
    if (!hash.startsWith('0'.repeat(POW_DIFFICULTY))) return res.status(400).json({ ok: false, error: 'Invalid proof-of-work.' });
    req.session.pow = null; // single use

    const guild = client.guilds.cache.get(pow.guildId);
    const roleId = guild ? getCfg(pow.guildId).settings.verifiedRole : null;
    if (!guild) return res.json({ ok: true, message: 'Verified (bot not in that server to assign a role).' });
    if (!roleId) return res.json({ ok: true, message: 'Verified! (No verified role configured in /setup.)' });
    try {
      const member = await guild.members.fetch(req.session.user.id);
      await member.roles.add(roleId, 'Cloud Fair verification');
      return res.json({ ok: true, message: 'Verified — role granted!' });
    } catch (e) {
      return res.json({ ok: true, message: 'Verified, but could not assign the role: ' + e.message });
    }
  });

  // ---------- SSE live sync (Discord → browser) ----------
  app.get('/api/community/:id/stream', (req, res) => {
    const cfg = getCommunityByCustomId(req.params.id) || getCommunity(req.params.id);
    if (!cfg) return res.status(404).end();
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(cfg)}\n\n`);
    const onChange = (c) => { if (c.guildId === cfg.guildId) res.write(`data: ${JSON.stringify(c)}\n\n`); };
    bus.on('change', onChange);
    req.on('close', () => bus.off('change', onChange));
  });

  // ---------- Super-Admin approval dashboard ----------
  const requireSuperAdmin = (req, res, next) => {
    if (req.session.user?.id && req.session.user.id === superAdminId()) return next();
    res.status(403).send('<h1>403 — Super Admin only</h1>');
  };

  app.get('/admin/approval', requireSuperAdmin, (req, res) => {
    const pending = listPending();
    const rows = pending.length
      ? pending.map((c) => `<div class="card"><h3>${esc(c.communityName)}</h3>
          <p class="muted">Guild: ${esc(c.guildId)} • /c/${esc(c.customSubdomainOrId)}</p>
          <form method="POST" action="/admin/approval/${esc(c.guildId)}/approve" style="display:inline"><button class="btn">✅ Approve</button></form>
          <form method="POST" action="/admin/approval/${esc(c.guildId)}/deny" style="display:inline"><button class="btn" style="background:#e74c3c">🚫 Deny</button></form>
        </div>`).join('')
      : '<div class="card center muted">No communities awaiting approval. 🎉</div>';
    res.send(page({ communityName: 'Super Admin', themeColor: '#ffd23f' },
      `<div class="hero"><h1>🛡️ Approval Queue</h1><p>${pending.length} pending</p></div>${rows}`));
  });

  app.post('/admin/approval/:guildId/:action', requireSuperAdmin, async (req, res) => {
    const { guildId, action } = req.params;
    const approved = action === 'approve';
    setApproved(guildId, approved); // mutates DB + emits → live sync
    // Notify the guild (system message in first sendable channel).
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const ch = guild.channels.cache.find((c) => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
      ch?.send(approved ? '🎉 Your community page has been **approved**!' : '🚫 Your community page request was **denied**.').catch(() => {});
    }
    res.redirect('/admin/approval');
  });
}