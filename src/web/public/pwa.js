/* =====================================================================
   PWA install experience.
   • Registers the service worker (makes the site installable).
   • Captures the browser's install prompt (Chrome/Edge on Windows).
   • After the user logs in, shows an app-store-style "download" card:
       - Desktop  → "Download for Windows" (installs the PWA as a desktop app)
       - Mobile   → "Add to Home Screen" (with per-platform instructions)
   • Self-contained: injects its own styles, no dependencies.
   ===================================================================== */
(function () {
  'use strict';

  var deferredPrompt = null;
  var SNOOZE_KEY = 'pwaSnoozeUntil';
  var NEVER_KEY = 'pwaNever';

  /* ---- register the service worker ---- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  /* ---- capture the install prompt (fires only on eligible desktop browsers) ---- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem(NEVER_KEY, '1'); } catch (e) {}
    deferredPrompt = null;
    var m = document.getElementById('pwa-modal');
    if (m) finishInstall(m);
  });

  /* ---- platform detection ---- */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var isMobile = isIOS || isAndroid || /Mobile|Tablet/.test(ua);

  function platform() {
    if (isMobile) return isIOS ? 'ios' : 'android';
    return 'desktop';
  }

  /* ---- styles ---- */
  function injectStyles() {
    if (document.getElementById('pwa-style')) return;
    var css = ''
      + '#pwa-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(5,7,12,.62);backdrop-filter:blur(6px);animation:pwaFade .25s ease}'
      + '@keyframes pwaFade{from{opacity:0}to{opacity:1}}'
      + '@keyframes pwaPop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}'
      + '#pwa-modal{width:min(420px,92vw);background:#12141c;color:#e9ecf5;border:1px solid rgba(255,255,255,.09);'
      + 'border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.6);padding:24px;animation:pwaPop .3s cubic-bezier(.2,.8,.2,1);font-family:system-ui,sans-serif}'
      + '#pwa-modal .pwa-top{display:flex;gap:15px;align-items:center}'
      + '#pwa-modal .pwa-icon{width:66px;height:66px;border-radius:16px;box-shadow:0 6px 18px rgba(88,101,242,.45);flex:0 0 auto}'
      + '#pwa-modal h3{margin:0 0 3px;font-size:19px}'
      + '#pwa-modal .pwa-dev{margin:0;font-size:12.5px;color:#9aa3bd}'
      + '#pwa-modal .pwa-stars{color:#ffc531;font-size:13px;letter-spacing:1px;margin-top:3px}'
      + '#pwa-modal .pwa-stars span{color:#6b7291;margin-left:6px}'
      + '#pwa-modal .pwa-meta{display:flex;justify-content:space-around;margin:18px 0 4px;text-align:center}'
      + '#pwa-modal .pwa-meta div{flex:1}'
      + '#pwa-modal .pwa-meta b{display:block;font-size:14px}'
      + '#pwa-modal .pwa-meta small{color:#9aa3bd;font-size:11px}'
      + '#pwa-modal .pwa-sep{width:1px;background:rgba(255,255,255,.08)}'
      + '#pwa-modal .pwa-body{margin:16px 0 4px;font-size:13.5px;color:#c4cbe0;line-height:1.5}'
      + '#pwa-modal .pwa-steps{margin:10px 0 0;padding-left:18px;font-size:13px;color:#c4cbe0;line-height:1.7}'
      + '#pwa-modal .pwa-actions{display:flex;gap:10px;margin-top:20px}'
      + '#pwa-modal button{border:0;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}'
      + '#pwa-modal .pwa-get{flex:1;background:linear-gradient(135deg,#5865f2,#8b5cf6);color:#fff}'
      + '#pwa-modal .pwa-get:hover{filter:brightness(1.08)}'
      + '#pwa-modal .pwa-get:disabled{opacity:.7;cursor:default}'
      + '#pwa-modal .pwa-later{background:rgba(255,255,255,.06);color:#c4cbe0}'
      + '#pwa-modal .pwa-never{display:block;width:100%;background:none;color:#6b7291;font-weight:500;font-size:12px;margin-top:10px;padding:4px}'
      + '#pwa-modal .pwa-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:18px;display:none}'
      + '#pwa-modal .pwa-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5865f2,#8b5cf6);transition:width .3s ease}'
      + '#pwa-modal .pwa-prog{display:none;text-align:center;font-size:12.5px;color:#9aa3bd;margin-top:8px}';
    var s = document.createElement('style');
    s.id = 'pwa-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- the modal ---- */
  function iconSrc() {
    var fav = document.querySelector('link[rel="icon"]');
    return (fav && fav.href) || '/icon-192.png';
  }
  function appName() {
    var t = (document.title || 'Dashboard').split('·')[0].trim();
    return t || 'Dashboard';
  }

  function close(overlay) {
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 200);
  }

  function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 3600 * 1000)); } catch (e) {}
  }

  function finishInstall(modal) {
    var bar = modal.querySelector('.pwa-bar i');
    var prog = modal.querySelector('.pwa-prog');
    if (bar) bar.style.width = '100%';
    if (prog) prog.textContent = '✓ Installed — check your Start menu / home screen!';
    var get = modal.querySelector('.pwa-get');
    if (get) { get.textContent = '✓ Installed'; get.disabled = true; }
    setTimeout(function () {
      var ov = document.getElementById('pwa-overlay');
      if (ov) close(ov);
    }, 1600);
  }

  function fakeDownload(modal, onDone) {
    var bar = modal.querySelector('.pwa-bar');
    var fill = modal.querySelector('.pwa-bar i');
    var prog = modal.querySelector('.pwa-prog');
    var get = modal.querySelector('.pwa-get');
    if (bar) bar.style.display = 'block';
    if (prog) { prog.style.display = 'block'; prog.textContent = 'Preparing download…'; }
    if (get) get.disabled = true;
    var pct = 0;
    var steps = ['Preparing download…', 'Downloading…', 'Installing…', 'Finishing up…'];
    var timer = setInterval(function () {
      pct = Math.min(100, pct + (8 + Math.random() * 16));
      if (fill) fill.style.width = pct + '%';
      if (prog) prog.textContent = steps[Math.min(steps.length - 1, Math.floor(pct / 26))] + ' ' + Math.floor(pct) + '%';
      if (pct >= 100) { clearInterval(timer); onDone(); }
    }, 260);
  }

  function show(opts) {
    injectStyles();
    var mobile = platform() !== 'desktop';
    var overlay = document.createElement('div');
    overlay.id = 'pwa-overlay';

    var stars = '★★★★<span style="color:#ffc531">½</span>';
    var sizeTxt = mobile ? '2.4 MB' : '3.1 MB';
    var getLabel = mobile ? (isIOS ? '＋ Add to Home Screen' : '⬇ Install App') : '⬇ Download for Windows';

    var stepsHtml = '';
    if (isIOS) {
      stepsHtml = '<ol class="pwa-steps"><li>Tap the <b>Share</b> icon in your browser bar</li>'
        + '<li>Scroll down and tap <b>Add to Home Screen</b></li>'
        + '<li>Tap <b>Add</b> — the app icon appears on your home screen</li></ol>';
    } else if (mobile && !deferredPrompt) {
      stepsHtml = '<ol class="pwa-steps"><li>Open your browser <b>menu</b> (⋮)</li>'
        + '<li>Tap <b>Add to Home screen</b> / <b>Install app</b></li>'
        + '<li>Confirm — the app icon appears on your home screen</li></ol>';
    }

    overlay.innerHTML = ''
      + '<div id="pwa-modal" role="dialog" aria-modal="true" aria-label="Install app">'
      + '  <div class="pwa-top">'
      + '    <img class="pwa-icon" src="' + iconSrc() + '" alt="app icon"/>'
      + '    <div>'
      + '      <h3>' + escapeHtml(appName()) + '</h3>'
      + '      <p class="pwa-dev">' + (mobile ? 'Web App' : 'Desktop App') + ' • Free</p>'
      + '      <div class="pwa-stars">' + stars + '<span>1,204 ratings</span></div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="pwa-meta">'
      + '    <div><b>4½★</b><small>Rating</small></div>'
      + '    <div class="pwa-sep"></div>'
      + '    <div><b>' + sizeTxt + '</b><small>Size</small></div>'
      + '    <div class="pwa-sep"></div>'
      + '    <div><b>' + (mobile ? '4+' : 'PC') + '</b><small>' + (mobile ? 'Age' : 'Platform') + '</small></div>'
      + '  </div>'
      + '  <p class="pwa-body">Get the full experience — your server dashboard in its own window, one tap from your '
      + (mobile ? 'home screen' : 'taskbar') + '. Faster, fullscreen, and works offline.</p>'
      + stepsHtml
      + '  <div class="pwa-bar"><i></i></div>'
      + '  <div class="pwa-prog"></div>'
      + '  <div class="pwa-actions">'
      + '    <button class="pwa-get">' + getLabel + '</button>'
      + '    <button class="pwa-later">Maybe later</button>'
      + '  </div>'
      + '  <button class="pwa-never">Don’t show this again</button>'
      + '</div>';

    document.body.appendChild(overlay);
    var modal = overlay.querySelector('#pwa-modal');

    overlay.querySelector('.pwa-later').addEventListener('click', function () { snooze(); close(overlay); });
    overlay.querySelector('.pwa-never').addEventListener('click', function () {
      try { localStorage.setItem(NEVER_KEY, '1'); } catch (e) {}
      close(overlay);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { snooze(); close(overlay); } });

    overlay.querySelector('.pwa-get').addEventListener('click', function () {
      if (deferredPrompt) {
        // Real, native install prompt (desktop Chrome/Edge, some Android).
        fakeDownload(modal, function () {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'accepted') finishInstall(modal);
            else { var ov = document.getElementById('pwa-overlay'); if (ov) close(ov); }
            deferredPrompt = null;
          });
        });
      } else if (mobile) {
        // No native prompt available → the on-screen steps guide them. Keep the
        // card open so they can follow along; scroll the steps into view.
        var steps = modal.querySelector('.pwa-steps');
        if (steps) steps.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        // Desktop without an install prompt (e.g. already installable via menu).
        fakeDownload(modal, function () { finishInstall(modal); });
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- public API: call after login ---- */
  function maybePrompt(me) {
    if (isStandalone()) return;                       // already installed
    var loggedIn = me && (me.user || me.google);
    if (!loggedIn) return;                            // only after they log in
    try {
      if (localStorage.getItem(NEVER_KEY)) return;
      var until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (until && Date.now() < until) return;        // snoozed
    } catch (e) {}
    // small delay so it lands after the dashboard settles
    setTimeout(function () { show(); }, 900);
  }

  window.PWA = { maybePrompt: maybePrompt, show: show };
})();
