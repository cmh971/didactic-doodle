// landing-live.js — makes the landing feel alive: a scroll-progress bar, pulsing
// charts in the hero preview card, and a rolling "live activity" feed so the mock
// dashboard looks like a real, breathing product. Self-contained (injects its own CSS).
(function () {
  if (window.__landingLive) return;
  window.__landingLive = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.textContent = `
    #scroll-prog { position: fixed; top:0; left:0; height:3px; width:100%; transform-origin:left; transform:scaleX(0); z-index:1000002;
      background: linear-gradient(90deg,#5865f2,#37d0a0); box-shadow:0 0 12px rgba(55,208,160,.6); will-change: transform; }
    .lp-mini-bars i { transition: height .8s cubic-bezier(.4,1.4,.5,1); }
    #lp-feed { margin-top:12px; display:flex; flex-direction:column; gap:6px; }
    .lp-feed-row { display:flex; align-items:center; gap:8px; font-size:12px; color:#9fb2d4;
      background:rgba(255,255,255,.03); border:1px solid rgba(148,163,184,.12); border-radius:8px; padding:6px 10px;
      opacity:0; transform:translateY(-6px); transition:opacity .3s ease, transform .3s cubic-bezier(.34,1.4,.64,1); }
    .lp-feed-row.in { opacity:1; transform:none; }
    .lp-feed-row .fe { font-size:14px; }
    .lp-feed-row .ft { margin-left:auto; color:#5b6a8a; font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(style);

  // ---- scroll progress bar ----
  const bar = document.createElement('div'); bar.id = 'scroll-prog'; document.body.appendChild(bar);
  addEventListener('scroll', () => {
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    bar.style.transform = `scaleX(${Math.min(1, p || 0)})`;
  }, { passive: true });

  // ---- pulsing preview charts ----
  const bars = document.querySelectorAll('.lp-mini-bars i');
  if (bars.length && !reduce) {
    setInterval(() => bars.forEach((b) => { b.style.height = (24 + Math.random() * 72) + '%'; }), 1400);
  }

  // ---- live activity feed ----
  const body = document.querySelector('.lp-preview-body');
  if (body) {
    const feed = document.createElement('div'); feed.id = 'lp-feed'; body.appendChild(feed);
    const EVENTS = [
      ['🛡️', 'Blocked a raid attempt'], ['🎫', 'New ticket opened'], ['🪙', '+250 credits paid'],
      ['🚨', '911 call dispatched'], ['📈', 'Member leveled up'], ['🤖', 'AI answered a question'],
      ['👮', 'Warrant issued'], ['🪙', 'Daily reward claimed'], ['🌩️', 'Radar refreshed'],
      ['✅', 'Automation fired'], ['📷', 'Bodycam clip saved'], ['⚖️', 'Verdict locked'],
    ];
    let i = Math.floor(Math.random() * EVENTS.length);
    function push() {
      const [e, t] = EVENTS[i % EVENTS.length]; i++;
      const row = document.createElement('div'); row.className = 'lp-feed-row';
      row.innerHTML = `<span class="fe">${e}</span><span>${t}</span><span class="ft">now</span>`;
      feed.prepend(row);
      requestAnimationFrame(() => row.classList.add('in'));
      // age the older rows
      [...feed.children].forEach((r, idx) => { if (idx > 0) { const ft = r.querySelector('.ft'); if (ft) ft.textContent = idx + 'm'; } });
      while (feed.children.length > 4) feed.lastChild.remove();
    }
    push(); setTimeout(push, 400); setInterval(push, reduce ? 5000 : 2300);
  }
})();
