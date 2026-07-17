// Member-facing Roblox verification flow.
const $ = (id) => document.getElementById(id);
const api = async (url, opts) => {
  const r = await fetch(url, { credentials: 'same-origin', ...opts, headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
};
const show = (id) => document.querySelectorAll('.vf-step').forEach((s) => s.classList.toggle('active', s.id === id));
const msg = (el, text, kind) => { el.textContent = text; el.className = 'vf-msg ' + kind; };

let guildId = new URLSearchParams(location.search).get('g') || '';
let confirmedUsername = '';

async function boot() {
  let me;
  try { me = await api('/api/me'); } catch { me = null; }
  if (!me || !me.user) { show('step-login'); return; }

  if (!guildId) {
    const opts = await api('/api/verify/options').catch(() => []);
    if (!opts.length) { show('step-login'); $('vf-server').textContent = 'No servers with verification set up were found for your account.'; return; }
    if (opts.length === 1) { guildId = opts[0].id; $('vf-server').textContent = `Verifying for ${opts[0].name}`; return startCode(); }
    $('vf-guilds').innerHTML = opts.map((o) => `<option value="${o.id}">${o.name}</option>`).join('');
    show('step-guild');
    $('vf-guild-go').onclick = () => { guildId = $('vf-guilds').value; startCode(); };
    return;
  }
  startCode();
}

async function startCode() {
  // reuse an existing pending code, or create one
  let code = null;
  try { code = (await api('/api/verify/code?g=' + encodeURIComponent(guildId))).code; } catch {}
  if (!code) { try { code = (await api('/api/verify/start', { method: 'POST', body: JSON.stringify({ guildId }) })).code; } catch {} }
  $('vf-code').textContent = code || 'Run /verify in the server to get a code';
  show('step-code');
}

$('vf-code').onclick = () => { navigator.clipboard?.writeText($('vf-code').textContent).then(() => { $('vf-code').textContent += '  ✓'; }); };

$('vf-check').onclick = async () => {
  const username = $('vf-username').value.trim();
  if (!username) return;
  const btn = $('vf-check'); btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const p = await api('/api/verify/preview', { method: 'POST', body: JSON.stringify({ username }) });
    confirmedUsername = p.name;
    $('vf-avatar').src = p.avatar || '';
    $('vf-name').textContent = p.name;
    $('vf-id').textContent = 'Roblox ID ' + p.id;
    show('step-confirm');
  } catch (e) {
    msg($('vf-msg1'), e.message, 'err');
  } finally { btn.disabled = false; btn.textContent = 'Check my account →'; }
};

$('vf-back').onclick = () => show('step-code');

$('vf-confirm').onclick = async () => {
  const btn = $('vf-confirm'); btn.disabled = true; btn.textContent = 'Verifying…';
  try {
    const r = await api('/api/verify/complete', { method: 'POST', body: JSON.stringify({ guildId, username: confirmedUsername }) });
    const bits = [];
    if (r.added) bits.push('verified role added');
    if (r.removed) bits.push('unverified role removed');
    if (r.nick) bits.push('nickname updated');
    $('vf-done-detail').textContent = bits.length ? `Done — ${bits.join(', ')}. You can remove the code from your Roblox profile now.` : 'Verified! You can remove the code from your Roblox profile now.';
    show('step-done');
  } catch (e) {
    msg($('vf-msg2'), e.message, 'err');
    btn.disabled = false; btn.textContent = '✅ Yes, verify me';
  }
};

boot();
