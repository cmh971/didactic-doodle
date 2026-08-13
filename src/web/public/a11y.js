/* Accessibility toolkit (WCAG 2.2 / ADA). Drop-in: <script src="/a11y.js" defer></script>
 *
 * ALWAYS-ON baseline (invisible to normal users — this is what makes the site compliant):
 *   • keyboard focus rings (:focus-visible)   • "Skip to content" link
 *   • honours the OS "reduce motion" setting   • larger click/tap targets for the widget
 *
 * OPT-IN enhancements (OFF by default, behind the ♿ button — normal users never see them
 * unless they turn them on): high contrast, big text, reduce motion, dyslexia font,
 * underline links. Preferences persist in localStorage.
 */
(function () {
  if (window.__a11yLoaded) return; window.__a11yLoaded = true;
  var KEY = 'sentinel-a11y';
  var OPTS = [
    { id: 'contrast', label: 'High contrast' },
    { id: 'xl', label: 'Bigger text' },
    { id: 'motion', label: 'Reduce motion' },
    { id: 'dys', label: 'Dyslexia-friendly font' },
    { id: 'links', label: 'Underline all links' },
  ];

  // ---- always-on baseline + opt-in classes ----
  var css = document.createElement('style');
  css.textContent = [
    ':focus-visible{outline:3px solid #37d0a0!important;outline-offset:2px!important;border-radius:3px}',
    '.a11y-skip{position:fixed;left:8px;top:-60px;z-index:100000;background:#37d0a0;color:#04121f;padding:10px 14px;border-radius:8px;font-weight:700;transition:top .15s}',
    '.a11y-skip:focus{top:8px}',
    '@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}',
    // opt-in
    'html.a11y-contrast{filter:contrast(1.35) saturate(1.15)}',
    'html.a11y-xl{zoom:1.18}',
    'html.a11y-motion *,html.a11y-motion *::before,html.a11y-motion *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
    'html.a11y-dys,html.a11y-dys *{font-family:"Comic Sans MS","Segoe UI",Verdana,sans-serif!important;letter-spacing:.03em;word-spacing:.08em;line-height:1.7!important}',
    'html.a11y-links a{text-decoration:underline!important}',
    // the widget
    '#a11y-fab{position:fixed;left:14px;bottom:14px;width:46px;height:46px;border-radius:50%;border:2px solid #37d0a0;background:#0e1c2c;color:#fff;font-size:22px;cursor:pointer;z-index:99998;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px #0006}',
    '#a11y-panel{position:fixed;left:14px;bottom:70px;width:240px;background:#0e1c2c;color:#e8f0ff;border:1px solid #37d0a0;border-radius:12px;padding:14px;z-index:99999;font-family:system-ui,sans-serif;box-shadow:0 10px 30px #0008;display:none}',
    '#a11y-panel.open{display:block}',
    '#a11y-panel h3{margin:0 0 8px;font-size:15px}',
    '#a11y-panel label{display:flex;align-items:center;gap:8px;padding:7px 4px;font-size:14px;cursor:pointer;border-radius:6px}',
    '#a11y-panel label:hover{background:#16283d}',
    '#a11y-panel input{width:18px;height:18px;accent-color:#37d0a0}',
    '#a11y-panel .reset{margin-top:8px;width:100%;padding:7px;border:none;border-radius:8px;background:#16283d;color:#9fc0e0;cursor:pointer}',
  ].join('');
  document.head.appendChild(css);

  function ready(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // Skip link → first <main>, or first heading, or body.
    var skip = document.createElement('a');
    skip.className = 'a11y-skip'; skip.textContent = 'Skip to main content';
    var main = document.querySelector('main, #main, [role="main"]') || document.querySelector('h1');
    if (main && !main.id) main.id = 'a11y-main';
    skip.href = '#' + (main ? main.id : '');
    skip.addEventListener('click', function () { if (main) { main.setAttribute('tabindex', '-1'); main.focus(); } });
    document.body.insertBefore(skip, document.body.firstChild);

    // Load saved prefs.
    var state = {};
    try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    function apply() {
      OPTS.forEach(function (o) { document.documentElement.classList.toggle('a11y-' + o.id, !!state[o.id]); });
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }
    apply();

    // Floating button.
    var fab = document.createElement('button');
    fab.id = 'a11y-fab'; fab.textContent = '♿';
    fab.setAttribute('aria-label', 'Accessibility options');
    fab.setAttribute('aria-expanded', 'false');
    document.body.appendChild(fab);

    // Panel.
    var panel = document.createElement('div');
    panel.id = 'a11y-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Accessibility options');
    panel.innerHTML = '<h3>♿ Accessibility</h3>' + OPTS.map(function (o) {
      return '<label><input type="checkbox" data-opt="' + o.id + '"' + (state[o.id] ? ' checked' : '') + '> ' + o.label + '</label>';
    }).join('') + '<button class="reset">Reset all</button>';
    document.body.appendChild(panel);

    function togglePanel(open) { panel.classList.toggle('open', open); fab.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('input').focus(); }
    fab.addEventListener('click', function () { togglePanel(!panel.classList.contains('open')); });
    panel.addEventListener('change', function (e) { var id = e.target.getAttribute('data-opt'); if (id) { state[id] = e.target.checked; apply(); } });
    panel.querySelector('.reset').addEventListener('click', function () { state = {}; apply(); panel.querySelectorAll('input').forEach(function (i) { i.checked = false; }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') togglePanel(false); });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== fab && panel.classList.contains('open')) togglePanel(false); });
  });
})();
