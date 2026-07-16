/* Site-wide owner effects engine. Fetches /api/site-control and applies whatever
   pranks the owner has toggled. If the viewer is the owner, shows a floating
   escape bar so effects (and the kill switch) are never a trap. Self-contained. */
(function () {
  'use strict';

  // Inject the effect stylesheet once.
  const css = `
    html.fx-upsidedown body { transform: rotate(180deg); }
    html.fx-comic * { font-family: "Comic Sans MS", "Comic Sans", cursive !important; }
    html.fx-gray { filter: grayscale(1); }
    html.fx-blur body { filter: blur(2.4px); }
    html.fx-disco body { animation: fx-hue 6s linear infinite; }
    @keyframes fx-hue { to { filter: hue-rotate(360deg); } }
    html.fx-spooky body { animation: fx-shake 0.35s infinite; }
    @keyframes fx-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-2px,1px)} 50%{transform:translate(2px,-1px)} 75%{transform:translate(-1px,-2px)} }
    html.fx-spooky::after { content:""; position:fixed; inset:0; z-index:9998; pointer-events:none; background:radial-gradient(circle at 50% 40%, transparent 30%, rgba(0,0,0,0.85) 100%); }
    html.fx-crt::before { content:""; position:fixed; inset:0; z-index:9997; pointer-events:none; background:repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0, rgba(0,0,0,0.14) 1px, transparent 2px, transparent 3px); mix-blend-mode:multiply; }
    .fx-piece { position:fixed; top:-30px; z-index:9990; pointer-events:none; will-change:transform; animation:fx-fall linear forwards; }
    @keyframes fx-fall { to { transform: translateY(110vh) rotate(360deg); } }
    #fx-banner { position:fixed; top:0; left:0; right:0; z-index:9999; background:linear-gradient(90deg,#5865f2,#e91e63); color:#fff; text-align:center; padding:8px 14px; font:600 0.9rem system-ui; box-shadow:0 4px 14px rgba(0,0,0,0.4); }
    #fx-counter { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:9999; background:#111827; color:#ffd23f; border:1px solid #ffd23f; border-radius:14px; padding:14px 22px; font:700 1rem system-ui; box-shadow:0 10px 40px rgba(0,0,0,0.6); animation:fx-pop 0.4s ease; }
    @keyframes fx-pop { from{opacity:0;transform:translate(-50%,20px)} to{opacity:1;transform:translate(-50%,0)} }
    #owner-fx-bar { position:fixed; bottom:14px; left:50%; transform:translateX(-50%); z-index:10000; display:flex; gap:10px; align-items:center; background:rgba(15,23,42,0.92); color:#e6edf3; border:1px solid #5865f2; border-radius:999px; padding:7px 14px; font:600 0.82rem system-ui; box-shadow:0 10px 40px rgba(0,0,0,0.6); backdrop-filter:blur(8px); }
    #owner-fx-bar a, #owner-fx-bar button { color:#8b95ff; text-decoration:none; background:none; border:none; cursor:pointer; font:inherit; }
    #owner-fx-bar button { color:#ff6b6b; }
    #owner-fx-bar .dot { width:8px; height:8px; border-radius:50%; background:#2ecc71; }
    #fx-creditsteal { position:fixed; inset:0; z-index:10001; background:rgba(2,6,23,0.94); display:flex; align-items:center; justify-content:center; text-align:center; color:#fff; animation:fx-pop 0.3s ease; }
    #fx-creditsteal .cs-title { font:800 1.5rem system-ui; color:#ff6b6b; margin-bottom:16px; letter-spacing:0.05em; }
    #fx-creditsteal .cs-num { font:900 3.6rem ui-monospace,monospace; color:#ffd23f; text-shadow:0 0 34px rgba(255,210,63,0.55); }
    #fx-creditsteal .cs-sub { margin-top:16px; color:#9aa7b4; font:500 0.95rem system-ui; }
    #fx-chat { position:fixed; bottom:14px; right:14px; z-index:10002; width:320px; max-width:92vw; background:#0b1020; border:1px solid #5865f2; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.7); display:flex; flex-direction:column; overflow:hidden; animation:fx-pop 0.25s ease; font-family:system-ui,sans-serif; }
    #fx-chat .chat-head { background:#5865f2; color:#fff; padding:10px 14px; font-weight:700; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center; }
    #fx-chat .chat-head button { background:none; border:none; color:#fff; cursor:pointer; font-size:1.1rem; line-height:1; }
    #fx-chat .chat-body { padding:12px; height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
    .chat-msg { max-width:80%; padding:8px 12px; border-radius:12px; font-size:0.88rem; line-height:1.4; white-space:pre-wrap; word-break:break-word; }
    .chat-msg.left { align-self:flex-start; background:#1c2330; color:#e6edf3; border-bottom-left-radius:3px; }
    .chat-msg.right { align-self:flex-end; background:#5865f2; color:#fff; border-bottom-right-radius:3px; }
    #fx-chat .chat-input { display:flex; gap:6px; padding:10px; border-top:1px solid #2a3340; }
    #fx-chat .chat-input input { flex:1; background:#161b22; color:#e6edf3; border:1px solid #2a3340; border-radius:8px; padding:8px 10px; font-size:0.85rem; outline:none; }
    #fx-chat .chat-input button { background:#5865f2; color:#fff; border:none; border-radius:8px; padding:0 14px; font-weight:600; cursor:pointer; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let rainTimers = [];
  function rain(emoji, sizeRem) {
    const spawn = () => {
      const p = document.createElement('div');
      p.className = 'fx-piece';
      p.textContent = emoji;
      p.style.left = Math.random() * 100 + 'vw';
      p.style.fontSize = (sizeRem || 1.4) + 'rem';
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      p.style.opacity = 0.5 + Math.random() * 0.5;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 9000);
    };
    rainTimers.push(setInterval(spawn, 350));
  }

  function creditStealOverlay() {
    if (document.getElementById('fx-creditsteal')) return;
    const o = document.createElement('div');
    o.id = 'fx-creditsteal';
    o.innerHTML = '<div><div class="cs-title">💸 STEALING YOUR CREDITS…</div><div class="cs-num">1,000,000</div><div class="cs-sub">Hold still, this won\'t hurt (much) 😈</div></div>';
    document.body.appendChild(o);
    const numEl = o.querySelector('.cs-num');
    let n = 1000000;
    const t = setInterval(() => {
      n = Math.max(0, n - Math.ceil(n / 12));
      numEl.textContent = n.toLocaleString();
      if (n <= 0) {
        clearInterval(t);
        numEl.textContent = '0';
        o.querySelector('.cs-title').textContent = '✅ CREDITS STOLEN';
        o.querySelector('.cs-sub').textContent = 'Thanks for your contribution. 🫡';
        setTimeout(() => o.remove(), 2600); // don't trap anyone permanently
      }
    }, 170);
  }

  function applyEffects(fx) {
    const root = document.documentElement;
    root.classList.toggle('fx-upsidedown', !!fx.upsideDown);
    root.classList.toggle('fx-comic', !!fx.comicSans);
    root.classList.toggle('fx-disco', !!fx.disco);
    root.classList.toggle('fx-crt', !!fx.crt);
    root.classList.toggle('fx-gray', !!fx.grayscale);
    root.classList.toggle('fx-blur', !!fx.blur);
    root.classList.toggle('fx-spooky', !!fx.spooky);

    if (fx.banner) {
      const b = document.createElement('div');
      b.id = 'fx-banner'; b.textContent = fx.banner;
      document.body.appendChild(b);
      document.body.style.paddingTop = '38px';
    }
    if (fx.fakeCounter) {
      const c = document.createElement('div');
      c.id = 'fx-counter';
      c.textContent = '🎉 You are visitor #1,000,000! You win… absolutely nothing.';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 7000);
    }
    if (fx.snow) rain('❄️', 1.3);
    if (fx.emojiRain) rain(fx.emojiRain, 1.8);
    if (fx.creditSteal) creditStealOverlay();
  }

  function ownerBar() {
    const bar = document.createElement('div');
    bar.id = 'owner-fx-bar';
    bar.innerHTML =
      '<span class="dot"></span><span>Owner mode</span>' +
      '<a href="/dashboard#owner">Control panel</a>' +
      '<a href="/maintenance">Preview 503</a>' +
      '<button id="fx-clear" title="Turn off every effect">✕ Clear all</button>';
    document.body.appendChild(bar);
    const clr = document.getElementById('fx-clear');
    if (clr) clr.addEventListener('click', async () => {
      clr.textContent = '…';
      try {
        await fetch('/api/site-control', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maintenance: false, banner: '', upsideDown: false, comicSans: false, snow: false, disco: false, crt: false, grayscale: false, blur: false, spooky: false, fakeCounter: false, emojiRain: '' }),
        });
      } catch { /* ignore */ }
      location.reload();
    });
  }

  // A signature of everything that matters, so we can detect owner changes live.
  function signature(s) {
    return JSON.stringify({ m: s.maintenance, b: s.banned, e: s.effects || {} });
  }

  const onDashboard = location.pathname.indexOf('/dashboard') === 0;
  let sig = null;

  // Two-way staff chat panel (visitor side).
  let chatPanel = null;
  function ensureChatPanel() {
    if (chatPanel) { chatPanel.style.display = 'flex'; return chatPanel; }
    chatPanel = document.createElement('div');
    chatPanel.id = 'fx-chat';
    chatPanel.innerHTML =
      '<div class="chat-head">💬 Staff Chat <button title="minimize">–</button></div>' +
      '<div class="chat-body"></div>' +
      '<form class="chat-input"><input type="text" placeholder="Type a reply…" maxlength="500" autocomplete="off" /><button type="submit">Send</button></form>';
    document.body.appendChild(chatPanel);
    const body = chatPanel.querySelector('.chat-body');
    chatPanel.querySelector('.chat-head button').addEventListener('click', () => {
      body.style.display = body.style.display === 'none' ? 'flex' : 'none';
      chatPanel.querySelector('.chat-input').style.display = body.style.display === 'none' ? 'none' : 'flex';
    });
    chatPanel.querySelector('.chat-input').addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = chatPanel.querySelector('input');
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      addChatMsg('right', text);
      try { await fetch('/api/chat/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); } catch { /* ignore */ }
    });
    return chatPanel;
  }
  function addChatMsg(side, text) {
    ensureChatPanel();
    const body = chatPanel.querySelector('.chat-body');
    const m = document.createElement('div');
    m.className = 'chat-msg ' + side;
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }

  // Heartbeat: reports who/where you are (for the owner's presence list) and
  // picks up any moderator message aimed at you.
  async function heartbeat() {
    try {
      const r = await (await fetch('/api/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname + location.hash }),
      })).json();
      if (r && Array.isArray(r.messages)) r.messages.forEach((t) => addChatMsg('left', t));
    } catch { /* ignore */ }
  }

  async function init() {
    let s;
    try { s = await (await fetch('/api/site-control')).json(); } catch { return; }
    sig = signature(s);
    applyEffects(s.effects || {});
    if (s.owner) ownerBar();
    heartbeat();
    setInterval(heartbeat, 5000);   // presence + mod-message pickup
    setInterval(poll, 3000);        // live effect / kill-switch push
  }

  async function poll() {
    let s;
    try { s = await (await fetch('/api/site-control')).json(); } catch { return; }
    const cur = signature(s);
    if (cur === sig) return;      // nothing changed
    sig = cur;
    // The control surface (dashboard) never force-reloads itself while you toggle.
    // Everyone else auto-reloads → they instantly get the effect / kill switch / ban.
    if (!onDashboard) location.reload();
  }

  init();
})();
