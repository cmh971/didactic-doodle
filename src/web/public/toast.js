// toast.js — tiny reusable toast/notification system with optional Undo.
//   window.toast('Saved!', { icon:'✅', undo: () => {...}, duration: 3500 })
(function () {
  if (window.toast) return;
  const wrap = document.createElement('div');
  wrap.id = 'toast-wrap';
  wrap.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000001;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;';
  const mount = () => { if (!wrap.isConnected && document.body) document.body.appendChild(wrap); };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);

  window.toast = function (msg, opts = {}) {
    mount();
    const t = document.createElement('div');
    t.style.cssText = 'pointer-events:auto;background:#0e1424;border:1px solid #24304d;color:#e8eefc;padding:12px 16px;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.6);font:600 14px system-ui;display:flex;align-items:center;gap:12px;opacity:0;transform:translateY(10px) scale(.96);transition:opacity .22s ease,transform .22s cubic-bezier(.34,1.4,.64,1);max-width:90vw;';
    const icon = document.createElement('span'); icon.textContent = opts.icon || '✅';
    const text = document.createElement('span'); text.textContent = msg;
    t.appendChild(icon); t.appendChild(text);
    if (opts.undo) {
      const u = document.createElement('button');
      u.textContent = 'Undo';
      u.style.cssText = 'background:#37d0a0;color:#04121f;border:none;border-radius:8px;padding:5px 12px;font-weight:700;cursor:pointer;';
      u.onclick = () => { try { opts.undo(); } catch { /* ignore */ } dismiss(); };
      t.appendChild(u);
    }
    wrap.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'none'; });
    const to = setTimeout(dismiss, opts.duration || 3500);
    function dismiss() { clearTimeout(to); t.style.opacity = '0'; t.style.transform = 'translateY(10px) scale(.96)'; setTimeout(() => t.remove(), 220); }
    return dismiss;
  };
})();
