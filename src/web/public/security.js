// security.js — aggressive self-XSS deterrent.
//   • Re-fires the "STOP" console warning continuously.
//   • Detects an open console (size heuristic + console-render bait).
//   • On detection: a full "SITE LOCKED / SELF-DESTRUCT" screen with Request-Access.
//
// HONEST NOTE: client code can never be truly hidden, and this can't literally
// destroy anything (the server keeps running, and it's bypassable by disabling JS).
// It's a strong DETERRENT for scam victims — the REAL protection is server-side,
// where nothing sensitive is ever sent to the browser. The lockdown is dismissible
// so the owner isn't stranded while debugging.
(function () {
  if (window.__sec) return;
  window.__sec = true;

  const warn = () => {
    try {
      console.log('%c✋ STOP', 'background:#ef4444;color:#fff;font-size:44px;font-weight:900;padding:6px 20px;border-radius:10px');
      console.log('%cIf someone told you to paste or type ANYTHING in this console, you are being SCAMMED (99%% chance).', 'font-size:17px;color:#f59e0b;font-weight:800');
      console.log('%cPasting code here can hand over your account. Close this and paste NOTHING.', 'font-size:14px;color:#cbd5e1');
    } catch { /* blocked */ }
  };
  warn();
  setInterval(warn, 2500); // keep re-printing so it's always visible

  let acknowledged = sessionStorage.getItem('sec-ack') === '1';
  let locked = false;

  function lockdown() {
    if (locked || acknowledged) return;
    locked = true;
    const o = document.createElement('div');
    o.id = 'sec-lock';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#070102;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;';
    o.innerHTML = `<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(239,68,68,.06) 0 2px,transparent 2px 4px);pointer-events:none"></div>
      <div style="position:relative;max-width:500px;text-align:center;padding:34px;border:2px solid #ef4444;border-radius:20px;background:#12060a;box-shadow:0 0 80px rgba(239,68,68,.5)">
        <div style="font-size:64px;animation:secPulse 1s infinite">🛑</div>
        <h1 style="color:#ef4444;margin:8px 0 4px;letter-spacing:2px">SITE LOCKED</h1>
        <p style="color:#fca5a5;font-weight:700;margin:0 0 8px">SELF-DESTRUCT / SECURITY LOCKDOWN ENGAGED</p>
        <p style="color:#e8eefc;line-height:1.65">The developer console was opened. If someone asked you to do this or paste something,
          <b style="color:#f59e0b">they are trying to scam you.</b> Do not continue.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">
          <button id="sec-req" style="background:#5865f2;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-weight:800;cursor:pointer">🔐 Request access</button>
          <button id="sec-cont" style="background:#16233d;color:#93a1c0;border:1px solid #24304d;border-radius:10px;padding:12px 20px;font-weight:600;cursor:pointer">I'm a developer — continue</button>
        </div>
        <div id="sec-reqform" style="display:none;margin-top:14px;text-align:left">
          <input id="sec-name" placeholder="Your name / handle" style="width:100%;margin:6px 0;padding:11px;border-radius:8px;background:#0b1220;border:1px solid #24304d;color:#fff">
          <input id="sec-reason" placeholder="Why do you need console access?" style="width:100%;margin:6px 0;padding:11px;border-radius:8px;background:#0b1220;border:1px solid #24304d;color:#fff">
          <button id="sec-send" style="background:#37d0a0;color:#04121f;border:none;border-radius:8px;padding:11px 16px;font-weight:800;cursor:pointer;width:100%">Send to the owner &amp; dev</button>
          <p id="sec-msg" style="color:#93a1c0;font-size:12px;margin-top:8px"></p>
        </div>
      </div>
      <style>@keyframes secPulse{50%{transform:scale(1.15);opacity:.6}}</style>`;
    document.documentElement.appendChild(o);
    o.querySelector('#sec-cont').onclick = () => { acknowledged = true; sessionStorage.setItem('sec-ack', '1'); o.remove(); locked = false; };
    o.querySelector('#sec-req').onclick = () => { o.querySelector('#sec-reqform').style.display = 'block'; };
    o.querySelector('#sec-send').onclick = async () => {
      const name = o.querySelector('#sec-name').value, reason = o.querySelector('#sec-reason').value;
      const msg = o.querySelector('#sec-msg');
      try {
        await fetch('/api/access-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, reason, page: location.pathname }) });
        msg.textContent = '✅ Sent — the owner and lead dev both got your request.';
      } catch { msg.textContent = 'Could not send — try again.'; }
    };
  }

  // Detection 1: docked DevTools shrinks the viewport.
  setInterval(() => {
    const th = 170;
    if ((outerWidth - innerWidth > th) || (outerHeight - innerHeight > th)) lockdown();
  }, 1000);

  // Detection 2: console-render bait — the getter fires only when the console
  // actually renders the object (i.e., DevTools is open, even when undocked).
  const bait = {};
  Object.defineProperty(bait, 'CONSOLE_DETECTED', { get() { lockdown(); return ''; } });
  setInterval(() => { try { console.log('%c%o', 'font-size:0', bait); } catch { /* ignore */ } }, 1500);
})();
