// cad-fx — the "spaceship" skin for the Dispatcher Console. Purely additive: it
// injects a sci-fi CSS overlay, a boot sequence, scanlines, a radar sweep over the
// map, glowing HUD chips, a telemetry ticker, and wires SFX to the real actions.
// It never touches the CAD data logic — if this file is removed the console still
// works exactly the same. Requires /sfx.js loaded first.
//
// Note: the header chips + bottom ticker are cosmetic "flight-deck" flair (uplink /
// GPS lock / core temp readouts), not live data — pure sci-fi atmosphere.
(function () {
  if (window.__cadFx) return;
  window.__cadFx = true;

  const css = `
  body{ background:
    radial-gradient(1200px 800px at 72% -12%, #10233a 0%, transparent 60%),
    radial-gradient(1000px 700px at -12% 112%, #0c1b2e 0%, transparent 55%),
    #05080d !important; }
  body::before{ content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image: linear-gradient(#0e2b47 1px, transparent 1px), linear-gradient(90deg,#0e2b47 1px, transparent 1px);
    background-size:44px 44px; opacity:.10; animation: cadfx-grid 9s linear infinite; }
  @keyframes cadfx-grid{ to{ background-position:44px 44px; } }
  header, .grid, #banner{ position:relative; z-index:2; }
  header{ background:linear-gradient(180deg,#0b2036,#081522)!important; border-bottom:1px solid #1f6f8f!important;
    box-shadow:0 0 26px rgba(31,111,143,.45); }
  header h1{ text-shadow:0 0 14px rgba(55,208,160,.7); letter-spacing:.6px; }
  .card{ position:relative; background:linear-gradient(180deg, rgba(14,32,50,.94), rgba(9,20,33,.94))!important;
    border:1px solid #1f5f80!important; box-shadow:0 0 0 1px rgba(31,111,143,.15), 0 0 22px rgba(10,40,60,.5), inset 0 0 34px rgba(10,30,50,.35)!important; }
  .card::before,.card::after{ content:''; position:absolute; width:14px; height:14px; border:2px solid #37d0a0; opacity:.65; pointer-events:none; }
  .card::before{ top:-1px; left:-1px; border-right:0; border-bottom:0; }
  .card::after{ bottom:-1px; right:-1px; border-left:0; border-top:0; }
  .card h2{ color:#5fe0c0!important; text-shadow:0 0 8px rgba(55,208,160,.5); }
  #pcount,#server{ font-family:'Consolas',monospace; text-shadow:0 0 8px rgba(55,208,160,.6); }
  canvas#map{ box-shadow:0 0 32px rgba(31,111,143,.5), inset 0 0 40px rgba(0,0,0,.6); border-color:#1f6f8f!important; }
  button{ transition:box-shadow .15s, transform .05s; }
  button:hover{ box-shadow:0 0 12px rgba(55,208,160,.5); }
  button:active{ transform:translateY(1px); }
  #btn-panic{ box-shadow:0 0 16px rgba(239,68,68,.7)!important; animation:cadfx-panic 1.4s ease-in-out infinite; }
  @keyframes cadfx-panic{ 50%{ box-shadow:0 0 28px rgba(239,68,68,1)!important; } }
  #cadfx-scan{ position:fixed; inset:0; pointer-events:none; z-index:9990;
    background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 2px, rgba(0,25,45,.13) 2px 3px); mix-blend-mode:overlay; }
  #cadfx-scan::after{ content:''; position:absolute; left:0; right:0; height:140px; top:-140px;
    background:linear-gradient(rgba(55,208,160,0), rgba(55,208,160,.09), rgba(55,208,160,0)); animation:cadfx-sweep 7s linear infinite; }
  @keyframes cadfx-sweep{ to{ transform:translateY(120vh); } }
  #cadfx-vig{ position:fixed; inset:0; pointer-events:none; z-index:9989; box-shadow:inset 0 0 240px rgba(0,0,0,.85); }
  #cadfx-radar{ position:absolute; pointer-events:none; border-radius:10px; overflow:hidden; z-index:3; mix-blend-mode:screen; }
  #cadfx-radar::before{ content:''; position:absolute; inset:-25%;
    background:conic-gradient(from 0deg, rgba(55,208,160,.20), rgba(55,208,160,0) 42deg); animation:cadfx-radar 4s linear infinite; }
  @keyframes cadfx-radar{ to{ transform:rotate(360deg); } }
  #cadfx-hud{ display:flex; gap:7px; align-items:center; margin-left:14px; font-family:monospace; font-size:11px; }
  .cadfx-chip{ padding:2px 8px; border:1px solid #1f6f8f; border-radius:6px; color:#5fe0c0; background:rgba(10,30,50,.6); box-shadow:0 0 8px rgba(31,111,143,.3); white-space:nowrap; }
  .cadfx-chip b{ color:#9fe8d8; }
  .cadfx-led{ display:inline-block; width:7px; height:7px; border-radius:50%; background:#37d0a0; box-shadow:0 0 8px #37d0a0; margin-right:5px; animation:cadfx-blink 1.5s infinite; }
  @keyframes cadfx-blink{ 50%{ opacity:.3; } }
  #cadfx-mute{ margin-left:8px; cursor:pointer; width:auto; padding:4px 9px; background:#0b2036; color:#5fe0c0; border:1px solid #1f6f8f; border-radius:6px; font-size:12px; }
  #cadfx-ticker{ position:fixed; left:0; right:0; bottom:0; height:22px; z-index:9991; overflow:hidden;
    background:linear-gradient(90deg,#081522,#0b2036,#081522); border-top:1px solid #1f6f8f; box-shadow:0 -4px 20px rgba(0,0,0,.5); }
  #cadfx-ticker span{ position:absolute; white-space:nowrap; font-family:monospace; font-size:11px; color:#5fe0c0; top:4px; text-shadow:0 0 6px rgba(55,208,160,.4); animation:cadfx-tick 40s linear infinite; }
  @keyframes cadfx-tick{ from{ transform:translateX(100vw);} to{ transform:translateX(-140%);} }
  #cadfx-boot{ position:fixed; inset:0; z-index:99999; background:radial-gradient(circle at 50% 40%, #06121f, #02060b); display:flex; align-items:center; justify-content:center; transition:opacity .8s; }
  #cadfx-boot.gone{ opacity:0; }
  #cadfx-boot .bootcard{ width:min(560px,90vw); text-align:center; font-family:monospace; }
  #cadfx-boot .bootlogo{ font-size:22px; color:#5fe0c0; letter-spacing:3px; text-shadow:0 0 18px rgba(55,208,160,.8); margin-bottom:16px; }
  #cadfx-boot .bootlines{ text-align:left; min-height:160px; color:#7fd0e0; font-size:13px; line-height:1.85; text-shadow:0 0 6px rgba(55,208,160,.3); }
  #cadfx-boot .bootlines .ok{ color:#37d0a0; }
  #cadfx-bootbtn{ width:auto; margin-top:14px; padding:12px 26px; font-family:monospace; letter-spacing:2px; background:#0b2036; color:#5fe0c0; border:1px solid #37d0a0; border-radius:8px; cursor:pointer; box-shadow:0 0 22px rgba(55,208,160,.4); }
  #cadfx-bootbtn:hover{ background:#123049; }
  .grid{ padding-bottom:26px!important; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const mk = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html != null) e.innerHTML = html; return e; };
  document.body.appendChild(mk('div', 'cadfx-scan'));
  document.body.appendChild(mk('div', 'cadfx-vig'));

  // ---- header HUD chips + mute ----
  const header = document.querySelector('header');
  if (header) {
    const hud = mk('div', 'cadfx-hud',
      '<span class="cadfx-chip"><span class="cadfx-led"></span>UPLINK <b>SECURE</b></span>' +
      '<span class="cadfx-chip">GPS <b id="cadfx-gps">12</b> SATS</span>' +
      '<span class="cadfx-chip">CORE <b id="cadfx-temp">41.2°</b></span>');
    // insert right after the H1
    const h1 = header.querySelector('h1');
    if (h1 && h1.nextSibling) header.insertBefore(hud, h1.nextSibling); else header.appendChild(hud);
    const mute = mk('button', 'cadfx-mute', window.SFX && SFX.isMuted() ? '🔇' : '🔊');
    mute.setAttribute('data-nosfx', '');
    mute.title = 'Toggle sound';
    mute.onclick = () => { const m = window.SFX ? SFX.toggleMute() : true; mute.textContent = m ? '🔇' : '🔊'; if (!m && window.SFX) SFX.blip(); };
    header.appendChild(mute);
  }

  // ---- telemetry ticker (cosmetic flight-deck flavor) ----
  const ticker = mk('div', 'cadfx-ticker');
  const tickerText =
    '◉ DISPATCH CORE NOMINAL ◉ UPLINK SECURE ◉ ER:LC LINK ESTABLISHED ◉ GPS LOCK 12/12 ◉ TACTICAL MAP SYNCED ◉ ' +
    'SENSOR ARRAY ONLINE ◉ ENCRYPTION AES-256 ◉ REDUNDANCY OK ◉ ALL UNITS MONITORED ◉ SIGNAL INTEGRITY 100% ◉';
  ticker.appendChild(mk('span', null, tickerText + ' &nbsp; ' + tickerText));
  document.body.appendChild(ticker);

  // ---- radar sweep over the map ----
  const cv = document.getElementById('map');
  if (cv && cv.parentElement) {
    const radar = mk('div', 'cadfx-radar');
    cv.parentElement.style.position = cv.parentElement.style.position || 'relative';
    cv.parentElement.insertBefore(radar, cv.nextSibling);
    const place = () => { radar.style.left = cv.offsetLeft + 'px'; radar.style.top = cv.offsetTop + 'px'; radar.style.width = cv.clientWidth + 'px'; radar.style.height = cv.clientHeight + 'px'; };
    place();
    window.addEventListener('resize', place);
    setInterval(place, 2000);
  }

  // ---- flicker the cosmetic readouts a little ----
  setInterval(() => {
    const gps = document.getElementById('cadfx-gps'); const temp = document.getElementById('cadfx-temp');
    if (gps) gps.textContent = String(11 + Math.floor(Math.random() * 2));
    if (temp) temp.textContent = (40 + Math.random() * 3).toFixed(1) + '°';
  }, 3000);

  // ---- wire SFX to the real dispatch actions ----
  const S = () => window.SFX || { click() {}, blip() {}, confirm() {}, siren() {}, alert() {}, error() {} };
  const hook = (id, fn) => { const el = document.getElementById(id); if (el) { el.setAttribute('data-nosfx', ''); el.addEventListener('click', fn); } };
  hook('btn-panic', () => S().siren());
  hook('btn-sig', () => S().alert());
  hook('c-add', () => S().confirm());
  hook('z-save', () => S().confirm());
  hook('z-toggle', () => S().blip());

  // Play a siren whenever a NEW alert appears in the banner (panic/signal escalation).
  const banner = document.getElementById('banner');
  if (banner) {
    let wasOn = false;
    new MutationObserver(() => {
      const on = banner.classList.contains('on');
      if (on && !wasOn) S().siren();
      wasOn = on;
    }).observe(banner, { attributes: true, childList: true, attributeFilter: ['class'] });
  }

  // ---- boot sequence ----
  const boot = mk('div', 'cadfx-boot',
    '<div class="bootcard"><div class="bootlogo">◉ SENTINEL DISPATCH CORE</div>' +
    '<div class="bootlines" id="cadfx-bootlines"></div>' +
    '<button id="cadfx-bootbtn" data-nosfx>◉ INITIALIZE</button></div>');
  document.body.appendChild(boot);
  const LINES = [
    'BOOTING DISPATCH CORE v4.8 …',
    'MOUNTING SENSOR ARRAY … <span class="ok">OK</span>',
    'CALIBRATING GPS LOCK … <span class="ok">12 SATELLITES</span>',
    'ESTABLISHING ER:LC UPLINK … <span class="ok">SECURE</span>',
    'DECRYPTING TACTICAL MAP … <span class="ok">OK</span>',
    'ARMING PANIC & SIGNAL-100 SUBSYSTEMS … <span class="ok">READY</span>',
    'DISPATCH CORE ONLINE — WELCOME, DISPATCHER.',
  ];
  const btn = boot.querySelector('#cadfx-bootbtn');
  const linesEl = boot.querySelector('#cadfx-bootlines');
  btn.onclick = () => {
    if (window.SFX) SFX.powerOn();
    btn.style.display = 'none';
    let i = 0;
    const iv = setInterval(() => {
      if (i >= LINES.length) {
        clearInterval(iv);
        setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 800); }, 550);
        return;
      }
      linesEl.insertAdjacentHTML('beforeend', `<div>&gt; ${LINES[i]}</div>`);
      if (window.SFX) (i === LINES.length - 1 ? SFX.confirm() : SFX.blip());
      i++;
    }, 300);
  };
})();
