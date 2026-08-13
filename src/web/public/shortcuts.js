// shortcuts.js — global keybind + gamepad/yoke engine. Reads bindings from
// localStorage and fires actions from a keyboard key OR a controller button/axis.
// The /keybinds page uses window.Shortcuts to display + rebind everything.
(function () {
  if (window.Shortcuts) return;

  const ACTIONS = [
    { id: 'dashboard', label: '📊 Open Dashboard', run: () => (location.href = '/dashboard') },
    { id: 'cmdk', label: '⌘ Command Palette', run: () => dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })) },
    { id: 'home', label: '🏠 Go Home', run: () => (location.href = '/') },
    { id: 'docs', label: '📘 Open Docs', run: () => (location.href = '/docs') },
    { id: 'commands', label: '🧩 Open Commands', run: () => (location.href = '/commands') },
    { id: 'weather', label: '🌩️ Weather Hub', run: () => (location.href = '/weather-hub') },
    { id: 'cad', label: '🚨 CAD Console', run: () => (location.href = '/cad-hub') },
    { id: 'theme', label: '🌓 Toggle Theme', run: () => document.getElementById('lp-theme')?.click() },
    { id: 'scrollUp', label: '⬆️ Scroll Up', run: () => scrollBy({ top: -450, behavior: 'smooth' }) },
    { id: 'scrollDown', label: '⬇️ Scroll Down', run: () => scrollBy({ top: 450, behavior: 'smooth' }) },
  ];
  const DEFAULT_KEYS = { dashboard: 'd', home: 'h', docs: 'g', commands: 'c', theme: 't', scrollUp: 'w', scrollDown: 's' };

  let binds = { enabled: true, keys: { ...DEFAULT_KEYS }, pad: {} };
  try { const saved = JSON.parse(localStorage.getItem('sentinel-keybinds') || 'null'); if (saved) binds = Object.assign(binds, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } }); } catch { /* defaults */ }
  const save = () => localStorage.setItem('sentinel-keybinds', JSON.stringify(binds));
  const run = (id) => { const a = ACTIONS.find((x) => x.id === id); if (a) { try { a.run(); } catch { /* ignore */ } } };

  // ---- keyboard ----
  addEventListener('keydown', (e) => {
    if (!binds.enabled) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave ⌘K etc. to their handlers
    const el = document.activeElement;
    if (el && el.matches && el.matches('input,textarea,select,[contenteditable="true"]')) return;
    const k = (e.key || '').toLowerCase();
    for (const [id, key] of Object.entries(binds.keys || {})) {
      if (key && key.toLowerCase() === k) { e.preventDefault(); run(id); break; }
    }
  });

  // ---- gamepad / yoke ----
  const prev = {};
  function padLoop() {
    if (binds.enabled) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp) continue;
        for (const [id, m] of Object.entries(binds.pad || {})) {
          if (!m) continue;
          let active = false;
          if (m.type === 'button') active = !!gp.buttons[m.index]?.pressed;
          else if (m.type === 'axis') { const v = gp.axes[m.index] || 0; active = m.dir > 0 ? v > 0.6 : v < -0.6; }
          const key = gp.index + ':' + id;
          if (active && !prev[key]) run(id);
          prev[key] = active;
        }
      }
    }
    requestAnimationFrame(padLoop);
  }
  if (navigator.getGamepads) requestAnimationFrame(padLoop);

  window.Shortcuts = { ACTIONS, DEFAULT_KEYS, get: () => binds, save, run, reset() { binds = { enabled: true, keys: { ...DEFAULT_KEYS }, pad: {} }; save(); } };
})();
