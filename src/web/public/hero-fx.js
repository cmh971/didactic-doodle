// hero-fx.js — the "AAA UI" layer for the landing page. Vanilla, self-contained:
//   • Floating particle field (canvas)         • Cursor trail
//   • Haptic taps (navigator.vibrate)          • Synthesized UI sounds
//   • Spring "pop" press on buttons            • ⌘K / Ctrl+K command palette
// All gated behind prefers-reduced-motion where it matters.
(function () {
  if (window.__herofx) return;
  window.__herofx = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- tiny sound engine (Web Audio, no files) ---------------- */
  let actx;
  function beep(freq, dur = 0.05, type = 'sine', gain = 0.028) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio blocked until gesture */ }
  }

  /* ---------------- haptics + sound + spring press ---------------- */
  const style = document.createElement('style');
  style.textContent = `
    .fx-pop { animation: fxPop .34s cubic-bezier(.34,1.56,.64,1); }
    @keyframes fxPop { 0% { transform: scale(.9); } 100% { transform: scale(1); } }
    #fx-trail span { position: fixed; top:0; left:0; width:7px; height:7px; border-radius:50%; pointer-events:none; z-index:1; margin:-3.5px 0 0 -3.5px;
      background: radial-gradient(circle, rgba(139,147,255,.9), rgba(55,208,160,.4) 60%, transparent); mix-blend-mode: screen; }
    #fx-particles { position: fixed; inset:0; z-index:0; pointer-events:none; opacity:.6; }
    /* command palette */
    #cmdk { position: fixed; inset:0; z-index:1000000; display:none; align-items:flex-start; justify-content:center; background:rgba(2,4,10,.6); backdrop-filter: blur(6px); }
    #cmdk.open { display:flex; animation: ckFade .2s ease; }
    @keyframes ckFade { from { opacity:0; } to { opacity:1; } }
    #cmdk .ck-box { margin-top:12vh; width:min(560px,92vw); background:#0e1424; border:1px solid #24304d; border-radius:16px; box-shadow:0 30px 80px rgba(0,0,0,.7); overflow:hidden; animation: ckPop .22s cubic-bezier(.34,1.4,.64,1); }
    @keyframes ckPop { from { transform: translateY(-12px) scale(.98); opacity:0; } to { transform:none; opacity:1; } }
    #cmdk input { width:100%; padding:18px 20px; background:transparent; border:none; outline:none; color:#e8eefc; font-size:17px; border-bottom:1px solid #24304d; }
    #cmdk .ck-list { max-height:320px; overflow:auto; padding:8px; }
    #cmdk .ck-item { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:10px; cursor:pointer; color:#c3cfe4; }
    #cmdk .ck-item .e { font-size:18px; }
    #cmdk .ck-item small { margin-left:auto; color:#5b6a8a; font-size:12px; }
    #cmdk .ck-item.sel, #cmdk .ck-item:hover { background:rgba(88,101,242,.18); color:#fff; }
    #cmdk-hint { position: fixed; right:16px; bottom:16px; z-index:900; background:rgba(14,20,36,.85); border:1px solid #24304d; color:#93a1c0; font:600 12px system-ui; padding:8px 12px; border-radius:999px; cursor:pointer; backdrop-filter: blur(8px); }
    #cmdk-hint kbd { background:#0b1220; border:1px solid #24304d; border-radius:5px; padding:1px 6px; }
    @media (prefers-reduced-motion: reduce) { .fx-pop { animation:none; } #fx-particles,#fx-trail { display:none; } }
  `;
  document.head.appendChild(style);

  const interactive = (t) => t && t.closest && t.closest('a, button, .btn, .lp-chip, summary');
  document.addEventListener('pointerdown', (e) => {
    const b = interactive(e.target); if (!b) return;
    if (navigator.vibrate) navigator.vibrate(12);           // haptic tap (mobile)
    beep(560, 0.055, 'square', 0.04);                        // click sound
    if (!reduce) { b.classList.remove('fx-pop'); void b.offsetWidth; b.classList.add('fx-pop'); } // spring pop
  }, true);
  document.addEventListener('animationend', (e) => { e.target.classList && e.target.classList.remove('fx-pop'); }, true);
  let lastHover = 0;
  document.addEventListener('pointerover', (e) => {
    if (!e.target.closest) return; const b = e.target.closest('a.btn, button.btn');
    if (b && Date.now() - lastHover > 60) { lastHover = Date.now(); beep(1500, 0.025, 'sine', 0.014); }
  }, true);

  if (!reduce) {
    /* ---------------- particle field ---------------- */
    const cv = document.createElement('canvas'); cv.id = 'fx-particles'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W, H, parts;
    function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; parts = Array.from({ length: Math.min(70, Math.floor(W / 22)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.6, s: Math.random() * 0.4 + 0.15, sway: Math.random() * 2 * Math.PI, hue: Math.random() < 0.5 ? '139,147,255' : '55,208,160' })); }
    resize(); addEventListener('resize', resize);
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.s; p.sway += 0.01; p.x += Math.sin(p.sway) * 0.3;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(${p.hue},${0.5 + p.r / 6})`; ctx.shadowColor = `rgba(${p.hue},.8)`; ctx.shadowBlur = 8; ctx.fill();
      }
      requestAnimationFrame(draw);
    })();

    /* ---------------- cursor trail ---------------- */
    const trail = document.createElement('div'); trail.id = 'fx-trail';
    const dots = Array.from({ length: 6 }, () => { const s = document.createElement('span'); trail.appendChild(s); return { el: s, x: innerWidth / 2, y: innerHeight / 2 }; });
    document.body.appendChild(trail);
    let mx = innerWidth / 2, my = innerHeight / 2;
    addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
    (function trailLoop() {
      let px = mx, py = my;
      for (const d of dots) { d.x += (px - d.x) * 0.35; d.y += (py - d.y) * 0.35; d.el.style.transform = `translate(${d.x}px,${d.y}px)`; px = d.x; py = d.y; }
      requestAnimationFrame(trailLoop);
    })();
  }

  /* ---------------- ⌘K command palette ---------------- */
  const ITEMS = [
    { e: '📊', label: 'Open Dashboard', href: '/dashboard', hint: 'Control center' },
    { e: '📘', label: 'Documentation', href: '/docs', hint: 'Guides' },
    { e: '🧩', label: 'All Commands', href: '/commands', hint: '612 commands' },
    { e: '🌩️', label: 'Weather Hub', href: '/weather-hub', hint: 'Radar · cams · AI' },
    { e: '🚨', label: 'CAD Console', href: '/cad-hub', hint: 'Dispatch' },
    { e: '🗂️', label: 'Projects', href: '/projects', hint: 'Portfolio' },
    { e: '⌨️', label: 'Controls & Keybinds', href: '/keybinds', hint: 'Rebind · yoke' },
    { e: '📥', label: 'Apply / Join the Team', href: '/apply', hint: 'Dev · mod' },
    { e: '📈', label: 'Status', href: '/status', hint: 'Health' },
    { e: '🏠', label: 'Home', href: '/', hint: 'Landing' },
  ];
  const modal = document.createElement('div');
  modal.id = 'cmdk';
  modal.innerHTML = `<div class="ck-box"><input placeholder="Type a page or action…  (Esc to close)" aria-label="Command palette"><div class="ck-list"></div></div>`;
  document.body.appendChild(modal);
  const input = modal.querySelector('input'), list = modal.querySelector('.ck-list');
  let sel = 0, filtered = ITEMS;
  function render() {
    list.innerHTML = filtered.map((it, i) => `<div class="ck-item ${i === sel ? 'sel' : ''}" data-i="${i}"><span class="e">${it.e}</span><span>${it.label}</span><small>${it.hint}</small></div>`).join('') || '<div class="ck-item">No matches</div>';
    list.querySelectorAll('.ck-item[data-i]').forEach((el) => el.addEventListener('click', () => go(Number(el.dataset.i))));
  }
  function go(i) { const it = filtered[i]; if (it) { beep(880, 0.08, 'sine', 0.05); location.href = it.href; } }
  function open() { modal.classList.add('open'); input.value = ''; sel = 0; filtered = ITEMS; render(); setTimeout(() => input.focus(), 30); beep(1200, 0.06, 'sine', 0.03); }
  function close() { modal.classList.remove('open'); }
  input.addEventListener('input', () => { const q = input.value.toLowerCase(); filtered = ITEMS.filter((it) => (it.label + ' ' + it.hint).toLowerCase().includes(q)); sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(filtered.length - 1, sel + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') go(sel);
    else if (e.key === 'Escape') close();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.classList.contains('open') ? close() : open(); } });

  const hint = document.createElement('div'); hint.id = 'cmdk-hint'; hint.innerHTML = 'Press <kbd>Ctrl</kbd> <kbd>K</kbd>'; hint.onclick = open;
  document.body.appendChild(hint);
})();
