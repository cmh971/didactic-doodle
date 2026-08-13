// cad-patrol.js — Patrol Ops layer for the Dispatcher Console. Additive: reads the
// live state each tick (cad.html calls CADPatrol.update(state)) and adds:
//   • Speed radar — computes each player's speed from GPS deltas between polls and
//     flags anyone over the limit for their street (flashing ring on the map + list).
//   • Auto-dispatch — on a new 911 call, finds the closest on-duty unit and reads a
//     voice dispatch ("Unit X, closest to a call at …") via the Web Speech API.
// Requires /sfx.js (alert beeps). Settings persist in localStorage.
(function () {
  if (window.CADPatrol) return;

  const cfg = { limitMph: 80, factor: 0.35, voice: true }; // studs/sec × factor ≈ mph (tunable per server)
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('patrolCfg') || '{}')); } catch { /* defaults */ }
  const save = () => { try { localStorage.setItem('patrolCfg', JSON.stringify(cfg)); } catch { /* ignore */ } };

  const prev = new Map();       // name -> {x,z,t}
  const seenCalls = new Set();  // 911 call numbers already dispatched
  const boloSeen = new Set();   // BOLO/ALPR hits already alerted
  const violators = new Map();  // name -> {mph, street, team}
  window.__patrolViolators = violators;
  const dispatchLog = [];

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dist = (a, b) => { const dx = a.x - b.x; const dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); };
  const onDuty = (u) => u.team && u.team !== 'Civilian';

  function speak(text) {
    if (!cfg.voice || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.03; u.pitch = 0.9; speechSynthesis.speak(u); } catch { /* no TTS */ }
  }

  function renderRadar() {
    const el = document.getElementById('patrol-radar'); if (!el) return;
    if (!violators.size) { el.innerHTML = '<div class="m">No active speed violations.</div>'; return; }
    el.innerHTML = [...violators.entries()]
      .sort((a, b) => b[1].mph - a[1].mph)
      .map(([name, v]) => `<div class="call p1"><div class="t">🚨 ${esc(name)} — <b>${v.mph} mph</b></div><div class="m">📍 ${esc(v.street)} · limit ${cfg.limitMph}</div></div>`)
      .join('');
  }

  function logDispatch(text) {
    dispatchLog.unshift({ text, at: new Date().toLocaleTimeString() });
    if (dispatchLog.length > 15) dispatchLog.pop();
    const el = document.getElementById('patrol-dispatch');
    if (el) el.innerHTML = dispatchLog.map((d) => `<div class="m">[${d.at}] ${d.text}</div>`).join('') || '<div class="m">—</div>';
  }

  function dispatchClosest(state, call) {
    const units = state.units.filter((u) => onDuty(u) && u.x != null);
    let best = null; let bd = Infinity;
    if (call.x != null) for (const u of units) { const d = dist(u, call); if (d < bd) { bd = d; best = u; } }
    const where = call.postal || call.desc || 'an unknown location';
    const msg = best
      ? `${best.callsign || best.name}, you are the closest unit to a new 9 1 1 call at ${where}.`
      : `New 9 1 1 call at ${where}. No units currently on duty.`;
    logDispatch('📻 ' + esc(msg));
    if (window.SFX) SFX.alert();
    speak(msg);
  }

  function update(state) {
    if (!state || !state.units) return;
    const now = Date.now();
    const fresh = new Map();
    for (const u of state.units) {
      if (u.x == null || u.z == null) continue;
      const p = prev.get(u.name);
      prev.set(u.name, { x: u.x, z: u.z, t: now });
      if (p) {
        const dt = (now - p.t) / 1000;
        if (dt > 0.5 && dt < 20) {
          const mph = Math.round((dist(u, p) / dt) * cfg.factor);
          if (mph > cfg.limitMph) fresh.set(u.name, { mph, street: u.street || u.postal || 'unknown', team: u.team });
        }
      }
    }
    for (const name of fresh.keys()) if (!violators.has(name) && window.SFX) SFX.alert(); // beep on NEW violation
    violators.clear();
    for (const [k, v] of fresh) violators.set(k, v);
    renderRadar();

    // BOLO / ALPR hits (live vehicles + players matched against saved BOLOs)
    const hits = state.bolos || [];
    const bel = document.getElementById('patrol-bolo');
    if (bel) bel.innerHTML = hits.length
      ? hits.map((h) => `<div class="call p1"><div class="t">${h.type === 'person' ? '👤' : '🚗'} ${esc(h.label)} — <b>BOLO HIT</b></div><div class="m">${esc(h.detail || '')}${h.reason ? ' · ' + esc(h.reason) : ''}</div></div>`).join('')
      : '<div class="m">No BOLO hits.</div>';
    for (const h of hits) { const k = h.type + ':' + h.label; if (!boloSeen.has(k)) { boloSeen.add(k); if (window.SFX) SFX.siren(); } }
    if (boloSeen.size > 200) boloSeen.clear();

    for (const c of state.gameCalls || []) {
      if (c.number == null || seenCalls.has(c.number)) continue;
      seenCalls.add(c.number);
      dispatchClosest(state, c);
    }
    if (seenCalls.size > 500) seenCalls.clear();
  }

  window.CADPatrol = {
    update, cfg,
    setLimit(v) { cfg.limitMph = Math.max(1, +v || 80); save(); },
    setFactor(v) { cfg.factor = +v || 0.35; save(); },
    toggleVoice() { cfg.voice = !cfg.voice; save(); return cfg.voice; },
  };

  // Wire the settings controls (they exist by the time this deferred script runs).
  const limitEl = document.getElementById('patrol-limit');
  if (limitEl) { limitEl.value = cfg.limitMph; limitEl.onchange = () => window.CADPatrol.setLimit(limitEl.value); }
  const vEl = document.getElementById('patrol-voice');
  if (vEl) { vEl.textContent = cfg.voice ? '🔊 Voice' : '🔇 Voice'; vEl.onclick = () => { vEl.textContent = window.CADPatrol.toggleVoice() ? '🔊 Voice' : '🔇 Voice'; }; }
})();
